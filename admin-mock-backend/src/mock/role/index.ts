import type { MockItem } from "../../adapter";
import { PERM } from "../../permission/codes";

interface Role
{
  id: number;
  roleName: string;
  createTime: string;
  updateTime: string;
}

interface RoleSearchBody
{
  keyword: string;
}

interface RoleSaveOrUpdateBody
{
  id?: number;
  roleName: string;
}

interface RoleDeleteBody
{
  ids: number[];
}

interface UpdateRolePermissionBody
{
  roleId: number;
  permissionIds: number[];
}

interface AddPermissionBody
{
  name: string;
  pid: number;
  code: string;
  type: number;
}

interface UpdatePermissionBody
{
  id: number;
  name: string;
  code: string;
}

interface DeletePermissionBody
{
  id: number;
}

interface Permission
{
  id: number;
  name: string;
  pid: number;
  code: string;
  type: number;
  updateTime?: string;
  children?: Permission[];
  select?: boolean;
}

// 接口元数据统一用 adapter 的 MockItem：权限码与公开标记都声明在那里，
// 本模块不再自己定义一份重复的结构。
// 鉴权已上提到 adapter，各 route 只需声明 permission，
// 不再有逐个手写的 token 比对（改造前本模块 10 处、user 模块 8 处）。

let allRoles: Role[] = [
  {
    id: 1,
    roleName: "超级管理员",
    createTime: "2021-06-01 08:38:40",
    updateTime: "2023-04-28 11:03:39",
  },
  {
    id: 2,
    roleName: "前台",
    createTime: "2021-06-01 08:38:40",
    updateTime: "2023-04-28 11:03:39",
  },
  {
    id: 3,
    roleName: "运营",
    createTime: "2021-06-02 10:15:22",
    updateTime: "2023-04-28 10:15:22",
  },
  {
    id: 4,
    roleName: "产品",
    createTime: "2021-06-03 14:22:18",
    updateTime: "2023-04-28 10:15:22",
  },
  {
    id: 5,
    roleName: "前端",
    createTime: "2021-06-04 09:05:45",
    updateTime: "2023-04-27 09:20:10",
  },
  {
    id: 6,
    roleName: "后端",
    createTime: "2021-06-05 11:33:20",
    updateTime: "2023-04-27 09:20:10",
  },
  {
    id: 7,
    roleName: "测试",
    createTime: "2021-06-06 16:40:12",
    updateTime: "2023-04-26 15:30:22",
  },
  {
    id: 8,
    roleName: "财务",
    createTime: "2021-06-07 08:55:30",
    updateTime: "2023-04-25 10:11:44",
  },
  {
    id: 9,
    roleName: "运维",
    createTime: "2021-06-08 13:20:18",
    updateTime: "2023-04-24 08:50:31",
  },
  {
    id: 10,
    roleName: "销售",
    createTime: "2021-06-09 10:08:45",
    updateTime: "2023-04-23 12:15:00",
  },
  {
    id: 11,
    roleName: "程序架构师",
    createTime: "2021-06-10 15:12:33",
    updateTime: "2023-04-22 09:30:15",
  },
];

let rolePermissionMap: Record<number, number[]> = {
  1: [
    1, 101, 1011, 1012, 1013, 1014, 102, 1021, 1022, 1023, 1024, 103, 1031,
    1032, 1033, 104, 1041, 10411, 105, 1051, 1052, 1053, 106, 107, 1071, 1072,
    108, 109, 1091, 1092, 1093, 110, 1101, 1102, 1103, 111, 1111,
  ],
  2: [ 101, 1011, 1013 ],
  3: [ 104, 1041, 10411, 105, 1051, 1052, 1053 ],
  4: [ 104, 1041, 10411 ],
  5: [ 104, 1041 ],
  6: [ 104, 1041 ],
  7: [ 105, 1051, 1052 ],
  8: [ 106, 107, 1071 ],
  9: [ 108 ],
  10: [ 105, 1051, 107, 1071 ],
  11: [ 104, 1041, 10411 ],
};

