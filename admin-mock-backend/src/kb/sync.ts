/**
 * 知识库增量同步回调
 *
 * 职责：业务侧商品数据「写库成功」后，异步通知 AI 后端的 /kb 接口，
 * 只刷新对应那一条知识的向量，不做全量重建。
 *
 * 关键约束：
 * 1. 必须 fire-and-forget：绝不能因为知识库不可用而拖慢或中断业务写库。
 * 2. 必须带超时：AI 后端无响应时快速放弃并记录日志。
 * 3. 只在业务写入真正成功（code === 200 且 ok !== false）时才触发。
 * 4. 任何异常都在此层吞掉，只打日志。
 *
 * 生产环境接入 MySQL 时，把 maybeSyncKnowledge 的调用点放在
 * `await connection.commit()` 成功之后即可，其余逻辑无需改动。
 */

/** AI 后端地址，可通过环境变量覆盖 */
const KB_BASE_URL = process.env.AI_KB_BASE_URL || "http://localhost:3000";

/** 与 admin-ai-backend/.env 中 KB_SYNC_TOKEN 保持一致 */
const KB_SYNC_TOKEN = process.env.KB_SYNC_TOKEN || "kb-sync-token-2026";

/** 单次回调超时时间（毫秒） */
const KB_TIMEOUT_MS = Number(process.env.KB_TIMEOUT_MS || 5000);

/** 回调总开关，置为 "false" 可整体关闭知识库同步 */
const KB_SYNC_ENABLED = process.env.KB_SYNC_ENABLED !== "false";

/** 同步事件：交给 AI 后端处理的单条知识变更 */
export interface KbEvent {
  action: "upsert" | "delete";
  docId: string;
  title?: string;
  content?: string;
  source?: string;
  docType?: string;
}

/** 业务写入上下文 */
export interface KbContext {
  method: string;
  url: string;
  body?: any;
  query?: any;
  params?: any;
}

/** 单个路由的同步规则 */
interface KbRule {
  /** 匹配的请求方法，小写 */
  method: string;
  /** 路径匹配（用正则，兼容带路径参数的接口） */
  test: (url: string) => boolean;
  /** 由请求与响应推导出知识库事件；返回 null 表示本次无需同步 */
  resolve: (ctx: KbContext, result: any) => KbEvent | null;
}

/** 从多个来源中挑出第一个有值的字段 */
function pick(...values: any[]): any {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** 从 url 中按正则抽出一段路径参数 */
function fromUrl(url: string, pattern: RegExp): string | undefined {
  const match = String(url || "").match(pattern);
  return match ? match[1] : undefined;
}

/** 拼接知识正文：过滤掉空字段，避免产生 "字段：undefined" 这类噪声 */
function joinFields(pairs: Array<[string, any]>): string {
  return pairs
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) =>
      Array.isArray(value) ? `${label}：${value.join("、")}` : `${label}：${value}`,
    )
    .join("；");
}

/** 商品数据统一的知识来源标识，用于回答溯源 */
const SOURCE = "业务数据/商品管理";

/**
 * 各写接口 -> 知识库事件映射。
 * 覆盖商品业务数据的增、删、改（含上下架、软删除、回收站恢复）。
 */
