/**
 * LanceDB 向量库访问层
 *
 * 表结构（knowledge_chunks）：
 *   id         主键，形如 `knowledge:12#0`（docType:docId#chunkIndex）
 *   vector     Embedding 向量，维度取自 EMBEDDING_DIMENSIONS
 *   text       片段正文
 *   title      所属条目标题
 *   source     溯源元信息（doc 中 json 的 source 字段 / 业务数据标识）
 *   docId      来源业务主键，增量更新与删除以它为最小粒度
 *   docType    knowledge（doc 静态知识） | product（业务数据）
 *   chunkIndex 片段在文档内的序号
 *   hash       内容指纹，用于增量比对
 *   updatedAt  入库时间（ISO 字符串）
 *
 * 增量能力：单文档粒度的 delete + add，不做全量重建。
 */
import fs from "node:fs";
import * as lancedb from "@lancedb/lancedb";
import { Schema, Field, FixedSizeList, Float32, Utf8, Int32 } from "apache-arrow";
import {
  lanceDbPath,
  lanceTable,
  embeddingDimensions,
  embeddingModel,
  ragTimeoutMs,
  ragTopK,
} from "../env.js";
import { RagError, RagErrorCode, withTimeout, isTimeoutError } from "./errors.js";

/**
 * 查询时选出的列，避免把 1024 维向量白白拉回内存。
 * `_distance` 必须显式声明：LanceDB 新版本不再自动附加该列，
 * 不声明会导致相似度分数丢失。
 */
const SEARCH_COLUMNS = [
  "id",
  "text",
  "title",
  "source",
  "docId",
  "docType",
  "chunkIndex",
  "updatedAt",
  "_distance",
];

let dbInstance = null;
let tableInstance = null;

/** 转义 LanceDB 过滤表达式中的单引号，防止表达式注入 */
export function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

/** 连接 LanceDB（首次调用时建目录） */
export async function getDb() {
  if (dbInstance) return dbInstance;
  try {
    if (!fs.existsSync(lanceDbPath)) {
      fs.mkdirSync(lanceDbPath, { recursive: true });
    }
    dbInstance = await lancedb.connect(lanceDbPath);
    return dbInstance;
  } catch (err) {
    throw new RagError(
      RagErrorCode.VECTOR_DB_FAILED,
      `连接向量库失败(${lanceDbPath}): ${err.message}`,
      { cause: err },
    );
  }
}

/** 构建向量表结构，显式声明向量维度，避免空表推导不出 FixedSizeList */
export function buildSchema(dimensions = embeddingDimensions) {
  return new Schema([
    new Field("id", new Utf8()),
    new Field("vector", new FixedSizeList(dimensions, new Field("item", new Float32()))),
    new Field("text", new Utf8()),
    new Field("title", new Utf8()),
    new Field("source", new Utf8()),
    new Field("docId", new Utf8()),
    new Field("docType", new Utf8()),
    new Field("chunkIndex", new Int32()),
    new Field("hash", new Utf8()),
    new Field("updatedAt", new Utf8()),
  ]);
}

/**
 * 校验已存在的向量表维度是否与当前配置一致。
 *
 * 改了 EMBEDDING_MODEL / EMBEDDING_DIMENSIONS 之后复用旧表，
 * 每次写入都会在 Arrow 内部报出难以定位的维度错误；
 * 这里提前拦下并给出可操作的提示。
 * @param {object} table
 */
async function assertSchemaMatches(table) {
  let vectorField;
  try {
    const schema = await table.schema();
    vectorField = schema?.fields?.find((f) => f.name === "vector");
  } catch (err) {
    console.warn(`[rag] 读取向量表结构失败，跳过维度校验: ${err.message}`);
    return;
  }
  if (!vectorField) return;

  const actual = vectorField.type?.listSize;
  if (typeof actual === "number" && actual !== embeddingDimensions) {
    throw new RagError(
      RagErrorCode.VECTOR_DB_FAILED,
      `向量表 ${lanceTable} 的维度(${actual})与当前配置 EMBEDDING_DIMENSIONS=${embeddingDimensions} 不一致。` +
        `更换 Embedding 模型后需重建索引：删除 ${lanceDbPath} 目录后执行 npm run kb:rebuild`,
      { context: { expected: embeddingDimensions, actual, model: embeddingModel } },
    );
  }
}

/**
 * 获取向量表；不存在时按 schema 创建空表。
 * @param {{ createIfMissing?: boolean }} [options]
 */
