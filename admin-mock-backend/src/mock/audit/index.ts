import { PERM } from "../../permission/codes";
import type { MockItem } from "../../adapter";
import { skuData } from "../sku";

// 审核单状态：0 待审核 / 1 已通过 / 2 已驳回
type AuditStatus = 0 | 1 | 2;

interface AuditRecord {
  id: number;
  skuId: number;
  // 提交时对 SKU 信息做快照：审核留痕不应随 SKU 后续被修改（或被删除）而变化
  skuName: string;
  skuDefaultImg: string;
  price: number;
  weight: string;
  // 提交时已生效的上下架状态
  currentIsSale: number;
  // 本次申请的目标状态：1 申请上架 / 0 申请下架
  targetIsSale: number;
  status: AuditStatus;
  applyUserName: string;
  applyTime: string;
  auditUserName: string;
  auditTime: string;
  auditRemark: string;
}

// 审核单数据（内存态，mock 后端重启即清空，包括 tsx watch 触发的重启）
const auditRecords: AuditRecord[] = [];
let auditIdSeed = 1000;

// 当前时间，格式与其它 mock 模块保持一致
const now = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const fail = (message: string) => ({
  code: 500,
  message,
  ok: false,
  data: null,
});
const success = (message: string, data: unknown = null) => ({
  code: 200,
  message,
  ok: true,
  data,
});

// 该SKU是否已有待审核的申请
const findPendingRecord = (skuId: number) =>
  auditRecords.find((item) => item.skuId === skuId && item.status === 0);

// 审核通过/驳回的公共逻辑，单条与批量复用
const auditOne = (
  record: AuditRecord,
  action: "approve" | "reject",
  auditUserName: string,
  auditRemark: string,
) => {
  record.status = action === "approve" ? 1 : 2;
  record.auditUserName = auditUserName;
  record.auditTime = now();
  record.auditRemark = auditRemark || (action === "approve" ? "审核通过" : "");
  // 只有审核通过才真正改变上下架状态；驳回时状态原地不动
  if (action === "approve") {
    const sku = skuData.find((item) => item.id === record.skuId);
    if (sku) {
      sku.isSale = record.targetIsSale;
      sku.updateTime = record.auditTime;
    }
  }
};