const allPermissions: Permission[] = [
  {
    id: 1,
    name: "全部数据",
    pid: 0,
    code: "all",
    type: 1,
    select: false,
    children: [
      {
        id: 101,
        name: "用户管理",
        pid: 1,
        code: "user:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1011,
            name: "添加用户",
            pid: 101,
            code: "user:add",
            type: 2,
            select: false,
          },
          {
            id: 1012,
            name: "删除用户",
            pid: 101,
            code: "user:delete",
            type: 2,
            select: false,
          },
          {
            id: 1013,
            name: "修改用户",
            pid: 101,
            code: "user:update",
            type: 2,
            select: false,
          },
          {
            id: 1014,
            name: "分配角色",
            pid: 101,
            code: "user:role",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 102,
        name: "角色管理",
        pid: 1,
        code: "role:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1021,
            name: "分配权限",
            pid: 102,
            code: "role:permission",
            type: 2,
            select: false,
          },
          {
            id: 1022,
            name: "添加角色",
            pid: 102,
            code: "role:add",
            type: 2,
            select: false,
          },
          {
            id: 1023,
            name: "修改角色",
            pid: 102,
            code: "role:update",
            type: 2,
            select: false,
          },
          {
            id: 1024,
            name: "删除角色",
            pid: 102,
            code: "role:delete",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 103,
        name: "菜单管理",
        pid: 1,
        code: "menu:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1031,
            name: "添加",
            pid: 103,
            code: "menu:add",
            type: 2,
            select: false,
          },
          {
            id: 1032,
            name: "修改",
            pid: 103,
            code: "menu:update",
            type: 2,
            select: false,
          },
          {
            id: 1033,
            name: "删除",
            pid: 103,
            code: "menu:delete",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 104,
        name: "商品管理",
        pid: 1,
        code: "goods:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1041,
            name: "分类管理",
            pid: 104,
            code: "goods:category",
            type: 1,
            select: false,
            children: [
              {
                id: 10411,
                name: "添加子分类",
                pid: 1041,
                code: "goods:category:add",
                type: 2,
                select: false,
              },
            ],
          },
        ],
      },
      {
        id: 105,
        name: "订单管理",
        pid: 1,
        code: "order:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1051,
            name: "订单列表",
            pid: 105,
            code: "order:list",
            type: 2,
            select: false,
          },
          {
            id: 1052,
            name: "查看订单详情",
            pid: 105,
            code: "order:detail",
            type: 2,
            select: false,
          },
          {
            id: 1053,
            name: "退款",
            pid: 105,
            code: "order:refund",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 106,
        name: "退款管理",
        pid: 1,
        code: "refund:manage",
        type: 1,
        select: false,
        children: [],
      },
      {
        id: 107,
        name: "客户管理",
        pid: 1,
        code: "customer:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1071,
            name: "客户列表",
            pid: 107,
            code: "customer:list",
            type: 2,
            select: false,
          },
          {
            id: 1072,
            name: "锁定客户",
            pid: 107,
            code: "customer:lock",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 108,
        name: "权限管理",
        pid: 1,
        code: "permission:manage",
        type: 1,
        select: false,
        children: [],
      },
      {
        id: 109,
        name: "优惠券管理",
        pid: 1,
        code: "coupon:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1091,
            name: "添加活动",
            pid: 109,
            code: "coupon:activity:add",
            type: 2,
            select: false,
          },
          {
            id: 1092,
            name: "修改活动",
            pid: 109,
            code: "coupon:activity:update",
            type: 2,
            select: false,
          },
          {
            id: 1093,
            name: "活动规则",
            pid: 109,
            code: "coupon:activity:rule",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 110,
        name: "优惠券管理",
        pid: 1,
        code: "coupon:manage",
        type: 1,
        select: false,
        children: [
          {
            id: 1101,
            name: "添加优惠券",
            pid: 110,
            code: "coupon:add",
            type: 2,
            select: false,
          },
          {
            id: 1102,
            name: "修改优惠券",
            pid: 110,
            code: "coupon:update",
            type: 2,
            select: false,
          },
          {
            id: 1103,
            name: "活动规则",
            pid: 110,
            code: "coupon:rule",
            type: 2,
            select: false,
          },
        ],
      },
      {
        id: 111,
        name: "Skus详情",
        pid: 1,
        code: "skus:detail",
        type: 1,
        select: false,
        children: [
          {
            id: 1111,
            name: "删除Sku",
            pid: 111,
            code: "skus:delete",
            type: 2,
            select: false,
          },
        ],
      },
    ],
  },
];