export async function getTable(options = {}) {
  const { createIfMissing = true } = options;
  if (tableInstance) return tableInstance;

  const db = await getDb();
  try {
    const names = await db.tableNames();
    if (names.includes(lanceTable)) {
      // 校验通过后才写入缓存句柄：若先缓存再校验，assertSchemaMatches 抛出
      // （换 Embedding 模型后维度不一致）时句柄已经留在模块级变量里，
      // 后续每次调用都会在 `if (tableInstance) return tableInstance` 处直接命中，
      // 校验再也不会执行 —— 维度不匹配只报一次，之后一直拿着错表跑到 Arrow 层报错
      const opened = await db.openTable(lanceTable);
      await assertSchemaMatches(opened);
      tableInstance = opened;
      return tableInstance;
    }
    if (!createIfMissing) return null;
    tableInstance = await db.createEmptyTable(lanceTable, buildSchema(), {
      mode: "create",
      existOk: true,
    });
    console.log(`[rag] 向量表 ${lanceTable} 不存在，已按维度 ${embeddingDimensions} 创建`);
    return tableInstance;
  } catch (err) {
    // 已是 RagError 说明是内部校验主动抛出的（如维度不一致），
    // 再包一层会把 context 里的排查线索（期望/实际维度）压成一段文本
    if (err instanceof RagError) throw err;
    throw new RagError(
      RagErrorCode.VECTOR_DB_FAILED,
      `打开向量表 ${lanceTable} 失败: ${err.message}`,
      { cause: err },
    );
  }
}

/** 统一包装向量库操作：超时 + 错误归一 */
async function runDbOperation(fn, label) {
  try {
    return await withTimeout(fn(), ragTimeoutMs, label);
  } catch (err) {
    if (err instanceof RagError) throw err;
    if (isTimeoutError(err)) {
      throw new RagError(RagErrorCode.VECTOR_DB_TIMEOUT, `${label}超时: ${err.message}`, {
        cause: err,
      });
    }
    throw new RagError(RagErrorCode.VECTOR_DB_FAILED, `${label}失败: ${err.message}`, {
      cause: err,
    });
  }
}

/** 表内记录总数 */
export async function countRows() {
  const table = await getTable();
  return runDbOperation(() => table.countRows(), "统计向量条数");
}

/**
 * 只读巡检：不建目录、不建表、不写盘。
 *
 * 供健康检查使用。该接口无鉴权且前端每次页面加载都会调用，不能有副作用：
 * 走 getTable() 默认的 createIfMissing=true 会在全新部署上顺手建出一个空表，
 * 把「知识库尚未初始化」伪装成「一切正常」。
 * 表存在但维度与配置不一致时，assertSchemaMatches 会抛出 RagError，
 * 由调用方按「配置不匹配」而非「服务不可用」来呈现。
 *
 * @returns {Promise<{ ready: boolean, chunks: number }>}
 */
export async function inspectTable() {
  // getDb() 在目录缺失时会建目录，这里先行判断，保证探测完全只读
  if (!fs.existsSync(lanceDbPath)) return { ready: false, chunks: 0 };

  const table = await getTable({ createIfMissing: false });
  if (!table) return { ready: false, chunks: 0 };

  const chunks = await runDbOperation(() => table.countRows(), "统计向量条数");
  return { ready: true, chunks };
}

/** 新增向量记录 */
export async function addRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return 0;
  const table = await getTable();
  await runDbOperation(() => table.add(records), "写入向量记录");
  return records.length;
}

/**
 * 从 delete 结果中取出真实删除行数。
 * LanceDB 返回 { numDeletedRows }，旧版本或异常结构下退化为 0，
 * 调用方据此统计即可，不影响删除语义本身。
 * @param {unknown} result
 * @returns {number}
 */
function extractDeletedRows(result) {
  const rows = result?.numDeletedRows;
  return typeof rows === "number" && Number.isFinite(rows) ? rows : 0;
}

/** 按主键批量删除，返回实际删除行数 */
export async function deleteByIds(ids) {
  const list = (ids || []).filter(Boolean);
  if (list.length === 0) return 0;
  const table = await getTable();
  const predicate = list.map((id) => `'${escapeSqlString(id)}'`).join(", ");
  const result = await runDbOperation(
    () => table.delete(`id IN (${predicate})`),
    "按主键删除向量",
  );
  return extractDeletedRows(result);
}

/**
 * 按来源文档删除其全部片段。
 * 这是增量更新的关键：改/删一条业务知识前先清掉它的旧向量，避免残留脏数据。
 *
 * 重要：docId 只在 docType 内唯一（片段主键是 `docType:docId#index`）。
 * doc/knowledge.json 用的是纯数字 id（1..42），业务侧商品 id 也可能取同样的值，
 * 若只用 docId 过滤，一次业务删除会把同 id 的静态文档知识一并清掉。
 * 因此调用方应尽量传入 docType 收窄范围。
 *
 * @param {string} docId
 * @param {{ docType?: string }} [options] 传入 docType 时按 (docId, docType) 精确删除
 * @returns {Promise<number>} 实际删除的片段数（不存在时为 0）
 */
