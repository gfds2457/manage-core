/**
 * 高敏感操作 → 日志条目的映射规则。
 *
 * 结构照搬 kb/sync.ts 的 KB_RULES：adapter 是全部 60 条路由的唯一出口，
 * 每条规则自带 method + url 匹配，命中后才解析出日志内容。
 * 这样做的好处是「记录哪些操作」集中在一张表里，加一条规则就多一处留痕，
 * 不必去每个业务 mock 里穿插写日志代码。
 *
 * 只收高敏感操作（账号增删改、角色与授权变更、商品删除/恢复、审核流转）。
 * 商品的新增与编辑不入表：它们频次高，会把首页那 8 条日志位刷满，
 * 真正需要追责的删除与授权记录反而被挤下去。
 */

export interface OperationContext
{
  method: string;
  /** 已去掉 query string 的路径，规则里可以直接用 startsWith / 正则收尾锚定 */
  path: string;
  body?: any;
  query?: any;
  params?: any;
  /** 由 permission/guard.ts 鉴权时写入，是服务端认定的操作人 */
  user?: { id: number; name: string; username: string; roleName: string };
}

/** 日志状态：0 待处理（黄）/ 1 已执行（绿）/ 2 危险动作（红，删除与驳回） */
export const LOG_STATUS = {
  PENDING: 0,
  DONE: 1,
  DANGER: 2,
} as const;

export interface OperationRule
{
  method: "post" | "put" | "delete";
  test: ( path: string ) => boolean;
  /** 动作描述。给函数时可按请求体动态决定，例如区分「新增账号」与「编辑账号」 */
  action: string | ( ( ctx: OperationContext, result: any ) => string );
  /** 操作对象描述，回答「动了哪一条」 */
  target: ( ctx: OperationContext, result: any ) => string;
  /** 不写时默认 1（已执行） */
  status?: number | ( ( ctx: OperationContext, result: any ) => number );
}

/** 从多个候选来源里取第一个有意义的值，兼容 body / query / params / 响应体各处取值 */
const pick = ( ...values: any[] ): any =>
  values.find( ( value ) => value !== undefined && value !== null && value !== "" );

/** 把 id 列表渲染成可读文本，兼容单个 id、id 数组、逗号串 */
const renderIds = ( ids: any ): string =>
{
  if ( Array.isArray( ids ) ) return ids.join( "、" );
  return String( ids ?? "" );
};

/** 取操作对象名称：优先用响应体里的名称（真实落库的那条），退化到 id */
const named = ( name: any, id: any, fallback: string ): string =>
  name ? `「${ name }」` : id ? ` id ${ id }` : fallback;

