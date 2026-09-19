/**
 * 健康检测接口（需求 4：页面加载预检测后端是否在线）
 *
 * 设计要点：
 * 1. 前端在页面加载时先探测本接口，提前判断 AI 后端是否在线，
 *    避免用户输完问题、点了发送才收到 net::ERR_CONNECTION_REFUSED。
 * 2. 只要进程还活着就返回 200，连通性结论放在 body.status 里。
 *    前端据此区分两种情况：请求本身失败 =「服务没起来」；
 *    请求成功但 status=degraded =「服务起来了，但某个依赖挂了」。
 *    若用 5xx 表达降级，前端会误判成网络故障，给出错误的排障方向。
 * 3. 依赖探测统一加超时与兜底：任一下游卡住都不会把健康检查一起拖死，
 *    否则「用来发现卡死的接口」自己就成了新的卡死点。
 * 4. 探测结果做缓存 + 合并 + 冷却：本接口无鉴权且每次页面加载都会触发，
 *    探测用的又是与问答主链路共用的 MySQL 连接池（connectionLimit=8），
 *    若每个请求都实打实查一次库，下游一慢就会把连接池排满、把正常问答饿死。
 */
import express from "express";
import pkg from "../../package.json" with { type: "json" };
import { getConfigSummary, port } from "../env.js";
import { probe } from "../mysql.js";
import { inspectTable } from "../rag/vectorStore.js";
// 复用 RAG 模块的超时工具：它额外做了 timer.unref() 与「吞掉超时后迟到的拒绝」，
// 在本文件里再实现一份只会让两处行为慢慢跑偏
import { withTimeout, RagErrorCode } from "../rag/errors.js";

/**
 * 允许透出给前端的错误码白名单 —— 全部来自 RagErrorCode 这个有限枚举。
 * 不能改成「只要有 string 类型的 code 就透出」：mysql2 的报错同样带 code
 * （ECONNREFUSED / ER_ACCESS_DENIED_ERROR / ENOTFOUND …），
 * 那是原始基础设施错误码，属于本接口明确要避免的泄露内容。
 */
const SAFE_ERROR_CODES = new Set(Object.values(RagErrorCode));

/** 单个依赖的探测超时，超过即判定该依赖不可用，保证接口整体快速返回 */
export const PROBE_TIMEOUT_MS = 3000;

/** 探测结果缓存时长：窗口内的重复探测直接复用，不重复打下游 */
export const PROBE_CACHE_TTL_MS = 5000;

/**
 * 依赖不可用后的冷却时长。
 * 下游宕机时探测请求本身也会失败（且失败前要一直等到超时），
 * 冷却期内直接复用上一次的降级结论，避免故障期间请求越堆越多。
 */
export const PROBE_FAILURE_COOLDOWN_MS = 15000;

/**
 * 服务标识，便于前端日志里区分多个后端。
 * 直接取 package.json 的 name，避免与真实包名各写一份、慢慢对不上。
 */
export const SERVICE_NAME = pkg.name;

/** 依赖的中文名，用于拼接对外提示与服务端日志 */
const DEPENDENCY_LABELS = {
  database: "数据库",
  vectorStore: "向量库",
};

/** 进程启动时间，用于计算 uptime */
const startedAt = Date.now();

/**
 * 探测失败的对外描述。
 * 原始报错只写服务端日志：MySQL 的报错里常带连接串与账号，
 * LanceDB 的报错里带数据目录绝对路径，直接塞进响应体等于对外泄露内网结构。
 * 对外只给一个可读提示 + 有限的错误码，足够前端区分「超时」与「连不上」。
 * @param {"database"|"vectorStore"} name
 * @param {unknown} err
 * @returns {{ code: string, message: string }}
 */