export const KB_RULES: KbRule[] = [
  // ---------------- SPU ----------------
  {
    method: "post",
    test: (url) => url.startsWith("/api/admin/product/saveSpuInfo"),
    resolve: (ctx, result) => {
      const data = result?.data || {};
      const spu = { ...ctx.body, ...data };
      const id = pick(data.id, ctx.body?.id, ctx.body?.spuName);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `spu:${id}`,
        docType: "product",
        title: `SPU ${pick(spu.spuName, "未命名")}`,
        source: SOURCE,
        content: joinFields([
          ["SPU名称", spu.spuName],
          ["商品描述", spu.description],
          ["三级分类ID", spu.category3Id],
          ["品牌ID", spu.tmId],
        ]),
      };
    },
  },
  {
    method: "post",
    test: (url) => url.startsWith("/api/admin/product/updateSpuInfo"),
    resolve: (ctx, result) => {
      const id = pick(result?.data?.id, ctx.body?.id, ctx.body?.spuName);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `spu:${id}`,
        docType: "product",
        title: `SPU ${pick(ctx.body?.spuName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["SPU名称", ctx.body?.spuName],
          ["商品描述", ctx.body?.description],
          ["三级分类ID", ctx.body?.category3Id],
          ["品牌ID", ctx.body?.tmId],
        ]),
      };
    },
  },
  {
    method: "delete",
    test: (url) => url.startsWith("/api/admin/product/deleteSpu"),
    resolve: (ctx, result) => {
      const id = pick(ctx.query?.id, ctx.params?.id);
      if (!id) return null;
      return { action: "delete", docId: `spu:${id}`, source: SOURCE };
    },
  },
  {
    method: "delete",
    test: (url) => url.startsWith("/api/admin/product/recycle/restoreSpu"),
    resolve: (ctx, result) => {
      const id = pick(ctx.body?.id, ctx.query?.id);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `spu:${id}`,
        docType: "product",
        title: `SPU ${pick(result?.data?.spuName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["SPU名称", result?.data?.spuName],
          ["商品描述", result?.data?.description],
          ["说明", "该 SPU 已从回收站恢复"],
        ]),
      };
    },
  },

  // ---------------- SKU ----------------
  {
    method: "post",
    test: (url) => url.startsWith("/api/admin/product/saveSkuInfo"),
    resolve: (ctx, result) => {
      const data = result?.data || {};
      const sku = { ...ctx.body, ...data };
      const id = pick(data.id, ctx.body?.id, ctx.body?.skuName);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `sku:${id}`,
        docType: "product",
        title: `SKU ${pick(sku.skuName, "未命名")}`,
        source: SOURCE,
        content: joinFields([
          ["SKU名称", sku.skuName],
          ["商品描述", sku.skuDesc],
          ["售价", sku.price !== undefined ? `${sku.price} 元` : undefined],
          ["重量", sku.weight],
          ["所属SPU", sku.spuId],
          ["上架状态", sku.isSale === 1 ? "已上架" : "未上架"],
        ]),
      };
    },
  },
  {
    method: "put",
    test: (url) => /\/api\/admin\/product\/onSale\//.test(url),
    resolve: (ctx, result) => {
      const data = result?.data || {};
      const id = pick(
        data.id,
        fromUrl(ctx.url, /onSale\/([^/?]+)/),
      );
      if (!id) return null;
      return {
        action: "upsert",
        docId: `sku:${id}`,
        docType: "product",
        title: `SKU ${pick(data.skuName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["SKU名称", data.skuName],
          ["商品描述", data.skuDesc],
          ["售价", data.price !== undefined ? `${data.price} 元` : undefined],
          ["上架状态", data.isSale === 1 ? "已上架" : "已下架"],
        ]),
      };
    },
  },
  {
    method: "delete",
    test: (url) => /\/api\/admin\/product\/deleteSku\//.test(url),
    resolve: (ctx, result) => {
      const id = pick(
        fromUrl(ctx.url, /deleteSku\/([^/?]+)/),
        ctx.params?.skuId,
      );
      if (!id) return null;
      return { action: "delete", docId: `sku:${id}`, source: SOURCE };
    },
  },
  {
    method: "delete",
    test: (url) => url.startsWith("/api/admin/product/recycle/restoreSku"),
    resolve: (ctx, result) => {
      const id = pick(ctx.body?.id, result?.data?.id);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `sku:${id}`,
        docType: "product",
        title: `SKU ${pick(result?.data?.skuName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["SKU名称", result?.data?.skuName],
          ["商品描述", result?.data?.skuDesc],
          ["说明", "该 SKU 已从回收站恢复"],
        ]),
      };
    },
  },

  // ---------------- 品牌 ----------------
  {
    method: "post",
    test: (url) => url.startsWith("/api/product/baseTrademark/save"),
    resolve: (ctx, result) => {
      const id = pick(result?.data?.id, ctx.body?.id, ctx.body?.tmName);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `brand:${id}`,
        docType: "product",
        title: `品牌 ${pick(result?.data?.tmName, ctx.body?.tmName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["品牌名称", pick(result?.data?.tmName, ctx.body?.tmName)],
          ["品牌LOGO", pick(result?.data?.logoUrl, ctx.body?.logoUrl)],
        ]),
      };
    },
  },
  {
    method: "put",
    test: (url) => url.startsWith("/api/product/baseTrademark/update"),
    resolve: (ctx, result) => {
      if (!ctx.body?.id) return null;
      return {
        action: "upsert",
        docId: `brand:${ctx.body.id}`,
        docType: "product",
        title: `品牌 ${pick(ctx.body?.tmName, ctx.body.id)}`,
        source: SOURCE,
        content: joinFields([
          ["品牌名称", ctx.body?.tmName],
          ["品牌LOGO", ctx.body?.logoUrl],
        ]),
      };
    },
  },
  {
    method: "delete",
    test: (url) => url.startsWith("/api/product/baseTrademark"),
    resolve: (ctx, result) => {
      const id = pick(ctx.body?.id, ctx.query?.id);
      if (!id) return null;
      return { action: "delete", docId: `brand:${id}`, source: SOURCE };
    },
  },
  {
    method: "put",
    test: (url) => url.startsWith("/api/product/baseTrademark/restore"),
    resolve: (ctx, result) => {
      const id = pick(ctx.body?.id, result?.data?.id);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `brand:${id}`,
        docType: "product",
        title: `品牌 ${pick(result?.data?.tmName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["品牌名称", result?.data?.tmName],
          ["说明", "该品牌已从回收站恢复"],
        ]),
      };
    },
  },

  // ---------------- 商品属性 ----------------
  {
    method: "post",
    test: (url) => url.startsWith("/api/product/attr/addAttr"),
    resolve: (ctx, result) => {
      const data = result?.data || {};
      const id = pick(data.attrId, ctx.body?.attrId, ctx.body?.attrName);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `attr:${id}`,
        docType: "product",
        title: `属性 ${pick(data.attrName, ctx.body?.attrName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["属性名称", pick(data.attrName, ctx.body?.attrName)],
          ["可选值", pick(data.attrValueList, ctx.body?.attrValueList)],
        ]),
      };
    },
  },
  {
    method: "put",
    test: (url) => url.startsWith("/api/product/attr/updateAttr"),
    resolve: (ctx, result) => {
      const data = result?.data || {};
      const id = pick(data.attrId, ctx.body?.attrId);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `attr:${id}`,
        docType: "product",
        title: `属性 ${pick(data.attrName, ctx.body?.attrName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["属性名称", pick(data.attrName, ctx.body?.attrName)],
          ["可选值", pick(data.attrValueList, ctx.body?.attrValueList)],
        ]),
      };
    },
  },
  {
    method: "delete",
    test: (url) => url.startsWith("/api/attribute/delete"),
    resolve: (ctx, result) => {
      const id = pick(ctx.body?.attrId, ctx.query?.attrId);
      if (!id) return null;
      return { action: "delete", docId: `attr:${id}`, source: SOURCE };
    },
  },
  {
    method: "put",
    test: (url) => url.startsWith("/api/product/attr/recycle/restore"),
    resolve: (ctx, result) => {
      const id = pick(ctx.body?.attrId, result?.data?.attrId);
      if (!id) return null;
      return {
        action: "upsert",
        docId: `attr:${id}`,
        docType: "product",
        title: `属性 ${pick(result?.data?.attrName, id)}`,
        source: SOURCE,
        content: joinFields([
          ["属性名称", result?.data?.attrName],
          ["可选值", result?.data?.attrValueList],
          ["说明", "该属性已从回收站恢复"],
        ]),
      };
    },
  },
];

