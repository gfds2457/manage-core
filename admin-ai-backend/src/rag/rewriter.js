/**
 * 检索前 Query 改写
 *
 * 目的：把口语化的用户提问改写成更适合向量召回的检索关键词
 * （补全业务术语、去除寒暄、保留实体）。
 * 改写失败时自动降级为原始 query，绝不阻塞问答。
 */
import OpenAI from "openai";
import { apiKey, baseURL, modelName, ragTimeoutMs, ragQueryRewrite } from "../env.js";
import { RagError, RagErrorCode, withTimeout } from "./errors.js";

let client = null;

function getClient() {
  if (!client) client = new OpenAI({ apiKey, baseURL });
  return client;
}

/**
 * 改写结果的长度约束。
 * REWRITE_TARGET_LENGTH 写进提示词，引导模型输出精炼的关键词组合；
 * REWRITE_MAX_LENGTH 是服务端硬截断，防止模型不听话时把超长文本送进检索。
 * 两者分离：提示词是「期望值」，截断是「防御性上限」。
 */
const REWRITE_TARGET_LENGTH = 60;
const REWRITE_MAX_LENGTH = 200;

/** 短问题改写收益低（如「品牌」「SKU」），跳过改写省一次模型调用 */
const MIN_REWRITE_LENGTH = 4;

const REWRITE_SYSTEM_PROMPT = `你是一个检索查询优化助手。请把用户的问题改写成一句更适合知识库向量检索的关键词组合。
要求：
1. 保留问题中的全部关键实体（商品名、接口名、字段名、模块名等）
2. 补充同义或相关的专业术语，提高召回率
3. 去掉"你好""请问"等寒暄语和语气词
4. 只输出改写后的检索语句本身，不要解释，不要引号，不要换行
5. 长度控制在 ${REWRITE_TARGET_LENGTH} 个字符以内`;

/**
 * 清洗模型输出：去掉引号、换行、前缀说明
 * @param {string} text
 * @returns {string}
 */
export function sanitizeRewritten(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/^[\s"'`「『]+/, "")
    .replace(/[\s"'`」』]+$/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/^(改写后|检索语句|关键词)[:：]\s*/, "")
    .trim()
    .slice(0, REWRITE_MAX_LENGTH);
}

/**
 * 改写用户 query
 * @param {string} question 用户原始提问
 * @param {{ enabled?: boolean, timeoutMs?: number }} [options]
 * @returns {Promise<{query:string, rewritten:boolean, fallbackReason?:string}>}
 */
export async function rewriteQuery(question, options = {}) {
  const original = typeof question === "string" ? question.trim() : "";
  const enabled = options.enabled ?? ragQueryRewrite;

  if (!original) {
    throw new RagError(RagErrorCode.INVALID_INPUT, "用户提问不能为空");
  }

  // 短查询（如单个词）改写收益低，直接返回，省一次模型调用
  if (!enabled || original.length <= MIN_REWRITE_LENGTH) {
    return { query: original, rewritten: false };
  }

  try {
    const completion = await withTimeout(
      getClient().chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: REWRITE_SYSTEM_PROMPT },
          { role: "user", content: original },
        ],
        temperature: 0.1,
      }),
      options.timeoutMs ?? ragTimeoutMs,
      "Query 改写",
    );

    const rewritten = sanitizeRewritten(completion?.choices?.[0]?.message?.content);
    if (!rewritten) {
      return { query: original, rewritten: false, fallbackReason: "改写结果为空" };
    }
    return { query: rewritten, rewritten: true };
  } catch (err) {
    // 兜底：改写失败就用原问题检索
    console.warn(`[rag] Query 改写失败，降级使用原始问题: ${err.message}`);
    return { query: original, rewritten: false, fallbackReason: err.message };
  }
}

/** 测试注入 */
export function __setClientForTest(mockClient) {
  client = mockClient;
}

export function __resetClient() {
  client = null;
}

export default {
  rewriteQuery,
  sanitizeRewritten,
  REWRITE_TARGET_LENGTH,
  REWRITE_MAX_LENGTH,
  MIN_REWRITE_LENGTH,
};
