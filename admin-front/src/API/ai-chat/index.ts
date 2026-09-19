import axios from "axios";
import { fetchEventSource } from "@Microsoft/fetch-event-source";
import { getEnvReport } from "@/utils/aiEnv";
import { AiBusinessError, classifyAiError } from "@/utils/aiError";
import type { AiErrorInfo } from "@/utils/aiError";

/**
 * AI 对话接口层
 *
 * 直连独立项目 admin-ai-backend（Node/Express + MySQL + 大模型，端口 3000）。
 * 地址来自 VITE_AI_API_BASE_URL，启动时已由 src/utils/aiEnv.ts 校验过合法性。
 *
 * 本文件额外承担三件事，避免调用方各自实现导致行为不一致：
 * 1. 统一超时（需求 6）
 * 2. 统一取消：同一时刻只允许一条流式长连接（需求 6）
 * 3. 统一错误分类：网络故障 / 业务报错分开处理（需求 5）
 */

/** 地址取值统一走环境变量校验模块，保证与实际请求的地址完全一致 */
const AI_BASE_URL = getEnvReport().aiBaseUrl;

/** 普通接口超时：/title、/userFeature 会触发大模型，耗时较长，留足 60s */
const AI_REQUEST_TIMEOUT_MS = 60_000;

/** 流式连接的空闲超时：超过该时长没有收到任何数据，判定连接已卡死 */
const AI_STREAM_IDLE_TIMEOUT_MS = 60_000;

/** 流式连接的硬上限：防止极端情况下连接长期挂起，把页面拖卡 */
const AI_STREAM_MAX_DURATION_MS = 5 * 60_000;

/** 健康检查超时：预检测必须够快，不能让页面等它 */
const AI_HEALTH_TIMEOUT_MS = 5_000;

/** 导出当前生效的后端地址，供界面与日志展示，方便一眼确认连的是哪个后端 */
export const AI_API_BASE_URL = AI_BASE_URL;

/**
 * 演示阶段用的兜底用户 ID。
 *
 * 正常流程下取的是登录用户的 id（见 utils/aiUserId.getAiChatUserId），
 * 只有拿不到登录态时才退回这个常量，避免所有账号共用同一份会话历史。
 */
export const AI_CHAT_USER_ID = "001";

/** 数据源选项结构：value 随 /chat 请求下发，label 用于界面展示 */
export interface AiDatasourceOption
{
  value: string;
  label: string;
}

/**
 * 数据源选项。
 * 当前后端的检索链路固定挂在配置的 MySQL 库上（见 admin-ai-backend/src/.env），
 * 尚未提供「多数据源列表」接口，因此这里下发唯一选项作为占位，
 * 保证界面结构与设计稿一致；后端支持多库后只需把本常量换成接口返回值。
 */
export const AI_DATASOURCE: AiDatasourceOption = {
  value: "shop_db",
  label: "shop_db · MySQL",
};

/**
 * 图片生成模型标识。
 * 该值必须与 admin-ai-backend 的 IMAGE_MODEL_NAME 一致：
 * 后端在 main() 里按 `model === imageModelName` 分流，
 * 命中时走图片生成网关并回推 imageUrl，而不是文生文链路。
 */
export const AI_IMAGE_MODEL_VALUE = "qwen-image-3.0";

/**
 * 可选模型列表。
 * value 是传给后端 /chat 的 model 字段，label 是界面展示名。
 */
export const AI_MODEL_OPTIONS: AiDatasourceOption[] = [
  { value: "qwen3.7-plus", label: "qwen3.7-plus" },
  { value: AI_IMAGE_MODEL_VALUE, label: "qwen-image-3.0" },
];

/**
 * 判断某个模型是否走图片生成链路。
 * 界面文案（如「图片生成中」）与后续分叉逻辑都以此为准，
 * 避免各处各写一份字符串比较，后端换模型名时只需改常量。
 * @param model 当前选中的模型标识
 * @returns 是否图片生成模型
 */
export function isImageModel ( model?: string ): boolean
{
  return model === AI_IMAGE_MODEL_VALUE;
}

const ask = axios.create( {
  baseURL: AI_BASE_URL,
  timeout: AI_REQUEST_TIMEOUT_MS,
} );

