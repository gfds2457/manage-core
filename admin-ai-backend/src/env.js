/**
 * 统一配置中心
 *
 * 职责：
 * 1. 从 src/.env 读取全部配置（大模型、Embedding 模型、LanceDB、RAG 参数）
 * 2. 解析结果为普通对象，供全项目引用，杜绝业务代码内硬编码模型名 / 维度 / 路径
 * 3. 启动即校验必填项，缺失或非法直接抛出带明确提示的错误
 *
 * 优先级：process.env > src/.env（便于 CI / 容器覆盖）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 项目根目录（admin-ai-backend），相对路径配置均以此为基准 */
export const ROOT_DIR = path.resolve(__dirname, "..");

/** .env 文件绝对路径 */
export const ENV_FILE = path.join(__dirname, ".env");

/** 配置类错误：区分「配置没写对」与「运行时故障」，便于上层给出友好提示 */
export class ConfigError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ConfigError";
    this.details = details;
  }
}

/**
 * 解析 .env 文本为键值对象。
 * 支持：注释、空行、export 前缀、单/双引号包裹的值、值内的 # 号。
 * @param {string} content .env 文件内容
 * @returns {Record<string, string>}
 */
export function parseEnvContent(content) {
  const result = {};
  if (typeof content !== "string") return result;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    // 跳过空行与整行注释
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).replace(/^export\s+/, "").trim();
    if (!key) continue;

    const value = line.slice(eqIndex + 1).trim();

    // 引号值优先：先定位收尾引号，引号内的 # 属于值本身而不是注释。
    // 顺序不能反 —— 若先按 " #" 截断，`KEY="v # not comment"` 会被砍成 `"v`，
    // 既丢了内容又因为末字符不再是引号而带着前引号入库。
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2) {
      // 取「后面只跟行尾注释」的那个引号，而不是最后一个同类引号：
      // 注释文本里出现同类引号时（如 `KEY='abc' # 别用 'dev' 的 key`），
      // lastIndexOf 会被注释里的引号带偏，把注释整段并进值里
      let closingIndex = -1;
      for (let i = 1; i < value.length; i += 1) {
        if (value[i] !== quote) continue;
        const rest = value.slice(i + 1).trim();
        if (rest === "" || rest.startsWith("#")) {
          closingIndex = i;
          break;
        }
      }
      if (closingIndex > 0) {
        // 收尾引号之后只允许跟行尾注释：`KEY="v" # 说明`
        const rest = value.slice(closingIndex + 1).trim();
        if (rest === "" || rest.startsWith("#")) {
          result[key] = value.slice(1, closingIndex);
          continue;
        }
        // 收尾引号后面还有别的内容，说明引号并不成对包裹整个值，
        // 按未加引号的值继续处理
      }
    }

    // 未加引号：把「空格 + #」视作行尾注释起点，
    // 只认「空格 + #」是为了不误伤值里自带的 #（如密码、URL 锚点）
    let unquoted = value;
    const hashIndex = unquoted.indexOf(" #");
    if (hashIndex !== -1) unquoted = unquoted.slice(0, hashIndex).trim();

    // 兜底：`KEY="abc" # 说明` 之外，仍可能遇到首尾成对引号未走上面分支的情况
    if (
      (unquoted.startsWith('"') && unquoted.endsWith('"') && unquoted.length >= 2) ||
      (unquoted.startsWith("'") && unquoted.endsWith("'") && unquoted.length >= 2)
    ) {
      unquoted = unquoted.slice(1, -1);
    }
    result[key] = unquoted;
  }
  return result;
}

/**
 * 读取 .env 文件；文件不存在时返回空对象（交由校验环节报错）
 * @param {string} [filePath]
 * @returns {Record<string, string>}
 */
export function loadEnvFile(filePath = ENV_FILE) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return parseEnvContent(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    throw new ConfigError(`读取配置文件失败: ${filePath}`, [err.message]);
  }
}

const fileVars = loadEnvFile();
/**
 * 合并后的原始配置来源。
 *
 * 过滤掉值为空串的 process.env：容器编排里常见的
 * `environment: - RAG_TOP_K=${RAG_TOP_K}`（变量未设置时展开成空串）
 * 会以「空串」覆盖 src/.env 里的有效值，随后 getRaw 又把空串判为缺失、
 * 回落到内置默认值 —— 配置写了却静默不生效。只有真正没声明过才算「未设置」。
 */
