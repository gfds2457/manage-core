/**
 * 检索链路编排
 *
 * 用户提问 -> 大模型改写 query -> Embedding -> LanceDB 向量检索 -> 阈值过滤 + 来源溯源
 *
 * 全链路容错（需求 6）：任一步骤异常都不抛出，而是降级为「空结果 + 友好提示」，
 * 由上层继续走无 RAG 的普通问答，不打断主业务流程。
 */
import { rewriteQuery } from "./rewriter.js";
import { embedQuery } from "./embedding.js";
import { searchVectors } from "./vectorStore.js";
import { ragTopK, ragScoreThreshold } from "../env.js";
import { RagError, RagErrorCode, FRIENDLY_MESSAGE } from "./errors.js";

/** 检索链路各阶段的降级提示 */
export const RETRIEVE_NOTICE = {
  EMPTY_QUERY: FRIENDLY_MESSAGE[RagErrorCode.EMPTY_RESULT],
  EMBEDDING_FAILED: FRIENDLY_MESSAGE[RagErrorCode.EMBEDDING_FAILED],
  VECTOR_DB_FAILED: FRIENDLY_MESSAGE[RagErrorCode.VECTOR_DB_FAILED],
  NO_MATCH: "知识库中未检索到匹配内容，将基于通用能力回答",
};

/**
 * 按相似度阈值过滤，并按分数降序
 * @param {Array<object>} results
 * @param {number} threshold
 */
export function filterByScore(results, threshold) {
  return (results || [])
    .filter((item) => typeof item.score === "number" && item.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

/**
 * 检索知识库
 * @param {string} question 用户原始提问
 * @param {{ topK?: number, threshold?: number, docType?: string, enableRewrite?: boolean, fallbackToRawQuery?: boolean }} [options]
 * @returns {Promise<{
 *   question: string, query: string, rewritten: boolean,
 *   results: Array<object>, sources: Array<object>,
 *   hasContext: boolean, degraded: boolean, notice: string|null
 * }>}
 */
export async function retrieveKnowledge(question, options = {}) {
  const original = typeof question === "string" ? question.trim() : "";
  const topK = options.topK ?? ragTopK;
  const threshold = options.threshold ?? ragScoreThreshold;

  const base = {
    question: original,
    query: original,
    rewritten: false,
    results: [],
    sources: [],
    hasContext: false,
    degraded: false,
    notice: null,
  };

  if (!original) {
    return { ...base, degraded: true, notice: RETRIEVE_NOTICE.EMPTY_QUERY };
  }

  // 1. Query 改写（内部已做失败降级，不会抛错）
  let searchQuery = original;
  let rewritten = false;
  try {
    const rewriteResult = await rewriteQuery(original, { enabled: options.enableRewrite });
    searchQuery = rewriteResult.query || original;
    rewritten = rewriteResult.rewritten;
  } catch (err) {
    // 改写抛错的唯一情况是入参非法，此时直接用原问题继续
    console.warn(`[rag] 改写阶段异常，使用原始问题: ${err.message}`);
  }

  // 2. 向量化检索目标
  let queryVector;
  try {
    queryVector = await embedQuery(searchQuery);
  } catch (err) {
    const notice =
      err instanceof RagError ? err.friendlyMessage : RETRIEVE_NOTICE.EMBEDDING_FAILED;
    console.error(`[rag] 查询向量化失败: ${err.message}`);
    return { ...base, query: searchQuery, rewritten, degraded: true, notice };
  }

  // 3. 向量检索
  let hits;
  try {
    hits = await searchVectors(queryVector, { topK, docType: options.docType });
  } catch (err) {
    const notice =
      err instanceof RagError ? err.friendlyMessage : RETRIEVE_NOTICE.VECTOR_DB_FAILED;
    console.error(`[rag] 向量检索失败: ${err.message}`);
    return { ...base, query: searchQuery, rewritten, degraded: true, notice };
  }

  // 4. 阈值过滤：低于阈值的片段视为噪声，避免误导大模型
  const results = filterByScore(hits, threshold);

  if (results.length === 0) {
    return {
      ...base,
      query: searchQuery,
      rewritten,
      degraded: true,
      notice: RETRIEVE_NOTICE.NO_MATCH,
    };
  }

  return {
    question: original,
    query: searchQuery,
    rewritten,
    results,
    sources: results.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      docId: item.docId,
      docType: item.docType,
      score: item.score,
      // 片段摘要：前端「引用来源」面板需要在不加载原文的前提下展示命中内容。
      // 只截前 120 字，避免把整段基地文本随 SSE 推给浏览器
      preview: String(item.text ?? "").replace(/\s+/g, " ").slice(0, 120),
    })),
    hasContext: true,
    degraded: false,
    notice: null,
  };
}

export default { retrieveKnowledge, filterByScore, RETRIEVE_NOTICE };
