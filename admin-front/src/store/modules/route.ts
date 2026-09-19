import { constantRoutes } from "@/router/routes";
import { defineStore } from "pinia";
// 将常量路由存储到pinia中
const menuList = defineStore("menuList", {
  state: (): { routes: any[]; loadedKey: string } => {
    return {
      routes: constantRoutes,
      // 菜单已按哪个身份加载过，格式 "用户id|角色列表"。
      // 用它判断是否需要重建菜单，不能用 token：mock 对所有账号返回同一个 token，
      // 切换账号时 token 不变，会导致第二个账号看到第一个账号的菜单
      loadedKey: "",
    };
  },
  actions: {
    // 退出登录时重置，避免下一个账号复用上一个账号的菜单
    reset() {
      this.routes = constantRoutes;
      this.loadedKey = "";
    },
  },
});
export default menuList;
