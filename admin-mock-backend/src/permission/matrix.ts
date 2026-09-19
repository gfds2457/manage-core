import { PERM, WILDCARD } from "./codes";

/**
 * 角色 → 权限码矩阵。「谁能做什么」的唯一真源。
 *
 * 需求约束（request.md）：
 *   - 超级管理员：拥有全部权限
 *   - 运营：商品增删改查、商品审核；没有用户与角色管理权
 *   - 产品：只能查看商品；不能删除/新增商品，不能管理账号
 *
 * 「产品」这一行的空数组不是漏写：产品角色按最小权限原则不持有任何写权限，
 * 它能看商品靠的是前端路由放行与商品读接口「登录即可访问」，
 * 而不是靠一个 goods:read 码——读权限对所有登录用户开放，单列一个码没有区分度。
 *
 * 扩展方式：新增角色时在这里加一行即可，业务代码一行都不用动。
 * 未登记的角色解析为空数组而不是抛错：角色是用户在角色管理页可自建的，
 * 抛错会让「新建一个角色」这件事直接不可用。
 */
export const ROLE_MATRIX: Record<string, string[]> = {
  "超级管理员": [ WILDCARD ],
  "运营": [
    PERM.GOODS_BRAND_WRITE,
    PERM.GOODS_ATTR_WRITE,
    PERM.GOODS_SPU_WRITE,
    PERM.GOODS_SKU_WRITE,
    PERM.GOODS_REVIEW_AUDIT,
  ],
  "产品": [],
};

/**
 * 角色是逗号分隔的字符串（"运营,产品"），拆分时容错全角逗号与顿号，
 * 避免手写演示数据时踩坑。
 */
export const parseRoles = (roleNames?: string | null): string[] =>
  ( roleNames ?? "" )
    .split( /[,，、]/ )
    .map( ( item ) => item.trim() )
    .filter( Boolean );

/**
 * 按角色推导权限码。多角色取并集并去重。
 * 一个用户同时挂「运营,产品」时，拿到的是运营那套写权限——按并集取最大权限集。
 */
export const resolvePermissions = (roleNames?: string | null): string[] => {
  const result: string[] = [];
  parseRoles( roleNames ).forEach( ( role ) =>
  {
    ( ROLE_MATRIX[ role ] ?? [] ).forEach( ( code ) =>
    {
      if ( !result.includes( code ) ) result.push( code );
    } );
  } );
  return result;
};

/**
 * 判断权限码集合是否覆盖所需权限。
 * 与前端 utils/permission.ts 的 hasPermission 保持同一套语义：
 *   - 持有通配符 "*" 一律放行
 *   - need 为空视为不做控制（放行），避免有人漏传值导致接口整体不可用
 */
export const hasPermission = (
  permissions: string[],
  need?: string | string[],
): boolean =>
{
  const required = ( Array.isArray( need ) ? need : [ need ] ).filter(
    ( item ): item is string => typeof item === "string" && item.length > 0,
  );
  if ( required.length === 0 ) return true;
  if ( permissions.includes( WILDCARD ) ) return true;
  return required.some( ( item ) => permissions.includes( item ) );
};
