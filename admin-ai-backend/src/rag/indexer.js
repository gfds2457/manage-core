/**
 * 知识库入库编排
 *
 * 两条链路：
 * 1. 文档链路 syncKnowledgeBase —— 读取 doc/*.json，首次全量入库，
 *    之后按内容指纹只处理变化的知识（增量）。
 * 2. 业务链路 upsertBusinessKnowledge / removeBusinessKnowledge ——
 *    页面增删改商品数据后由业务侧回调触发，只动对应单条知识。
 *
 * 两条链路都以 docId 为最小粒度做「删旧向量 + 写新向量」，不做全量重建。
 */
import { loadKnowledgeDocs } from "./loader.js";
import { buildDocChunks } from "./chunker.js";
import { embedTexts } from "./embedding.js";
import {
  deleteByDocId,
  deleteByDocType,
  listDocIds,
  upsertDocChunks,
} from "./vectorStore.js";
import {
  readManifest,
  writeManifest,
  diffDocs,
  applyManifestUpdates,
  removeManifestEntries,
  dropManifestByType,
  buildDocHash,
} from "./manifest.js";
import { RagError, RagErrorCode } from "./errors.js";
import {
  DOC_TYPE_KNOWLEDGE,
  DOC_TYPE_PRODUCT,
  DEFAULT_PRODUCT_SOURCE,
  normalizeDocType,
} from "./constants.js";

/**
 * 把切块结果向量化并转为向量库记录
 * @param {Array<object>} chunks buildDocChunks 的输出
 * @returns {Promise<Array<object>>}
 */
async function embedChunks(chunks) {
  if (chunks.length === 0) return [];
  const vectors = await embedTexts(chunks.map((c) => c.embeddingText));

  if (vectors.length !== chunks.length) {
    throw new RagError(
      RagErrorCode.INDEX_FAILED,
      `向量数量(${vectors.length})与片段数量(${chunks.length})不一致`,
    );
  }

  return chunks.map((chunk, index) => ({
    id: chunk.id,
    vector: vectors[index],
    text: chunk.text,
    title: chunk.title,
    source: chunk.source,
    docId: chunk.docId,
    docType: chunk.docType,
    chunkIndex: chunk.chunkIndex,
    hash: chunk.hash,
    updatedAt: chunk.updatedAt,
  }));
}

/**
 * 入库单条知识（供文档链路与业务链路复用）
 * @param {object} doc
 * @returns {Promise<{docId:string, chunkCount:number, hash:string}>}
 */
export async function indexSingleDoc(doc) {
  const docType = normalizeDocType(doc.docType);
  const docId = String(doc.docId);
  const rawContent = String(doc.content ?? "").trim();
  const chunks = await buildDocChunks(doc);

  // 返回值在两条分支上保持同一形状，避免调用方（applyManifestUpdates）拿到残缺条目
  const baseEntry = {
    docId,
    docType,
    chunkCount: 0,
    // 必须是「文档级」指纹：清单用它和 diffDocs 的 buildDocHash 比对，
    // 若误用片段级指纹，该条目会被判定为永远变化，导致重复向量化
    hash: buildDocHash(doc),
    title: doc.title || "",
    source: doc.source || "",
    updatedAt: new Date().toISOString(),
  };

  if (chunks.length === 0) {
    // 只有「正文确实为空」才等价于删除。
    // 正文非空却切不出片段，是切块参数或内容过短导致的，直接删除会丢数据，
    // 因此这里保留原向量并告警，让人工决定是否调整 RAG_CHUNK_SIZE。
    if (rawContent) {
      console.warn(
        `[rag] 知识条目 docId=${docId} 正文非空但未切出有效片段（长度 ${rawContent.length}，` +
          `低于最小片段长度），已保留其原有向量不做删除`,
      );
    } else {
      await deleteByDocId(docId, { docType });
    }
    return baseEntry;
  }

  const records = await embedChunks(chunks);
  // 增量核心：先删该文档旧向量，再写入新向量（按 docType 收窄，防跨类型误删）
  await upsertDocChunks(docId, records, { docType });

  return { ...baseEntry, chunkCount: records.length };
}

/**
 * 知识库同步（首次全量 / 后续增量）
 * @param {{ force?: boolean, docs?: Array<object>, dir?: string, onProgress?: Function }} [options]
 * @returns {Promise<{mode:string, total:number, upserted:number, deleted:number, unchanged:number, failed:Array, chunkCount:number, durationMs:number}>}
 */