// 业务失败体（HTTP 200 但 success=false）统一转成异常抛出。
// 否则调用方会拿到一个「看起来成功」的响应继续往下走，
// 问题被推迟到更靠后的位置才暴露，定位成本更高。
ask.interceptors.response.use(
  ( response ) =>
  {
    const body = response.data;
    if ( body && typeof body === "object" && "success" in body && body.success === false )
    {
      throw new AiBusinessError( body.message || body.error || "接口返回失败", {
        code: body.code,
        status: response.status,
      } );
    }
    return response;
  },
  ( error ) =>
  {
    // 这里只做透传，不弹提示也不吞异常：
    // 分类、日志、弹窗统一由调用方通过 classifyAiError / logAiError 处理，
    // 保证同一次失败只产生一条日志和一次提示
    return Promise.reject( error );
  }
);

/**
 * 健康检查结果
 */
export interface AiHealthResult
{
  /** 后端服务是否在线（HTTP 能通即为在线） */
  online: boolean;
  /** 后端返回的 status 字段：ok / degraded */
  status: string;
  /** 面向用户的提示文案 */
  message: string;
  /** 技术细节，输出到控制台 */
  detail: string;
  /** 探测耗时，毫秒 */
  latencyMs: number;
  /** 后端各依赖的状态，在线时才有值 */
  dependencies?: Record<string, { status: string;[ key: string ]: unknown }>;
}

/**
 * 后端健康检测（需求 4）。
 * 页面加载时预检测后端是否在线，把「服务没起来」提前告诉用户，
 * 而不是等用户输完问题点了发送才报 ERR_CONNECTION_REFUSED。
 *
 * 本函数不抛异常：无论成功失败都返回结构化结果，调用方按 online 分支处理即可。
 * @returns 健康检查结果
 */
export async function checkAiHealth (): Promise<AiHealthResult>
{
  const startedAt = Date.now();

  // 使用独立的 axios 实例，避免复用 ask 的业务错误拦截器：
  // 健康检查的失败是预期内的分支，不应该走异常通道
  try
  {
    const response = await axios.get( `${ AI_BASE_URL }/health`, {
      timeout: AI_HEALTH_TIMEOUT_MS,
    } );
    const latencyMs = Date.now() - startedAt;
    const body = response.data || {};

    const dependencies = body.dependencies || undefined;
    const degraded = body.status === "degraded";

    // 找出具体是哪个依赖挂了，方便排查时直接定位
    const brokenDeps = Object.entries( dependencies || {} )
      .filter( ( [ , value ]: [ string, any ] ) => value?.status !== "up" )
      .map( ( [ name, value ]: [ string, any ] ) => `${ name }(${ value?.message || "不可用" })` );

    return {
      online: true,
      status: body.status || "ok",
      message: degraded
        ? `AI 后端已启动，但部分能力降级：${ brokenDeps.join( "、" ) || "依赖异常" }`
        : "AI 后端连接正常",
      detail: `GET ${ AI_BASE_URL }/health 返回 ${ response.status }，耗时 ${ latencyMs }ms，body=${ JSON.stringify( body )?.slice( 0, 500 ) }`,
      latencyMs,
      dependencies,
    };
  } catch ( err )
  {
    const latencyMs = Date.now() - startedAt;
    const info = classifyAiError( err, "AI 后端健康检测" );

    return {
      online: false,
      status: "offline",
      message:
        info.type === "network"
          ? `无法连接到 AI 后端 ${ AI_BASE_URL }，请确认后端服务已启动`
          : info.friendly,
      detail: `${ info.detail }（目标地址：${ AI_BASE_URL }/health，耗时 ${ latencyMs }ms）`,
      latencyMs,
    };
  }
}

/** 流式对话的回调与参数 */
export interface ChatStreamOptions
{
  keyword: string;
  userId: string;
  convertId: string;
  /**
   * 每收到一段流式数据触发一次。
   * data 用 any：后端在同一条 SSE 连接上混推四种不同结构的数据
   * （OpenAI 风格的 choices/delta、工具卡片、生成图片 imageUrl、检索来源 rag_sources），
   * 没有统一的判别字段可以收敛成联合类型，收到的只是 JSON.parse 的结果，
   * 由调用方按各自分支判断。禁止在这里做隐式类型断言。
   */
  onMessage: ( data: any ) => void;
  /**
   * 长连接建立成功（收到响应头）后触发。
   * 这是「消息已经成功送达后端」的最早确定信号：后端在写响应头之前就已把
   * 这条用户消息落库，因此它也是发起标题生成请求的合适时机。
   */
  onOpen?: () => void;
  /** 整条长连接正常结束后触发 */
  onComplete: () => void;
  /** 请求失败时触发，入参已是分类好的错误信息，可直接弹提示 */
  onError?: ( info: AiErrorInfo, rawError: unknown ) => void;
  userFeature?: string;
  model?: string;
  /** 数据源标识，随请求下发给后端，便于后续按库检索 */
  datasource?: string;
  files?: string[];
}

