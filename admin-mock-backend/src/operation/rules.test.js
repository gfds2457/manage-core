import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OPERATION_RULES,
  LOG_STATUS,
  resolveAction,
  resolveStatus,
} from "./rules.ts";

/**
 * 按 method + path 找出命中的规则。
 * 规则里的 method 一律小写（post/put/delete），这里统一转小写再比。
 */
function findRule( method, path )
{
  const normalized = method.toLowerCase();
  return OPERATION_RULES.find(
    ( rule ) => rule.method === normalized && rule.test( path ),
  );
}

/** 断言某条路径确实被规则命中，并把命中的规则返回给调用方继续断言 */
function expectHit( method, path )
{
  const rule = findRule( method, path );
  assert.ok(
    rule,
    `期望 ${ method } ${ path } 能命中规则，但实际没有`,
  );
  return rule;
}

// ---------------------------------------------------------------- 1. 路径命中

test( "路径命中：高敏感操作都能匹配到规则", () =>
{
  const cases = [
    [ "PUT", "/api/user/saveOrUpdate" ],
    [ "PUT", "/api/user/role/update" ],
    [ "DELETE", "/api/user/role/delete" ],
    [ "PUT", "/api/role/saveOrUpdate" ],
    [ "DELETE", "/api/role/delete" ],
    [ "PUT", "/api/role/permission/update" ],
    [ "DELETE", "/api/admin/product/deleteSpu" ],
    [ "DELETE", "/api/admin/product/deleteSku/12" ],
    [ "PUT", "/api/admin/product/recycle/restoreSpu" ],
    [ "DELETE", "/api/product/baseTrademark" ],
    [ "POST", "/api/admin/product/audit/submit" ],
  ];

  for ( const [ method, path ] of cases )
  {
    expectHit( method, path );
  }
} );

test( "路径命中：以 /api/admin/product/deleteSku/ 开头的路径同样命中", () =>
{
  expectHit( "DELETE", "/api/admin/product/deleteSku/1" );
  expectHit( "DELETE", "/api/admin/product/deleteSku/99999" );
} );

test( "路径命中：规则只声明 post/put/delete 三种方法", () =>
{
  const allowed = new Set( [ "post", "put", "delete" ] );
  for ( const rule of OPERATION_RULES )
  {
    assert.ok(
      allowed.has( rule.method ),
      `规则出现意料之外的方法：${ rule.method }`,
    );
  }
} );

// ---------------------------------------------------------------- 2. 不误记

test( "不误记：读接口不被任何规则命中", () =>
{
  const readPaths = [
    "/api/user/list",
    "/api/admin/product/list",
    "/api/admin/operation/logs",
  ];

  // 规则的 method 里不存在 get，读请求自然不会被记录
  assert.ok( OPERATION_RULES.every( ( rule ) => rule.method !== "get" ) );

  for ( const path of readPaths )
  {
    assert.equal(
      findRule( "get", path ),
      undefined,
      `读接口 ${ path } 不应命中任何规则`,
    );
  }
} );

// ---------------------------------------------------------------- 3. resolveAction

test( "resolveAction：静态字符串规则原样返回动作描述", () =>
{
  const rule = expectHit( "PUT", "/api/user/role/update" );
  const ctx = { method: "put", path: "/api/user/role/update" };

  assert.equal( resolveAction( rule, ctx, {} ), "分配角色" );
} );

test( "resolveAction：PUT /api/user/saveOrUpdate 靠 body.id 区分新增与编辑", () =>
{
  const rule = expectHit( "PUT", "/api/user/saveOrUpdate" );
  const base = { method: "put", path: "/api/user/saveOrUpdate" };

  assert.equal(
    resolveAction(
      rule,
      { ...base, body: { id: 3, username: "zhangsan" } },
      {},
    ),
    "编辑账号",
  );

  assert.equal(
    resolveAction(
      rule,
      { ...base, body: { username: "zhangsan" } },
      {},
    ),
    "新增账号",
  );
} );

test( "resolveAction：提交审核靠 body.targetIsSale 区分上下架", () =>
{
  const rule = expectHit( "POST", "/api/admin/product/audit/submit" );
  const base = { method: "post", path: "/api/admin/product/audit/submit" };

  assert.equal(
    resolveAction( rule, { ...base, body: { skuId: 1, targetIsSale: 1 } }, {} ),
    "提交上架审核",
  );

  assert.equal(
    resolveAction( rule, { ...base, body: { skuId: 1, targetIsSale: 0 } }, {} ),
    "提交下架审核",
  );

  // targetIsSale 缺失时按非 1 处理，即下架
  assert.equal(
    resolveAction( rule, { ...base, body: { skuId: 1 } }, {} ),
    "提交下架审核",
  );
} );

