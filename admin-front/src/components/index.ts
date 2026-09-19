import SvgIcon from "./svgIcons/Svg-icon.vue";
import Category from "./category/index.vue";
//导入App类型
import type { App } from "vue";
const allGlobleComponent = Object.entries({ SvgIcon, Category });
export default {
  // 将注册全局组件变成插件，插件能够把注册代码从main.ts剥离
  install(app: App) {
    allGlobleComponent.forEach(([key, component]) => {
      app.component(key, component);
    });
  },
};
