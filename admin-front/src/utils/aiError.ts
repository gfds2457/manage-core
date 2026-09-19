/**
 * AI 对话错误分类与日志（需求 5）
 *
 * 需求要求把「网络连不上」和「接口业务报错」分开对待，因为两者的
 * 处理方式完全不同：
 * - 网络连不上：用户自己能解决（把后端启动起来），提示要给出启动指引
 * - 接口业务报错：用户解决不了，提示要说明服务端返回了什么，便于反馈
 * 如果统一提示「请求失败」，用户拿不到任何有效信息，只能来问开发。
 *
 * 同时约定：弹窗只给用户看友好文案，完整技术细节全部打到控制台，
 * 既不吓到用户，也不丢排查线索。
 *
 * 类型说明：本模块的入参统一用 any —— 需要接收 axios error、DOMException、
 * 业务异常、甚至服务端直接抛出的原始值，各来源结构互不兼容，
 * 用 unknown 反而要在每处访问前写重复的收窄判断。所有字段访问都先用可选链兜底。
 */
import { AI_BACKEND_EXPECTED_PORT } from "@/utils/aiEnv";

/** 错误大类 */
export type AiErrorType =
  /** 网络层失败：连接被拒绝、DNS 解析失败、断网等，请求根本没送达 */
  | "network"
  /** 超时：连接上了但迟迟没有响应 */
  | "timeout"
  /** 主动取消：用户点了停止，或发起了新的请求顶掉旧请求 */
  | "canceled"
  /** 接口业务报错：请求已送达，服务端返回了错误状态码或业务失败体 */
  | "business"
  /** 兜底：无法归类的异常 */
  | "unknown";

export interface AiErrorInfo {
  type: AiErrorType;
  /** 面向用户的友好提示，可直接用于弹窗 */
  friendly: string;
  /** 面向开发者的技术描述，输出到控制台 */
  detail: string;
  /** HTTP 状态码，业务报错时存在 */
  status?: number;
  /** 服务端返回的业务错误码 */
  code?: string;
}

/**
 * 业务错误：请求成功送达服务端，但服务端明确返回了失败。
 * 用于把「HTTP 200 但 body.success === false」这类响应也归一成异常，
 * 否则调用方会拿到一个看似成功的响应继续往下走。
 */
export class AiBusinessError extends Error
{
  code?: string;

  status?: number;

  constructor( message: string, options: { code?: string; status?: number } = {} )
  {
    super( message );
    this.name = "AiBusinessError";
    this.code = options.code;
    this.status = options.status;
  }
}

/** HTTP 状态码 → 友好文案 */
const HTTP_STATUS_MESSAGE: Record<number, string> = {
  400: "请求参数有误",
  401: "登录状态已失效，请重新登录",
  403: "没有访问该接口的权限",
  404: "接口地址不存在，请检查 AI 后端版本是否匹配",
  408: "服务端处理超时",
  413: "上传内容过大",
  429: "请求过于频繁，请稍后再试",
  500: "AI 后端内部错误",
  502: "AI 后端网关异常",
  503: "AI 服务暂时不可用",
  504: "AI 后端网关超时",
};

/**
 * 判断异常是否为「主动取消」。
 * axios 取消抛 CanceledError（code=ERR_CANCELED），
 * fetch 取消抛 DOMException AbortError（name=AbortError，code=20）。
 * @param error 原始异常
 * @returns 是否为取消
 */
export function isCanceledError( error: any ): boolean
{
  if ( !error ) return false;
  // 只认库给出的结构化标记，不用 message 做模糊匹配：
  // message 里也可能带着服务端返回的业务文案，一旦出现 "aborted" 之类的词，
  // 真实故障会被误判成用户取消，进而既不弹提示也不打日志，问题被彻底藏起来。
  // 末尾的 message 兜底仅匹配库/浏览器的固定文案
  return (
    error.code === "ERR_CANCELED" ||
    error.code === 20 ||
    error.name === "CanceledError" ||
    error.name === "AbortError" ||
    error.message === "canceled" ||
    error.message === "The operation was aborted."
  );
}

/**
 * 判断异常是否为「超时」。
 * axios 超时抛 ECONNABORTED；Node 侧连接超时为 ETIMEDOUT。
 * @param error 原始异常
 * @returns 是否超时
 */
export function isTimeoutError( error: any ): boolean
{
  if ( !error ) return false;
  return (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ERR_TIMEOUT" ||
    /timeout|timed out/i.test( String( error.message || "" ) )
  );
}

/**
 * 判断异常是否为「网络层失败」。
 * 覆盖 axios(xhr) 的 "Network Error" 与 fetch 的 "Failed to fetch" / Safari 的 "Load failed"，
 * 以及浏览器控制台里直接可见的 ERR_CONNECTION_REFUSED。
 * @param error 原始异常
 * @returns 是否为网络失败
 */
