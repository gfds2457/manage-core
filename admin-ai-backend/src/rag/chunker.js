/**
 * 文本切块与向量记录构造
 *
 * 切块策略：优先按段落 → 换行 → 中文句号 → 中文分号/逗号 递归切分，
 * 使每个片段尽量保持语义完整，利于向量召回质量。
 */
import crypto from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ragChunkSize, ragChunkOverlap, kbMaxChunksPerDoc } from "../env.js";
import { RagError, RagErrorCode } from "./errors.js";
import { DOC_TYPE_KNOWLEDGE, normalizeDocType } from "./constants.js";

/** 中文场景下更合理的分隔符优先级 */
export const DEFAULT_SEPARATORS = [
  "\n\n",
  "\n",
  "。",
  "！",
  "？",
  "；",
  "，",
  " ",
  "",
];

/**
 * 有效片段最小长度。
 * 递归切分在遇到连续标点时会产生仅含「。」这类无信息量的碎片，
 * 它们会稀释检索质量（曾实际召回过内容为「。」的片段），此处直接剔除。
 */
export const MIN_CHUNK_LENGTH = 8;

/**
 * 判断片段是否为有效内容：长度达标且不只是标点/空白。
 * @param {string} chunk
 * @returns {boolean}
 */
export function isMeaningfulChunk(chunk) {
  const text = String(chunk ?? "").trim();
  if (text.length < MIN_CHUNK_LENGTH) return false;
  // 至少包含一个中英文/数字字符，纯标点碎片丢弃
  return /[一-龥a-zA-Z0-9]/.test(text);
}

/**
 * 计算内容指纹，用于增量更新时判断是否真的需要重新向量化。
 * @param {string} text
 * @returns {string} 16 位十六进制
 */
export function hashContent(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf-8").digest("hex").slice(0, 16);
}

/**
 * 构建文本切分器
 * @param {{ chunkSize?: number, chunkOverlap?: number, separators?: string[] }} [options]
 */
export function createSplitter(options = {}) {
  const chunkSize = options.chunkSize ?? ragChunkSize;
  const chunkOverlap = options.chunkOverlap ?? ragChunkOverlap;

  if (chunkOverlap >= chunkSize) {
    throw new RagError(
      RagErrorCode.CONFIG_INVALID,
      `切块重叠长度(${chunkOverlap})必须小于切块长度(${chunkSize})`,
    );
  }

  return new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: options.separators ?? DEFAULT_SEPARATORS,
  });
}

/**
 * 切分单段文本，自动过滤空白与纯标点碎片
 * @param {string} text
 * @param {{ chunkSize?: number, chunkOverlap?: number, maxChunks?: number }} [options]
 * @returns {Promise<string[]>}
 */
export async function splitText(text, options = {}) {
  const normalized = String(text ?? "").trim();
  if (!normalized) return [];

  const splitter = createSplitter(options);
  let chunks = await splitter.splitText(normalized);
  chunks = chunks.map((c) => c.trim()).filter(isMeaningfulChunk);

  const maxChunks = options.maxChunks ?? 0;
  if (maxChunks > 0 && chunks.length > maxChunks) {
    console.warn(
      `[rag] 单个文档切出 ${chunks.length} 个片段，超过上限 ${maxChunks}，已截断`,
    );
    chunks = chunks.slice(0, maxChunks);
  }
  return chunks;
}

/** 拼装主键：docType:docId#chunkIndex */
export function buildChunkId(docType, docId, chunkIndex) {
  return `${docType}:${docId}#${chunkIndex}`;
}

/** 供 Embedding 使用的文本：带上标题补充语境，提升召回准确率 */
export function buildEmbeddingText(title, chunk) {
  return title ? `${title}\n${chunk}` : chunk;
}

/**
 * 把一个知识条目切块并构造成待入库记录（不含向量）
 * @param {{ docId: string|number, docType?: string, title?: string, content: string, source?: string }} doc
 * @param {{ now?: string, maxChunks?: number }} [options]
 * @returns {Promise<Array<{id,text,title,source,docId,docType,chunkIndex,hash,updatedAt,embeddingText}>>}
 */
export async function buildDocChunks(doc, options = {}) {
  const docId = doc?.docId === undefined || doc?.docId === null ? "" : String(doc.docId);
  if (!docId) {
    throw new RagError(RagErrorCode.INVALID_INPUT, "知识条目缺少 docId，无法入库");
  }

  const docType = normalizeDocType(doc.docType);
  const title = doc.title || "";
  const source = doc.source || "";
  const updatedAt = options.now || new Date().toISOString();
  // 静态文档知识不限制片段数；业务知识按配置截断，避免单条商品描述挤占召回名额
  const maxChunks =
    options.maxChunks ?? (docType === DOC_TYPE_KNOWLEDGE ? 0 : kbMaxChunksPerDoc);

  const chunks = await splitText(doc.content, { maxChunks });

  return chunks.map((chunk, index) => ({
    id: buildChunkId(docType, docId, index),
    text: chunk,
    title,
    source,
    docId,
    docType,
    chunkIndex: index,
    hash: hashContent(buildEmbeddingText(title, chunk)),
    updatedAt,
    embeddingText: buildEmbeddingText(title, chunk),
  }));
}

export default {
  hashContent,
  createSplitter,
  splitText,
  buildDocChunks,
  buildChunkId,
  buildEmbeddingText,
  isMeaningfulChunk,
  DEFAULT_SEPARATORS,
  MIN_CHUNK_LENGTH,
  DOC_TYPE_KNOWLEDGE,
};
