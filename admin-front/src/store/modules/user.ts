import { defineStore } from "pinia";
import { reLogin, reUser } from "@/API/user/index";
import { setToken, getToken } from "@/utils/token";
import { removeToken } from "@/utils/token";
import { parseRoles } from "@/utils/permission";
import menuList from "@/store/modules/route";
interface dataType {
  username: string;
  password: string;
}
interface UserRes {
  code?: number;
  data: {
    id: number;
    username: string;
    name: string;
    nickname?: string;
    avatar: string;
    role: string;
    permissions: Array<string>;
  };
  //data?会让ts认为data里面可能为undefined，那么data.id这种就会报错
  // ts会提前拦截这种错误，所以这种对象后面最好不要加？
  message?: string;
}
const useUser = defineStore("useUser", {
  // 存储token
  // 本地存储的数据非响应式，这里存储的数据为响应式
  state: () => {
    return {
      //在任意组件第一次调用这个仓库时，state()函数就会执行一次（getToken()就会执行一次）
      //之后多次调用该仓库，state()都不会再执行，后续都是复用同一个仓库数据
      token: getToken(),
      userName: "",
      avatar: "",
      id: null as number | null,
      // 当前登录用户的角色列表，"运营,产品" 这种字符串拆分而来。决定路由与菜单
      roles: [] as string[],
      // 按钮级权限标识，超管为通配的 ["*"]。只服务 v-hasBtn，不参与路由/菜单判断
      permissions: [] as string[],
    };
  },
  actions: {
    // 封装请求登录方法
    async userLogin(data: dataType) {
      const res = await reLogin(data);
      const success = res.code == 200 || res.data?.code == 200;
      const token = res.data?.token || res.token;
      if (success && token) {
        //重新登录时更新pinia仓库里的token
        this.token = token;
        setToken(token);
      } else {
        return Promise.reject(
          new Error(res.message || res.data?.message || "登录失败"),
        );
        // 响应码为401，登录失败
      }
      return res;
    },
    // 封装获取用户信息方法
    // 1.获取token
    // 2.设置请求拦截器，携带token发送请求
    // 3.如果获取用户信息成功，就将用户信息存储到用户仓库中
    // 动态路由的注册统一交给 permission.ts 里的守卫，这里只负责存数据
    async userInfo() {
      const res = (await reUser()) as UserRes;
      if (res.code == 200) {
        // 存储用户信息到状态中
        this.avatar = res.data.avatar;
        this.userName = res.data.name;
        this.id = res.data.id;
        this.roles = parseRoles(res.data.role);
        this.permissions = res.data.permissions ?? [];
      } else {
        return Promise.reject(res.message);
      }
    },
    // 封装退出登录，清除当前用户信息方法
    // 清除当前用户信息
    userLogout() {
      this.token = "";
      this.userName = "";
      this.avatar = "";
      this.id = null;
      this.roles = [];
      this.permissions = [];
      removeToken();
      // 菜单同步重置，避免下一个账号看到上一个账号的菜单
      menuList().reset();
    },
  },
});
export default useUser;
