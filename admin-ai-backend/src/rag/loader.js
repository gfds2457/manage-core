/**
 * doc 目录知识装载器
 *
 * 读取 doc/*.json，归一成统一的知识条目结构：
 *   { docId, docType, title, content, source, file }
 *
 * 对不规范数据采取「跳过并记录」策略，单个坏文件不影响整体入库。
 */
import fs from "node:fs";
import path from "node:path";
import { docDir } from "../env.js";
import { DOC_TYPE_KNOWLEDGE, normalizeDocType } from "./constants.js";

/**
 * 把 JSON 中的一条记录归一成知识条目。
 * @param {any} item 原始记录
 * @param {{ file: string, index: number, fallbackIdPrefix: string }} ctx
 * @returns {{docId,docType,title,content,source,file}|null}
 */
export function normalizeDocItem(item, ctx) {
  if (item === null || item === undefined) return null;

  // 支持字符串数组形式的知识文件
  if (typeof item === "string") {
    const content = item.trim();
    if (!content) return null;
    return {
      docId: `${ctx.fallbackIdPrefix}-${ctx.index}`,
      docType: DOC_TYPE_KNOWLEDGE,
      title: "",
      content,
      source: ctx.file,
      file: ctx.file,
    };
  }

  if (typeof item !== "object") return null;

  // 兼容 content / text / description 等常见正文字段
  const content = String(
    item.content ?? item.text ?? item.description ?? item.desc ?? "",
  ).trim();
  if (!content) return null;

  const rawId = item.id ?? item.docId ?? item.key ?? `${ctx.fallbackIdPrefix}-${ctx.index}`;

  return {
    docId: String(rawId),
    docType: normalizeDocType(item.docType),
    title: String(item.title ?? item.name ?? "").trim(),
    content,
    // source 为可溯源元信息，缺失时退化为文件名
    source: String(item.source ?? item.file ?? ctx.file).trim() || ctx.file,
    file: ctx.file,
  };
}

/**
 * 解析单个 json 文件内容为知识条目数组
 * @param {string} raw 文件文本
 * @param {string} file 文件名（用于溯源与兜底 id）
 * @returns {Array<object>}
 */
export function parseDocFile(raw, file) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[rag] 解析知识文件失败，已跳过: ${file} -> ${err.message}`);
    return [];
  }

  // 支持顶层数组，或 { data: [...] } / { list: [...] } 包裹
  let list;
  if (Array.isArray(parsed)) list = parsed;
  else if (Array.isArray(parsed?.data)) list = parsed.data;
  else if (Array.isArray(parsed?.list)) list = parsed.list;
  else if (parsed && typeof parsed === "object") list = [parsed];
  else return [];

  const fallbackIdPrefix = path.basename(file, path.extname(file));
  return list
    .map((item, index) => normalizeDocItem(item, { file, index, fallbackIdPrefix }))
    .filter(Boolean);
}

/**
 * 读取 doc 目录下全部 json 知识文件
 * @param {{ dir?: string }} [options]
 * @returns {Array<object>} 知识条目数组
 */
export function loadKnowledgeDocs(options = {}) {
  const dir = options.dir || docDir;

  if (!fs.existsSync(dir)) {
    // 目录缺失属于部署/配置错误，不能降级成「0 条知识」——
    // 那样同步会报告成功、健康检查显示正常，而知识库实际是空的。
    throw new Error(`知识库目录不存在: ${dir}，请确认 doc 目录已随服务一起部署`);
  }

  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name);

  const docs = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const items = parseDocFile(raw, file);
      docs.push(...items);
    } catch (err) {
      console.error(`[rag] 读取知识文件失败，已跳过: ${file} -> ${err.message}`);
    }
  }

  // docId 是增量同步的最小粒度，重复会导致后写入的覆盖先写入的，
  // diffDocs/清单只保留最后一条，前面的向量成为无法清理的孤儿。
  const seen = new Map();
  const unique = [];
  for (const doc of docs) {
    const key = String(doc.docId);
    if (seen.has(key)) {
      console.error(
        `[rag] 发现重复 docId=${key}（${seen.get(key)} 与 ${doc.file}），` +
          `已保留后者并跳过前者，请修正知识文件避免向量孤儿`,
      );
      unique[unique.findIndex((d) => String(d.docId) === key)] = doc;
      seen.set(key, doc.file);
      continue;
    }
    seen.set(key, doc.file);
    unique.push(doc);
  }

  console.log(`[rag] 知识目录 ${dir} 共读取 ${files.length} 个文件，${unique.length} 条知识`);
  return unique;
}

export default { loadKnowledgeDocs, parseDocFile, normalizeDocItem };
