export interface UserItemInterface {
  createTime: string;
  id: number;
  name: string;
  nickname?: string;
  password: string;
  phone: null;
  roleName: string;
  updateTime: string;
  username: string;
  // 新增/编辑账号时提交的角色名数组；列表接口返回的是 roleName（逗号串），
  // 提交走 roleNames 数组。后端 saveOrUpdate 会把它过滤成已知角色再落库
  roleNames?: string[];
}

export interface UserDataReqInterface {
  countId: null;
  current: number;
  hitCoun: boolean;
  maxLimit: null;
  optimizeCountSql: boolean;
  orders: [];
  pages: number;
  records: UserItemInterface[];
  searchCount: boolean;
  size: number;
  total: number;
}

export interface UserAllResInterface {
  code?: number;
  data: UserDataReqInterface;
  message?: string;
  ok?: boolean;
}

export interface RoleAssignBody {
  id: number;
  roleNames: string[];
}
