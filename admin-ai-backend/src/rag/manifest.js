/**
 * 增量更新状态清单
 *
 * 记录每条知识上一次入库时的内容指纹，是「首次全量、后续增量」的判定依据：
 *   - 清单不存在 / 为空  -> 首次运行，全量入库
 *   - 指纹变化           -> 只重新向量化该条
 *   - 指纹一致           -> 直接跳过，不调用 Embedding，不写向量库
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR, getRaw } from "../env.js";
import { hashContent } from "./chunker.js";
import { DOC_TYPE_KNOWLEDGE, normalizeDocType } from "./constants.js";

/**
 * 清单文件位置。
 * 默认与 LanceDB 数据目录同级（src/data），可用 KB_MANIFEST_PATH 覆盖，
 * 便于容器里只挂载数据卷、源码树只读的部署方式。
 */
const manifestPathRaw = getRaw("KB_MANIFEST_PATH", "./src/data/kb-manifest.json");
export const MANIFEST_PATH = path.isAbsolute(manifestPathRaw)
  ? manifestPathRaw
  : path.resolve(ROOT_DIR, manifestPathRaw);

const MANIFEST_VERSION = 1;

/** 生成一条知识的内容指纹（标题 + 正文 + 来源） */
export function buildDocHash(doc) {
  return hashContent(`${doc.title || ""} ${doc.content || ""} ${doc.source || ""}`);
}

/** 读取清单，损坏时自动降级为空清单（触发一次全量重建，保证可用） */
export function readManifest(filePath = MANIFEST_PATH) {
  try {
    if (!fs.existsSync(filePath)) {
      return { version: MANIFEST_VERSION, updatedAt: null, docs: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return {
      version: parsed.version ?? MANIFEST_VERSION,
      updatedAt: parsed.updatedAt ?? null,
      docs: parsed.docs && typeof parsed.docs === "object" ? parsed.docs : {},
    };
  } catch (err) {
    console.error(`[rag] 读取增量清单失败，将执行全量入库: ${err.message}`);
    return { version: MANIFEST_VERSION, updatedAt: null, docs: {} };
  }
}

/**
 * 原子写入清单，避免进程中断导致文件损坏。
 *
 * 返回 `{ ok, error }` 而不是静默吞掉异常：
 * 清单没落盘时向量其实已经写入，若调用方以为成功，
 * 下次同步会把所有条目当成「内容未变」而跳过——数据看似入库实则状态丢失。
 * 由调用方决定是告警还是计入失败。
 *
 * @param {object} manifest
 * @param {string} [filePath]
 * @returns {{ ok: boolean, error: string|null, payload: object }}
 */
export function writeManifest(manifest, filePath = MANIFEST_PATH) {
  const payload = {
    version: manifest.version ?? MANIFEST_VERSION,
    updatedAt: new Date().toISOString(),
    docs: manifest.docs || {},
  };

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`[rag] 写入增量清单失败: ${filePath} -> ${err.message}`);
    return { ok: false, error: err.message, payload };
  }
  return { ok: true, error: null, payload };
}

/**
 * 比对当前知识条目与历史清单，得出增量任务。
 *
 * 重要：删除范围必须按 docType 收窄。
 * 文档同步只负责 doc 目录里的静态知识，若把清单里业务侧写入的 product
 * 类知识也一并删除，每次服务重启都会清空业务知识，与「增量更新」目标相悖。
 *
 * 作用域按「本次同步负责的类型集合」判定，而不是只认单一类型：
 * doc/*.json 里可能声明了扩展分类（如 faq），若只放行 knowledge，
 * 这些条目的文件被删除后将永远留在清单与向量库里成为孤儿。
 *
 * @param {Array<{docId,docType?,title,content,source}>} docs 当前来源提供的知识
 * @param {object} manifest
 * @param {{ scopeDocType?: string, scopeDocTypes?: string[] }} [options]
 *        本次同步负责的知识类型（scopeDocTypes 优先，支持多类型）
 * @returns {{toUpsert: Array<object>, toDelete: string[], unchanged: number, isFirstRun: boolean}}
 */
export function diffDocs(docs, manifest, options = {}) {
  const scopeTypes = new Set(
    (options.scopeDocTypes || [options.scopeDocType ?? DOC_TYPE_KNOWLEDGE]).map((t) =>
      normalizeDocType(t),
    ),
  );
  const known = manifest?.docs || {};
  const inScope = (entry) => scopeTypes.has(normalizeDocType(entry?.docType));

  // 首次运行的判定同样按类型收敛：库里只有业务知识、还没有文档知识时，
  // 文档同步仍应视作首次全量
  const isFirstRun = !Object.entries(known).some(([, entry]) => inScope(entry));

  const toUpsert = [];
  let unchanged = 0;
  const seen = new Set();

  for (const doc of docs) {
    const docId = String(doc.docId);
    seen.add(docId);
    const hash = buildDocHash(doc);
    const previous = known[docId];

    if (previous && previous.hash === hash) {
      unchanged++;
      continue;
    }
    toUpsert.push({ ...doc, hash, isNew: !previous });
  }

  // 清单里有、但当前来源已不存在，且属于本次同步负责的类型 -> 才清理旧向量
  const toDelete = Object.keys(known).filter(
    (docId) => !seen.has(docId) && inScope(known[docId]),
  );

  return { toUpsert, toDelete, unchanged, isFirstRun };
}

/** 用最新的入库结果更新清单条目 */
export function applyManifestUpdates(manifest, entries) {
  const docs = { ...(manifest.docs || {}) };
  for (const entry of entries) {
    docs[String(entry.docId)] = {
      hash: entry.hash,
      chunkCount: entry.chunkCount,
      title: entry.title || "",
      source: entry.source || "",
      // 记录类型，供后续同步判断删除范围
      docType: normalizeDocType(entry.docType),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
  }
  return { ...manifest, docs };
}

/** 从清单中移除条目 */
export function removeManifestEntries(manifest, docIds) {
  const docs = { ...(manifest.docs || {}) };
  for (const docId of docIds || []) delete docs[String(docId)];
  return { ...manifest, docs };
}

/**
 * 移除某一类型的全部条目（全量重建某类知识时使用）。
 * 与 removeManifestEntries 的区别：按 docType 批量清理，且不影响其它类型，
 * 保证「重建静态知识」不会连带清空业务知识的清单记录。
 * @param {object} manifest
 * @param {string} docType
 */
export function dropManifestByType(manifest, docType) {
  const target = normalizeDocType(docType);
  const docs = {};
  for (const [docId, entry] of Object.entries(manifest?.docs || {})) {
    if (normalizeDocType(entry?.docType, target) === target) continue;
    docs[docId] = entry;
  }
  return { ...manifest, docs };
}

export default {
  MANIFEST_PATH,
  buildDocHash,
  readManifest,
  writeManifest,
  diffDocs,
  applyManifestUpdates,
  removeManifestEntries,
  dropManifestByType,
};
