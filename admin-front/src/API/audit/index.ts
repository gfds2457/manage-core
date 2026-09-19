import request from "@/utils/request";
const API = {
  auditListURL: "/admin/product/audit/list/",
  approveAuditURL: "/admin/product/audit/approve",
  rejectAuditURL: "/admin/product/audit/reject",
  batchAuditURL: "/admin/product/audit/batch",
};

// 审核单条操作入参
export interface AuditOperateBody {
  auditId: number;
  // 审核人，由前端从用户仓库带过来（mock 后端拿不到"当前是谁在操作"）
  auditUserName: string;
  auditRemark?: string;
}

// 审核批量操作入参
export interface BatchAuditBody {
  auditIds: number[];
  action: "approve" | "reject";
  auditUserName: string;
  auditRemark?: string;
}

// 获取商品上下架审核分页列表。
// status 传空表示查全部；keyword 匹配 SKU 名称与申请人
export const getAuditList = (
  page: number,
  pageSize: number,
  status?: number | string,
  keyword?: string,
) =>
  request.get( `${ API.auditListURL }${ page }/${ pageSize }`, {
    params: { status, keyword },
  } );

// 审核通过：会把对应 SKU 的上下架状态真正改掉
export const approveAudit = ( data: AuditOperateBody ) =>
  request.put( API.approveAuditURL, data );

// 审核驳回：SKU 的上下架状态保持不变，驳回意见必填
export const rejectAudit = ( data: AuditOperateBody ) =>
  request.put( API.rejectAuditURL, data );

// 批量审核：action 为 approve 或 reject
export const batchAudit = ( data: BatchAuditBody ) =>
  request.put( API.batchAuditURL, data );