export async function syncKnowledgeBase(options = {}) {
  const started = Date.now();
  const { force = false, onProgress } = options;

  const docs = options.docs || loadKnowledgeDocs({ dir: options.dir });
  if (docs.length === 0) {
    console.warn("[rag] 未读取到任何知识条目，跳过入库");
    return {
      mode: force ? "full" : "incremental",
      total: 0,
      upserted: 0,
      deleted: 0,
      unchanged: 0,
      failed: [],
      chunkCount: 0,
      durationMs: Date.now() - started,
    };
  }

  // 强制全量：只重建 doc 目录的静态知识，绝不动业务知识。
  // 不能直接用 resetTable() —— 那是删整张表，会把业务侧写入的 product 向量
  // 连同清单条目一起清空，一次「重建静态知识」就顺手毁掉了增量业务数据。
  let manifest = readManifest();
  if (force) {
    // 清理范围 = doc 目录里实际出现的类型，业务类型 (product) 始终排除
    const forceTypes = [
      ...new Set(docs.map((doc) => normalizeDocType(doc.docType))),
    ].filter((type) => type !== DOC_TYPE_PRODUCT);
    const targets = forceTypes.length > 0 ? forceTypes : [DOC_TYPE_KNOWLEDGE];

    let removedChunks = 0;
    for (const type of targets) {
      removedChunks += await deleteByDocType(type);
      manifest = dropManifestByType(manifest, type);
    }
    console.log(
      `[rag] 已进入全量重建模式（类型: ${targets.join(",")}，已清理 ${removedChunks} 个片段，业务知识保持不变）`,
    );
  }

  // 本次同步负责「除业务知识以外的全部类型」：
  // doc/*.json 允许声明扩展分类（如 faq），只放行 knowledge 会让这些条目
  // 在源文件删除后永远留在库中。业务侧的 product 不在范围内，避免被误清空。
  const docTypesInUse = [
    ...new Set(docs.map((doc) => normalizeDocType(doc.docType))),
  ].filter((type) => type !== DOC_TYPE_PRODUCT);
  const scopeDocTypes = docTypesInUse.length > 0 ? docTypesInUse : [DOC_TYPE_KNOWLEDGE];

  const { toUpsert, toDelete, unchanged, isFirstRun } = diffDocs(docs, manifest, {
    scopeDocTypes,
  });
  const mode = force || isFirstRun ? "full" : "incremental";
  console.log(
    `[rag] 同步模式=${mode} 总条目=${docs.length} 待更新=${toUpsert.length} 待删除=${toDelete.length} 未变化=${unchanged}`,
  );

  const failed = [];
  const updatedEntries = [];
  let chunkCount = 0;

  for (let i = 0; i < toUpsert.length; i++) {
    const doc = toUpsert[i];
    try {
      const entry = await indexSingleDoc(doc);
      chunkCount += entry.chunkCount;
      updatedEntries.push({ ...entry, hash: doc.hash });
    } catch (err) {
      // 单条失败不影响整体同步，记录后继续
      const detail = err instanceof RagError ? err.toLogObject() : { message: err?.message };
      console.error(`[rag] 知识条目入库失败 docId=${doc.docId}:`, JSON.stringify(detail));
      failed.push({ docId: String(doc.docId), code: detail.code, message: detail.message });
    }
    if (typeof onProgress === "function") {
      onProgress({ current: i + 1, total: toUpsert.length, docId: String(doc.docId) });
    }
  }

  // 清理已从文档中消失的知识（按实际删除的片段数累加，保证统计真实）
  let deleted = 0;
  const deletedDocIds = [];
  for (const docId of toDelete) {
    try {
      // 按 docType 收窄：docId 只在类型内唯一，避免误删同 id 的业务知识。
      // 类型取自清单条目本身（作用域可能是多类型），而非写死 knowledge。
      const entryType = normalizeDocType(manifest.docs?.[docId]?.docType);
      deleted += await deleteByDocId(docId, { docType: entryType });
      deletedDocIds.push(docId);
    } catch (err) {
      // 删除失败时不能把条目从清单里摘掉：向量仍在库里，
      // 清单一旦忘记它，diffDocs 再也不会把它列入待删除，脏向量将永久残留。
      console.error(`[rag] 清理失效知识失败 docId=${docId}: ${err.message}`);
      failed.push({ docId, message: err.message });
    }
  }

  // 清单在最后一步「重新读取」再写：
  // 本次同步可能耗时数分钟，期间业务侧的 /kb/upsert、/kb/delete 会更新清单，
  // 若用开头读到的旧快照整体覆盖，这些业务条目会被悄悄回滚丢失。
  const latestManifest = readManifest();
  let nextManifest = applyManifestUpdates(latestManifest, updatedEntries);
  nextManifest = removeManifestEntries(nextManifest, deletedDocIds);
  const writeResult = writeManifest(nextManifest);
  if (!writeResult.ok) {
    console.error(`[rag] 增量清单写入失败，下次同步将重复向量化: ${writeResult.error}`);
    failed.push({ docId: "-", code: "INDEX_FAILED", message: `清单写入失败: ${writeResult.error}` });
  }

  const result = {
    mode,
    total: docs.length,
    upserted: updatedEntries.length,
    deleted,
    unchanged,
    failed,
    chunkCount,
    durationMs: Date.now() - started,
  };
  console.log(
    `[rag] 同步完成 mode=${mode} 写入=${result.upserted} 删除=${deleted} 片段=${chunkCount} 失败=${failed.length} 耗时=${result.durationMs}ms`,
  );
  return result;
}

