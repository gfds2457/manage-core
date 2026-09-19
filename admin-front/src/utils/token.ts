// 封装存储token值函数
export const setToken = (token: string) => {
  localStorage.setItem("token", token);
};
// 封装获取token值函数
// 可以直接调用函数获取token，不用每次都localStorage.getItem
export const getToken = () => {
  return localStorage.getItem("token");
};
// 封装清除token值函数
export const removeToken = () => {
  return localStorage.removeItem("token");
};