const processVars = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ""),
);
const merged = { ...fileVars, ...processVars };

/**
 * 取配置项原始字符串
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string|undefined}
 */
export function getRaw(key, fallback) {
  const value = merged[key];
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed === "" ? fallback : trimmed;
}

/** 必填项缺失时抛出明确提示 */
function requireValue(key) {
  const value = getRaw(key);
  if (value === undefined) {
    // 修复指引同时写进 message：details 目前没有任何消费方
    // （bootstrap.js / index.js 都只打印 err.message），
    // 只放在 details 里等于没提示，用户看不到「该去哪个文件补哪一行」
    const hint = `请在 ${ENV_FILE} 中补充 ${key}=<值>`;
    throw new ConfigError(`缺少必填配置项 ${key}，${hint}`, [hint]);
  }
  return value;
}

/** 读取整数配置，非法值直接报错 */
function intValue(key, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = getRaw(key);
  if (raw === undefined) {
    // 复用 requireValue：同样是「必填项缺失」，报错形态要与
    // OPENAI_API_KEY 等处一致，否则读取指引就只剩部分配置能拿到。
    // 不加 Number() 包裹 —— requireValue 在缺失时必然抛出，返回值永远取不到
    if (fallback === undefined) return requireValue(key);
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new ConfigError(`配置项 ${key} 必须为整数，当前值: ${raw}`);
  }
  if (parsed < min || parsed > max) {
    throw new ConfigError(
      `配置项 ${key} 超出允许范围 [${min}, ${max}]，当前值: ${parsed}`,
    );
  }
  return parsed;
}

/** 读取浮点配置 */
function floatValue(key, fallback, { min = -Infinity, max = Infinity } = {}) {
  const raw = getRaw(key);
  if (raw === undefined) {
    // 与 intValue 保持一致：必填项缺失时走 requireValue，
    // 这样修复指引对整数键和浮点键都拿得到（requireValue 必然抛出，无需 Number 包裹）
    if (fallback === undefined) return requireValue(key);
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`配置项 ${key} 必须为数字，当前值: ${raw}`);
  }
  if (parsed < min || parsed > max) {
    throw new ConfigError(
      `配置项 ${key} 超出允许范围 [${min}, ${max}]，当前值: ${parsed}`,
    );
  }
  return parsed;
}

/** 读取布尔配置：true/false/1/0/yes/no */
function boolValue(key, fallback) {
  const raw = getRaw(key);
  if (raw === undefined) return fallback;
  const normalized = raw.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new ConfigError(`配置项 ${key} 必须为布尔值(true/false)，当前值: ${raw}`);
}

// ------------------------------------------------------------------ 服务端口
/**
 * HTTP 监听端口。
 * 前端 .env 里的 VITE_AI_API_BASE_URL 必须与这里一致，否则页面加载时
 * 健康检查就报 net::ERR_CONNECTION_REFUSED。放在配置中心是为了让
 * 「实际监听的端口」与「健康检查对外汇报的端口」只有一个来源。
 */
export const port = intValue("PORT", 3000, { min: 1, max: 65535 });

// ---------------------------------------------------------------- 大模型配置
export const apiKey = requireValue("OPENAI_API_KEY");
export const baseURL = requireValue("OPENAI_API_BASE_URL");
export const modelName = requireValue("OPENAI_API_MODEL_NAME");

// ------------------------------------------------------------ 图片生成模型配置
// 注意：下面两个默认值是针对当前接入的网关（阿里云百炼 wan 系列）的，
// 换网关时必须显式配置 IMAGE_MODEL_NAME / IMAGE_GENERATE_PATH，
// 否则会静默请求到旧网关上，只看到一段难以定位的网关报错。
// 两个键的启动期校验见 validateConfig()，.env.example 中也有说明。
export const imageBaseURL = getRaw("IMAGE_API_BASE_URL", baseURL);
export const imageModelName = getRaw("IMAGE_MODEL_NAME", "qwen-image-3.0");
/** 图片生成接口路径：不同网关路径不同，放在配置里避免换网关时改业务代码 */
export const imageGeneratePath = getRaw(
  "IMAGE_GENERATE_PATH",
  "/services/aigc/multimodal-generation/generation",
);
/** 图片生成的输出尺寸 / 张数 / 水印 / 思考模式，逐项可配，避免调参数还要改业务代码 */
export const imageSize = getRaw("IMAGE_SIZE", "2K");
export const imageCount = intValue("IMAGE_N", 1, { min: 1, max: 4 });
export const imageWatermark = boolValue("IMAGE_WATERMARK", false);
export const imageThinkingMode = boolValue("IMAGE_THINKING_MODE", true);