function describeProbeFailure(name, err) {
  const label = DEPENDENCY_LABELS[name] || name;
  console.error(`[health] ${label}探测失败:`, err?.message || err);

  // 只透出白名单里的枚举码（如 VECTOR_DB_FAILED / VECTOR_DB_TIMEOUT）：
  // 它们本身不含内网信息，能让前端区分「配置不匹配」和「服务不可用」，
  // 免得把维度不一致这类配置问题一律显示成「向量库挂了」
  if (typeof err?.code === "string" && SAFE_ERROR_CODES.has(err.code)) {
    return { code: err.code, message: `${label}异常` };
  }

  // 超时工具抛出的错误 name 为 TimeoutError，且 message 里带「超时」
  const timedOut =
    err?.name === "TimeoutError" || /超时/.test(String(err?.message || ""));

  return {
    code: timedOut ? "PROBE_TIMEOUT" : "PROBE_FAILED",
    message: `${label}不可用`,
  };
}

/**
 * 探测数据库连通性。
 * 会话与消息都落在 MySQL，数据库不可用时问答主链路无法工作，属强依赖。
 * 探测本身失败不抛出，转为 { status: "down" } 交给上层汇总。
 * @returns {Promise<{ status: string, code?: string, message?: string }>}
 */
export async function probeDatabase() {
  try {
    // 走探测专用连接池 + 超时销毁连接，避免探测卡住时占用业务连接
    await probe({ timeoutMs: PROBE_TIMEOUT_MS });
    return { status: "up" };
  } catch (err) {
    return { status: "down", ...describeProbeFailure("database", err) };
  }
}

/**
 * 探测向量库（LanceDB）连通性。
 * 向量库只影响知识库检索，检索链路本身有降级兜底，因此它是弱依赖。
 *
 * 用只读巡检而非 countRows()：后者会顺手把表建出来，
 * 让「知识库尚未初始化」显示成「一切正常」。
 * @returns {Promise<{ status: string, chunks?: number, code?: string, message?: string }>}
 */
export async function probeVectorStore() {
  try {
    const { ready, chunks } = await withTimeout(inspectTable(), PROBE_TIMEOUT_MS, "向量库");
    if (!ready) {
      // 表还没建不是「服务挂了」，是知识库没初始化：
      // 用独立错误码让前端提示出可执行的下一步，而不是笼统的不可用
      return {
        status: "down",
        code: "VECTOR_STORE_EMPTY",
        message: "向量库尚未初始化，知识库检索不可用",
      };
    }
    return { status: "up", chunks };
  } catch (err) {
    return { status: "down", ...describeProbeFailure("vectorStore", err) };
  }
}

/** 最近一次探测结果 { at: number, dependencies: object } */
let cache = null;
/** 正在进行的探测，用于把并发请求合并成一次 */
let inflight = null;
/** 冷却截止时间戳，未降级时为 0 */
let downUntil = 0;

/**
 * 真正执行一次双依赖探测
 * @returns {Promise<{ dependencies: object, ok: boolean }>}
 */
async function runProbes() {
  // 两个探测并行执行，最坏耗时 = 单个探测超时，而不是两者之和
  const [database, vectorStore] = await Promise.all([
    probeDatabase(),
    probeVectorStore(),
  ]);
  const ok = database.status === "up" && vectorStore.status === "up";
  return { dependencies: { database, vectorStore }, ok };
}

/**
 * 取依赖状态：带缓存、并发合并与失败冷却。
 * 抽成函数便于单测，路由只负责组装响应。
 * @param {{ now?: number }} [options]
 * @returns {Promise<{ database: object, vectorStore: object }>}
 */