const addUpdateTime = (
  permissions: Permission[],
  time: string,
): Permission[] =>
{
  return permissions.map( ( p ) => ( {
    ...p,
    updateTime: time,
    children:
      p.children && p.children.length > 0
        ? addUpdateTime( p.children, time )
        : p.children,
  } ) );
};

const updateTimes: Record<number, string> = {
  1: "2020-09-25 13:47:54",
  101: "2021-12-04 19:39:41",
  1011: "2021-12-04 19:40:01",
  1012: "2021-12-04 19:40:01",
  1013: "2021-12-04 19:42:37",
  1014: "2021-12-04 19:42:43",
  102: "2021-12-04 19:40:02",
  1021: "2021-12-04 19:42:41",
  1022: "2021-12-04 19:42:41",
  1023: "2021-12-04 19:42:41",
  1024: "2021-12-04 19:42:41",
  103: "2021-12-04 19:40:02",
  1031: "2021-12-04 19:40:02",
  1032: "2021-12-04 19:40:02",
  1033: "2021-12-04 19:40:02",
  104: "2021-12-04 19:40:03",
  1041: "2021-12-04 19:40:03",
  10411: "2021-12-04 19:40:03",
  105: "2021-12-04 19:43:28",
  1051: "2021-12-04 19:43:28",
  1052: "2021-12-04 19:43:28",
  1053: "2021-12-04 19:43:28",
  106: "2021-12-04 19:40:06",
  107: "2021-12-04 19:40:06",
  1071: "2021-12-04 19:40:06",
  1072: "2021-12-04 19:40:06",
  108: "2021-12-04 19:40:06",
  109: "2021-12-04 19:40:06",
  1091: "2021-12-04 19:40:06",
  1092: "2021-12-04 19:40:06",
  1093: "2021-12-04 19:40:06",
  110: "2021-12-04 19:40:06",
  1101: "2021-12-04 19:40:06",
  1102: "2021-12-04 19:40:06",
  1103: "2021-12-04 19:40:06",
  111: "2021-12-04 19:40:06",
  1111: "2021-12-04 19:40:06",
};

const addUpdateTimeById = ( permissions: Permission[] ): Permission[] =>
{
  return permissions.map( ( p ) => ( {
    ...p,
    updateTime: updateTimes[ p.id ] || "2021-12-04 19:40:00",
    children:
      p.children && p.children.length > 0
        ? addUpdateTimeById( p.children )
        : p.children,
  } ) );
};

const allPermissionsWithTime = addUpdateTimeById( allPermissions );

