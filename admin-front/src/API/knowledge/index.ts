import axios from "axios";
import { getEnvReport } from "@/utils/aiEnv";
import { AiBusinessError } from "@/utils/aiError";

/**
 * 知识库接口直连独立 AI 后端 admin-ai-backend（Express，端口 3000）。
 * /kb/* 全部需要 x-kb-token 鉴权（后端未配置令牌时为无鉴权模式，本地开发可直接通过），
 * 令牌可在 .env.development 用 VITE_KB_SYNC_TOKEN 覆盖。
 */
// 地址统一走环境变量校验模块，保证知识库与对话请求连的是同一个后端
const KB_BASE_URL = getEnvReport().aiBaseUrl;

/** 知识库接口超时：同步接口只做入队，检索接口可能触发 embedding，留 30s */
const KB_REQUEST_TIMEOUT_MS = 30_000;

/**
 * 知识库同步令牌。
 * 不在源码里保留字面量默认值：源码里的凭据会随仓库一起分发出去，
 * 而此前 .env.development 里并未配置同名变量，等于「文档说的可覆盖」从未生效，
 * 任何人拿到仓库就能调用 /kb/sync、/kb/search。
 * 令牌应放在被 gitignore 的 .env.development.local（Vite 的 *.local 约定）。
 */
const KB_SYNC_TOKEN = import.meta.env.VITE_KB_SYNC_TOKEN || "";

if (!KB_SYNC_TOKEN) {
  console.warn(
    "[知识库] 未配置 VITE_KB_SYNC_TOKEN，/kb/* 请求将不带鉴权头；" +
    "若后端已开启令牌校验（src/.env 中配置了 KB_SYNC_TOKEN），这些接口会返回 401"
  );
}

const kb = axios.create({
  baseURL: `${KB_BASE_URL}/kb`,
  timeout: KB_REQUEST_TIMEOUT_MS,
  // 未配置令牌时不带该请求头：带空串会被后端判成「令牌错误」直接拒绝，
  // 不如走无鉴权模式，由后端按自身是否配置令牌来决定是否放行
  ...(KB_SYNC_TOKEN ? { headers: { "x-kb-token": KB_SYNC_TOKEN } } : {}),
});

// 与 src/API/ai-chat 保持一致的业务失败判定：
// HTTP 200 但 success=false 时统一转成异常，
// 否则调用方会拿到一个「看似成功」的响应，继续去读失败响应里的 data
kb.interceptors.response.use((response) => {
  const body = response.data;
  if (body && typeof body === "object" && "success" in body && body.success === false) {
    throw new AiBusinessError(body.message || body.error || "知识库接口返回失败", {
      code: body.code,
      status: response.status,
    });
  }
  return response;
});

/** 向量库队列状态 */
export interface KbQueueStatus {
  pending: number;
  draining: boolean;
  total: number;
  succeeded: number;
  failed: number;
  lastTask: { label: string; at: string } | null;
  lastError: { label: string; message: string } | null;
}

/** GET /kb/stats 返回体 */
export interface KbStatsData {
  manifestDocs: number;
  vectorDocs: number;
  lastSyncAt: string;
  vectorChunks: number;
  queue: KbQueueStatus;
}

/** 检索命中片段 */
export interface KbHit {
  id: string;
  score: number;
  source: string;
  title: string;
  text: string;
  docId?: string;
  docType?: string;
}

/** POST /kb/search 返回体 */
export interface KbSearchData {
  question: string;
  rewrittenQuery: string;
  rewritten: boolean;
  hasContext: boolean;
  degraded: boolean;
  notice: string | null;
  count: number;
  sources: KbHit[];
  hits: KbHit[];
}

interface KbRes<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
}

// 知识库概览：文档数、向量分块数、同步队列状态
export const getKbStats = () => kb.get<KbRes<KbStatsData>>("/stats");

// 增量同步队列状态
export const getKbQueue = () => kb.get<KbRes<KbQueueStatus>>("/queue");

// 手动触发 doc 目录同步：force 为 true 时全量重建
export const syncKb = (force = false) => kb.post<KbRes<{ message: string }>>("/sync", { force });

// 检索调试：直接看某个问题命中了哪些知识片段，用于排查召回不准
export const searchKb = (question: string, options: { topK?: number; threshold?: number; docType?: string } = {}) =>
  kb.post<KbRes<KbSearchData>>("/search", { question, ...options });
