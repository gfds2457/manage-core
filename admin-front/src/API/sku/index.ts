import request from "@/utils/request";
const API = {
  getSkuListURL: "/admin/product/list",
  onSaleSkuURL: "/admin/product/onSale/",
  getSkuDetailURL: "/admin/product/getSkuInfo/",
  updateSkuInfoURL: "/admin/product/updateSkuInfo",
  deleteSkuURL: "/admin/product/deleteSku/",
  deletedSkuListURL: "/admin/product/recycle/deletedSkuList",
  restoreSkuURL: "/admin/product/recycle/restoreSku",
  submitAuditURL: "/admin/product/audit/submit",
  skuAuditStateURL: "/admin/product/audit/skuAuditState",
};

// 提交审核时带的数据
export interface SubmitAuditBody {
  skuId: number;
  // 申请把状态改成什么：1 申请上架 / 0 申请下架
  targetIsSale: number;
  applyUserName: string;
}

// 提交审核接口返回的数据
export interface SubmitAuditResInterface {
  code?: number;
  data?: unknown;
  message?: string;
  msg?: string;
  ok?: boolean;
}

// 获取SKU分页列表接口
export const getSkuList = ( page: number, pageSize: number ) =>
  request.get( `${ API.getSkuListURL }/${ page }/${ pageSize }` );

// sku商品上架下架接口。
// 接入审核后不再由 SKU 页面直接调用（改为提交审核申请），保留供后台/调试使用
export const onSaleSku = ( skuId: number, status: number ) =>
  request.put( `${ API.onSaleSkuURL }${ skuId }/${ status }` );

// 获取sku商品详情
export const getSkuDetail = ( skuId: number ) =>
  request.get( `${ API.getSkuDetailURL }${ skuId }` );

// 编辑SKU时允许修改的字段。
// weight 沿用后端的字符串约定（如 "190.00"），价格是数字
export interface UpdateSkuBody {
  id: number;
  skuName?: string;
  price?: number;
  weight?: string;
  skuDesc?: string;
  skuDefaultImg?: string;
}

// 更新SKU商品信息（按 id 就地修改）
export const updateSkuInfo = ( data: UpdateSkuBody ) =>
  request.put( API.updateSkuInfoURL, data );

// 删除已有SKU商品接口（软删除，30天内可在回收站恢复）
export const deleteSku = ( skuId: number ) =>
  request.delete( `${ API.deleteSkuURL }${ skuId }` );

// 获取已软删除的SKU列表（回收站）
export const getDeletedSkuList = () => request.get( API.deletedSkuListURL );

// 恢复误删SKU商品接口
export const restoreSku = ( skuId: number ) =>
  request.put( API.restoreSkuURL, { id: skuId } );

// 提交SKU上下架审核申请，需运营/超级管理员在商品审核页通过后才真正生效
export const submitSkuAudit = ( data: SubmitAuditBody ) =>
  request.post( API.submitAuditURL, data );

// 获取每个SKU最近一条审核单，用于列表页渲染按钮状态与"审核中"标记
export const getSkuAuditState = () => request.get( API.skuAuditStateURL );