export async function getDependencies({ now = Date.now() } = {}) {
  // age 可能为负（调用方注入的 now 早于上次写入、或系统时钟被回拨），
  // 负值天然满足 < TTL，会让旧缓存被无限期沿用，这里显式排除
  const age = cache ? now - cache.at : 0;
  if (cache && age >= 0 && age < PROBE_CACHE_TTL_MS) {
    return cache.dependencies;
  }
  // 冷却期内复用上一次的降级结论，不再给已经挂掉的下游添压
  if (cache && now < downUntil) {
    return cache.dependencies;
  }
  // 同一时刻只允许一次探测在途，其余请求共用它的结果
  if (inflight) return inflight;

  inflight = runProbes()
    .then(({ dependencies, ok }) => {
      // 写回时也用调用方传入的 now：读写两处用不同的时钟，
      // 会让 TTL / 冷却窗口在注入 now 的测试里失去确定性
      // （例如传 now: 1000 时 now - cache.at 为负，永远命中旧缓存）
      cache = { at: now, dependencies };
      downUntil = ok ? 0 : now + PROBE_FAILURE_COOLDOWN_MS;
      return dependencies;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * 测试用：重置探测缓存、在途探测与冷却状态。
 * 这三项都是模块级状态，不重置会让用例之间相互污染
 * （上一条用例留下的「降级 + 仍在冷却」会静默短路掉下一条的探测）。
 * 与 vectorStore.js 的 __resetForTest() 保持同一套约定。
 */
export function __resetForTest() {
  cache = null;
  inflight = null;
  downUntil = 0;
}

/**
 * 组装健康检查响应体。
 * 抽成纯函数便于单测，不依赖 express 的 req / res。
 * @param {{
 *   database: { status: string },
 *   vectorStore: { status: string },
 *   uptimeSeconds: number,
 *   now?: number,
 * }} input
 * @returns {{
 *   status: "ok" | "degraded",
 *   service: string,
 *   timestamp: string,
 *   uptimeSeconds: number,
 *   message: string,
 *   dependencies: { database: object, vectorStore: object },
 * }}
 */
export function buildHealthPayload({ database, vectorStore, uptimeSeconds, now = Date.now() }) {
  const databaseUp = database?.status === "up";
  const vectorStoreUp = vectorStore?.status === "up";
  const status = databaseUp && vectorStoreUp ? "ok" : "degraded";

  return {
    status,
    service: SERVICE_NAME,
    timestamp: new Date(now).toISOString(),
    uptimeSeconds,
    // degraded 时前端提示「部分功能降级」，而不是直接说服务不可用吓用户
    message: status === "ok" ? "服务正常" : "服务已启动，但部分依赖异常",
    dependencies: { database, vectorStore },
  };
}

/**
 * 汇总当前进程的运行时信息，便于前端排查「连的是哪个配置」。
 * 只暴露端口与模型名等非敏感字段，API Key 之类的凭据不会出现在这里。
 * @returns {object}
 */
function getRuntimeSummary() {
  // 端口与 index.js 的监听端口同源，避免「健康检查说 3000、实际监听在别处」
  const base = { port, envValid: true };

  try {
    const summary = getConfigSummary();
    return { ...base, model: summary?.modelName || null };
  } catch (err) {
    // 走到这里说明配置模块自身异常；「配置写错」这条路径在启动期
    // validateConfig() 就会打印错误并退出进程，不会等到健康检查来发现
    console.error("[health] 读取配置快照失败:", err?.message || err);
    return { ...base, model: null, envValid: false };
  }
}

export const healthRouter = express.Router();

// GET /health —— 前端页面加载预检测
healthRouter.get("/", async (req, res) => {
  try {
    const dependencies = await getDependencies();

    const payload = buildHealthPayload({
      database: dependencies.database,
      vectorStore: dependencies.vectorStore,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    });

    // 只要进程存活就返回 200，降级信息通过 status 字段表达
    res.status(200).json({ ...payload, runtime: getRuntimeSummary() });
  } catch (err) {
    // 健康检查自身不允许 500：它挂了前端就完全失去判断依据，
    // 只能退化成「服务不可用」的误报。这里降级返回而非抛给错误中间件。
    console.error("[health] 健康检查执行异常:", err?.message || err);
    // 整个响应体都交给 buildHealthPayload 组装，只覆盖 message：
    // 手写一份会和正常路径的字段（如 timestamp）慢慢跑偏，
    // 且以后往 buildHealthPayload 加字段时这条路径会静默漏掉。
    // 前端正是靠 dependencies.*.status 判断依赖状态，
    // 缺了这段结构，它在最需要信息的降级路径上只能读到 undefined。
    const payload = buildHealthPayload({
      database: { status: "down", code: "PROBE_FAILED", message: "数据库不可用" },
      vectorStore: { status: "down", code: "PROBE_FAILED", message: "向量库不可用" },
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    });

    res.status(200).json({
      ...payload,
      message: "健康检查执行异常，请查看服务端日志",
      runtime: getRuntimeSummary(),
    });
  }
});
