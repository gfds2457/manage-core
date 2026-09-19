/**
 * src/permission/guard.ts 的单元测试。
 *
 * 运行方式：npx tsx --test src/permission/guard.test.js
 * 框架用 Node 内置的 node:test，断言用 node:assert/strict，不引入任何第三方依赖。
 *
 * 测试用真实用户数据（src/mock/user/data.ts）与真实权限矩阵（src/permission/matrix.ts）
 * 构造场景，token 一律经 issueToken 签发，不自造字符串——除了专门验证「非法 token」的那组。
 */
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { checkAuth } from "./guard.ts";
import { clearSessions, issueToken } from "./session.ts";
import { findUserById } from "../mock/user/data.ts";
import { PERM, WILDCARD } from "./codes.ts";
import { resolvePermissions } from "./matrix.ts";

// —— 测试账号，取自 src/mock/user/data.ts ——
// id 1  : username admin    / roleName「超级管理员」→ 持有通配符 *
// id 94 : username zhangsan / roleName「运营,产品」→ 实际拿到运营那 5 个写码
// id 95 : username 李四666   / roleName ""        → 已建号但未分配角色，无任何权限
const ADMIN_ID = 1;
const OPS_ID = 94;
const NO_ROLE_ID = 95;

/** 运营角色实际持有的权限码（产品在矩阵里为空，不贡献权限） */
const OPS_PERMISSIONS = Object.freeze([
  PERM.GOODS_BRAND_WRITE,
  PERM.GOODS_ATTR_WRITE,
  PERM.GOODS_SPU_WRITE,
  PERM.GOODS_SKU_WRITE,
  PERM.GOODS_REVIEW_AUDIT,
]);

/** 带 Bearer 前缀的请求上下文 */
const ctxWith = (token) => ({ headers: { authorization: `Bearer ${token}` } });

