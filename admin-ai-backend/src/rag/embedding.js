/**
 * Embedding 封装层
 *
 * 统一收口向量化调用，模型名与维度全部来自 src/.env，业务代码零硬编码。
 * 具备：批量切分、超时保护、失败重试、维度校验、错误归一。
 */
import OpenAI from "openai";
import {
  apiKey,
  baseURL,
  embeddingModel,
  embeddingDimensions,
  ragEmbedBatchSize,
  ragTimeoutMs,
  ragRetryTimes,
  ragRetryDelayMs,
} from "../env.js";
import {
  RagError,
  RagErrorCode,
  withTimeout,
  withRetry,
  isTimeoutError,
} from "./errors.js";

let client = null;

/** 懒加载 OpenAI 兼容客户端，避免模块导入即发起网络依赖 */
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey, baseURL });
  }
  return client;
}

/**
 * 归一化向量（单位化），使余弦相似度与点积等价，
 * 同时规避部分服务端不做归一化导致的检索排序偏差。
 * @param {number[]} vector
 * @returns {number[]}
 */
export function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) return [];
  let sum = 0;
  for (const v of vector) sum += v * v;
  const norm = Math.sqrt(sum);
  if (norm === 0 || !Number.isFinite(norm)) return vector.slice();
  return vector.map((v) => v / norm);
}

/**
 * 校验单条向量是否合法
 * @param {unknown} vector
 * @param {number} index 批次内下标，用于定位问题
 */
function assertValidVector(vector, index) {
  if (!Array.isArray(vector)) {
    throw new RagError(
      RagErrorCode.EMBEDDING_FAILED,
      `第 ${index} 条向量化结果格式非法（非数组）`,
    );
  }
  if (vector.length !== embeddingDimensions) {
    throw new RagError(
      RagErrorCode.EMBEDDING_FAILED,
      `向量维度不一致：配置 EMBEDDING_DIMENSIONS=${embeddingDimensions}，` +
        `实际返回 ${vector.length}，请核对 ${embeddingModel} 是否支持该维度`,
      { context: { expected: embeddingDimensions, actual: vector.length } },
    );
  }
  if (vector.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new RagError(RagErrorCode.EMBEDDING_FAILED, `第 ${index} 条向量包含非法数值`);
  }
}

/**
 * 调用一次 Embedding 接口（含超时与重试）
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function requestEmbedding(texts) {
  const call = () => {
    // 每次尝试独立 AbortController：超时后主动中断请求，
    // 否则 withRetry 会在旧请求仍在途时再发一次，造成重复计费与连接堆积
    const controller = new AbortController();
    const request = getClient()
      .embeddings.create(
        {
          model: embeddingModel,
          input: texts,
        },
        { signal: controller.signal },
      )
      .catch((err) => {
        // 主动中断导致的失败统一归一成超时错误，交由上层映射为 EMBEDDING_TIMEOUT
        if (controller.signal.aborted) {
          const abortErr = new Error(`Embedding 调用超时（${ragTimeoutMs}ms）`);
          abortErr.name = "TimeoutError";
          throw abortErr;
        }
        throw err;
      });

    return withTimeout(request, ragTimeoutMs, "Embedding 调用", () => controller.abort());
  };

  let response;
  try {
    response = await withRetry(call, {
      times: ragRetryTimes,
      delayMs: ragRetryDelayMs,
      label: "Embedding 调用",
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new RagError(RagErrorCode.EMBEDDING_TIMEOUT, `Embedding 调用超时: ${err.message}`, {
        cause: err,
      });
    }
    throw new RagError(
      RagErrorCode.EMBEDDING_FAILED,
      `Embedding 调用失败: ${err?.message || err}`,
      { cause: err },
    );
  }

  const data = response?.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new RagError(
      RagErrorCode.EMBEDDING_FAILED,
      `Embedding 返回条数与请求不一致：请求 ${texts.length}，返回 ${data?.length ?? 0}`,
    );
  }

  // OpenAI 兼容接口允许返回顺序与请求顺序不一致，必须按 index 回填，
  // 否则向量会与文本错位，导致检索召回到完全不相关的内容。
  const ordered = [...data].sort((a, b) => {
    const ia = Number.isInteger(a?.index) ? a.index : 0;
    const ib = Number.isInteger(b?.index) ? b.index : 0;
    return ia - ib;
  });

  return ordered.map((item, index) => {
    // item 可能为 null（部分兼容网关会返回稀疏数组），
    // 不加判断会抛出裸 TypeError，绕过 RagError 归一化让上层无法友好降级
    if (!item || typeof item !== "object") {
      throw new RagError(
        RagErrorCode.EMBEDDING_FAILED,
        `Embedding 返回的第 ${index} 条数据为空或格式非法`,
      );
    }
    assertValidVector(item.embedding, index);
    return normalizeVector(item.embedding);
  });
}

/**
 * 批量文本向量化
 * @param {string[]} textList 待向量化文本
 * @param {{ batchSize?: number }} [options]
 * @returns {Promise<number[][]>} 与输入顺序严格一致
 */
export async function embedTexts(textList, options = {}) {
  if (!Array.isArray(textList)) {
    throw new RagError(RagErrorCode.INVALID_INPUT, "embedTexts 入参必须为数组");
  }
  const cleaned = textList.map((t) => (typeof t === "string" ? t.trim() : ""));
  if (cleaned.length === 0) return [];

  const emptyIndex = cleaned.findIndex((t) => t === "");
  if (emptyIndex !== -1) {
    throw new RagError(
      RagErrorCode.INVALID_INPUT,
      `第 ${emptyIndex} 条待向量化文本为空，请先过滤空片段`,
    );
  }

  // 批大小必须为正整数：为 0 时下面的循环步长为 0 会变成死循环。
  // 显式传入非法值直接报错，不静默退回配置值，避免调用方以为生效了却没用上。
  const batchSize = options.batchSize ?? ragEmbedBatchSize;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RagError(
      RagErrorCode.CONFIG_INVALID,
      `Embedding 批大小非法：${batchSize}，请检查 RAG_EMBED_BATCH_SIZE 配置`,
    );
  }

  const vectors = [];
  for (let i = 0; i < cleaned.length; i += batchSize) {
    const batch = cleaned.slice(i, i + batchSize);
    const batchVectors = await requestEmbedding(batch);
    vectors.push(...batchVectors);
  }
  return vectors;
}

/**
 * 单条查询向量化
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedQuery(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new RagError(RagErrorCode.INVALID_INPUT, "查询文本不能为空");
  }
  const [vector] = await embedTexts([text]);
  return vector;
}

/** 供测试注入 mock 客户端 */
export function __setClientForTest(mockClient) {
  client = mockClient;
}

/** 清空懒加载客户端，便于测试间隔离 */
export function __resetClient() {
  client = null;
}

export default { embedTexts, embedQuery, normalizeVector };