// ------------------------------------------------------------- Embedding 配置
export const embeddingModel = requireValue("EMBEDDING_MODEL");
export const embeddingDimensions = intValue("EMBEDDING_DIMENSIONS", undefined, {
  min: 1,
});

// ---------------------------------------------------------------- 向量库配置
/** LanceDB 存储目录（统一解析为绝对路径） */
const lanceDbPathRaw = getRaw("LANCEDB_PATH", "./src/data/lancedb");
export const lanceDbPath = path.isAbsolute(lanceDbPathRaw)
  ? lanceDbPathRaw
  : path.resolve(ROOT_DIR, lanceDbPathRaw);
export const lanceTable = getRaw("LANCEDB_TABLE", "knowledge_chunks");

// ---------------------------------------------------------------- RAG 参数
export const ragTopK = intValue("RAG_TOP_K", 5, { min: 1, max: 100 });
export const ragScoreThreshold = floatValue("RAG_SCORE_THRESHOLD", 0.35, {
  min: -1,
  max: 1,
});
export const ragChunkSize = intValue("RAG_CHUNK_SIZE", 200, { min: 10 });
export const ragChunkOverlap = intValue("RAG_CHUNK_OVERLAP", 40, { min: 0 });
export const ragEmbedBatchSize = intValue("RAG_EMBED_BATCH_SIZE", 10, { min: 1 });
export const ragTimeoutMs = intValue("RAG_TIMEOUT_MS", 30000, { min: 1000 });
export const ragQueryRewrite = boolValue("RAG_QUERY_REWRITE", true);
export const ragRetryTimes = intValue("RAG_RETRY_TIMES", 2, { min: 0, max: 5 });
export const ragRetryDelayMs = intValue("RAG_RETRY_DELAY_MS", 500, { min: 0 });

// ------------------------------------------------------------ 知识库接口鉴权
export const kbSyncToken = getRaw("KB_SYNC_TOKEN", "");
export const kbMaxChunksPerDoc = intValue("KB_MAX_CHUNKS_PER_DOC", 20, { min: 1 });
/** 后台增量更新队列上限，超出后接口返回 503 由业务侧重试 */
export const kbQueueMaxSize = intValue("KB_QUEUE_MAX_SIZE", 1000, { min: 1 });

// --------------------------------------------------------------- 文档目录
// 目录名支持用配置覆盖：本模块定位是「路径的唯一来源」，
// 若写死在这里，换部署布局就只能改源码重新发版。
// 相对路径以项目根目录为基准，绝对路径原样使用。
const docDirRaw = getRaw("DOC_DIR", "doc");
export const docDir = path.isAbsolute(docDirRaw)
  ? docDirRaw
  : path.resolve(ROOT_DIR, docDirRaw);
const contextDirRaw = getRaw("CONTEXT_DIR", "context");
export const contextDir = path.isAbsolute(contextDirRaw)
  ? contextDirRaw
  : path.resolve(ROOT_DIR, contextDirRaw);

/**
 * 启动期配置自检。
 *
 * 说明：必填项缺失时，本模块在「导入阶段」的 requireValue() 就会抛出清晰错误，
 * 因此这里不再重复校验必填项——那种检查永远不可达（模块都加载不进来）。
 * 这里只校验「跨字段的一致性约束」：单个字段各自合法、但组合起来非法的情况，
 * 以及需要额外语义校验的项。
 *
 * @param {{ silent?: boolean }} [options]
 * @returns {{ ok: true, errors: [], warnings: string[] }}
 */
