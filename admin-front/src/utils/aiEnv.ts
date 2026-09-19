/**
 * 前端环境变量校验（需求 3）
 *
 * 背景：AI 后端地址写错时，前端不会有任何提示，直到用户真正发送消息，
 * 才以 net::ERR_CONNECTION_REFUSED 的形式暴露在控制台里，排查成本很高。
 *
 * 本模块在应用启动时就校验地址配置，把「配置错误」和「后端没启动」
 * 这两类问题在用户提问之前区分开：
 * - 配置错误 → 启动即报错，给出具体该改哪个文件、改成什么
 * - 后端没启动 → 由健康检查（src/API/ai-chat 的 checkAiHealth）负责提示
 *
 * 纯函数与读取 import.meta.env 的包装分开，纯函数部分可直接单测。
 */

/** AI 后端（admin-ai-backend，Node/Express）默认地址 */
export const DEFAULT_AI_BASE_URL = "http://localhost:3000";

/** mock 后端（admin-mock-backend，Node/Express）默认地址 */
export const DEFAULT_MOCK_BASE_URL = "http://localhost:3001/api";

/** admin-ai-backend 固定监听端口，写成别的端口必然连不上 */
export const AI_BACKEND_EXPECTED_PORT = "3000";

/**
 * 历史遗留端口：项目早期按 Python 方案规划过 uvicorn，
 * 但当前 AI 后端是 Node/Express 服务，8000 端口没有任何进程监听。
 * 这里单独识别，是为了让这个已经踩过的坑不要再踩第二次。
 */
export const LEGACY_PYTHON_PORT = "8000";

export type EnvIssueLevel = "error" | "warn";

export interface EnvIssue {
  level: EnvIssueLevel;
  /** 出问题的环境变量名 */
  key: string;
  /** 面向开发者的中文说明，需包含「错在哪」与「怎么改」 */
  message: string;
}

export interface BaseUrlResolution {
  /** 最终使用的地址（已归一化；非法配置会回退到 fallback） */
  url: string;
  issues: EnvIssue[];
  /** 是否成功用上了环境变量里配置的值 */
  fromEnv: boolean;
}

export interface EnvReport {
  /** 无 error 级问题时为 true（warn 不阻塞启动） */
  ok: boolean;
  aiBaseUrl: string;
  mockBaseUrl: string;
  issues: EnvIssue[];
}

/**
 * 归一化地址：去掉首尾空格与末尾斜杠。
 * 末尾斜杠会让 `${base}/chat` 拼出双斜杠，部分网关会把 //chat 当成独立路径而 404。
 * @param raw 原始配置值
 * @returns 归一化后的地址
 */
export function normalizeBaseUrl( raw?: string | null ): string
{
  return String( raw ?? "" ).trim().replace( /\/+$/, "" );
}

/**
 * 校验单个 baseURL 配置项。
 * @param key 环境变量名，用于报错提示
 * @param rawValue 环境变量原始值
 * @param fallback 非法 / 缺省时使用的兜底地址
 * @returns 解析结果与问题清单
 */
