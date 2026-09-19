/**
 * src/permission/session.ts 单元测试。
 *
 * 运行：npx tsx --test src/permission/session.test.js
 * 说明：ESM + Node 内置测试框架（node:test / node:assert/strict），无第三方依赖；
 *      导入本地 TS 源码必须带 .ts 扩展名。
 *
 * ⚠️ session.ts 内部有一张「已签发 token → userId」的内存表，用例之间必须
 *    clearSessions() 重置，否则互相影响。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  TOKEN_PREFIX,
  issueToken,
  resolveUserId,
  clearSessions,
} from "./session.ts";

// -------------------------------------------------------------- issueToken

test( "issueToken：token 以 mock-token- 开头", () =>
{
  clearSessions();
  const token = issueToken( 7 );
  assert.ok( token.startsWith( "mock-token-" ) );
  assert.ok( token.startsWith( TOKEN_PREFIX ) );
  assert.equal( typeof token, "string" );
} );

test( "issueToken：同一用户两次签发得到不同 token（对应多端同时登录）", () =>
{
  clearSessions();
  const first = issueToken( 7 );
  const second = issueToken( 7 );

  assert.notEqual( first, second );
  // 随机串不同，但都指向同一个用户
  assert.equal( resolveUserId( first ), 7 );
  assert.equal( resolveUserId( second ), 7 );
} );

test( "issueToken：不同用户签发不同 token", () =>
{
  clearSessions();
  assert.notEqual( issueToken( 1 ), issueToken( 2 ) );
} );

// ------------------------------------------------------------ resolveUserId

test( "resolveUserId：能解析出签发时的 userId", () =>
{
  clearSessions();
  assert.equal( resolveUserId( issueToken( 7 ) ), 7 );
  assert.equal( resolveUserId( issueToken( 42 ) ), 42 );
  assert.equal( resolveUserId( issueToken( 12345 ) ), 12345 );
} );

test( "resolveUserId：带与不带 Bearer 前缀都能解析", () =>
{
  clearSessions();
  const token = issueToken( 7 );

  assert.equal( resolveUserId( token ), 7 );
  assert.equal( resolveUserId( `Bearer ${ token }` ), 7 );
  // 前缀大小写不敏感、额外空白也能容错
  assert.equal( resolveUserId( `bearer ${ token }` ), 7 );
  assert.equal( resolveUserId( `BEARER   ${ token }  ` ), 7 );
} );

test( "resolveUserId：无法解析的输入一律返回 null", () =>
{
  clearSessions();

  const invalid = [
    undefined,
    null,
    "",
    "   ",
    // 旧版「所有账号共用一个」的常量 token，必须拒掉
    "admin-token-1-abc",
    "Bearer admin-token-1-abc",
    // mock-token- 前缀正确，但 userId 部分不是正整数
    "mock-token-abc-x",
    "mock-token-0-x",
    "mock-token--1-x",
    "mock-token-1.5-x",
    "mock-token-NaN-x",
    // 前缀缺失的裸串
    "mock-token",
    "7-x",
  ];

  for ( const input of invalid )
  {
    assert.equal(
      resolveUserId( input ),
      null,
      `以下输入应返回 null：${ JSON.stringify( input ) }`,
    );
  }
} );

test( "resolveUserId：多次调用之间状态互不影响（每个用例先 clearSessions）", () =>
{
  clearSessions();
  const first = issueToken( 7 );
  assert.equal( resolveUserId( first ), 7 );

  clearSessions();
  const second = issueToken( 9 );
  assert.equal( resolveUserId( second ), 9 );
  // 内存表已重置，但按 token 自带的 userId 兜底，仍能解析回 7 而不是被串成 9
  assert.equal( resolveUserId( first ), 7 );
} );
