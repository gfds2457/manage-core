export interface PermissionSaveOrUpdateBody {
  // 编辑时提交自身 id（走 /permission/update），新增时不传
  id?: number;
  name?: string;
  pid?: number;
  code?: string;
  type?: number;
}
