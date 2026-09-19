import type { App, DirectiveBinding } from "vue";
import useUser from "@/store/modules/user";
import { hasPermission } from "@/utils/permission";
// 权限按钮：v-hasBtn="'goods:brand:add'" 或 v-hasBtn="['a', 'b']"（命中任一即可）
// 不传值时不控制显隐；超管的 permissions 是通配的 ["*"]，一律放行
export const isHasBtn = (app: App) => {
  app.directive("hasBtn", {
    mounted(el: HTMLElement, binding: DirectiveBinding) {
      // 组件挂载一定发生在路由守卫 await userInfo() 之后，所以这里权限已就位
      const { permissions } = useUser();
      const allowed = hasPermission(
        permissions,
        binding.value as string | string[],
      );
      // 用 display 隐藏，不用 removeChild：Vue 的 vnode 仍持有 el 引用，
      // 父组件重新渲染时会把节点插回来（按钮"复活"），而且 removeChild 依赖 parentNode
      el.style.display = allowed ? "" : "none";
    },
  });
};
