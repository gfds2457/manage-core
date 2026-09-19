import request from "@/utils/request";
import type { PermissionSaveOrUpdateBody } from "./type";
const Api = {
  AddPermission_URL: "/permission/add",
  UpdatePermission_URL: "/permission/update",
  DeletePermission_URL: "/permission/delete",
};
// 新增权限
export const AddPermission = (data: PermissionSaveOrUpdateBody) => {
  return request.post(Api.AddPermission_URL, data);
};
// 更新权限
export const UpdatePermission = (data: PermissionSaveOrUpdateBody) => {
  return request.put(Api.UpdatePermission_URL, data);
};
// 删除权限
export const DeletePermission = (data: number) => {
  return request.delete(Api.DeletePermission_URL, { data: { id: data } });
};