export function validateBaseUrl( key: string, rawValue: string | undefined, fallback: string ): BaseUrlResolution
{
  const issues: EnvIssue[] = [];
  const normalized = normalizeBaseUrl( rawValue );

  // 未配置：不算错误，回退默认值即可，但必须提示，否则「改了 .env 不生效」会被误判成代码 bug
  if ( !normalized )
  {
    issues.push( {
      level: "warn",
      key,
      message: `${ key } 未配置，已回退到默认地址 ${ fallback }。如需指定请在 .env.development 中配置。`,
    } );
    return { url: fallback, issues, fromEnv: false };
  }

  let parsed: URL;
  try
  {
    parsed = new URL( normalized );
  } catch
  {
    issues.push( {
      level: "error",
      key,
      message: `${ key }="${ normalized }" 不是合法的 URL，已回退到 ${ fallback }。正确格式示例：${ fallback }`,
    } );
    return { url: fallback, issues, fromEnv: false };
  }

  // 协议必须是 http/https：file: / ws: 之类的协议 axios 无法正常发起请求。
  // 注意：http/https 下主机名为空时 URL 构造本身就会抛错，已在上面被捕获，
  // 因此这里不需要再单独判空 hostname
  if ( parsed.protocol !== "http:" && parsed.protocol !== "https:" )
  {
    issues.push( {
      level: "error",
      key,
      message: `${ key } 只支持 http/https 协议，当前为 ${ parsed.protocol }，已回退到 ${ fallback }`,
    } );
    return { url: fallback, issues, fromEnv: false };
  }

  // 是否为 AI 后端地址：部分校验规则只对 AI 后端成立
  const isAiBackend = key === "VITE_AI_API_BASE_URL";

  // 常见误配：沿用 Python 方案的 8000 端口。
  // 与其他错误分支保持一致地回退到 fallback —— 既然已判定该地址必然连不上，
  // 就不能再让运行时继续拿着它发请求，否则「报表说错、实际照用」两头对不上
  if ( isAiBackend && parsed.port === LEGACY_PYTHON_PORT )
  {
    issues.push( {
      level: "error",
      key,
      message:
        `${ key } 指向 ${ LEGACY_PYTHON_PORT } 端口，但 admin-ai-backend 是 Node/Express 项目，` +
        `没有 uvicorn，也不会监听 ${ LEGACY_PYTHON_PORT }。已回退到 ${ fallback }，` +
        `请把 .env.development 中的 ${ key } 改为 http://localhost:${ AI_BACKEND_EXPECTED_PORT }`,
    } );
    return { url: fallback, issues, fromEnv: false };
  }

  if ( isAiBackend && parsed.port && parsed.port !== AI_BACKEND_EXPECTED_PORT )
  {
    issues.push( {
      level: "warn",
      key,
      message: `${ key } 端口为 ${ parsed.port }，而 admin-ai-backend 默认监听 ${ AI_BACKEND_EXPECTED_PORT }，请确认是否改过后端端口`,
    } );
  }

  // 未显式写端口时，浏览器会打到 80/443，和本地开发后端几乎必然连不上
  if ( !parsed.port )
  {
    issues.push( {
      level: "warn",
      key,
      message: `${ key }="${ normalized }" 未显式指定端口，将请求默认端口(80/443)，请确认目标服务确实监听该端口`,
    } );
  }

  // AI 后端所有接口都挂在根路径下（/chat、/new、/health 等），
  // baseURL 带上路径前缀会拼成 /api/chat 这类不存在的地址。
  // 只对 AI 后端校验：mock 后端的 VITE_API_BASE_URL 合法值本身就带 /api 前缀
  const pathname = parsed.pathname.replace( /\/+$/, "" );
  if ( isAiBackend && pathname )
  {
    issues.push( {
      level: "warn",
      key,
      message: `${ key } 带有路径前缀 "${ pathname }"，AI 后端接口位于根路径，拼接后可能得到不存在的地址`,
    } );
  }

  return { url: normalized, issues, fromEnv: true };
}

/** 缓存校验结果，避免每次调用都重复解析与打印日志 */
let cachedReport: EnvReport | null = null;

/**
 * 读取并校验全部前端环境变量。
 * 结果做缓存：启动时校验一次即可，后续调用直接复用。
 * @param force 为 true 时忽略缓存重新校验（供单测与运行时重载使用）
 * @returns 校验报告
 */
export function getEnvReport( force = false ): EnvReport
{
  if ( cachedReport && !force )
  {
    return cachedReport;
  }

  const env = import.meta.env || ( {} as ImportMetaEnv );

  const ai = validateBaseUrl( "VITE_AI_API_BASE_URL", env.VITE_AI_API_BASE_URL, DEFAULT_AI_BASE_URL );
  const mock = validateBaseUrl( "VITE_API_BASE_URL", env.VITE_API_BASE_URL, DEFAULT_MOCK_BASE_URL );

  const issues = [ ...ai.issues, ...mock.issues ];

  cachedReport = {
    ok: !issues.some( issue => issue.level === "error" ),
    aiBaseUrl: ai.url,
    mockBaseUrl: mock.url,
    issues,
  };

  return cachedReport;
}

/**
 * 启动时执行校验并把结论打到控制台。
 * 无论成败都输出当前生效地址，方便一眼确认「前端到底在连哪个后端」。
 * @returns 校验报告
 */
export function runEnvValidation(): EnvReport
{
  const report = getEnvReport( true );
  const errors = report.issues.filter( issue => issue.level === "error" );
  const warns = report.issues.filter( issue => issue.level === "warn" );

  const title = report.ok
    ? "[环境变量校验] 通过"
    : `[环境变量校验] 发现 ${ errors.length } 个错误，${ warns.length } 个警告`;

  // 用 collapsed 分组，避免把启动日志刷屏
  console.groupCollapsed( title );
  console.log( "AI 后端地址:", report.aiBaseUrl );
  console.log( "Mock 后端地址:", report.mockBaseUrl );
  console.log( "原始配置:", {
    VITE_AI_API_BASE_URL: import.meta.env?.VITE_AI_API_BASE_URL,
    VITE_API_BASE_URL: import.meta.env?.VITE_API_BASE_URL,
  } );
  errors.forEach( issue => console.error( `[配置错误] ${ issue.key }: ${ issue.message }` ) );
  warns.forEach( issue => console.warn( `[配置警告] ${ issue.key }: ${ issue.message }` ) );
  if ( report.ok )
  {
    console.log( "未发现配置错误" );
  }
  console.groupEnd();

  return report;
}