/**
 * 判断业务写入是否真正成功。
 * 注意：部分失败分支同样返回 code 200，靠 ok: false 区分，必须同时判断。
 */
export function isWriteSuccess(result: any): boolean {
  if (!result || typeof result !== "object") return false;
  if (result.code !== 200) return false;
  if (result.ok === false) return false;
  return true;
}

/**
 * 根据请求匹配规则并推导知识库事件
 * @returns KbEvent | null
 */
export function resolveKbEvent(ctx: KbContext, result: any): KbEvent | null {
  const method = String(ctx.method || "get").toLowerCase();
  const url = String(ctx.url || "");

  for (const rule of KB_RULES) {
    if (rule.method !== method) continue;
    if (!rule.test(url)) continue;
    try {
      return rule.resolve(ctx, result);
    } catch (err) {
      console.error(`[kb-sync] 解析同步事件失败 ${method.toUpperCase()} ${url}:`, err);
      return null;
    }
  }
  return null;
}

/**
 * 异步通知 AI 后端更新知识库
 *
 * 刻意不 await、不抛错：知识库同步失败绝不能影响业务接口的响应。
 */
export function notifyKnowledgeBase(event: KbEvent): void {
  if (!KB_SYNC_ENABLED) return;

  const endpoint = event.action === "delete" ? "/kb/delete" : "/kb/upsert";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KB_TIMEOUT_MS);

  // 立即返回，任务在后台跑
  void (async () => {
    try {
      const response = await fetch(`${KB_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kb-token": KB_SYNC_TOKEN,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(
          `[kb-sync] 知识库同步失败 ${event.action} ${event.docId}: HTTP ${response.status} ${text.slice(0, 200)}`,
        );
        return;
      }
      console.log(`[kb-sync] 知识库${event.action === "delete" ? "删除" : "更新"}已受理: ${event.docId}`);
    } catch (err: any) {
      // AI 后端未启动 / 超时 / 网络异常都走这里，只记日志
      const reason = err?.name === "AbortError" ? `超时(${KB_TIMEOUT_MS}ms)` : err?.message;
      console.error(`[kb-sync] 知识库同步异常 ${event.action} ${event.docId}: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  })();
}

/**
 * 业务接口统一入口：写入成功后按需触发知识库增量同步。
 * 在 adapter 中于 res.json 之后调用。
 */
export function maybeSyncKnowledge(ctx: KbContext, result: any): void {
  if (!isWriteSuccess(result)) return;

  const event = resolveKbEvent(ctx, result);
  if (!event) return;

  if (event.action === "upsert" && !String(event.content || "").trim()) {
    console.warn(`[kb-sync] 跳过内容为空的同步事件: ${event.docId}`);
    return;
  }

  notifyKnowledgeBase(event);
}

export default { maybeSyncKnowledge, resolveKbEvent, notifyKnowledgeBase, isWriteSuccess, KB_RULES };
