// 审核单的结构由 SKU 页维护：SKU 列表的按钮状态和审核页展示的是同一份数据，
// 类型只保留一处定义，避免两边改漏
export type { AuditRecordInterface, AuditStatus } from "../sku/type";
import type { AuditRecordInterface } from "../sku/type";

// 审核列表接口返回类型
export interface AuditListResInterface {
  code?: number;
  data: {
    records?: AuditRecordInterface[];
    total?: number;
  };
  message?: string;
  ok?: boolean;
}

// 审核操作接口返回类型
export interface AuditOperateResInterface {
  code?: number;
  data?: unknown;
  message?: string;
  msg?: string;
  ok?: boolean;
}
