/**
 * RAG 领域常量
 *
 * docType 用于区分知识来源，决定增量同步的删除范围：
 *   - knowledge：doc/*.json 里的静态知识，由 syncKnowledgeBase 负责增删
 *   - product  ：业务页面增删改产生的知识，由 /kb/upsert、/kb/delete 维护
 *
 * 两类知识的同步互不干扰：文档同步只清理 knowledge 类，避免把业务知识误删。
 * 集中定义避免字面量散落各处导致同步范围判断出错。
 */

/** 静态文档知识 */
export const DOC_TYPE_KNOWLEDGE = "knowledge";

/** 业务数据知识 */
export const DOC_TYPE_PRODUCT = "product";

/** 业务知识的默认溯源标识 */
export const DEFAULT_PRODUCT_SOURCE = "业务数据";

/** 内置的 docType 取值 */
export const DOC_TYPES = [DOC_TYPE_KNOWLEDGE, DOC_TYPE_PRODUCT];

/**
 * 归一化 docType：空值回退到静态知识类型，自定义类型原样保留。
 * 不强制收窄到 DOC_TYPES，以便 doc/*.json 中使用扩展分类。
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeDocType(value, fallback = DOC_TYPE_KNOWLEDGE) {
  const type = typeof value === "string" ? value.trim() : "";
  return type || fallback;
}

export default {
  DOC_TYPE_KNOWLEDGE,
  DOC_TYPE_PRODUCT,
  DEFAULT_PRODUCT_SOURCE,
  DOC_TYPES,
  normalizeDocType,
};
