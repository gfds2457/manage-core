import { isWriteSuccess } from "../kb/sync";
import { OPERATION_RULES, resolveAction, resolveStatus } from "./rules";
import type { OperationContext } from "./rules";

/**
 * 操作日志的内存存储与写入。
 *
 * 挂在 adapter 的响应出口上（与知识库同步同一个位置），
 * 因为那是全部 60 条路由的唯一汇聚点——业务 mock 里不需要写任何日志代码。
 */

export interface OperationLog
{
  id: number;
  /** 动作描述，如「删除 SKU」 */
  action: string;
  /** 操作对象，如「SKU「小米手机」」 */
  target: string;
  /** 操作人显示名，取自服务端鉴权认定的用户，不是前端传参 */
  operator: string;
  operatorId: number | null;
  time: string;
  /** 0 待处理 / 1 已执行 / 2 危险动作，前端据此上色 */
  status: number;
}

/** 日志上限。超出后丢弃最旧的，避免长时间运行把内存撑满 */
const MAX_LOGS = 200;

/** 最新的一条在最前，读取时直接 slice 即可 */
const operationLogs: OperationLog[] = [];

let logIdSeed = 10000;

/** 当前时间，格式与其它 mock 模块保持一致 */
const now = (): string =>
{
  const d = new Date();
  const pad = ( n: number ) => String( n ).padStart( 2, "0" );
  return `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }-${ pad(
    d.getDate(),
  ) } ${ pad( d.getHours() ) }:${ pad( d.getMinutes() ) }:${ pad(
    d.getSeconds(),
  ) }`;
};

export interface NewOperationLog
{
  action: string;
  target: string;
  operator: string;
  operatorId: number | null;
  status: number;
  time?: string;
}

/** 写入一条日志。并发写入在单线程 Node 下天然串行，无需加锁 */
export const recordOperation = ( entry: NewOperationLog ): OperationLog =>
{
  const log: OperationLog = {
    id: ++logIdSeed,
    action: entry.action,
    target: entry.target,
    operator: entry.operator,
    operatorId: entry.operatorId,
    time: entry.time ?? now(),
    status: entry.status,
  };
  operationLogs.unshift( log );
  if ( operationLogs.length > MAX_LOGS )
  {
    operationLogs.length = MAX_LOGS;
  }
  return log;
};

/** 读取最近 N 条日志 */
export const readOperationLogs = ( limit = 8 ): OperationLog[] =>
{
  const size = Number( limit );
  const safeLimit = Number.isFinite( size ) && size > 0 ? Math.floor( size ) : 8;
  return operationLogs.slice( 0, safeLimit );
};

/**
 * 响应出口的钩子：命中高敏感操作规则且业务确实写成功时，记一条日志。
 *
 * 两个判定缺一不可：
 *   - isWriteSuccess 复用知识库同步那套判定（code === 200 且 ok !== false）。
 *     这里必须自己再判 method：isWriteSuccess 只看响应体不看方法，
 *     只判它会把 GET 请求也当成「写入成功」。
 *   - 规则表自带 method + path 匹配，未命中说明这不是需要留痕的操作，直接返回。
 *
 * 该函数保持同步且不抛错：它跑在响应已经发给客户端之后，
 * 任何异常都不该冒泡到 adapter 的 catch 里变成 500。
 */
export const maybeRecordOperation = (
  ctx: OperationContext & { method?: string; url?: string },
  result: any,
): void =>
{
  try
  {
    if ( !isWriteSuccess( result ) ) return;

    const method = String( ctx.method || "get" ).toLowerCase();
    if ( !["post", "put", "delete"].includes( method ) ) return;

    // ctx.url 是 originalUrl，带 query string；规则表里用完整路径做收尾锚定，
    // 不剥掉 query 会让 /api/product/baseTrademark?xxx 这类匹配不上
    const path = String( ctx.url || "" ).split( "?" )[ 0 ];

    const rule = OPERATION_RULES.find(
      ( item ) => item.method === method && item.test( path ),
    );
    if ( !rule ) return;

    const context: OperationContext = { ...ctx, method, path };
    const user = ctx.user;

    recordOperation( {
      action: resolveAction( rule, context, result ),
      target: rule.target( context, result ),
      operator: user?.name || user?.username || "未知操作人",
      operatorId: user?.id ?? null,
      status: resolveStatus( rule, context, result ),
    } );
  } catch ( err )
  {
    console.error( "[operation-log] 记录操作日志失败:", err );
  }
};

/** 仅供单元测试重置状态使用 */
export const clearOperationLogs = (): void =>
{
  operationLogs.length = 0;
  logIdSeed = 10000;
};