// ---------------------------------------------------------------- 4. resolveStatus

test( "resolveStatus：规则未声明 status 时默认「已执行」", () =>
{
  const rule = expectHit( "PUT", "/api/user/role/update" );
  assert.equal( rule.status, undefined );

  assert.equal(
    resolveStatus( rule, { method: "put", path: "/api/user/role/update" }, {} ),
    LOG_STATUS.DONE,
  );
} );

test( "resolveStatus：删除与驳回属于危险动作", () =>
{
  const dangerCases = [
    [ "DELETE", "/api/user/role/delete" ],
    [ "DELETE", "/api/role/delete" ],
    [ "DELETE", "/api/admin/product/deleteSpu" ],
    [ "DELETE", "/api/admin/product/deleteSku/12" ],
    // 源码中「审核驳回」声明为 put，不是 post
    [ "PUT", "/api/admin/product/audit/reject" ],
  ];

  for ( const [ method, path ] of dangerCases )
  {
    const rule = expectHit( method, path );
    assert.equal(
      resolveStatus( rule, { method: method.toLowerCase(), path }, {} ),
      LOG_STATUS.DANGER,
      `${ method } ${ path } 应为危险动作`,
    );
  }
} );

test( "resolveStatus：提交审核为「待处理」", () =>
{
  const rule = expectHit( "POST", "/api/admin/product/audit/submit" );

  assert.equal(
    resolveStatus(
      rule,
      { method: "post", path: "/api/admin/product/audit/submit" },
      {},
    ),
    LOG_STATUS.PENDING,
  );
} );

test( "resolveStatus：LOG_STATUS 取值符合约定", () =>
{
  assert.equal( LOG_STATUS.PENDING, 0 );
  assert.equal( LOG_STATUS.DONE, 1 );
  assert.equal( LOG_STATUS.DANGER, 2 );
} );

// ---------------------------------------------------------------- 5. target 文案

test( "target：编辑账号会带上名称与请求体里的角色", () =>
{
  const rule = expectHit( "PUT", "/api/user/saveOrUpdate" );
  const ctx = {
    method: "put",
    path: "/api/user/saveOrUpdate",
    body: { username: "zhangsan", roleNames: [ "管理员", "运营" ] },
  };
  const result = { code: 200, data: { id: 3, username: "zhangsan" } };

  assert.equal(
    rule.target( ctx, result ),
    "账号「zhangsan」，角色：管理员、运营",
  );
} );

test( "target：没有角色时只保留账号名", () =>
{
  const rule = expectHit( "PUT", "/api/user/saveOrUpdate" );
  const ctx = {
    method: "put",
    path: "/api/user/saveOrUpdate",
    body: { username: "lisi" },
  };

  assert.equal( rule.target( ctx, {} ), "账号「lisi」" );
} );

test( "target：缺少用户名时退化为「未知」", () =>
{
  const rule = expectHit( "PUT", "/api/user/saveOrUpdate" );
  const ctx = { method: "put", path: "/api/user/saveOrUpdate", body: {} };

  assert.equal( rule.target( ctx, {} ), "账号「未知」" );
} );

test( "target：删除账号会渲染 id 列表", () =>
{
  const rule = expectHit( "DELETE", "/api/user/role/delete" );
  const ctx = {
    method: "delete",
    path: "/api/user/role/delete",
    body: { ids: [ 1, 2, 3 ] },
  };

  assert.equal( rule.target( ctx, {} ), "账号 id 1、2、3" );
} );

test( "target：删除 SKU 会优先采用响应体里的名称", () =>
{
  const rule = expectHit( "DELETE", "/api/admin/product/deleteSku/12" );
  const ctx = {
    method: "delete",
    path: "/api/admin/product/deleteSku/12",
    params: { skuId: 12 },
  };
  const result = { code: 200, data: { skuName: "小米手机" } };

  assert.equal( rule.target( ctx, result ), "SKU「小米手机」" );
} );

test( "target：删除 SPU 带上名称", () =>
{
  const rule = expectHit( "DELETE", "/api/admin/product/deleteSpu" );
  const ctx = {
    method: "delete",
    path: "/api/admin/product/deleteSpu",
    body: { spuName: "小米手机 SPU" },
  };

  assert.equal( rule.target( ctx, {} ), "SPU「小米手机 SPU」" );
} );