/**
 * 超时中断标记。
 * 通过 AbortController 的 reason 传递给中止回调，
 * 用于区分「超时」与「用户主动取消」这两种都需要中止连接、但提示完全不同的情况。
 */
const ABORT_REASON_TIMEOUT = "timeout";

/**
 * 构造一个能被 classifyAiError 判定为「超时」的错误。
 * @param message 技术描述
 * @returns 带超时标记的错误
 */
function createTimeoutError ( message: string ): Error
{
  const error = new Error( message );
  error.name = "TimeoutError";
  ( error as Error & { code?: string } ).code = "ECONNABORTED";
  return error;
}

/**
 * 构造一个能被 classifyAiError 判定为「主动取消」的错误。
 * @param reason 取消原因
 * @returns 带取消标记的错误
 */
function createCanceledError ( reason: string ): Error
{
  const error = new Error( reason || "请求已取消" );
  error.name = "CanceledError";
  ( error as Error & { code?: string } ).code = "ERR_CANCELED";
  return error;
}

/** 当前进行中的流式请求控制器：同一时刻最多一条长连接 */
let activeStreamController: AbortController | null = null;

/**
 * 判断当前是否有流式请求进行中。
 * 调用方据此禁用发送按钮，从源头阻止重复提交（需求 6）。
 * @returns 是否正在流式接收
 */
export function isChatStreaming (): boolean
{
  return activeStreamController !== null;
}

/**
 * 取消当前进行中的流式请求。
 * @param reason 取消原因，仅用于日志
 * @returns 是否确实取消了某个请求
 */
export function cancelChatStream ( reason = "主动取消" ): boolean
{
  if ( !activeStreamController )
  {
    return false;
  }
  // 排障用日志，只在开发环境输出
  if ( import.meta.env.DEV )
  {
    console.log( `[AI 对话] 取消流式请求：${ reason }` );
  }
  activeStreamController.abort( reason );
  activeStreamController = null;
  return true;
}

/**
 * 流式获取聊天记录（SSE）
 *
 * 相比直接调用 fetchEventSource，这里补齐了三层保护：
 * 1. 空闲超时：长时间收不到数据自动断开，避免连接假死让页面一直转圈
 * 2. 总时长上限：极端情况下强制收尾
 * 3. 单连接约束：发起新请求时自动取消上一条，防止两条流的回调往同一个
 *    消息列表里写，导致回答内容错乱
 *
 * 取消统一走 cancelChatStream()，不再返回句柄：
 * 全模块只有一条活跃长连接，模块级函数即是唯一入口，
 * 多返回一个句柄只会多一条容易失同步的状态。
 * @param options 请求参数与回调
 */
