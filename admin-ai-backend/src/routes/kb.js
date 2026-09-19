/**
 * 知识库增量更新接口（需求 5 / 6）
 *
 * 设计要点：
 * 1. 业务侧（admin-mock-backend）在「业务数据写入成功」后调用本接口，
 *    接口立即返回 202，真正的向量重建在后台串行队列中异步完成，不阻塞业务写库。
 * 2. 所有向量操作走同一条串行队列，避免同一 docId 的 delete/add 交错导致脏数据。
 * 3. 任务失败只记录日志并保留重试记录，不向调用方抛错，不影响业务主流程。
 */
import express from "express";
import { kbSyncToken, kbQueueMaxSize } from "../env.js";
import {
  syncKnowledgeBase,
  upsertBusinessKnowledge,
  removeBusinessKnowledge,
  getKnowledgeStats,
} from "../rag/indexer.js";
import { retrieveKnowledge } from "../rag/retriever.js";
import { countRows } from "../rag/vectorStore.js";
import { RagError, RagErrorCode, FRIENDLY_MESSAGE } from "../rag/errors.js";
import { DOC_TYPES, DOC_TYPE_PRODUCT } from "../rag/constants.js";

/**
 * 业务侧只允许写入 product 类型。
 * docType 是向量库的分区键，也是增量同步判断删除范围的依据：
 * 若放行任意类型，业务侧可以创建出「文档同步不负责、业务接口也找不到」的
 * 知识条目，其向量既不会被更新也不会被清理，永久残留在库里。
 * 扩展分类只能来自 doc/*.json，不能来自 HTTP。
 * @param {unknown} value
 * @returns {string|null} 合法则返回归一化后的类型，非法返回 null
 */
function resolveRequestDocType(value) {
  if (value === undefined || value === null || value === "") return DOC_TYPE_PRODUCT;

  const type = String(value).trim();
  if (!DOC_TYPES.includes(type)) return null;
  if (type !== DOC_TYPE_PRODUCT) return null;
  return type;
}

export const kbRouter = express.Router();

// ---------------------------------------------------------------- 异步任务队列
/** 待处理任务队列 */
const taskQueue = [];
/** 队列是否正在消费 */
let draining = false;
/** 运行期统计，便于排查增量更新是否生效 */
export const kbStats = {
  total: 0,
  succeeded: 0,
  failed: 0,
  rejected: 0,
  lastTask: null,
  lastError: null,
};

/**
 * 串行消费队列：保证同一时刻只有一个向量写操作，
 * 避免并发 delete + add 相互覆盖。
 */
async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    while (taskQueue.length > 0) {
      const task = taskQueue.shift();
      try {
        await task.run();
        kbStats.succeeded++;
      } catch (err) {
        kbStats.failed++;
        kbStats.lastError = { label: task.label, message: err?.message };
        // 失败只记录，不影响后续任务与业务主流程
        console.error(`[kb] 后台任务失败 ${task.label}: ${err?.message}`);
      } finally {
        kbStats.lastTask = { label: task.label, at: new Date().toISOString() };
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * 投递异步任务。
 * 队列有上限：业务侧高频写入时若后台消费跟不上，直接拒绝并计数，
 * 避免任务无界堆积把进程内存吃满。
 * @param {string} label 任务标识
 * @param {() => Promise<any>} run 任务体
 * @returns {{accepted: boolean, pending: number}}
 */
export function enqueueKbTask(label, run) {
  if (taskQueue.length >= kbQueueMaxSize) {
    kbStats.rejected++;
    kbStats.lastError = { label, message: `队列已满(${kbQueueMaxSize})，任务被拒绝` };
    console.error(`[kb] 队列已满(${kbQueueMaxSize})，拒绝任务 ${label}`);
    return { accepted: false, pending: taskQueue.length };
  }

  kbStats.total++;
  taskQueue.push({ label, run });
  // 立即让出事件循环，接口先响应，任务在后台执行
  setImmediate(drainQueue);
  return { accepted: true, pending: taskQueue.length };
}

/** 等待队列清空（测试用） */
export async function waitForQueueIdle(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while ((draining || taskQueue.length > 0) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return taskQueue.length === 0 && !draining;
}

/** 当前队列积压情况 */
export function getQueueStatus() {
  return { pending: taskQueue.length, draining, ...kbStats };
}

// -------------------------------------------------------------------- 鉴权
/** 无鉴权模式的告警只打一次，避免每个请求都刷日志 */
let noTokenWarned = false;

/**
 * 常量时间比较，避免逐字符比较的耗时差异泄露令牌内容。
 * 长度不同直接判否（长度本身不是秘密），长度相同时用异或累加。
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a), "utf-8");
  const right = Buffer.from(String(b), "utf-8");
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

/**
 * 校验业务侧同步令牌。
 * 未配置 KB_SYNC_TOKEN 时（本地开发）放行并告警，配置后强制校验。
 */
function authGuard(req, res, next) {
  if (!kbSyncToken) {
    if (!noTokenWarned) {
      noTokenWarned = true;
      console.warn("[kb] 未配置 KB_SYNC_TOKEN，接口处于无鉴权模式，仅限本地开发使用");
    }
    return next();
  }
  const token =
    req.get("x-kb-token") ||
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

  if (!timingSafeEqual(token, kbSyncToken)) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "知识库同步令牌校验失败",
    });
  }
  return next();
}

kbRouter.use(authGuard);

// -------------------------------------------------------------------- 接口

/**
 * POST /kb/upsert
 * 业务数据新增/修改后调用，单条知识增量更新。
 * body: { docId, title, content|text, source, docType }
 */