describe("checkAuth", () => {
  // 每个用例前清空已签发 token 表，避免用例之间互相影响
  beforeEach(() => clearSessions());

  test("测试账号与权限矩阵与预期一致", () => {
    assert.equal(findUserById(ADMIN_ID)?.roleName, "超级管理员");
    assert.equal(findUserById(OPS_ID)?.roleName, "运营,产品");
    assert.equal(findUserById(NO_ROLE_ID)?.roleName, "");

    // 运营 + 产品的并集就是运营那 5 个码；顺序无关，排序后比较
    assert.deepEqual(
      [...resolvePermissions("运营,产品")].sort(),
      [...OPS_PERMISSIONS].sort(),
    );
    // 未分配角色解析为空数组
    assert.deepEqual(resolvePermissions(""), []);
  });

  test("mock.public 为 true 时直接放行", () => {
    // 登录接口此刻还没有 token，也必须放行
    assert.equal(checkAuth({ public: true }, { headers: {} }), null);
    // 带不带 Authorization 都一样
    assert.equal(checkAuth({ public: true }, ctxWith("garbage")), null);
    // 公开接口不做权限校验，声明了 permission 也照样放行
    assert.equal(
      checkAuth({ public: true, permission: PERM.GOODS_SPU_WRITE }, ctxWith("garbage")),
      null,
    );
  });

  test("没带 authorization 头 → 401", () => {
    assert.equal(checkAuth({}, { headers: {} })?.code, 401);
    assert.equal(checkAuth({}, {})?.code, 401);
    assert.equal(checkAuth({}, { headers: { authorization: "" } })?.code, 401);
    assert.equal(checkAuth({}, { headers: { authorization: "Bearer " } })?.code, 401);
  });

  test("token 格式非法 → 401", () => {
    const invalid = [
      "abc", // 不带前缀
      "Bearer abc", // 剥离 Bearer 后仍不带前缀
      "mock-token-", // 取不到 id
      "mock-token-abc-123", // id 不是数字
      "mock-token-0-abc", // id 必须大于 0
      "mock-token--1-abc", // 负数写法，split 后第一段为空串
      "some-token-1-abcdef", // 前缀不对
    ];

    for (const token of invalid) {
      const result = checkAuth({}, ctxWith(token));
      assert.equal(result?.code, 401, `token「${token}」应被拒绝`);
    }
  });

  test("token 格式合法但认不出用户 → 401", () => {
    // 经 issueToken 正常签发，但用户表里没有这个 id
    assert.equal(checkAuth({}, ctxWith(issueToken(99999)))?.code, 401);
    // 未经签发、格式合法（对应 mock 后端重启后内存表清空的场景），id 也不存在
    assert.equal(checkAuth({}, ctxWith("mock-token-88888-abcdef"))?.code, 401);
  });

  test("接口没声明 permission 时，登录即可访问", () => {
    // 运营访问只读接口
    assert.equal(checkAuth({}, ctxWith(issueToken(OPS_ID))), null);
    // 连角色都没有的账号，访问「登录即可」的接口同样放行
    assert.equal(checkAuth({ public: false }, ctxWith(issueToken(NO_ROLE_ID))), null);
    // permission 显式传 undefined / 空串，也按「不做控制」处理
    assert.equal(checkAuth({ permission: undefined }, ctxWith(issueToken(OPS_ID))), null);
    assert.equal(checkAuth({ permission: "" }, ctxWith(issueToken(OPS_ID))), null);
  });

  test("超级管理员放行，ctx.user 写成当前用户，permissions 含通配符 *", () => {
    const ctx = ctxWith(issueToken(ADMIN_ID));
    const result = checkAuth({ permission: PERM.PERMISSION_USER_WRITE }, ctx);

    assert.equal(result, null);
    assert.ok(ctx.user, "放行时应把当前用户写到 ctx.user");
    assert.equal(ctx.user.id, ADMIN_ID);
    assert.equal(ctx.user.username, "admin");
    assert.equal(ctx.user.roleName, "超级管理员");
    assert.ok(Array.isArray(ctx.user.permissions));
    assert.ok(
      ctx.user.permissions.includes(WILDCARD),
      `超管权限应含通配符 *，实际：${JSON.stringify(ctx.user.permissions)}`,
    );
  });

  test("运营角色：放行商品写接口，但访问权限域写接口返回 403", () => {
    const ctx = ctxWith(issueToken(OPS_ID));

    // 商品域写接口 → 运营持有 GOODS_SPU_WRITE，放行
    assert.equal(checkAuth({ permission: PERM.GOODS_SPU_WRITE }, ctx), null);
    assert.equal(ctx.user?.id, OPS_ID);
    assert.ok(!ctx.user.permissions.includes(WILDCARD), "运营不应拿到通配符");

    // 权限域写接口 → 运营没有 permission:* 系列，拒绝
    const denied = checkAuth({ permission: PERM.PERMISSION_ROLE_WRITE }, ctxWith(issueToken(OPS_ID)));
    assert.ok(denied, "应当拒绝");
    assert.equal(denied.code, 403);
    assert.match(denied.message, /运营/, "message 应带上当前角色名");

    // 同一资源下「能写商品」不代表能审商品之外的权限，逐码验证未授予的三个码
    for (const code of [
      PERM.PERMISSION_USER_WRITE,
      PERM.PERMISSION_ROLE_WRITE,
      PERM.PERMISSION_MENU_WRITE,
    ]) {
      const result = checkAuth({ permission: code }, ctxWith(issueToken(OPS_ID)));
      assert.equal(result?.code, 403, `运营访问 ${code} 应 403`);
    }
  });

  test("需要多个权限码（数组）时，持有任一即放行", () => {
    const need = [PERM.PERMISSION_ROLE_WRITE, PERM.GOODS_SPU_WRITE];
    assert.equal(checkAuth({ permission: need }, ctxWith(issueToken(OPS_ID))), null);
  });

  test("未分配角色访问需鉴权接口 → 403，message 为「未分配角色」", () => {
    const result = checkAuth(
      { permission: PERM.GOODS_SPU_WRITE },
      ctxWith(issueToken(NO_ROLE_ID)),
    );

    assert.ok(result, "应当拒绝");
    assert.equal(result.code, 403);
    assert.match(result.message, /未分配角色/);
  });

  test("401 / 403 时不写入 ctx.user", () => {
    const rejected401 = {};
    assert.equal(checkAuth({}, rejected401)?.code, 401);
    assert.equal(rejected401.user, undefined);

    const rejected403 = ctxWith(issueToken(NO_ROLE_ID));
    assert.equal(checkAuth({ permission: PERM.GOODS_SPU_WRITE }, rejected403)?.code, 403);
    assert.equal(rejected403.user, undefined);
  });
});
