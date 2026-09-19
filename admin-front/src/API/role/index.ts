import request from "@/utils/request";
import type {
  RoleSaveOrUpdateBody,
  RoleDeleteBody,
  RolePermissionUpdateBody,
} from "./type";
const Api = {
  getList: "/role/all",
  search: "/role/search",
  saveOrUpdate: "/role/saveOrUpdate",
  delete: "/role/delete",
  getPermission: "/role/permission",
  getRolePermission: "/role/permission/byRoleId",
  updatePermission: "/role/permission/update",
};
// 分页查询角色列表
export const getList = ( params: { current?: number; size?: number } ) =>
{
  return request.get( Api.getList, { params } );
};
// 搜索角色
export const search = ( data: { keyword?: string } ) =>
{
  // data直接作为请求体body发送，不用加{}
  return request.post( Api.search, data );
};
// 新增或更新角色
export const saveOrUpdate = ( data: RoleSaveOrUpdateBody ) =>
{
  // data直接作为请求体body发送，不用加{}
  return request.put( Api.saveOrUpdate, data );
};
// 删除角色
export const deleteRole = ( data: RoleDeleteBody | number ) =>
{
  return request.delete( Api.delete, { data: { ids: [ data ] } } );
};
// 获取所有权限数据
export const getPermission = () =>
{
  return request.get( Api.getPermission );
};
// 根据角色ID获取权限数据
export const getRolePermission = ( params: { roleId: number } ) =>
{
  return request.get( Api.getRolePermission, { params } );
};
// 更新角色权限
export const updatePermission = ( data: RolePermissionUpdateBody ) =>
{
  return request.put( Api.updatePermission, data );
};
