export interface RoleSaveOrUpdateBody {
  id?: number;
  roleName: string;
}
export interface RoleDeleteBody {
  ids: number[] | number;
}
export interface RolePermissionUpdateBody {
  roleId: number;
  permissionIds: number[];
}
export interface RolePermissionUpdateResponse {
  roleId?: number;
  permissionCount?: number[];
}
