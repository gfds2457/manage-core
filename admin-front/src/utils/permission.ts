/**
 * 权限工具。这里有一条硬约束，改动前务必先读：
 *   roles       → 决定「路由能否访问」和「菜单是否显示」
 *   permissions → 只决定「按钮是否显示」（配合 v-hasBtn 指令）
 * 两者语义不能互换。超管的 permissions 是通配的 ["*"]，如果用
 * permissions.includes(route.name) 这种写法去过滤路由，超管会看到空菜单。
 */

// 拥有全部权限的角色。配了 meta.roles 的路由对它始终放行，
// 这样以后新增受控页面时漏配「超级管理员」也不会把自己锁在门外
export const SUPER_ROLE = "超级管理员";

// 权限码常量。v-hasBtn 的取值只能从这里取，不要写字符串字面量。
//
// ⚠️ 必须与后端 admin-mock-backend/src/permission/codes.ts 的 PERM 逐字一致。
// 两边对不上的后果是静默的、且症状相反：前端码写错 → 按钮不显示但接口照常能调；
// 后端码写错 → 按钮看得见、一点就 403。都不会报错，只能靠人肉比对发现。
export const PERM = {
  GOODS_BRAND_WRITE: "goods:brand:write",
  GOODS_ATTR_WRITE: "goods:attr:write",
  GOODS_SPU_WRITE: "goods:spu:write",
  GOODS_SKU_WRITE: "goods:sku:write",
  GOODS_REVIEW_AUDIT: "goods:review:audit",
  PERMISSION_USER_WRITE: "permission:user:write",
  PERMISSION_ROLE_WRITE: "permission:role:write",
  PERMISSION_MENU_WRITE: "permission:menu:write",
} as const;

// mock 里角色是逗号分隔的字符串（"运营,产品"），需要拆成数组；
// 顺带容错全角逗号与顿号，避免手写数据时踩坑
export const parseRoles = (role?: string | null): string[] =>
  (role ?? "")
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);

// 单个路由是否对当前用户开放。
// 没配 meta.roles 的路由 = 所有登录用户都能访问，所以现有页面不受影响。
// 传进来的既可以是路由配置，也可以是守卫里的 to（两者都有 meta）
export const canAccessRoute = (route: any, roles: string[]): boolean => {
  if (roles.includes(SUPER_ROLE)) return true;
  const need = route?.meta?.roles as string[] | undefined;
  if (!Array.isArray(need) || need.length === 0) return true;
  return need.some((item) => roles.includes(item));
};

// 递归过滤路由树，只保留当前角色能访问的分支，用于渲染左侧菜单。
// 注意：路由表本身是全量注册的（见根目录 permission.ts），这里只裁剪菜单，
// 否则未匹配的地址拿不到 meta，守卫就没法做「无权访问」的拦截。
export const filterRoutesByRole = (routes: any[], roles: string[]): any[] => {
  const result: any[] = [];
  routes.forEach((route) => {
    if (!canAccessRoute(route, roles)) return;
    // 必须返回克隆对象，不能像旧实现那样原地改 item.children：
    // 切换账号会二次过滤，原地修改会把子路由掏空导致菜单永久残缺。
    // 也不能用 JSON.parse(JSON.stringify()) / structuredClone：
    // component 是懒加载函数，前者会静默丢弃它（页面空白），后者直接抛 DataCloneError。
    // meta 兜底成 {} 是必需的，菜单组件里写的是 item.meta.hide（没有 ?.）
    const cloned: any = { ...route, meta: { ...(route.meta ?? {}) } };
    if (Array.isArray(route.children) && route.children.length > 0) {
      const children = filterRoutesByRole(route.children, roles);
      // 子路由被全部过滤掉时父级要一起丢弃，
      // 否则会留下一个 redirect 指向不存在子路由的死菜单
      if (children.length === 0) return;
      cloned.children = children;
    }
    result.push(cloned);
  });
  return result;
};

// 按钮级权限判断：多条件之间是「或」的关系，命中任意一个即可。
// 不传 required 时视为不做控制（放行），避免有人漏传值导致按钮莫名消失
export const hasPermission = (
  permissions: string[],
  required?: string | string[],
): boolean => {
  const need = (Array.isArray(required) ? required : [required]).filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
  if (need.length === 0) return true;
  if (permissions.includes("*")) return true;
  return need.some((item) => permissions.includes(item));
};