export default [
  // 提交上下架审核申请
  {
    url: "/api/admin/product/audit/submit",
    method: "post",
    permission: PERM.GOODS_SKU_WRITE,
    response: ({ body }) => {
      const skuId = Number(body?.skuId);
      const targetIsSale = Number(body?.targetIsSale);
      const applyUserName = String(body?.applyUserName ?? "");

      if (!Number.isInteger(skuId)) {
        return fail("提交失败：skuId参数错误");
      }
      if (![0, 1].includes(targetIsSale)) {
        return fail("提交失败：状态参数只能是0(下架)或1(上架)");
      }

      const sku = skuData.find((item) => item.id === skuId);
      if (!sku) {
        return fail(`提交失败：不存在id为${skuId}的SKU商品`);
      }
      // 申请状态与已生效状态相同就没有审核的意义
      if (sku.isSale === targetIsSale) {
        return fail("提交失败：申请状态与当前状态一致，无需提交");
      }
      if (findPendingRecord(skuId)) {
        return fail("提交失败：该商品已有待审核的申请，请等待审核结果");
      }

      const record: AuditRecord = {
        id: ++auditIdSeed,
        skuId,
        skuName: sku.skuName,
        skuDefaultImg: sku.skuDefaultImg,
        price: sku.price,
        weight: sku.weight,
        currentIsSale: sku.isSale,
        targetIsSale,
        status: 0,
        applyUserName,
        applyTime: now(),
        auditUserName: "",
        auditTime: "",
        auditRemark: "",
      };
      auditRecords.push(record);
      return success("提交成功，等待审核", record);
    },
  },
  // 审核列表：分页 + 状态筛选 + 关键词搜索
  {
    url: "/api/admin/product/audit/list/:pageNo/:pageSize",
    method: "get",
    response: ({ params, query }) => {
      const pageNo = Number(params?.pageNo ?? 1);
      const pageSize = Number(params?.pageSize ?? 10);
      const statusRaw = query?.status;
      const keyword = String(query?.keyword ?? "").trim();

      // 按申请时间倒序，新的在前
      let list = [...auditRecords].sort(
        (a, b) =>
          new Date(b.applyTime).getTime() - new Date(a.applyTime).getTime(),
      );
      // status 传空（含空字符串）表示查全部
      if (statusRaw !== undefined && statusRaw !== "" && statusRaw !== null) {
        const status = Number(statusRaw);
        list = list.filter((item) => item.status === status);
      }
      if (keyword) {
        list = list.filter(
          (item) =>
            item.skuName.includes(keyword) ||
            item.applyUserName.includes(keyword) ||
            String(item.skuId) === keyword,
        );
      }

      const startIndex = (pageNo - 1) * pageSize;
      return success("成功", {
        records: list.slice(startIndex, startIndex + pageSize),
        total: list.length,
        current: pageNo,
        size: pageSize,
        pages: Math.ceil(list.length / pageSize),
      });
    },
  },
  // 审核通过：同时把对应SKU的上下架状态真正改掉
  {
    url: "/api/admin/product/audit/approve",
    method: "put",
    permission: PERM.GOODS_REVIEW_AUDIT,
    response: ({ body }) => {
      const record = auditRecords.find((item) => item.id === Number(body?.auditId));
      if (!record) {
        return fail("审核失败：审核单不存在");
      }
      if (record.status !== 0) {
        return fail("审核失败：该申请已被处理");
      }
      auditOne(
        record,
        "approve",
        String(body?.auditUserName ?? ""),
        String(body?.auditRemark ?? ""),
      );
      return success("审核通过，商品上下架状态已更新", record);
    },
  },
  // 审核驳回：SKU上下架状态保持不变，驳回理由必填
  {
    url: "/api/admin/product/audit/reject",
    method: "put",
    permission: PERM.GOODS_REVIEW_AUDIT,
    response: ({ body }) => {
      const record = auditRecords.find((item) => item.id === Number(body?.auditId));
      const auditRemark = String(body?.auditRemark ?? "").trim();
      if (!record) {
        return fail("驳回失败：审核单不存在");
      }
      if (record.status !== 0) {
        return fail("驳回失败：该申请已被处理");
      }
      if (auditRemark.length < 2) {
        return fail("驳回失败：请填写至少2个字的驳回理由");
      }
      auditOne(record, "reject", String(body?.auditUserName ?? ""), auditRemark);
      return success("已驳回，商品上下架状态保持不变", record);
    },
  },
  // 批量审核：已被处理过的单据跳过，不计为失败
  {
    url: "/api/admin/product/audit/batch",
    method: "put",
    permission: PERM.GOODS_REVIEW_AUDIT,
    response: ({ body }) => {
      const auditIds: number[] = Array.isArray(body?.auditIds)
        ? body.auditIds.map((id: unknown) => Number(id))
        : [];
      const action: "approve" | "reject" =
        body?.action === "reject" ? "reject" : "approve";
      const auditRemark = String(body?.auditRemark ?? "").trim();
      const auditUserName = String(body?.auditUserName ?? "");

      if (auditIds.length === 0) {
        return fail("批量操作失败：请先勾选审核单");
      }
      if (action === "reject" && auditRemark.length < 2) {
        return fail("批量驳回失败：请填写至少2个字的驳回理由");
      }

      let successCount = 0;
      let skippedCount = 0;
      auditIds.forEach((id) => {
        const record = auditRecords.find((item) => item.id === id);
        if (!record || record.status !== 0) {
          skippedCount += 1;
          return;
        }
        auditOne(record, action, auditUserName, auditRemark);
        successCount += 1;
      });

      const actionTip = action === "approve" ? "批量审核通过" : "批量驳回";
      const skippedTip = skippedCount ? `，${skippedCount}条已被处理已跳过` : "";
      return success(`${actionTip}成功${successCount}条${skippedTip}`, {
        successCount,
        skippedCount,
      });
    },
  },
  // SKU列表页用：每个SKU最近一条审核单，用于渲染按钮与"审核中"标记
  {
    url: "/api/admin/product/audit/skuAuditState",
    method: "get",
    response: () => {
      const stateMap: Record<number, AuditRecord> = {};
      // 按时间倒序遍历，先写入的是最新的，后面的不覆盖
      [...auditRecords]
        .sort(
          (a, b) =>
            new Date(b.applyTime).getTime() - new Date(a.applyTime).getTime(),
        )
        .forEach((record) => {
          if (!stateMap[record.skuId]) {
            stateMap[record.skuId] = record;
          }
        });
      return success("成功", stateMap);
    },
  },
] as MockItem[];