/**
 * 业务数据增量更新入口（需求 5）
 * 页面增/改商品数据且业务库写入成功后调用，只重建这一条知识的向量。
 * @param {{ docId: string|number, title?: string, content?: string, text?: string, source?: string, docType?: string }} payload
 * @returns {Promise<{success:boolean, docId:string, chunkCount:number, action:string, message?:string}>}
 */
export async function upsertBusinessKnowledge(payload = {}) {
  const docId = payload.docId === undefined || payload.docId === null ? "" : String(payload.docId).trim();
  const content = String(payload.content ?? payload.text ?? "").trim();

  if (!docId) {
    throw new RagError(RagErrorCode.INVALID_INPUT, "增量更新失败：缺少 docId");
  }
  if (!content) {
    // 正文为空等价于删除
    return removeBusinessKnowledge(docId);
  }

  const doc = {
    docId,
    docType: normalizeDocType(payload.docType, DOC_TYPE_PRODUCT),
    title: payload.title || "",
    content,
    source: payload.source || DEFAULT_PRODUCT_SOURCE,
  };

  const entry = await indexSingleDoc(doc);

  // 写清单前重新读取，避免覆盖同步期间其它任务写入的条目
  const writeResult = writeManifest(applyManifestUpdates(readManifest(), [entry]));
  if (!writeResult.ok) {
    // 向量已写入成功，仅清单未持久化：本次仍算成功，但下一次同步会重复向量化
    console.warn(`[rag] 业务知识清单写入失败 docId=${docId}: ${writeResult.error}`);
  }

  return {
    success: true,
    docId,
    chunkCount: entry.chunkCount,
    action: "upsert",
  };
}

/**
 * 业务数据删除入口
 * @param {string|number} docId
 * @param {{ docType?: string }} [options] 默认按业务知识类型删除，避免误删同 id 的静态知识
 * @returns {Promise<{success:boolean, docId:string, chunkCount:number, action:string}>}
 */
export async function removeBusinessKnowledge(docId, options = {}) {
  const id = docId === undefined || docId === null ? "" : String(docId).trim();
  if (!id) {
    throw new RagError(RagErrorCode.INVALID_INPUT, "增量删除失败：缺少 docId");
  }

  const docType = normalizeDocType(options.docType, DOC_TYPE_PRODUCT);
  await deleteByDocId(id, { docType });

  const writeResult = writeManifest(removeManifestEntries(readManifest(), [id]));
  if (!writeResult.ok) {
    console.warn(`[rag] 业务知识清单写入失败 docId=${id}: ${writeResult.error}`);
  }

  return { success: true, docId: id, docType, chunkCount: 0, action: "delete" };
}

/**
 * 知识库健康检查：返回库内统计信息
 */
export async function getKnowledgeStats() {
  const manifest = readManifest();
  let docIds = [];
  try {
    docIds = await listDocIds();
  } catch (err) {
    console.error(`[rag] 读取向量库文档列表失败: ${err.message}`);
  }
  return {
    manifestDocs: Object.keys(manifest.docs || {}).length,
    vectorDocs: docIds.length,
    lastSyncAt: manifest.updatedAt,
  };
}

export default {
  syncKnowledgeBase,
  upsertBusinessKnowledge,
  removeBusinessKnowledge,
  indexSingleDoc,
  getKnowledgeStats,
};
