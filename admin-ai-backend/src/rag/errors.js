/**
 * RAG 模块统一异常定义与容错工具
 *
 * 设计目标（对应需求 6「异常兜底」）：
 * - 任何向量检索 / 模型调用 / 入库失败都归一成 RagError，携带可读的中文提示
 * - 提供 timeout / retry 包装，避免单次抖动拖垮主流程
 * - 所有兜底路径只记录日志并降级，绝不向上抛出中断问答主业务
 */

/** RAG 错误码，便于日志检索与前端展示区分 */
export const RagErrorCode = {
  CONFIG_INVALID: "CONFIG_INVALID",
  EMBEDDING_FAILED: "EMBEDDING_FAILED",
  EMBEDDING_TIMEOUT: "EMBEDDING_TIMEOUT",
  VECTOR_DB_FAILED: "VECTOR_DB_FAILED",
  VECTOR_DB_TIMEOUT: "VECTOR_DB_TIMEOUT",
  REWRITE_FAILED: "REWRITE_FAILED",
  INDEX_FAILED: "INDEX_FAILED",
  EMPTY_RESULT: "EMPTY_RESULT",
  INVALID_INPUT: "INVALID_INPUT",
};

/** 对外统一的友好提示文案 */
export const FRIENDLY_MESSAGE = {
  [RagErrorCode.CONFIG_INVALID]: "知识库配置有误，请联系管理员检查模型配置",
  [RagErrorCode.EMBEDDING_FAILED]: "知识库向量化服务暂时不可用，请稍后重试",
  [RagErrorCode.EMBEDDING_TIMEOUT]: "知识库向量化服务响应超时，请稍后重试",
  [RagErrorCode.VECTOR_DB_FAILED]: "知识库检索服务暂时不可用，请稍后重试",
  [RagErrorCode.VECTOR_DB_TIMEOUT]: "知识库检索服务响应超时，请稍后重试",
  [RagErrorCode.REWRITE_FAILED]: "问题改写失败，已使用原始问题进行检索",
  [RagErrorCode.INDEX_FAILED]: "知识库更新失败，已记录日志稍后自动重试",
  [RagErrorCode.EMPTY_RESULT]: "知识库中未检索到相关内容",
  [RagErrorCode.INVALID_INPUT]: "请求参数不合法",
};

/** RAG 领域异常 */
export class RagError extends Error {
  /**
   * @param {string} code RagErrorCode
   * @param {string} [message] 内部排查用的详细信息
   * @param {{ cause?: unknown, context?: Record<string, unknown> }} [options]
   */
  constructor(code, message, options = {}) {
    super(message || FRIENDLY_MESSAGE[code] || "知识库服务异常");
    this.name = "RagError";
    this.code = code;
    this.cause = options.cause;
    this.context = options.context || {};
  }

  /** 返回可安全展示给用户的友好提示 */
  get friendlyMessage() {
    return FRIENDLY_MESSAGE[this.code] || "知识库服务暂时不可用，请稍后重试";
  }

  /** 结构化日志输出，避免把 stack 直接抛给前端 */
  toLogObject() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

/** 判断是否为超时类错误 */
export function isTimeoutError(err) {
  if (!err) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  const message = String(err.message || "");
  return /timeout|timed out|ETIMEDOUT|aborted/i.test(message);
}

/**
 * 给 Promise 加超时保护
 *
 * 注意：Promise.race 只是「不再等待」，并不会取消底层操作。
 * 传入 onTimeout 可在超时瞬间中断请求（如 AbortController.abort()），
 * 避免重试时旧请求仍在途导致重复调用。
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} [label] 超时提示中的业务名
 * @param {() => void} [onTimeout] 超时回调，用于中断底层请求
 * @returns {Promise<T>}
 */
export function withTimeout(promise, timeoutMs, label = "操作", onTimeout) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      // 先中断底层请求，再抛出超时错误，确保不留悬挂连接
      if (typeof onTimeout === "function") {
        try {
          onTimeout();
        } catch (err) {
          console.warn(`[rag] ${label} 超时中断失败: ${err.message}`);
        }
      }
      const err = new Error(`${label}超时（${timeoutMs}ms）`);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
    // Node 环境下避免定时器阻塞进程退出
    if (typeof timer.unref === "function") timer.unref();
  });

  // 超时后原 promise 可能仍以 rejected 结束，这里挂一个空的 catch
  // 防止它变成 unhandledRejection 把进程打挂
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
    if (typeof promise?.catch === "function") promise.catch(() => {});
  });
}

/**
 * 指数退避重试
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ times?: number, delayMs?: number, label?: string }} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options = {}) {
  const { times = 2, delayMs = 500, label = "操作" } = options;
  let lastError;

  for (let attempt = 0; attempt <= times; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // 输入类错误重试无意义，直接抛出
      if (err instanceof RagError && err.code === RagErrorCode.INVALID_INPUT) throw err;
      if (attempt < times) {
        const wait = delayMs * Math.pow(2, attempt);
        console.warn(`[rag] ${label} 第 ${attempt + 1} 次失败，${wait}ms 后重试: ${err.message}`);
        await sleep(wait);
      }
    }
  }
  throw lastError;
}

/** 睡眠 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 兜底执行器：失败时返回默认值而非抛异常，保证主流程不中断。
 * @template T
 * @param {() => Promise<T>} fn
 * @param {T} fallback
 * @param {string} label
 * @returns {Promise<T>}
 */
export async function safeRun(fn, fallback, label = "RAG 操作") {
  try {
    return await fn();
  } catch (err) {
    const detail = err instanceof RagError ? err.toLogObject() : { message: err?.message };
    console.error(`[rag] ${label} 失败，已降级:`, JSON.stringify(detail));
    return fallback;
  }
}

export default {
  RagError,
  RagErrorCode,
  FRIENDLY_MESSAGE,
  isTimeoutError,
  withTimeout,
  withRetry,
  safeRun,
  sleep,
};
