// 审核单状态：0 待审核 / 1 已通过 / 2 已驳回
export type AuditStatus = 0 | 1 | 2;

// 上下架审核单。
// 审核页要展示完整留痕，所以字段在提交时对 SKU 信息做了快照；
// SKU 列表页只用「最近一条」来判断按钮该显示箭头还是"审核中"
export interface AuditRecordInterface {
  id: number;
  skuId: number;
  // 提交时刻的 SKU 信息快照
  skuName: string;
  skuDefaultImg: string;
  price: number;
  weight: string;
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

// sku列表数据records数据类型
export interface SkuItemInterface {
  category3Id: number;
  createTime: string;
  id: number;
  isSale: number;
  price: number;
  skuAttrValueList: null;
  skuDefaultImg: string;
  skuDesc: string;
  skuImageList: null;
  skuName: string;
  skuSaleAttrValueList: null;
  spuId: number;
  tmId: number;
  updateTime: string;
  weight: string;
  // 该SKU最近一条上下架审核单，没有则为 null。由列表页拉取后合并到行上
  auditState?: AuditRecordInterface | null;
}

// 回收站中的SKU：在原SKU数据基础上增加软删除时间戳
export interface DeletedSkuItemInterface extends SkuItemInterface {
  deleteTime: string;
}

// 获取sku全部列表data数据返回类型
export interface SkuResInterface {
  current?: number;
  pages?: number;
  records?: SkuItemInterface[];
  size?: number;
  total?: number;
}

//
export interface SkuAllResInterface {
  code?: number;
  data: SkuResInterface;
  message?: string;
  ok?: boolean;
}

// 获取SKU审核状态接口返回类型：data 是以 skuId 为键的「最近一条审核单」
export interface SkuAuditStateResInterface {
  code?: number;
  data?: Record<number, AuditRecordInterface>;
  message?: string;
  ok?: boolean;
}
