export interface LoginBody {
  username: string;
  password: string;
}

export interface UserItemInterface {
  id?: number | null;
  username: string;
  nickname: string;
  password: string;
  // 新增/编辑账号时提交的角色名数组。后端 saveOrUpdate 收到后会过滤成已知角色，
  // 且新建账号时为空一律拒绝（「创建账号时必须为其分配角色」）
  roleNames?: string[];
}

export interface RoleUpdateBody {
  id: number;
  roleNames: string[];
}

export interface DeleteUserBody {
  ids: number[];
}
