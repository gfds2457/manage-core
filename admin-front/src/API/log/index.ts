import request from "@/utils/request";

const API = {
  OPERATION_LOG_URL: "/admin/operation/logs",
};

/**
 * 最近操作日志。
 *
 * 数据由后端 adapter 在响应后统一落库（见 admin-mock-backend/src/operation/rules.ts），
 * 记录的是高敏感操作：账号增删改、角色与授权变更、商品删除/恢复、审核流转。
 * 操作人取自服务端自己签发的 token，而不是前端传上来的字段——
 * 前端能传的字段就能伪造，日志一旦能被伪造就失去了追责价值。
 *
 * limit 是「取最近 N 条」，不是分页页码。
 */
export const getOperationLogs = (limit = 8) =>
  request.get(API.OPERATION_LOG_URL, { params: { limit } });