export function isNetworkError( error: any ): boolean
{
  if ( !error ) return false;
  if ( error.code === "ERR_NETWORK" ) return true;

  const message = String( error.message || "" );
  return /network error|failed to fetch|load failed|ERR_CONNECTION_REFUSED|ECONNREFUSED|ENOTFOUND|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/i.test(
    message
  );
}

/** 从原始异常里提取一个尽量可读的服务端错误消息 */
function extractServerMessage( response: any ): string
{
  const data = response?.data;
  if ( !data ) return "";
  if ( typeof data === "string" ) return data.slice( 0, 200 );
  return String( data.message || data.error || data.msg || "" );
}

/**
 * 把任意异常归一成带友好文案的错误信息。
 * @param error 原始异常（axios error / Error / 任意值）
 * @param contextLabel 场景名，用于拼接提示文案与日志
 * @returns 归一化后的错误信息
 */
export function classifyAiError( error: any, contextLabel = "AI 请求" ): AiErrorInfo
{
  // 1.主动取消：不是故障，不需要弹错误提示
  if ( isCanceledError( error ) )
  {
    return {
      type: "canceled",
      friendly: "已取消本次生成",
      detail: `请求被主动取消：${ error?.message || "无附加信息" }`,
    };
  }

  // 2.超时
  if ( isTimeoutError( error ) )
  {
    return {
      type: "timeout",
      friendly: `${ contextLabel }超时，AI 服务响应过慢，请稍后重试`,
      detail: `请求超时：${ error?.message || "无附加信息" }`,
    };
  }

  // 3.网络层失败：请求没送达，八成是后端没启动
  if ( isNetworkError( error ) )
  {
    return {
      type: "network",
      friendly: `无法连接 AI 后端服务，请确认 admin-ai-backend 已启动（默认端口 ${ AI_BACKEND_EXPECTED_PORT }）`,
      detail: `网络层失败：${ error?.message || "无附加信息" }`,
    };
  }

  // 4.业务报错：服务端有响应，只是状态码或业务码是失败的
  const response = error?.response;
  if ( response )
  {
    const status = Number( response.status );
    const serverMessage = extractServerMessage( response );
    const baseMessage = HTTP_STATUS_MESSAGE[ status ] || `服务返回异常状态码 ${ status }`;

    return {
      type: "business",
      status,
      code: error?.code,
      friendly: serverMessage
        ? `${ contextLabel }失败（HTTP ${ status }）：${ serverMessage }`
        : `${ contextLabel }失败（HTTP ${ status }）：${ baseMessage }`,
      detail: `接口业务报错：HTTP ${ status }，响应体：${ JSON.stringify( response.data )?.slice( 0, 500 ) }`,
    };
  }

  // 5.显式抛出的业务错误（HTTP 200 但业务失败，已被归一成 AiBusinessError）
  if ( error?.name === "AiBusinessError" )
  {
    return {
      type: "business",
      status: error.status,
      code: error.code,
      friendly: `${ contextLabel }失败：${ error.message }`,
      detail: `业务处理失败：code=${ error.code || "无" }，message=${ error.message }`,
    };
  }

  // 6.兜底
  return {
    type: "unknown",
    friendly: `${ contextLabel }失败，请稍后重试`,
    detail: `未分类异常：${ error?.message || String( error ) }`,
  };
}

/**
 * 输出详细技术日志。
 * 用 collapsed 分组，正常排查时点开即可，不干扰阅读。
 * @param context 场景名，如「发送消息」
 * @param info 归一化后的错误信息
 * @param raw 原始异常对象
 */
export function logAiError( context: string, info: AiErrorInfo, raw?: any ): void
{
  console.groupCollapsed( `[AI 对话] ${ context } 失败｜类型=${ info.type }` );
  console.error( "友好提示:", info.friendly );
  console.error( "技术详情:", info.detail );
  if ( info.status !== undefined ) console.error( "HTTP 状态码:", info.status );
  if ( info.code !== undefined ) console.error( "错误码:", info.code );
  if ( raw?.config )
  {
    console.error( "请求方法:", raw.config.method );
    console.error( "请求地址:", `${ raw.config.baseURL || "" }${ raw.config.url || "" }` );
    // 只打印必要的请求信息，不整个 dump 原始错误对象：
    // axios 的 error.config.headers 里带着 Authorization（Bearer Token），
    // 整个打出来等于把登录凭据写进控制台
    console.error( "请求体:", JSON.stringify( raw.config.data )?.slice( 0, 300 ) );
  }
  console.error( "错误消息:", raw?.message || String( raw ) );
  if ( raw?.response?.data !== undefined )
  {
    console.error( "响应体:", JSON.stringify( raw.response.data )?.slice( 0, 500 ) );
  }
  console.groupEnd();
}