export function fetchChatStream ( options: ChatStreamOptions ): void
{
  const {
    keyword, userId, convertId, onMessage, onOpen, onComplete, onError, userFeature, model, datasource, files,
  } = options;

  // 单连接约束：顶掉上一条流，并明确告知调用方原因
  cancelChatStream( "发起新的流式请求，自动取消上一条" );

  const controller = new AbortController();
  activeStreamController = controller;

  /** 本次请求的收尾状态，保证 onComplete / onError 只会被调用一次 */
  let settled = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () =>
  {
    if ( idleTimer ) { clearTimeout( idleTimer ); idleTimer = null; }
    if ( maxTimer ) { clearTimeout( maxTimer ); maxTimer = null; }
  };

  /** 统一的收尾入口，避免多处调用导致重复回调 */
  const settle = ( error?: unknown ) =>
  {
    if ( settled ) return;
    settled = true;
    clearTimers();
    controller.signal.removeEventListener( "abort", handleAbort );
    if ( activeStreamController === controller )
    {
      activeStreamController = null;
    }

    if ( !error )
    {
      onComplete();
      return;
    }

    // 这里只分类不记日志：日志统一由调用方按自己的业务场景输出，
    // 避免同一次失败在控制台里出现两条内容重复的记录
    onError?.( classifyAiError( error, "AI 对话" ), error );
  };

  /**
   * 自行监听 abort 并收尾（关键修复）。
   *
   * fetchEventSource 在 signal 被 abort 时走的是 resolve() 而不是 reject()，
   * 并且不会触发 onclose。见其源码：
   *   inputSignal?.addEventListener('abort', () => { dispose(); resolve(); });
   * 也就是说取消 / 超时之后，.catch 和 onclose 都不会执行，
   * 如果不在这里兜住，收尾回调永远不会触发：界面会一直停在「发送中」，
   * 发送按钮再也点不动，整个对话功能卡死。
   */
  const handleAbort = () =>
  {
    // abort 只有两个来源：空闲/总时长超时，以及 cancelChatStream 的取消。
    // 通过 AbortController 的 reason 区分，避免额外维护一份易失同步的状态位
    const reason = String( controller.signal.reason ?? "" );
    settle(
      reason === ABORT_REASON_TIMEOUT
        ? createTimeoutError( `超过 ${ AI_STREAM_IDLE_TIMEOUT_MS }ms 未收到响应数据` )
        : createCanceledError( reason )
    );
  };
  controller.signal.addEventListener( "abort", handleAbort, { once: true } );

  /** 重置空闲计时器：每收到一块数据都要重置，否则长回答会被误判为卡死 */
  const refreshIdleTimer = () =>
  {
    if ( idleTimer ) clearTimeout( idleTimer );
    idleTimer = setTimeout( () =>
    {
      controller.abort( ABORT_REASON_TIMEOUT );
    }, AI_STREAM_IDLE_TIMEOUT_MS );
  };

  // 总时长上限：兜底用，正常回答不会触发
  maxTimer = setTimeout( () =>
  {
    controller.abort( ABORT_REASON_TIMEOUT );
  }, AI_STREAM_MAX_DURATION_MS );

  refreshIdleTimer();

  fetchEventSource( `${ AI_BASE_URL }/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify( {
      keyword, userId, convertId, userFeature, model, datasource, files,
    } ),
    signal: controller.signal,
    // 切到后台标签页时不要中断重连：
    // 本接口是 POST 流式请求，重连会让后端把同一条用户消息再落库一次
    openWhenHidden: true,
    // 连接建立后触发：HTTP 状态码非 2xx 时在这里拦下，
    // 归一成业务错误，交由 classifyAiError 分类
    onopen: async ( response ) =>
    {
      if ( !response.ok )
      {
        throw new AiBusinessError( `流式接口返回 HTTP ${ response.status }`, {
          status: response.status,
        } );
      }
      // 连接已确认建立：此时后端一定已经收下这次提问，
      // 调用方可以据此立刻发起依赖「消息已入库」的后续请求（如生成会话标题）
      onOpen?.();
    },
    // 出错时必须 throw：库默认会无限重试，
    // 重试会让用户看到回答反复从头开始，比直接报错更糟
    onerror: ( err ) =>
    {
      throw err;
    },
    // 每收到一段流式数据触发一次
    onmessage: ( event ) =>
    {
      if ( settled ) return;
      refreshIdleTimer();
      try
      {
        onMessage( JSON.parse( event.data ) );
      } catch ( err )
      {
        // 单条数据解析失败不该中断整条长连接，跳过即可
        console.error( "[AI 对话] 流式数据解析失败，已跳过该片段:", err, event.data );
      }
    },
    // 整条长连接彻底关闭后触发
    onclose: () =>
    {
      settle();
    },
  } ).catch( ( error ) =>
  {
    settle( error );
  } );
}

/**
 * 获取所有聊天记录
 * @param userId 用户 ID
 */
export const getAllChat = ( userId: string ) =>
{
  return ask.post( "/all", { userId } );
};

/**
 * 创建新聊天
 * @param userId 用户 ID
 */
export const createChat = ( userId: string ) =>
{
  return ask.post( "/new", { userId } );
};

/**
 * 获取聊天标题
 * @param userId 用户 ID
 * @param convertId 会话 ID
 */
export const getTitle = ( userId: string, convertId: string ) =>
{
  return ask.post( "/title", {
    userId, convertId,
  } );
};

/**
 * 获取单条聊天记录
 * @param userId 用户 ID
 * @param convertId 会话 ID
 */
export const getSingleChat = ( userId: string, convertId: string ) =>
{
  return ask.post( "/singleChat", {
    userId, convertId,
  } );
};

/**
 * 获取用户特点
 * @param userId 用户 ID
 */
export const getUserFeature = ( userId: string ) =>
{
  return ask.post( "/userFeature", { userId } );
};

/**
 * 转化图片格式
 * @param file 待上传的图片文件
 */
export const uploadImg = ( file: any ) =>
{
  const fileData = new FormData();
  fileData.append( "file", file );
  return ask.post( "/changeImg", fileData );
};
