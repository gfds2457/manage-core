import type { MockItem } from "../adapter.js";
import { findUserById } from "../mock/user/data.js";
import type { User } from "../mock/user/data.js";
import { hasPermission, resolvePermissions } from "./matrix.js";
import { resolveUserId } from "./session.js";

/** 鉴权通过后挂在 ctx 上的当前用户，比 User 多一份已解析的权限码 */
export interface AuthedUser extends User
{
  permissions: string[];
}

export interface AuthError
{
  code: number;
  message: string;
}

/**
 * 接口鉴权。返回 null 表示放行，返回对象表示拒绝（调用方直接把它当响应体发回去）。
 *
 * 三条防线，按顺序：
 *   1. mock.public 标记的接口（登录）直接放行——不做校验是因为此时还没有 token 可校验。
 *   2. 没有有效 token / token 认不出人 → 401，要求重新登录。
 *   3. token 认得出人但权限码不覆盖该接口所需权限 → 403，拒绝业务执行。
 *
 * 放行时会把当前用户写回 ctx.user，供操作日志取「操作人」——
 * 这也是为什么日志不采用「前端传 applyUserName」那种做法：前端传的字段可以伪造，
 * 而这里的 identity 来自服务端自己签发的 token。
 */
export const checkAuth = (
  mock: Pick<MockItem, "public" | "permission">,
  ctx: any,
): AuthError | null =>
{
  // 公开接口（登录）不需要身份
  if ( mock.public ) return null;

  const user = findUserById( resolveUserId( ctx?.headers?.authorization ) );

  // 认不出人：可能是没带 token、token 格式不对，或已被退出登录失效
  if ( !user )
  {
    return { code: 401, message: "token 无效或已过期，请重新登录" };
  }

  const permissions = resolvePermissions( user.roleName );

  // 接口没声明 permission 时视为「登录即可访问」，
  // 例如查询自身信息的 /api/user/info、商品域的只读接口
  if ( !hasPermission( permissions, mock.permission ) )
  {
    return {
      code: 403,
      message: `无权限执行该操作（当前角色：${ user.roleName || "未分配角色" }）`,
    };
  }

  // 只在放行之后才挂 ctx.user：被拒的请求不该在请求上下文里留下「已认证的操作人」，
  // 否则后续任何读到 ctx.user 的代码（如操作日志取操作人）都可能把一次越权尝试
  // 记成一次成功的操作
  ctx.user = { ...user, permissions } as AuthedUser;

  return null;
};
