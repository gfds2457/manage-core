/**
 * src/mock/user/index.ts 中 /api/user/saveOrUpdate 的单元测试。
 *
 * 覆盖范围：新增分支与编辑分支对 password 的处理
 *   - 编辑：传了密码 → 覆盖原密码；不传 / 传 null / 传空串 → 保持原密码
 *   - 新增：不传密码 → 201 拦截且不入库；传了密码 → 以传入值为准（不是被丢弃，也不是写死的 "1234567"）
 *
 * 运行：npx tsx --test src/mock/user/index.test.js
 * 说明：ESM + Node 内置测试框架（node:test / node:assert/strict），无第三方依赖；
 *      导入本地 TS 源码必须带 .ts 扩展名。
 *
 * ⚠️ 被测模块直接读写 data.ts 里的 allUserList 单例，用例之间必须互相隔离：
 *    beforeEach 快照、afterEach 还原，保证每个用例拿到的都是同一份初始数据。
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import userMocks from "./index.ts";
import {
  allRoles,
  allUserList,
  findUserByCredentials,
  findUserIndexById,
} from "./data.ts";

// ------------------------------------------------------------------ helpers

/** 按 url + method 取出 mock 定义，method 缺省为 get（与 adapter 的兜底一致） */
const findMock = ( url, method ) =>
  userMocks.find(
    ( mock ) =>
      mock.url === url &&
      ( mock.method || "get" ).toLowerCase() === method.toLowerCase(),
  );

const saveOrUpdate = findMock( "/api/user/saveOrUpdate", "put" );

/**
 * 模拟 adapter 调用 handler 时构造的 ctx。
 * saveOrUpdate 只解构了 body，其余字段照实补上，方便以后实现改用 query/params 时用例仍成立。
 */
const callSaveOrUpdate = ( body ) =>
{
  if ( !saveOrUpdate )
  {
    throw new Error( "未找到 /api/user/saveOrUpdate 的 mock 定义" );
  }
  return saveOrUpdate.response( {
    method: "put",
    url: "/api/user/saveOrUpdate",
    body,
    params: {},
    query: {},
  } );
};

/**
 * data.ts 里的真实角色名。
 * keepKnownRoles 会过滤掉未登记的角色，所以新增用例必须带上一个真实角色名，
 * 否则会先被「创建账号时必须为其分配角色」拦下，测不到密码分支。
 */
const firstRoleName = () => allRoles[ 0 ]?.roleName;

/** 造一个可编辑的既有账号 */
const seedUser = ( overrides = {} ) =>
{
  const now = new Date().toLocaleString();
  const user = {
    id: 9001,
    username: "seed_user",
    password: "old-password",
    name: "种子用户",
    phone: null,
    roleName: firstRoleName(),
    createTime: now,
    updateTime: now,
    ...overrides,
  };
  allUserList.unshift( user );
  return user;
};

// 每个用例开始前快照、结束后原地还原（allUserList 是模块级单例，必须原地改）
let snapshot = [];

beforeEach( () =>
{
  snapshot = allUserList.map( ( user ) => ( { ...user } ) );
} );

afterEach( () =>
{
  allUserList.length = 0;
  allUserList.push( ...snapshot );
} );

// -------------------------------------------------------------------- 前置

test( "前置：能找到 /api/user/saveOrUpdate 的 PUT mock，且角色数据可用", () =>
{
  assert.ok( saveOrUpdate, "未找到 /api/user/saveOrUpdate 的 mock 定义" );
  assert.equal( typeof saveOrUpdate.response, "function" );
  assert.ok(
    firstRoleName(),
    "allRoles 里至少要有一个角色，否则新增分支会被角色校验提前拦下",
  );
} );

// ---------------------------------------------------------------- 编辑分支

test( "编辑：传了新密码 → 覆盖原密码，新密码可登录、旧密码失效", () =>
{
  const seeded = seedUser();

  const res = callSaveOrUpdate( {
    id: seeded.id,
    username: seeded.username,
    nickname: seeded.name,
    password: "new-password",
  } );

  assert.equal( res.code, 200 );
  assert.equal(
    allUserList[ findUserIndexById( seeded.id ) ].password,
    "new-password",
  );
  assert.ok(
    findUserByCredentials( seeded.username, "new-password" ),
    "提交时填的新密码应能登录",
  );
  assert.ok(
    !findUserByCredentials( seeded.username, "old-password" ),
    "旧密码在改密后不应再能登录",
  );
} );

