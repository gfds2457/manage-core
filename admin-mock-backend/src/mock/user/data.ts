/**
 * 用户与角色的内存数据表。
 *
 * 单独拆成 data 模块（而不是留在 user/index.ts 里）是为了打断循环依赖：
 * adapter 要做接口鉴权就得查「请求者是谁、什么角色」，若直接 import user/index.ts，
 * 而 user/index.ts 又 `import type { MockItem } from "../../adapter.js"`，两边就绕成了环。
 * 拆出纯数据后依赖方向变成单向：user/index.ts → data.ts ← permission/guard.ts。
 *
 * 表本身仍是模块级可变对象（增删改直接原地修改），与改造前行为一致。
 */

export interface Role
{
  id: number;
  roleName: string;
}

export interface User
{
  id: number;
  createTime: string;
  updateTime: string;
  username: string;
  password: string;
  name: string;
  phone: string | null;
  roleName: string;
}

export const allRoles: Role[] = [
  { id: 1, roleName: "超级管理员" },
  { id: 2, roleName: "前台" },
  { id: 3, roleName: "运营" },
  { id: 4, roleName: "产品" },
  { id: 5, roleName: "前端" },
  { id: 6, roleName: "后端" },
  { id: 7, roleName: "测试" },
  { id: 8, roleName: "财务" },
  { id: 9, roleName: "运维" },
  { id: 10, roleName: "销售" },
  { id: 11, roleName: "程序架构师" },
];

export const allUserList: User[] = [
  {
    id: 1,
    createTime: "2023-01-01 00:00:00",
    updateTime: "2023-01-01 00:00:00",
    username: "admin",
    password: "123456",
    // name 决定右上角显示的名字，不要改成"超级管理员"
    name: "管理员",
    phone: "13800138000",
    // 登录用 find 取第一条匹配记录，所以这个角色就是 admin/123456 实际拿到的角色
    roleName: "超级管理员",
  },
  {
    id: 95,
    createTime: "2023-04-28 13:15:02",
    updateTime: "2023-04-28 13:15:02",
    username: "李四666",
    password: "123456lisi",
    name: "李四666",
    phone: null,
    // 演示「账号已创建但尚未分配角色」的边界：这类账号登录后无任何写权限
    roleName: "",
  },
  {
    id: 94,
    createTime: "2023-04-28 12:46:45",
    updateTime: "2023-04-28 12:46:45",
    username: "zhangsan",
    password: "1234567",
    name: "张三",
    phone: "13800138000",
    roleName: "运营,产品",
  },
  {
    id: 93,
    createTime: "2023-04-27 09:20:10",
    updateTime: "2023-04-27 09:20:10",
    username: "admin",
    password: "123456",
    name: "admin",
    phone: null,
    roleName: "超级管理员,前台,运营,产品,前端,后端,测试,财务,运维,销售",
  },
  {
    id: 92,
    createTime: "2023-04-26 15:30:22",
    updateTime: "2023-04-26 15:30:22",
    username: "test01",
    password: "123456",
    name: "测试一号",
    phone: "13900139000",
    roleName: "测试",
  },
  {
    id: 91,
    createTime: "2023-04-25 10:11:44",
    updateTime: "2023-04-25 10:11:44",
    username: "caiwu",
    password: "123456",
    name: "财务专员",
    phone: "13700137000",
    roleName: "财务",
  },
  {
    id: 90,
    createTime: "2023-04-24 08:50:31",
    updateTime: "2023-04-24 08:50:31",
    username: "yunwei",
    password: "123456",
    name: "运维小哥",
    phone: "13600136000",
    roleName: "运维",
  },
];

/** 按 id 查用户，查不到返回 null。鉴权链路的主要入口 */
export const findUserById = (id: number | null | undefined): User | null =>
{
  if ( typeof id !== "number" ) return null;
  return allUserList.find( ( user ) => user.id === id ) ?? null;
};

/**
 * 按账号密码查用户。
 * 注意 allUserList 里 id=1 与 id=93 的 username/password 完全相同，
 * find 只取第一条，所以 admin/123456 实际登录到的是 id=1（超级管理员）。
 */
export const findUserByCredentials = (
  username: string,
  password: string,
): User | null =>
  allUserList.find(
    ( user ) => user.username === username && user.password === password,
  ) ?? null;

/** 按 id 取下标，供各写接口原地更新 */
export const findUserIndexById = (id: number): number =>
  allUserList.findIndex( ( user ) => user.id === id );