export function validateConfig(options = {}) {
  const errors = [];
  const warnings = [];

  // 单字段范围在 intValue/floatValue 里已保证，这里只做跨字段与语义校验
  const checks = [
    {
      key: "OPENAI_API_BASE_URL",
      value: baseURL,
      test: (v) => /^https?:\/\//.test(v),
      hint: "必须是以 http(s):// 开头的完整地址",
    },
    {
      key: "IMAGE_API_BASE_URL",
      value: imageBaseURL,
      test: (v) => /^https?:\/\//.test(v),
      hint: "必须是以 http(s):// 开头的完整地址",
    },
    {
      key: "IMAGE_GENERATE_PATH",
      value: imageGeneratePath,
      test: (v) => v.startsWith("/"),
      hint: "必须是以 / 开头的绝对路径，否则会把网关地址的末段路径吃掉",
    },
    {
      key: "RAG_CHUNK_OVERLAP",
      value: ragChunkOverlap,
      test: (v) => v < ragChunkSize,
      hint: `切块重叠长度必须小于切块长度(RAG_CHUNK_SIZE=${ragChunkSize})`,
    },
    {
      key: "EMBEDDING_DIMENSIONS",
      value: embeddingDimensions,
      // 下限与整数性已由 intValue(min:1) 保证，这里只做可达的上限校验
      test: (v) => v <= 8192,
      hint: "向量维度不得超过 8192，且需与向量库表结构一致",
    },
  ];

  for (const check of checks) {
    if (!check.test(check.value)) {
      errors.push(`[${check.key}] ${check.hint}，当前值: ${check.value}`);
    }
  }

  // 图片生成的模型名与接口路径带有「只对当前网关有效」的默认值：
  // 换网关时若只改了 IMAGE_API_BASE_URL，请求会静默打到旧网关上，
  // 表现为一段看不懂的网关报错。这里把它显式暴露出来，不阻断启动。
  const imageDefaultsInUse = [];
  if (getRaw("IMAGE_MODEL_NAME") === undefined) imageDefaultsInUse.push("IMAGE_MODEL_NAME");
  if (getRaw("IMAGE_GENERATE_PATH") === undefined) imageDefaultsInUse.push("IMAGE_GENERATE_PATH");
  if (imageDefaultsInUse.length > 0) {
    warnings.push(
      `[${imageDefaultsInUse.join(", ")}] 未配置，正在使用仅适用于当前接入网关的默认值` +
      `（imageModelName=${imageModelName}）。更换图片生成网关时请一并配置，` +
      `否则请求会静默发往旧网关。`,
    );
  }

  // 写接口无鉴权是高风险配置：仅告警不阻断，便于本地开发，但必须显式可见
  if (!kbSyncToken) {
    warnings.push(
      `[KB_SYNC_TOKEN] 未配置，/kb/* 写接口将处于无鉴权状态；` +
      `非本地开发环境务必在 ${ENV_FILE} 中设置该令牌`,
    );
  }

  if (errors.length > 0) {
    const message = `配置校验未通过，请检查 ${ENV_FILE}:\n  - ${errors.join("\n  - ")}`;
    throw new ConfigError(message, errors);
  }

  if (!options.silent) {
    console.log(
      `[config] 校验通过 | 对话模型: ${modelName} | Embedding: ${embeddingModel}(${embeddingDimensions}维) | 向量库: ${lanceTable}`,
    );
    for (const warning of warnings) console.warn(`[config] 注意: ${warning}`);
  }
  return { ok: true, errors: [], warnings };
}

/** 导出配置快照，便于日志排查（隐藏敏感字段） */
export function getConfigSummary() {
  return {
    port,
    baseURL,
    modelName,
    imageModelName,
    embeddingModel,
    embeddingDimensions,
    lanceDbPath,
    lanceTable,
    ragTopK,
    ragScoreThreshold,
    ragChunkSize,
    ragChunkOverlap,
    ragQueryRewrite,
    kbSyncEnabled: Boolean(kbSyncToken),
  };
}

export default {
  port,
  apiKey,
  baseURL,
  modelName,
  imageBaseURL,
  imageModelName,
  imageGeneratePath,
  imageSize,
  imageCount,
  imageWatermark,
  imageThinkingMode,
  docDir,
  contextDir,
  embeddingModel,
  embeddingDimensions,
  lanceDbPath,
  lanceTable,
  ragTopK,
  ragScoreThreshold,
  ragChunkSize,
  ragChunkOverlap,
  ragEmbedBatchSize,
  ragTimeoutMs,
  ragQueryRewrite,
  ragRetryTimes,
  ragRetryDelayMs,
  kbSyncToken,
  kbMaxChunksPerDoc,
  kbQueueMaxSize,
  validateConfig,
  getConfigSummary,
};
