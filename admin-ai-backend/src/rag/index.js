/**
 * RAG 模块统一出口
 *
 * 上层（index.js / store.js / 路由）只需从这里引入，不感知内部实现分层。
 */
import { validateConfig } from "../env.js";
import { retrieveKnowledge } from "./retriever.js";
import { buildRagPrompt, EMPTY_CONTEXT_PLACEHOLDER } from "./prompt.js";
import { syncKnowledgeBase, getKnowledgeStats } from "./indexer.js";
import { countRows } from "./vectorStore.js";
import { FRIENDLY_MESSAGE, RagErrorCode } from "./errors.js";

export { retrieveKnowledge, filterByScore, RETRIEVE_NOTICE } from "./retriever.js";
export {
  buildRagPrompt,
  loadRagTemplate,
  formatRetrievedContext,
  fillTemplate,
  EMPTY_CONTEXT_PLACEHOLDER,
} from "./prompt.js";
export {
  syncKnowledgeBase,
  upsertBusinessKnowledge,
  removeBusinessKnowledge,
  indexSingleDoc,
  getKnowledgeStats,
} from "./indexer.js";
export { embedTexts, embedQuery, normalizeVector } from "./embedding.js";
export {
  searchVectors,
  addRecords,
  deleteByDocId,
  deleteByIds,
  upsertDocChunks,
  countRows,
  resetTable,
  getTable,
  buildSchema,
} from "./vectorStore.js";
export { splitText, buildDocChunks, hashContent } from "./chunker.js";
export { loadKnowledgeDocs, parseDocFile } from "./loader.js";
export {
  readManifest,
  writeManifest,
  diffDocs,
  applyManifestUpdates,
  removeManifestEntries,
  dropManifestByType,
  buildDocHash,
  MANIFEST_PATH,
} from "./manifest.js";
export {
  RagError,
  RagErrorCode,
  FRIENDLY_MESSAGE,
  withTimeout,
  withRetry,
  safeRun,
} from "./errors.js";
export {
  DOC_TYPE_KNOWLEDGE,
  DOC_TYPE_PRODUCT,
  DEFAULT_PRODUCT_SOURCE,
  DOC_TYPES,
  normalizeDocType,
} from "./constants.js";

/**
 * 一步式获取 RAG 提示词与来源（供 /chat 主流程调用）
 *
 * 任何异常都不会抛出：最差情况返回不含资料的提示词 + 友好提示，
 * 保证大模型问答链路始终可继续。
 * @param {string} question 用户提问
 * @param {{ topK?: number, threshold?: number, docType?: string, enableRewrite?: boolean }} [options]
 * @returns {Promise<{ prompt:string, contextText:string, sources:Array<object>, hasContext:boolean, degraded:boolean, notice:string|null, query:string, rewritten:boolean }>}
 */
export async function prepareRagContext(question, options = {}) {
  const retrieval = await retrieveKnowledge(question, options);
  const built = buildRagPrompt({ question, chunks: retrieval.results });

  return {
    prompt: built.prompt,
    contextText: built.contextText,
    sources: built.sources,
    hasContext: built.hasContext,
    degraded: retrieval.degraded,
    notice: retrieval.notice,
    query: retrieval.query,
    rewritten: retrieval.rewritten,
  };
}

/**
 * 服务启动时的知识库初始化
 *
 * 首次运行：全量入库
 * 后续运行：只在检测到内容变化时做增量更新
 * @param {{ force?: boolean, skip?: boolean }} [options]
 */
export async function initKnowledgeBase(options = {}) {
  if (options.skip) {
    console.log("[rag] 已跳过知识库初始化");
    return null;
  }

  try {
    // 启动即校验模型配置，缺失项直接给出明确提示
    validateConfig({ silent: true });
  } catch (err) {
    console.error(`[rag] ${err.message}`);
    return { ok: false, error: err.message };
  }

  try {
    const result = await syncKnowledgeBase({ force: options.force });
    const rows = await countRows().catch(() => -1);
    console.log(`[rag] 知识库就绪，当前向量片段总数: ${rows}`);
    return { ok: true, ...result, vectorCount: rows };
  } catch (err) {
    // 初始化失败不阻断服务启动，问答会自动降级为无 RAG 模式
    console.error(`[rag] 知识库初始化失败，问答将降级为无检索模式: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** 检索为空时给用户看的统一文案 */
export const emptyContextText = EMPTY_CONTEXT_PLACEHOLDER;

export default {
  prepareRagContext,
  initKnowledgeBase,
  retrieveKnowledge,
  buildRagPrompt,
  syncKnowledgeBase,
  getKnowledgeStats,
};
