import type { MockItem } from "../../adapter.js";
import { PERM } from "../../permission/codes.js";
import { issueToken } from "../../permission/session.js";
import {
  allRoles,
  allUserList,
  findUserByCredentials,
  findUserIndexById,
} from "./data.js";
import type { User } from "./data.js";

interface LoginBody
{
  username: string;
  password: string;
}

interface UserItemInterface
{
  id?: number | null;
  username: string;
  nickname: string;
  password: string;
  /** 账号所属角色。创建账号时必填，见下方 saveOrUpdate 的校验 */
  roleNames?: string[];
}

interface RoleUpdateBody
{
  id: number;
  roleNames: string[];
}

interface DeleteUserBody
{
  ids: number[];
}

/**
 * 只接受系统里真实存在的角色名。
 * 不做这层过滤的话，前端传个拼错的名字会被原样存进 roleName，
 * 该账号此后既拿不到任何权限、又看不出是哪里配错了。
 */
const keepKnownRoles = ( roleNames: unknown ): string[] =>
{
  if ( !Array.isArray( roleNames ) ) return [];
  const known = new Set( allRoles.map( ( role ) => role.roleName ) );
  return roleNames
    .map( ( name ) => String( name ).trim() )
    .filter( ( name ) => known.has( name ) );
};

/**
 * 用户与角色相关的 mock 接口。
 *
 * ⚠️ 这里不再逐个写 token 校验：鉴权已上提到 src/adapter.ts，
 * 由 permission/guard.ts 统一处理「有没有登录、有没有权限」。
 * 改造前本模块与 role 模块共 18 处硬编码的同一段 token 比对，
 * 那段逻辑既认不出用户是谁，也只能证明「拿到了常量字符串」。
 */
