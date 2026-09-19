import request from "@/utils/request";
import type {
  LoginBody,
  RoleUpdateBody,
  UserItemInterface,
  DeleteUserBody,
} from "./type";
const API = {
  LOGIN_URL: "/login",
  USER_URL: "/user/info",
  USER_INFO_URL: "/user/list",
  ADD_UPDATE_USER_URL: "/user/saveOrUpdate",
  GET_USER_LIST_URL: "/role/list",
  UPDATE_USER_ROLE_URL: "/user/role/update",
  DELETE_USER_ROLE_URL: "/user/role/delete",
  SEARCH_USER_URL: "/user/search",
};

// 1. 请求登录接口
export const reLogin = (data: LoginBody) => request.post(API.LOGIN_URL, data);
// 2.获取用户信息
export const reUser = () => request.get(API.USER_URL);
// 3.获取用户列表
export const reUserInfo = (current: number, size: number) =>
  request.get(API.USER_INFO_URL, {
    params: {
      current: current,
      size: size,
    },
  });
// 4.添加修改用户
export const reAddOrUpdateUser = (data: UserItemInterface) =>
  request.put(API.ADD_UPDATE_USER_URL, data);
// 5.获取用户全部职位列表
export const reUserList = () => request.get(API.GET_USER_LIST_URL);
// 6.分配用户角色
export const reUpdateUserRole = (data: RoleUpdateBody) =>
  request.put(API.UPDATE_USER_ROLE_URL, data);
// 7.删除用户角色,支持批量删除
export const reDeleteUserRole = (data: DeleteUserBody) =>
  request.delete(API.DELETE_USER_ROLE_URL, { data });
// 8.搜索用户
export const reSearchUser = (data: { keyword: string }) =>
  request.post(API.SEARCH_USER_URL, data);
