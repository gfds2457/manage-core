/**
 * 向量库门面层（兼容旧调用方）
 *
 * 说明：原实现直接依赖 ruvector，且模型名、向量维度、切块参数均硬编码在文件内。
 * 本次已迁移到 LanceDB，全部实现下沉到 src/rag/*，本文件仅保留原有函数签名，
 * 让历史调用方（index.js / embedding.js）无需大改即可继续工作。
 *
 * 新代码请直接从 ./rag/index.js 引入。
 */
import {
  embedTexts,
  embedQuery,
  prepareRagContext,
  syncKnowledgeBase,
  addRecords,
  deleteByDocId,
  searchVectors,
  loadKnowledgeDocs,
  splitText,
  buildDocChunks,
  countRows,
} from "./rag/index.js";
import { embeddingDimensions, ragChunkSize, ragChunkOverlap } from "./env.js";

/** 当前向量维度（由 .env 的 EMBEDDING_DIMENSIONS 决定） */
export const VECTOR_DIMENSIONS = embeddingDimensions;

/**
 * 文本批量转向量（保留旧签名，返回结构与 OpenAI 响应兼容）
 * @param {string[]} textList
 * @returns {Promise<{data: Array<{embedding:number[], index:number}>}>}
 */
export const getEmbedding = async (textList) => {
  const vectors = await embedTexts(textList);
  return {
    data: vectors.map((embedding, index) => ({ embedding, index })),
  };
};

/**
 * 向数据库添加单条知识
 * @param {string|number} id
 * @param {string} original 文本内容
 * @param {{ title?: string, source?: string, docType?: string }} [meta]
 */
export const add = async (id, original, meta = {}) => {
  const [vector] = await embedTexts([original]);
  await addRecords([
    {
      id: String(id),
      vector,
      text: original,
      title: meta.title || "",
      source: meta.source || "",
      docId: String(meta.docId ?? id),
      docType: meta.docType || "knowledge",
      chunkIndex: meta.chunkIndex ?? 0,
      hash: "",
      updatedAt: new Date().toISOString(),
    },
  ]);
};

/**
 * 向量检索（保留旧签名）
 * @param {string} query
 * @param {{ topK?: number, docType?: string }} [options]
 * @returns {Promise<Array<{id:string, text:string, title:string, source:string, score:number}>>}
 */
export async function search(query, options = {}) {
  const vector = await embedQuery(query);
  return searchVectors(vector, options);
}

/**
 * 读取 doc 目录下全部 json 知识（保留旧签名，返回知识条目数组）
 * @returns {Array<object>}
 */
export const readDocToText = () => loadKnowledgeDocs();

/**
 * 切分知识条目为文本片段（保留旧签名）
 * @param {Array<object>} allDocFiles
 * @returns {Promise<string[]>}
 */
export const splitDocToText = async (allDocFiles) => {
  const docs = Array.isArray(allDocFiles) ? allDocFiles : [];
  const chunks = [];
  for (const doc of docs) {
    const content = typeof doc === "string" ? doc : doc?.content;
    if (!content) continue;
    chunks.push(...(await splitText(content)));
  }
  return chunks;
};

/**
 * 入库知识片段（保留旧签名）
 * 注意：新流程请优先使用 syncKnowledgeBase 以获得增量能力。
 * @param {string[]} chunks
 */
export async function storeIn(chunks) {
  const list = Array.isArray(chunks) ? chunks : [];
  const docs = list.map((text, index) => ({
    docId: `legacy-${index}`,
    docType: "knowledge",
    title: "",
    content: text,
    source: "legacy-storeIn",
  }));

  const now = new Date().toISOString();
  let inserted = 0;
  for (const doc of docs) {
    const records = await buildDocChunks(doc, { now });
    const vectors = await embedTexts(records.map((r) => r.embeddingText));
    await addRecords(
      records.map((record, i) => ({
        id: record.id,
        vector: vectors[i],
        text: record.text,
        title: record.title,
        source: record.source,
        docId: record.docId,
        docType: record.docType,
        chunkIndex: record.chunkIndex,
        hash: record.hash,
        updatedAt: record.updatedAt,
      })),
    );
    inserted += records.length;
  }
  return inserted;
}

/**
 * 组装 RAG 提示词（兼容 index.js 现有调用）
 * @param {string} keyword 用户提问
 * @param {object} [options]
 * @returns {Promise<string>} 替换好占位符的完整提示词
 */
export const createRAGcontext = async (keyword, options = {}) => {
  const rag = await prepareRagContext(keyword, options);
  return rag.prompt;
};

/** 知识库同步入口（首次全量 / 后续增量） */
export { syncKnowledgeBase, countRows, deleteByDocId };

/** 切块参数透出，便于排查 */
export const CHUNK_OPTIONS = {
  chunkSize: ragChunkSize,
  chunkOverlap: ragChunkOverlap,
};

export default {
  getEmbedding,
  add,
  search,
  readDocToText,
  splitDocToText,
  storeIn,
  createRAGcontext,
  syncKnowledgeBase,
  countRows,
  VECTOR_DIMENSIONS,
};
