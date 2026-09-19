import { getSpuReq } from "@/API/spu";
import { getSkuList } from "@/API/sku";
import { getBrandList } from "@/API/product";
import { getKbStats } from "@/API/knowledge";
import { getOperationLogs } from "@/API/log";

/**
 * 工作台聚合数据。
 * 后端没有 dashboard 汇总接口，这里全部复用已有的分页/统计接口取真实数值，
 * 每个来源单独兜底：任意一个服务挂掉（如 AI 后端未启动）只让对应指标显示为 null，
 * 不会连带把整个首页拖成白屏。
 */

// 商品维度指标
export interface GoodsMetrics {
  spuTotal: number | null;
  skuTotal: number | null;
  brandTotal: number | null;
}

// 首页一次拉取的全部数据
export interface DashboardData {
  goods: GoodsMetrics;
  // 知识库文档数量，AI 后端不可达时为 null
  kbDocTotal: number | null;
  kbVectorChunks: number | null;
  kbQueuePending: number | null;
  // 最近同步时间
  kbLastSyncAt: string;
}

// 从分页响应里取 total，兼容 {code,data:{total}} 与 axios 原始响应两种形态
const pickTotal = (res: any): number | null => {
  const total = res?.data?.total ?? res?.total;
  return typeof total === "number" ? total : null;
};

// 单独取一个指标，失败返回 null（不让 Promise.all 整体 reject）
const safeCall = async (fn: () => Promise<any>) => {
  try {
    return await fn();
  } catch (err) {
    console.warn("[dashboard] 指标拉取失败:", err);
    return null;
  }
};

export const getDashboardData = async (): Promise<DashboardData> => {
  // pageSize 传 1：只要 total，不占带宽
  const [spuRes, skuRes, brandRes, kbRes] = await Promise.all([
    safeCall(() => getSpuReq({ page: 1, query: { pageSize: 1 } })),
    safeCall(() => getSkuList(1, 1)),
    safeCall(() => getBrandList(1, 1)),
    safeCall(() => getKbStats()),
  ]);

  return {
    goods: {
      spuTotal: pickTotal(spuRes),
      skuTotal: pickTotal(skuRes),
      brandTotal: pickTotal(brandRes),
    },
    // 注意：/kb/* 走的是独立 axios 实例（未做响应解包），
    // 因此真实数据在 axios 响应的 data.data 上，取成 data.xxx 会永远是 undefined
    kbDocTotal: kbRes?.data?.data?.manifestDocs ?? null,
    kbVectorChunks: kbRes?.data?.data?.vectorChunks ?? null,
    kbQueuePending: kbRes?.data?.data?.queue?.pending ?? null,
    kbLastSyncAt: kbRes?.data?.data?.lastSyncAt ?? "",
  };
};

// 操作日志的一条
export interface OperationLogItem {
  id: number | string;
  // 动作描述，如「新增账号」「删除 SPU」
  action: string;
  // 操作对象
  target: string;
  // 操作人
  operator: string;
  time: string;
  // 0 待处理 / 1 已执行 / 2 危险动作（删除与驳回）
  status: number;
}

/**
 * 最近操作日志：数据源是后端统一记录的操作日志接口。
 *
 * 之前这里是把审核单「翻译」成日志的：审核单只有商品上下架，
 * 账号新增、角色授权、商品删除这些高敏感操作一条都留不下痕迹。
 * 现在后端在 adapter 出口按规则表落库（operation/rules.ts），
 * 字段与这里的 OperationLogItem 一一对应，映射层因此可以整段删掉。
 */
export const getRecentLogs = async (pageSize = 8): Promise<OperationLogItem[]> => {
  const res = await safeCall(() => getOperationLogs(pageSize));
  const records = res?.data;
  if (!Array.isArray(records)) return [];
  return records.map((item: any) => ({
    id: item.id,
    action: item.action,
    target: item.target,
    operator: item.operator,
    time: item.time,
    status: item.status,
  }));
};

// 访问趋势的一个数据点
export interface VisitTrendPoint {
  // MM/DD
  date: string;
  count: number;
}

/**
 * 近 N 天访问量趋势。
 *
 * ⚠️ 演示数据：后端目前没有访问量统计接口（/kb/stats、审核列表都不含访问量），
 * 这里用固定序列生成，保证每次刷新图形稳定、不会跳动。
 * 后续后端接口就绪后，只需把函数体换成真实请求，调用方无需改动。
 */
const MOCK_VISIT_BASE = [268, 341, 305, 402, 388, 455, 512, 470, 498, 566, 534, 612, 688, 731];

export const getVisitTrend = (days = 14): VisitTrendPoint[] => {
  const points = MOCK_VISIT_BASE.slice(-days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return points.map((count, index) => {
    // 最后一个点对应当天，依次往前推
    const offset = points.length - 1 - index;
    const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
    return {
      date: `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
      count,
    };
  });
};
