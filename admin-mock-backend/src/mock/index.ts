// mock/index.ts
import audit from "./audit";
import brand from "./brand";
import user from "./user";
import spu from "./spu";
import sku from "./sku";
import role from "./role";
import attribute from "./attribute";
import log from "./log";

// 导出所有 mock 接口，由 src/adapter.ts 注册成 Express 路由
// 注意：数组顺序即路由注册顺序（先注册先匹配），不要随意调整模块顺序。
// audit 放在最前：它的路径段数较多，且要读写 sku 模块的数据，优先匹配最稳妥。
// log 放最后：/api/admin/operation/logs 与商品域前缀不重叠，不存在抢匹配问题
export default [
  ...audit,
  ...user,
  ...brand,
  ...spu,
  ...sku,
  ...role,
  ...attribute,
  ...log,
];