const mockResponseList: MockItem[] = [
  // 分页查询角色列表
  {
    url: "/api/role/all",
    method: "get",
    permission: PERM.PERMISSION_ROLE_WRITE,
    response: ( { query } ) =>
    {
const current: number = Number( query?.current ) || 1;
      const size: number = Number( query?.size ) || 5;

      const total: number = allRoles.length;
      const startIndex: number = ( current - 1 ) * size;
      const endIndex: number = startIndex + size;
      const records: Role[] = allRoles.slice( startIndex, endIndex );
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
  // 搜索角色列表
  {
    url: "/api/role/search",
    method: "post",
    permission: PERM.PERMISSION_ROLE_WRITE,
    response: ( { body } ) =>
    {
const { keyword = "" } = body as RoleSearchBody;

      const filteredList: Role[] = allRoles.filter( ( role ) =>
        role.roleName.includes( keyword ),
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
  // 新增或更新角色
  {
    url: "/api/role/saveOrUpdate",
    method: "put",
    permission: PERM.PERMISSION_ROLE_WRITE,
    response: ( { body } ) =>
    {
      // 校验 token
const formData: RoleSaveOrUpdateBody = body as RoleSaveOrUpdateBody;
      const { id, roleName } = formData;

      if ( !roleName )
      {
        return {
          code: 201,
          message: "职位名称不能为空",
        };
      }

      if ( id )
      {
        const index: number = allRoles.findIndex( ( r ) => r.id === id );
        if ( index !== -1 )
        {
          allRoles[ index ] = {
            ...allRoles[ index ],
            roleName,
            updateTime: new Date().toLocaleString(),
          };
        }
        return {
          code: 200,
          message: "职位修改成功",
          data: {
            ...allRoles.find( ( r ) => r.id === id ),
          },
          ok: true,
        };
      } else
      {
        const newId: number = Math.floor( Math.random() * 1000 ) + 100;
        const nowTime: string = new Date().toLocaleString();
        const newRole: Role = {
          id: newId,
          roleName,
          createTime: nowTime,
          updateTime: nowTime,
        };
        allRoles.unshift( newRole );
        return {
          code: 200,
          message: "职位新增成功",
          data: newRole,
          ok: true,
        };
      }
    },
  },
  // 删除角色
  {
    url: "/api/role/delete",
    method: "delete",
    permission: PERM.PERMISSION_ROLE_WRITE,
    response: ( { body } ) =>
    {
const { ids: id } = body as RoleDeleteBody | number;

      if ( !id || !Array.isArray( id ) || id.length === 0 )
      {
        return {
          code: 201,
          message: "职位ID不能为空",
        };
      }

      const deletedCount: number = id.filter( ( id: number ) =>
      {
        const index: number = allRoles.findIndex( ( r ) => r.id === id );
        if ( index !== -1 )
        {
          allRoles.splice( index, 1 );
          return true;
        }
        return false;
      } ).length;

      return {
        code: 200,
        message:
          deletedCount === 1 ? "职位删除成功" : `成功删除${ deletedCount }个职位`,
        data: { deletedCount },
        ok: true,
      };
    },
  },
  // 获取所有权限数据
  {
    url: "/api/role/permission",
    method: "get",
    permission: PERM.PERMISSION_MENU_WRITE,
    response: () =>
    {
return {
        code: 200,
        message: "成功",
        data: addUpdateTimeById( allPermissions ),
        ok: true,
      };
    },
  },
  // 根据角色ID获取权限数据
  {
    url: "/api/role/permission/byRoleId",
    method: "get",
    permission: PERM.PERMISSION_ROLE_WRITE,
    response: ( { query } ) =>
    {
const roleId: number = Number( query?.roleId );
      if ( !roleId )
      {
        return { code: 201, message: "角色ID不能为空" };
      }
      const role: Role | undefined = allRoles.find( ( r ) => r.id === roleId );
      if ( !role )
      {
        return { code: 201, message: "角色不存在" };
      }
      const permissionIds: number[] = rolePermissionMap[ roleId ] || [];
      const filterPermissions = (
        permissions: Permission[],
        selectedIds: number[],
      ): Permission[] =>
      {
        const result: Permission[] = [];
        for ( const p of permissions )
        {
          const isSelected = selectedIds.includes( p.id );
          const hasChildren = p.children && p.children.length > 0;
          const filteredChildren = hasChildren
            ? filterPermissions( p.children, selectedIds )
            : undefined;
          const hasSelectedChildren =
            filteredChildren && filteredChildren.length > 0;
          if ( isSelected || hasSelectedChildren )
          {
            result.push( {
              ...p,
              select: isSelected,
              children: hasSelectedChildren ? filteredChildren : undefined,
            } );
          }
        }
        return result;
      };
      const permissionsWithTime = addUpdateTimeById( allPermissions );
      const result = filterPermissions( permissionsWithTime, permissionIds );
      return {
        code: 200,
        message: "成功",
        data: result,
        ok: true,
      };
    },
  },
  // 更新角色权限
  {
    url: "/api/role/permission/update",
    method: "put",
    permission: PERM.PERMISSION_ROLE_WRITE,
    response: ( { body } ) =>
    {
const formData: UpdateRolePermissionBody =
        body as UpdateRolePermissionBody;
      const { roleId, permissionIds } = formData;
      if ( !roleId )
      {
        return { code: 201, message: "角色ID不能为空" };
      }
      if ( !permissionIds || !Array.isArray( permissionIds ) )
      {
        return { code: 201, message: "权限ID不能为空" };
      }
      const role: Role | undefined = allRoles.find( ( r ) => r.id === roleId );
      if ( !role )
      {
        return { code: 201, message: "角色不存在" };
      }
      rolePermissionMap[ roleId ] = permissionIds;
      return {
        code: 200,
        message: "权限修改成功",
        data: { roleId, permissionCount: permissionIds.length },
        ok: true,
      };
    },
  },
  // 添加权限
  {
    url: "/api/permission/add",
    method: "post",
    permission: PERM.PERMISSION_MENU_WRITE,
    response: ( { body } ) =>
    {
const formData: AddPermissionBody = body as AddPermissionBody;
      const { name, pid, code, type } = formData;
      if ( !name || !code )
      {
        return { code: 201, message: "名称和权限值不能为空" };
      }
      const addPermissionToTree = (
        permissions: Permission[],
        pid: number,
      ): boolean =>
      {
        for ( let i = 0; i < permissions.length; i++ )
        {
          if ( permissions[ i ].id === pid )
          {
            if ( !permissions[ i ].children )
            {
              permissions[ i ].children = [];
            }
            const newId =
              Math.max( ...permissions[ i ].children.map( ( p ) => p.id ), 0 ) + 1;
            permissions[ i ].children.push( {
              id: newId,
              name,
              pid,
              code,
              type,
              updateTime: new Date().toLocaleString( "zh-CN" ),
            } );
            return true;
          }
          if ( permissions[ i ].children && permissions[ i ].children.length > 0 )
          {
            if ( addPermissionToTree( permissions[ i ].children, pid ) )
            {
              return true;
            }
          }
        }
        return false;
      };
      if ( !addPermissionToTree( allPermissions, pid ) )
      {
        return { code: 201, message: "父级权限不存在" };
      }
      return {
        code: 200,
        message: "添加成功",
        ok: true,
      };
    },
  },
  // 修改权限
  {
    url: "/api/permission/update",
    method: "put",
    permission: PERM.PERMISSION_MENU_WRITE,
    response: ( { body } ) =>
    {
const formData: UpdatePermissionBody = body as UpdatePermissionBody;
      const { id, name, code } = formData;
      if ( !id )
      {
        return { code: 201, message: "权限ID不能为空" };
      }
      const updatePermissionInTree = (
        permissions: Permission[],
        id: number,
      ): boolean =>
      {
        for ( let i = 0; i < permissions.length; i++ )
        {
          if ( permissions[ i ].id === id )
          {
            if ( name ) permissions[ i ].name = name;
            if ( code ) permissions[ i ].code = code;
            permissions[ i ].updateTime = new Date().toLocaleString( "zh-CN" );
            return true;
          }
          if ( permissions[ i ].children && permissions[ i ].children.length > 0 )
          {
            if ( updatePermissionInTree( permissions[ i ].children, id ) )
            {
              return true;
            }
          }
        }
        return false;
      };
      if ( !updatePermissionInTree( allPermissions, id ) )
      {
        return { code: 201, message: "权限不存在" };
      }
      return {
        code: 200,
        message: "修改成功",
        ok: true,
      };
    },
  },
  // 删除权限
  {
    url: "/api/permission/delete",
    method: "delete",
    permission: PERM.PERMISSION_MENU_WRITE,
    response: ( { body } ) =>
    {
const formData: DeletePermissionBody = body as DeletePermissionBody;
      const { id } = formData;
      if ( !id )
      {
        return { code: 201, message: "权限ID不能为空" };
      }
      const deletePermissionFromTree = (
        permissions: Permission[],
        id: number,
      ): boolean =>
      {
        for ( let i = 0; i < permissions.length; i++ )
        {
          if ( permissions[ i ].children && permissions[ i ].children.length > 0 )
          {
            const childIndex = permissions[ i ].children.findIndex(
              ( p ) => p.id === id,
            );
            if ( childIndex !== -1 )
            {
              permissions[ i ].children.splice( childIndex, 1 );
              return true;
            }
            if ( deletePermissionFromTree( permissions[ i ].children, id ) )
            {
              return true;
            }
          }
        }
        return false;
      };
      if ( !deletePermissionFromTree( allPermissions, id ) )
      {
        return { code: 201, message: "权限不存在" };
      }
      return {
        code: 200,
        message: "删除成功",
        ok: true,
      };
    },
  },
];

export default mockResponseList;
