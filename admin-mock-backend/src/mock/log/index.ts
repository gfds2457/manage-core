import type { MockItem } from "../../adapter.js";
import { readOperationLogs } from "../../operation/record.js";

export default [
  // 首页「最近操作日志」的数据源。
  // 不做权限码限制：这是工作台的公共信息面板，所有登录用户都能看到，
  // 加 permission 码会让运营与产品进来就看到一块空白。
  {
    url: "/api/admin/operation/logs",
    method: "get",
    response: ( { query } ) =>
    {
      const limit = Number( query?.limit ) || 8;
      return {
        code: 200,
        ok: true,
        message: "成功",
        data: readOperationLogs( limit ),
      };
    },
  },
] as MockItem[];
