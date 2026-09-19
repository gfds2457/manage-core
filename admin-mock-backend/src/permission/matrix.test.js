/**
 * src/permission/matrix.ts 单元测试。
 *
 * 运行：npx tsx --test src/permission/matrix.test.js
 * 说明：ESM + Node 内置测试框架（node:test / node:assert/strict），无第三方依赖；
 *      导入本地 TS 源码必须带 .ts 扩展名。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { PERM, WILDCARD } from "./codes.ts";
import { parseRoles, resolvePermissions, hasPermission } from "./matrix.ts";

/** 运营角色应有的 5 个码。用 PERM 常量比对，避免测试里硬编码字符串。 */
const OPERATOR_PERMISSIONS = [
  PERM.GOODS_BRAND_WRITE,
  PERM.GOODS_ATTR_WRITE,
  PERM.GOODS_SPU_WRITE,
  PERM.GOODS_SKU_WRITE,
  PERM.GOODS_REVIEW_AUDIT,
];

/** 排序后比较，规避「矩阵里书写顺序」与「断言里书写顺序」不一致导致的假失败 */
const sorted = ( list ) => [ ...list ].sort();

// ---------------------------------------------------------------- parseRoles

test( "parseRoles：半角逗号拆分", () =>
{
  assert.deepEqual( parseRoles( "运营,产品" ), [ "运营", "产品" ] );
} );

test( "parseRoles：单个角色", () =>
{
  assert.deepEqual( parseRoles( "超级管理员" ), [ "超级管理员" ] );
} );

test( "parseRoles：容错全角逗号与顿号", () =>
{
  assert.deepEqual(
    parseRoles( "运营，产品、超级管理员" ),
    [ "运营", "产品", "超级管理员" ],
  );
} );

test( "parseRoles：去掉每段首尾空白", () =>
{
  assert.deepEqual( parseRoles( " 运营 ,\t产品 " ), [ "运营", "产品" ] );
} );

test( "parseRoles：null / undefined / 空串 / 纯分隔符都返回空数组", () =>
{
  assert.deepEqual( parseRoles( null ), [] );
  assert.deepEqual( parseRoles( undefined ), [] );
  assert.deepEqual( parseRoles( "" ), [] );
  assert.deepEqual( parseRoles( "   " ), [] );
  assert.deepEqual( parseRoles( ",,，、" ), [] );
} );

// ------------------------------------------------------- resolvePermissions

test( "resolvePermissions：超级管理员拿到通配符", () =>
{
  const perms = resolvePermissions( "超级管理员" );
  assert.deepEqual( perms, [ WILDCARD ] );
  assert.ok( perms.includes( WILDCARD ) );
} );

test( "resolvePermissions：运营拿到那 5 个写权限码，且不含通配符", () =>
{
  const perms = resolvePermissions( "运营" );
  assert.equal( perms.length, 5 );
  assert.deepEqual( sorted( perms ), sorted( OPERATOR_PERMISSIONS ) );
  assert.ok( !perms.includes( WILDCARD ) );
} );

test( "resolvePermissions：产品得到空数组", () =>
{
  assert.deepEqual( resolvePermissions( "产品" ), [] );
} );

test( "resolvePermissions：多角色取并集并去重（运营,产品）", () =>
{
  const perms = resolvePermissions( "运营,产品" );
  assert.equal( perms.length, 5 );
  assert.deepEqual( sorted( perms ), sorted( OPERATOR_PERMISSIONS ) );
  // 去重：同一角色重复出现不会让权限码翻倍
  assert.equal( new Set( perms ).size, perms.length );
} );

test( "resolvePermissions：多角色结果与书写顺序无关", () =>
{
  assert.deepEqual(
    sorted( resolvePermissions( "运营,产品" ) ),
    sorted( resolvePermissions( "产品,运营" ) ),
  );
} );

test( "resolvePermissions：同一角色写两遍仍只有 5 个码", () =>
{
  const perms = resolvePermissions( "运营,运营" );
  assert.equal( perms.length, 5 );
  assert.deepEqual( sorted( perms ), sorted( OPERATOR_PERMISSIONS ) );
} );

test( "resolvePermissions：未登记角色返回空数组而不抛错", () =>
{
  assert.doesNotThrow( () => resolvePermissions( "临时新建的角色" ) );
  assert.deepEqual( resolvePermissions( "临时新建的角色" ), [] );
  assert.deepEqual( resolvePermissions( "运营,临时新建的角色" ).length, 5 );
} );

test( "resolvePermissions：null / undefined / 空串返回空数组", () =>
{
  assert.deepEqual( resolvePermissions( null ), [] );
  assert.deepEqual( resolvePermissions( undefined ), [] );
  assert.deepEqual( resolvePermissions( "" ), [] );
} );

// ----------------------------------------------------------- hasPermission

test( "hasPermission：持有通配符 * 一律放行", () =>
{
  assert.equal( hasPermission( [ WILDCARD ], PERM.GOODS_SPU_WRITE ), true );
  assert.equal( hasPermission( [ WILDCARD ], "任意未登记的码" ), true );
  assert.equal( hasPermission( [ WILDCARD ], undefined ), true );
} );

test( "hasPermission：need 为空 / 空数组 / 空串时放行（视为不做控制）", () =>
{
  assert.equal( hasPermission( [], undefined ), true );
  assert.equal( hasPermission( [], null ), true );
  assert.equal( hasPermission( [], [] ), true );
  assert.equal( hasPermission( [], "" ), true );
  assert.equal( hasPermission( [], [ "" ] ), true );
  assert.equal( hasPermission( [ WILDCARD ], [] ), true );
} );

test( "hasPermission：命中所需权限即通过", () =>
{
  assert.equal(
    hasPermission( [ PERM.GOODS_SKU_WRITE ], PERM.GOODS_SKU_WRITE ),
    true,
  );
} );

test( "hasPermission：多条件命中任一即通过", () =>
{
  assert.equal(
    hasPermission(
      [ PERM.GOODS_SKU_WRITE ],
      [ PERM.GOODS_SPU_WRITE, PERM.GOODS_SKU_WRITE ],
    ),
    true,
  );
  assert.equal(
    hasPermission(
      [ PERM.GOODS_REVIEW_AUDIT ],
      [ PERM.GOODS_BRAND_WRITE, PERM.GOODS_REVIEW_AUDIT ],
    ),
    true,
  );
} );

test( "hasPermission：权限不足返回 false", () =>
{
  assert.equal(
    hasPermission( [ PERM.GOODS_SKU_WRITE ], PERM.GOODS_REVIEW_AUDIT ),
    false,
  );
  assert.equal( hasPermission( [], PERM.GOODS_SKU_WRITE ), false );
  // 产品的权限集合是空的，任何写权限都应被拒
  assert.equal(
    hasPermission( resolvePermissions( "产品" ), PERM.GOODS_SPU_WRITE ),
    false,
  );
} );

test( "hasPermission：与原矩阵联动，运营可审核商品、产品不可", () =>
{
  assert.equal(
    hasPermission( resolvePermissions( "运营" ), PERM.GOODS_REVIEW_AUDIT ),
    true,
  );
  assert.equal(
    hasPermission( resolvePermissions( "产品" ), PERM.GOODS_REVIEW_AUDIT ),
    false,
  );
} );