export default [
  // 登录接口。标记 public：此时还没有 token 可校验
  {
    url: "/api/login",
    method: "post",
    public: true,
    response: ( { body } ) =>
    {
      const { username = "", password = "" } = body as LoginBody;
      const user = findUserByCredentials( username, password );

      if ( !user )
      {
        return {
          data: { code: 401, message: "用户名或密码错误" },
          code: 401,
          message: "用户名或密码错误",
        };
      }

      // token 携带 userId，服务端据此认人；refreshToken 目前只下发不校验
      return {
        data: {
          token: issueToken( user.id ),
          refreshToken: "admin-refresh-token-xxx",
          code: 200,
          message: "登录成功",
        },
        code: 200,
        message: "登录成功",
      };
    },
  },
  // 获取用户信息接口。
  // 当前用户由 guard 从 token 解析后挂在 ctx.user 上，这里直接取，
  // 不再依赖改造前那个模块级 currentUser 单例（它让「谁在请求」变成「最后登录的是谁」）
  {
    url: "/api/user/info",
    method: "get",
    response: ( { user } ) =>
    {
      if ( !user )
      {
        return { code: 401, message: "用户未登录" };
      }
      return {
        code: 200,
        data: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatar: "../../src/assets/images/avatar.jpg",
          role: user.roleName || "user",
          // 已由 guard 按角色矩阵解析好，前端 v-hasBtn 直接消费
          permissions: user.permissions,
        },
        message: "获取用户信息成功",
      };
    },
  },
  {
    url: "/api/user/list",
    method: "get",
    permission: PERM.PERMISSION_USER_WRITE,
    response: ( { query } ) =>
    {
      const current: number = Number( query?.current ) || 1;
      const size: number = Number( query?.size ) || 5;

      const total: number = allUserList.length;
      const startIndex: number = ( current - 1 ) * size;
      const endIndex: number = startIndex + size;
      const records: User[] = allUserList.slice( startIndex, endIndex );
      const pages: number = Math.ceil( total / size );

      return {
        code: 200,
        message: "成功",
        data: {
          records,
          total,
          size,
          current,
          pages,
          orders: [],
          optimizeCountSql: true,
          hitCount: false,
          countId: null,
          maxLimit: null,
          searchCount: true,
        },
        ok: true,
      };
    },
  },
  {
    url: "/api/user/saveOrUpdate",
    method: "put",
    permission: PERM.PERMISSION_USER_WRITE,
    response: ( { body } ) =>
    {
      const formData: UserItemInterface = body as UserItemInterface;
      const { id, username, nickname, password } = formData;

      if ( !username )
      {
        return { code: 201, message: "用户名不能为空" };
      }
      if ( !nickname )
      {
        return { code: 201, message: "用户昵称不能为空" };
      }

      const roleNames = keepKnownRoles( formData.roleNames );

      if ( id )
      {
        const index: number = findUserIndexById( id );
        if ( index !== -1 )
        {
          allUserList[ index ] = {
            ...allUserList[ index ],
            username,
            name: nickname,
            // 编辑时未传密码表示「不改密码」，传了才覆盖。
            // 之前这里根本没写 password，等于编辑抽屉里的密码框是摆设：
            // 填了新密码保存后依然只能用旧密码登录
            password: password ? password : allUserList[ index ].password,
            // 编辑时未传角色表示「不改角色」，传了就整体覆盖
            roleName: formData.roleNames
              ? roleNames.join( "," )
              : allUserList[ index ].roleName,
            updateTime: new Date().toLocaleString(),
          };
        }
        return {
          code: 200,
          message: "用户修改成功",
          data: { ...allUserList.find( ( u ) => u.id === id ) },
          ok: true,
        };
      }

      // 创建账号必须分配角色：没有角色的账号登进来什么都不能做，
      // 与其让它变成一个查不出原因的「空权限账号」，不如在这里直接拦下
      if ( roleNames.length === 0 )
      {
        return { code: 201, message: "创建账号时必须为其分配角色" };
      }

      // 新建账号必须带密码，否则这个账号登录不进去（老代码写死 "1234567"，
      // 前端填的密码被整段丢弃，用户以为设了密码其实没设上，排查起来毫无线索）
      if ( !password )
      {
        return { code: 201, message: "用户密码不能为空" };
      }

      const newId: number = Math.floor( Math.random() * 1000 ) + 100;
      const nowTime: string = new Date().toLocaleString();
      const newUser: User = {
        id: newId,
        username,
        password,
        name: nickname,
        phone: null,
        roleName: roleNames.join( "," ),
        createTime: nowTime,
        updateTime: nowTime,
      };
      allUserList.unshift( newUser );
      return {
        code: 200,
        message: "用户新增成功",
        data: newUser,
        ok: true,
      };
    },
  },
  // 角色列表接口：给「分配角色」抽屉提供全部候选角色
  {
    url: "/api/role/list",
    method: "get",
    permission: PERM.PERMISSION_USER_WRITE,
    response: () => ( {
      code: 200,
      message: "成功",
      data: allRoles,
      ok: true,
    } ),
  },
  {
    url: "/api/user/role/update",
    method: "put",
    permission: PERM.PERMISSION_USER_WRITE,
    response: ( { body } ) =>
    {
      const { id, roleNames } = body as RoleUpdateBody;

      if ( !id )
      {
        return { code: 201, message: "用户ID不能为空" };
      }

      const index: number = findUserIndexById( id );
      if ( index === -1 )
      {
        return { code: 201, message: "用户不存在" };
      }

      allUserList[ index ] = {
        ...allUserList[ index ],
        roleName: Array.isArray( roleNames ) ? roleNames.join( "," ) : roleNames,
        updateTime: new Date().toLocaleString(),
      };

      return {
        code: 200,
        message: "角色分配成功",
        // 权限随角色实时推导，改完角色下次请求立刻生效，不需要额外的授权步骤
        data: { ...allUserList[ index ] },
        ok: true,
      };
    },
  },
  {
    url: "/api/user/role/delete",
    method: "delete",
    permission: PERM.PERMISSION_USER_WRITE,
    response: ( { body, user } ) =>
    {
      const { ids } = body as DeleteUserBody;

      if ( !ids || !Array.isArray( ids ) || ids.length === 0 )
      {
        return { code: 201, message: "用户ID不能为空" };
      }

      // 不允许删掉自己：删完当前 token 就指向一个不存在的用户，
      // 后续请求全部 401，用户只会看到莫名其妙的「登录已过期」
      if ( user && ids.includes( user.id ) )
      {
        return { code: 201, message: "不能删除当前登录的账号" };
      }

      const deletedCount: number = ids.filter( ( id: number ) =>
      {
        const index: number = findUserIndexById( id );
        if ( index !== -1 )
        {
          allUserList.splice( index, 1 );
          return true;
        }
        return false;
      } ).length;

      return {
        code: 200,
        message:
          deletedCount === 1 ? "用户删除成功" : `成功删除${ deletedCount }个用户`,
        data: { deletedCount },
        ok: true,
      };
    },
  },
  {
    url: "/api/user/login",
    method: "post",
    public: true,
    response: ( { body } ) =>
    {
      const { username, password } = body as LoginBody;

      if ( !username || !password )
      {
        return { code: 201, message: "用户名或密码不能为空" };
      }

      const user = findUserByCredentials( username, password );

      if ( !user )
      {
        return { code: 201, message: "用户名或密码错误" };
      }

      return {
        code: 200,
        message: "登录成功",
        data: {
          token: issueToken( user.id ),
          // 不回传 password：这个接口的响应体前端会整个存进 store
          user: { ...user, password: "" },
        },
        ok: true,
      };
    },
  },
  {
    url: "/api/user/search",
    method: "post",
    permission: PERM.PERMISSION_USER_WRITE,
    response: ( { body } ) =>
    {
      const { keyword = "" } = body as { keyword: string };

      const filteredList: User[] = allUserList.filter(
        ( user ) =>
          user.username.includes( keyword ) ||
          user.name.includes( keyword ) ||
          user.roleName.includes( keyword ) ||
          ( user.phone && user.phone.includes( keyword ) ),
      );

      return {
        code: 200,
        message: "成功",
        data: {
          records: filteredList,
          total: filteredList.length,
          size: filteredList.length,
          current: 1,
          pages: 1,
          orders: [],
          optimizeCountSql: true,
          hitCount: false,
          countId: null,
          maxLimit: null,
          searchCount: true,
        },
        ok: true,
      };
    },
  },
] as MockItem[];
