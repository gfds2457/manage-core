import { describe, it, expect } from "vitest";
import {
  SUPER_ROLE,
  PERM,
  parseRoles,
  canAccessRoute,
  filterRoutesByRole,
  hasPermission,
} from "./permission";

describe("parseRoles", () => {
  it("按半角逗号拆分并去除各项首尾空格", () => {
    expect(parseRoles("运营,产品,测试")).toEqual(["运营", "产品", "测试"]);
    expect(parseRoles(" 运营 , 产品 ")).toEqual(["运营", "产品"]);
  });

  it("兼容全角逗号与顿号", () => {
    expect(parseRoles("运营，产品、测试")).toEqual(["运营", "产品", "测试"]);
    expect(parseRoles("运营，产品,测试、运维")).toEqual([
      "运营",
      "产品",
      "测试",
      "运维",
    ]);
  });

  it("null / undefined / 空串返回空数组", () => {
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles(undefined)).toEqual([]);
    expect(parseRoles("")).toEqual([]);
  });

  it("仅由分隔符和空白组成时返回空数组", () => {
    expect(parseRoles(" , ，、 ")).toEqual([]);
  });
});

describe("canAccessRoute", () => {
  it("超级管理员始终放行，即使路由配了未命中的 roles", () => {
    expect(canAccessRoute({ meta: { roles: ["运营"] } }, [SUPER_ROLE])).toBe(
      true,
    );
  });

  it("未配置 meta.roles 时对所有登录用户放行", () => {
    expect(canAccessRoute({}, ["产品"])).toBe(true);
    expect(canAccessRoute({ meta: {} }, ["产品"])).toBe(true);
    expect(canAccessRoute({ meta: { roles: [] } }, ["产品"])).toBe(true);
  });

  it("命中 meta.roles 中任一角色即放行", () => {
    const route = { meta: { roles: ["运营", "产品"] } };
    expect(canAccessRoute(route, ["产品"])).toBe(true);
    expect(canAccessRoute(route, ["运营", "测试"])).toBe(true);
  });

  it("角色不命中时返回 false", () => {
    const route = { meta: { roles: ["运营"] } };
    expect(canAccessRoute(route, ["测试"])).toBe(false);
    expect(canAccessRoute(route, [])).toBe(false);
  });
});

describe("filterRoutesByRole", () => {
  const lazyComponent = () => Promise.resolve({ default: {} });

  const buildRoutes = () => [
    { path: "/public", meta: {}, component: lazyComponent },
    {
      path: "/admin",
      meta: { roles: ["运营"] },
      children: [{ path: "dashboard", meta: { roles: ["运营"] } }],
    },
    {
      path: "/goods",
      meta: { roles: ["产品", "运营"] },
      children: [
        { path: "list", meta: { roles: ["产品"] } },
        { path: "audit", meta: { roles: ["运营"] } },
      ],
    },
  ];

  it("递归过滤，只保留当前角色可访问的分支", () => {
    const result = filterRoutesByRole(buildRoutes(), ["产品"]);
    const paths = result.map((item) => item.path);
    expect(paths).toEqual(["/public", "/goods"]);

    const goodsChildren = result
      .find((item) => item.path === "/goods")
      .children.map((item) => item.path);
    expect(goodsChildren).toEqual(["list"]);
  });

  it("子路由全部被过滤时父级一并丢弃", () => {
    const result = filterRoutesByRole(buildRoutes(), ["测试"]);
    // /admin 与 /goods 都无命中子路由，只剩无角色限制的 /public
    expect(result.map((item) => item.path)).toEqual(["/public"]);
  });

  it("返回克隆对象，不修改原始路由树", () => {
    const original = buildRoutes();
    const result = filterRoutesByRole(original, ["产品"]);

    expect(result).not.toBe(original);
    expect(result[0]).not.toBe(original[0]);
    expect(result[0].meta).not.toBe(original[0].meta);
    expect(result[1]).not.toBe(original[1]);
    expect(result[1].children).not.toBe(original[1].children);
    expect(result[1].children[0]).not.toBe(original[1].children[0]);
  });

  it("同一原路由二次过滤（切换账号）不会掏空 children", () => {
    const original = buildRoutes();

    const first = filterRoutesByRole(original, ["产品"]);
    expect(first.map((item) => item.path)).toEqual(["/public", "/goods"]);

    // 换成不匹配的角色
    const second = filterRoutesByRole(original, ["测试"]);
    expect(second.map((item) => item.path)).toEqual(["/public"]);

    // 再切回来，结果按"运营"重新过滤：
    // /goods 下的 list roles 是 ["产品"]，不命中被过滤；只剩 audit
    const third = filterRoutesByRole(original, ["运营"]);
    const goods = third.find((item) => item.path === "/goods");
    expect(goods.children.map((item) => item.path)).toEqual(["audit"]);

    const admin = third.find((item) => item.path === "/admin");
    expect(admin.children.map((item) => item.path)).toEqual(["dashboard"]);

    // 多次过滤都返回克隆对象，原始路由树始终未被污染
    const originalGoods = original.find((item) => item.path === "/goods");
    expect(originalGoods.children.map((item) => item.path)).toEqual([
      "list",
      "audit",
    ]);

    const originalAdmin = original.find((item) => item.path === "/admin");
    expect(originalAdmin.children.map((item) => item.path)).toEqual([
      "dashboard",
    ]);
  });

  it("保留 component 懒加载函数引用", () => {
    const routes = [{ path: "/a", meta: {}, component: lazyComponent }];
    const result = filterRoutesByRole(routes, []);

    expect(result[0].component).toBe(lazyComponent);
    expect(typeof result[0].component).toBe("function");
  });
});

describe("hasPermission", () => {
  it("持有通配符 * 时放行", () => {
    expect(hasPermission(["*"], PERM.GOODS_BRAND_WRITE)).toBe(true);
    expect(hasPermission(["*"], [PERM.GOODS_SPU_WRITE, PERM.GOODS_ATTR_WRITE])).toBe(
      true,
    );
  });

  it("多条件之间为「或」，命中任意一个即通过", () => {
    expect(
      hasPermission([PERM.GOODS_SPU_WRITE], [
        PERM.GOODS_BRAND_WRITE,
        PERM.GOODS_SPU_WRITE,
      ]),
    ).toBe(true);
  });

  it("全部未命中时返回 false", () => {
    expect(
      hasPermission([PERM.GOODS_ATTR_WRITE], PERM.GOODS_BRAND_WRITE),
    ).toBe(false);
    expect(hasPermission([], PERM.GOODS_BRAND_WRITE)).toBe(false);
  });

  it("未传 required 时放行", () => {
    expect(hasPermission([])).toBe(true);
    expect(hasPermission([], undefined)).toBe(true);
    expect(hasPermission([], [])).toBe(true);
    // 传入空串 / 非字符串会被过滤掉，等同于不控制
    expect(hasPermission([], ["", undefined])).toBe(true);
  });
});