kbRouter.post("/upsert", (req, res) => {
  const body = req.body || {};
  const docId = body.docId === undefined || body.docId === null ? "" : String(body.docId).trim();
  const content = String(body.content ?? body.text ?? "").trim();

  if (!docId) {
    return res.status(400).json({
      success: false,
      code: RagErrorCode.INVALID_INPUT,
      message: "缺少 docId，无法定位知识条目",
    });
  }
  if (!content) {
    return res.status(400).json({
      success: false,
      code: RagErrorCode.INVALID_INPUT,
      message: "content 不能为空；如需删除知识请调用 /kb/delete",
    });
  }

  const docType = resolveRequestDocType(body.docType);
  if (!docType) {
    return res.status(400).json({
      success: false,
      code: RagErrorCode.INVALID_INPUT,
      message: `docType 非法：业务侧仅允许 ${DOC_TYPE_PRODUCT}`,
    });
  }

  // 异步执行，立即返回，避免阻塞业务写库事务
  const task = enqueueKbTask(`upsert:${docId}`, () =>
    upsertBusinessKnowledge({
      docId,
      title: body.title,
      content,
      source: body.source,
      docType,
    }),
  );

  // 队列打满时不假装受理，明确告知业务侧稍后重试
  if (!task.accepted) {
    return res.status(503).json({
      success: false,
      code: "QUEUE_FULL",
      docId,
      message: "知识库更新队列繁忙，请稍后重试（业务数据已正常保存）",
    });
  }

  return res.status(202).json({
    success: true,
    action: "upsert",
    docId,
    message: "知识库增量更新已受理，正在后台处理",
    queue: task.pending,
  });
});

/**
 * POST /kb/delete
 * 业务数据删除后调用，清掉该条知识的全部向量。
 * body: { docId }
 */
kbRouter.post("/delete", (req, res) => {
  const docId = req.body?.docId === undefined || req.body?.docId === null
    ? ""
    : String(req.body.docId).trim();

  if (!docId) {
    return res.status(400).json({
      success: false,
      code: RagErrorCode.INVALID_INPUT,
      message: "缺少 docId，无法定位知识条目",
    });
  }

  const docType = resolveRequestDocType(req.body?.docType);
  if (!docType) {
    return res.status(400).json({
      success: false,
      code: RagErrorCode.INVALID_INPUT,
      message: `docType 非法：业务侧仅允许 ${DOC_TYPE_PRODUCT}`,
    });
  }

  // 按业务知识类型删除：docId 只在类型内唯一，
  // 不加 docType 会把同 id 的静态文档知识一并删掉
  const task = enqueueKbTask(`delete:${docId}`, () =>
    removeBusinessKnowledge(docId, { docType }),
  );

  if (!task.accepted) {
    return res.status(503).json({
      success: false,
      code: "QUEUE_FULL",
      docId,
      message: "知识库更新队列繁忙，请稍后重试（业务数据已正常保存）",
    });
  }

  return res.status(202).json({
    success: true,
    action: "delete",
    docId,
    message: "知识库删除任务已受理，正在后台处理",
    queue: task.pending,
  });
});

/**
 * POST /kb/sync
 * 手动触发 doc 目录同步（默认增量，body.force=true 时全量重建）
 */
kbRouter.post("/sync", (req, res) => {
  const force = Boolean(req.body?.force);
  const task = enqueueKbTask(force ? "sync:full" : "sync:incremental", () =>
    syncKnowledgeBase({ force }),
  );

  if (!task.accepted) {
    return res.status(503).json({
      success: false,
      code: "QUEUE_FULL",
      message: "知识库更新队列繁忙，请稍后重试",
    });
  }

  return res.status(202).json({
    success: true,
    action: "sync",
    mode: force ? "full" : "incremental",
    message: "知识库同步任务已受理，正在后台处理",
  });
});

/**
 * GET /kb/queue —— 增量更新队列状态
 * 注意：必须定义在本 router 内。若挂在 app 上，/kb 前缀的 router 会先命中
 * 鉴权中间件，导致该路由永远不可达。
 */
kbRouter.get("/queue", (req, res) => {
  res.json({ success: true, data: getQueueStatus() });
});

/** GET /kb/stats —— 知识库与队列状态 */
kbRouter.get("/stats", async (req, res) => {
  try {
    const stats = await getKnowledgeStats();
    const vectorChunks = await countRows().catch(() => -1);
    return res.json({
      success: true,
      data: { ...stats, vectorChunks, queue: getQueueStatus() },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: err.code || RagErrorCode.VECTOR_DB_FAILED,
      message: err.friendlyMessage || FRIENDLY_MESSAGE[RagErrorCode.VECTOR_DB_FAILED],
    });
  }
});

/**
 * POST /kb/search —— 检索调试接口
 * 便于排查「检索为空 / 召回不准」，直接返回命中片段与来源
 * body: { question, topK, threshold }
 */
kbRouter.post("/search", async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) {
    return res.status(400).json({ success: false, message: "question 不能为空" });
  }

  // 该接口不抛错：检索失败时返回降级信息，方便定位问题
  const result = await retrieveKnowledge(question, {
    topK: req.body?.topK,
    threshold: req.body?.threshold,
    docType: req.body?.docType,
  });

  return res.json({
    success: true,
    data: {
      question: result.question,
      rewrittenQuery: result.query,
      rewritten: result.rewritten,
      hasContext: result.hasContext,
      degraded: result.degraded,
      notice: result.notice,
      count: result.results.length,
      sources: result.sources,
      hits: result.results.map((item) => ({
        id: item.id,
        score: item.score,
        source: item.source,
        title: item.title,
        text: String(item.text || "").slice(0, 120),
      })),
    },
  });
});

export default kbRouter;
