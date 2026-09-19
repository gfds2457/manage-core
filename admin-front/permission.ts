import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { ElMessage } from "element-plus";
import useUser from "./src/store/modules/user";
import { logo } from "@/setting/logo";
import { asyncRoutes, constantRoutes } from "./src/router/routes";
import menuList from "./src/store/modules/route";
import { canAccessRoute, filterRoutesByRole } from "@/utils/permission";
// 配置进度条
NProgress.configure({
  showSpinner: false,
  speed: 200,
});
//全局前置守卫
// 1.引入createRouter()返回的函数，调用全局前置守卫方法
// 2.全局使用守卫
import router from "./src/router/index";
router.beforeEach(async (to) => {
  NProgress.start();
  const userInfo = useUser();
  const menuStore = menuList();
  const token = userInfo.token;
  document.title = `${logo.title}-${to.meta.title}`;
  // 没登录：放行登录页，其余一律带去登录页
  if (!token) {
    if (to.path == "/login") return;
    return { path: "/login", query: { redirect: to.path } };
  }
  // 已登录还想去登录页，直接回首页
  if (to.path == "/login") return "/";
  // 没有用户信息（首次登录 / 刷新 / 切换账号）时拉一次，
  // 必须等在它之后才能拿到 roles，否则下面的角色判断会拿到空数组
  if (!userInfo.userName) {
    try {
      await userInfo.userInfo();
    } catch (err) {
      console.error("获取用户信息失败:", err);
      userInfo.userLogout();
      return { path: "/login", query: { redirect: to.path } };
    }
  }
  // 按身份重建动态路由与菜单。
  // 幂等键是 "用户id|角色列表"：不能用 token，mock 对所有账号返回同一个 token，
  // 切账号时 token 不变，第二个账号会看到第一个账号的菜单
  const loadedKey = `${userInfo.id ?? ""}|${userInfo.roles.join(",")}`;
  if (menuStore.loadedKey !== loadedKey) {
    // 路由表全量注册，不做角色裁剪：未注册的地址拿不到 meta，
    // 守卫就没法拦住「直接输 URL 访问无权限页面」
    asyncRoutes.forEach((route) => {
      router.addRoute(route);
    });
    // 只裁剪菜单，让没权限的人看不到入口
    menuStore.routes = [
      ...constantRoutes,
      ...filterRoutesByRole(asyncRoutes, userInfo.roles),
    ];
    menuStore.loadedKey = loadedKey;
    // 首次进入时目标路由可能还没匹配到记录，重进一次让本次导航的 meta / matched 完整
    if (to.matched.length === 0) return { ...to, replace: true };
  }
  // 角色拦截必须放在最后：此时路由一定已注册、to.meta 一定可读。
  // 放到前面会因为 to.meta 为空而被当成「未配置角色」，静默漏放行
  if (!canAccessRoute(to, userInfo.roles)) {
    ElMessage.warning("无权访问该页面");
    return { path: "/", replace: true };
  }
  return true;
});
//全局后置守卫
router.afterEach(() => {
  NProgress.done();
});