export async function deleteByDocId(docId, options = {}) {
  if (!docId) return 0;
  const table = await getTable();
  const docType = options.docType;
  const predicate = docType
    ? `docId = '${escapeSqlString(docId)}' AND docType = '${escapeSqlString(docType)}'`
    : `docId = '${escapeSqlString(docId)}'`;

  const result = await runDbOperation(
    () => table.delete(predicate),
    `删除文档向量(docId=${docId}${docType ? `, docType=${docType}` : ""})`,
  );
  return extractDeletedRows(result);
}

/** 按 docType 批量删除（用于重置某一类知识），返回实际删除行数 */
export async function deleteByDocType(docType) {
  if (!docType) return 0;
  const table = await getTable();
  const result = await runDbOperation(
    () => table.delete(`docType = '${escapeSqlString(docType)}'`),
    `按类型删除向量(docType=${docType})`,
  );
  return extractDeletedRows(result);
}

/**
 * 单条知识增量更新：先删旧向量，再写入新片段。
 * 全程只影响该 docId，不触碰其它文档，满足「不做全量重建」的约束。
 * @param {string} docId
 * @param {Array<Record<string, unknown>>} records 已包含向量的完整记录
 */
export async function upsertDocChunks(docId, records, options = {}) {
  if (!docId) {
    throw new RagError(RagErrorCode.INVALID_INPUT, "upsertDocChunks 需要有效的 docId");
  }
  const deleted = await deleteByDocId(docId, { docType: options.docType });
  const written = await addRecords(records);
  return { docId, deleted, inserted: written };
}

/** 列出当前库中所有来源文档 id（增量比对用） */
export async function listDocIds() {
  const table = await getTable();
  const rows = await runDbOperation(
    () => table.query().select(["docId"]).toArray(),
    "读取已入库文档列表",
  );
  return [...new Set(rows.map((r) => r.docId))];
}

/**
 * 向量检索
 * @param {number[]} vector 查询向量
 * @param {{ topK?: number, docType?: string }} [options]
 * @returns {Promise<Array<{id,text,title,source,docId,docType,score}>>} score 为余弦相似度(0~1)
 */
export async function searchVectors(vector, options = {}) {
  // 默认取配置值，避免硬编码 5 绕过 RAG_TOP_K
  const { topK = ragTopK, docType } = options;
  const limit = Number.isInteger(topK) && topK > 0 ? topK : ragTopK;
  const table = await getTable();

  const rows = await runDbOperation(() => {
    let q = table.search(vector).distanceType("cosine").select(SEARCH_COLUMNS);
    if (docType) q = q.where(`docType = '${escapeSqlString(docType)}'`);
    return q.limit(limit).toArray();
  }, "向量检索");

  return (rows || []).map((row) => {
    // 缺失 _distance 说明 select 列表或 LanceDB 版本出了问题，
    // 不能静默记 0 分——那会被阈值过滤掉，让整个 RAG 悄悄退化成「无资料」。
    if (typeof row._distance !== "number") {
      console.warn(
        `[rag] 检索结果缺少 _distance 字段(id=${row.id})，相似度无法计算，请核对 SEARCH_COLUMNS 与向量库版本`,
      );
    }
    return {
      id: row.id,
      text: row.text,
      title: row.title,
      source: row.source,
      docId: row.docId,
      docType: row.docType,
      chunkIndex: row.chunkIndex,
      // 余弦距离 -> 余弦相似度
      score:
        typeof row._distance === "number" ? Number((1 - row._distance).toFixed(4)) : 0,
    };
  });
}

/**
 * 清空整表（仅在显式全量重建时调用）
 *
 * 仅忽略「表不存在」这一种情况。权限不足、数据集被占用、IO 错误等
 * 必须原样抛出：否则 getTable() 会把仍然存在的表重新打开并打印「已重置」，
 * 让一次「全量重建」实际变成向旧数据追加，产生重复向量。
 */
export async function resetTable() {
  const db = await getDb();
  try {
    await db.dropTable(lanceTable);
  } catch (err) {
    const message = String(err?.message || "");
    if (!/not found|does not exist|No such/i.test(message)) {
      throw new RagError(
        RagErrorCode.VECTOR_DB_FAILED,
        `重置向量表 ${lanceTable} 失败: ${message}`,
        { cause: err },
      );
    }
    // 表本就不存在，等价于已重置
  }
  tableInstance = null;
  await getTable();
  console.log(`[rag] 向量表 ${lanceTable} 已重置`);
  return true;
}

/** 测试用：重置模块内缓存的连接与表句柄 */
export function __resetForTest() {
  dbInstance = null;
  tableInstance = null;
}

/** 测试用：覆盖数据库/表句柄 */
export function __setInstancesForTest(db, table) {
  dbInstance = db;
  tableInstance = table;
}

export { lanceDbPath, lanceTable, SEARCH_COLUMNS };

export default {
  getDb,
  getTable,
  buildSchema,
  addRecords,
  deleteByIds,
  deleteByDocId,
  deleteByDocType,
  upsertDocChunks,
  listDocIds,
  searchVectors,
  countRows,
  inspectTable,
  resetTable,
  escapeSqlString,
};