test( "编辑：完全不传 password 字段 → 保留原密码，但其它字段照常更新", () =>
{
  const seeded = seedUser();

  const res = callSaveOrUpdate( {
    id: seeded.id,
    username: "renamed_user",
    nickname: "改名后",
  } );

  assert.equal( res.code, 200 );

  const index = findUserIndexById( seeded.id );
  assert.equal( allUserList[ index ].username, "renamed_user", "用户名应已更新" );
  assert.equal( allUserList[ index ].name, "改名后", "昵称应已更新" );
  assert.equal( allUserList[ index ].password, "old-password", "未传密码应保留原密码" );
  assert.ok( findUserByCredentials( "renamed_user", "old-password" ) );
} );

test( "编辑：password 传空串 → 视为「不改密码」，保留原密码", () =>
{
  const seeded = seedUser();

  const res = callSaveOrUpdate( {
    id: seeded.id,
    username: seeded.username,
    nickname: seeded.name,
    password: "",
  } );

  assert.equal( res.code, 200 );
  assert.equal(
    allUserList[ findUserIndexById( seeded.id ) ].password,
    "old-password",
  );
  assert.ok( findUserByCredentials( seeded.username, "old-password" ) );
} );

test( "编辑：password 传 null 或 undefined → 保留原密码", () =>
{
  const nulled = seedUser( { id: 9002, username: "seed_null" } );
  const undefed = seedUser( { id: 9003, username: "seed_undef" } );

  callSaveOrUpdate( {
    id: nulled.id,
    username: nulled.username,
    nickname: nulled.name,
    password: null,
  } );
  callSaveOrUpdate( {
    id: undefed.id,
    username: undefed.username,
    nickname: undefed.name,
    password: undefined,
  } );

  assert.equal( allUserList[ findUserIndexById( 9002 ) ].password, "old-password" );
  assert.equal( allUserList[ findUserIndexById( 9003 ) ].password, "old-password" );
} );

// ---------------------------------------------------------------- 新增分支

test( "新增：不传密码 → 201 拦截，且不会写进用户列表", () =>
{
  const before = allUserList.length;

  const res = callSaveOrUpdate( {
    username: "brand_new",
    nickname: "新账号",
    roleNames: [ firstRoleName() ],
  } );

  assert.equal( res.code, 201 );
  assert.equal( res.message, "用户密码不能为空" );
  assert.equal( allUserList.length, before, "被拦截的账号不应出现在列表里" );
  assert.ok( !allUserList.some( ( user ) => user.username === "brand_new" ) );
  assert.ok(
    !findUserByCredentials( "brand_new", "1234567" ),
    "被拦截的账号不应能用老代码写死的 1234567 登录",
  );
} );

test( "新增：密码为空串 → 同样被 201 拦截", () =>
{
  const before = allUserList.length;

  const res = callSaveOrUpdate( {
    username: "brand_new",
    nickname: "新账号",
    password: "",
    roleNames: [ firstRoleName() ],
  } );

  assert.equal( res.code, 201 );
  assert.equal( res.message, "用户密码不能为空" );
  assert.equal( allUserList.length, before );
} );

test( "新增：传了密码 → 以传入密码入库，旧代码写死的 1234567 必须失效", () =>
{
  const before = allUserList.length;

  const res = callSaveOrUpdate( {
    username: "brand_new",
    nickname: "新账号",
    password: "p@ssw0rd!",
    roleNames: [ firstRoleName() ],
  } );

  assert.equal( res.code, 200 );
  assert.equal( allUserList.length, before + 1 );

  const created = findUserByCredentials( "brand_new", "p@ssw0rd!" );
  assert.ok( created, "应能用提交时填的密码登录" );
  assert.equal( created.password, "p@ssw0rd!" );
  assert.ok(
    !findUserByCredentials( "brand_new", "1234567" ),
    "老代码写死的 1234567 不应还能登录",
  );

  // unshift 插到最前，响应体里也带的是同一个新账号
  assert.equal( allUserList[ 0 ].password, "p@ssw0rd!" );
  assert.equal( res.data.password, "p@ssw0rd!" );
} );

test( "新增：校验顺序 —— 既缺角色又缺密码时，先报「必须分配角色」", () =>
{
  // 这条用例说明为什么上面的新增用例都必须带 roleNames：
  // 角色校验位于密码校验之前，缺角色时根本走不到密码分支。
  const res = callSaveOrUpdate( {
    username: "brand_new",
    nickname: "新账号",
  } );

  assert.equal( res.code, 201 );
  assert.equal( res.message, "创建账号时必须为其分配角色" );
} );