export const OPERATION_RULES: OperationRule[] = [
  // ---------------- 账号管理 ----------------
  {
    method: "put",
    test: ( path ) => path === "/api/user/saveOrUpdate",
    // 同一个接口承载新增与编辑，靠 body.id 区分
    action: ( ctx ) => ( ctx.body?.id ? "编辑账号" : "新增账号" ),
    target: ( ctx ) =>
    {
      const roles = ctx.body?.roleNames;
      const roleText = Array.isArray( roles ) && roles.length
        ? `，角色：${ roles.join( "、" ) }`
        : "";
      return `账号「${ ctx.body?.username ?? "未知" }」${ roleText }`;
    },
  },
  {
    method: "put",
    test: ( path ) => path === "/api/user/role/update",
    action: "分配角色",
    target: ( ctx ) =>
      `账号 id ${ ctx.body?.id } → ${
        Array.isArray( ctx.body?.roleNames )
          ? ctx.body.roleNames.join( "、" )
          : "无"
      }`,
  },
  {
    method: "delete",
    test: ( path ) => path === "/api/user/role/delete",
    action: "删除账号",
    target: ( ctx ) => `账号 id ${ renderIds( ctx.body?.ids ) }`,
    status: LOG_STATUS.DANGER,
  },

  // ---------------- 角色与权限 ----------------
  {
    method: "put",
    test: ( path ) => path === "/api/role/saveOrUpdate",
    action: ( ctx ) => ( ctx.body?.id ? "编辑角色" : "新增角色" ),
    target: ( ctx ) => `角色${ named( ctx.body?.roleName, ctx.body?.id, "" ) }`,
  },
  {
    method: "delete",
    test: ( path ) => path === "/api/role/delete",
    action: "删除角色",
    target: ( ctx ) =>
      `角色 id ${ renderIds( pick( ctx.body?.ids, ctx.body ) ) }`,
    status: LOG_STATUS.DANGER,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/role/permission/update",
    action: "分配权限",
    target: ( ctx ) =>
      `角色 id ${ ctx.body?.roleId }，授权 ${
        Array.isArray( ctx.body?.permissionIds )
          ? ctx.body.permissionIds.length
          : 0
      } 项`,
  },
  {
    method: "post",
    test: ( path ) => path === "/api/permission/add",
    action: "新增菜单权限",
    target: ( ctx ) => `权限「${ ctx.body?.name ?? "未命名" }」`,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/permission/update",
    action: "编辑菜单权限",
    target: ( ctx ) => `权限「${ ctx.body?.name ?? "未命名" }」`,
  },
  {
    method: "delete",
    test: ( path ) => path === "/api/permission/delete",
    action: "删除菜单权限",
    target: ( ctx ) => `权限 id ${ pick( ctx.body?.id, ctx.body ) }`,
    status: LOG_STATUS.DANGER,
  },

  // ---------------- 商品：删除与恢复 ----------------
  {
    method: "delete",
    test: ( path ) => path === "/api/admin/product/deleteSpu",
    action: "删除 SPU",
    target: ( ctx ) => `SPU${ named( ctx.body?.spuName, pick( ctx.query?.id, ctx.body?.id ), "" ) }`,
    status: LOG_STATUS.DANGER,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/admin/product/recycle/restoreSpu",
    action: "恢复 SPU",
    target: ( ctx ) => `SPU id ${ pick( ctx.body?.spuId, ctx.body?.id, ctx.query?.id ) }`,
  },
  {
    method: "delete",
    test: ( path ) => path.startsWith( "/api/admin/product/deleteSku/" ),
    action: "删除 SKU",
    target: ( ctx, result ) =>
      `SKU${ named( result?.data?.skuName, pick( ctx.params?.skuId, ctx.body?.skuId ), "" ) }`,
    status: LOG_STATUS.DANGER,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/admin/product/recycle/restoreSku",
    action: "恢复 SKU",
    target: ( ctx, result ) =>
      `SKU${ named( result?.data?.skuName, pick( ctx.body?.skuId, ctx.body?.id ), "" ) }`,
  },
  {
    method: "delete",
    test: ( path ) => path === "/api/product/baseTrademark",
    action: "删除品牌",
    target: ( ctx, result ) =>
      `品牌${ named( result?.data?.tmName, pick( ctx.body?.id, ctx.query?.id ), "" ) }`,
    status: LOG_STATUS.DANGER,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/product/baseTrademark/restore",
    action: "恢复品牌",
    target: ( ctx, result ) =>
      `品牌${ named( result?.data?.tmName, pick( ctx.body?.id, ctx.query?.id ), "" ) }`,
  },
  {
    method: "delete",
    test: ( path ) => path === "/api/attribute/delete",
    action: "删除属性",
    target: ( ctx ) =>
      `属性 id ${ pick( ctx.body?.attrId, ctx.body?.id, ctx.query?.attrId ) }`,
    status: LOG_STATUS.DANGER,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/product/attr/recycle/restore",
    action: "恢复属性",
    target: ( ctx ) =>
      `属性 id ${ pick( ctx.body?.attrId, ctx.body?.id, ctx.query?.attrId ) }`,
  },

  // ---------------- 商品审核流转 ----------------
  {
    method: "post",
    test: ( path ) => path === "/api/admin/product/audit/submit",
    action: ( ctx ) =>
      `提交${ Number( ctx.body?.targetIsSale ) === 1 ? "上架" : "下架" }审核`,
    target: ( ctx, result ) =>
      `SKU${ named( result?.data?.skuName, ctx.body?.skuId, "" ) }`,
    // 提交只是发起，结果尚未产生，用「待处理」色
    status: LOG_STATUS.PENDING,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/admin/product/audit/approve",
    action: "审核通过",
    target: ( ctx, result ) =>
      `SKU${ named( result?.data?.skuName, result?.data?.skuId, "" ) }`,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/admin/product/audit/reject",
    action: "审核驳回",
    target: ( ctx, result ) =>
      `SKU${ named( result?.data?.skuName, result?.data?.skuId, "" ) }`,
    status: LOG_STATUS.DANGER,
  },
  {
    method: "put",
    test: ( path ) => path === "/api/admin/product/audit/batch",
    action: ( ctx ) =>
      ctx.body?.action === "reject" ? "批量驳回" : "批量审核通过",
    target: ( ctx ) =>
      `审核单 ${ Array.isArray( ctx.body?.auditIds ) ? ctx.body.auditIds.length : 0 } 条`,
    status: ( ctx, result ) =>
      ctx.body?.action === "reject" || result?.data?.successCount === 0
        ? LOG_STATUS.DANGER
        : LOG_STATUS.DONE,
  },
];

/** 解析动作描述（静态字符串或按上下文计算的函数） */
export const resolveAction = (
  rule: OperationRule,
  ctx: OperationContext,
  result: any,
): string =>
  typeof rule.action === "function" ? rule.action( ctx, result ) : rule.action;

/** 解析状态码，规则未声明时默认「已执行」 */
export const resolveStatus = (
  rule: OperationRule,
  ctx: OperationContext,
  result: any,
): number =>
  typeof rule.status === "function"
    ? rule.status( ctx, result )
    : rule.status ?? LOG_STATUS.DONE;
