import { createApp } from "vue";
import App from "@/App.vue";
// 引入Element Plus图标组件
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
// 配置Element Plus国际化
import { zhCn } from "element-plus/es/locales.mjs";
// 引入全局组件
import allGlobleComponent from "@/components";
import "@/styles/index.scss";
// 引入Element Plus组件库
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
//引入ElementPlus暗黑变量样式
import "element-plus/theme-chalk/dark/css-vars.css";
// 引入高亮css样式
import 'highlight.js/styles/github.css'
import './styles/md.scss'
// 引入全局状态管理
import pinia from "@/store/index";
// 引入路由
import router from "./router/index";
import "virtual:svg-icons-register";
// 引入全局指令
import { isHasBtn } from "@/directive/btn";
// 环境变量校验：启动时先确认 AI 后端地址等配置合法（需求 3）
import { runEnvValidation } from "@/utils/aiEnv";
// 只在开发环境输出校验详情：这些信息是给开发者排障用的（含后端地址与原始配置），
// 生产环境打进用户控制台既无意义也不合适
if ( import.meta.env.DEV )
{
  runEnvValidation();
}
const app = createApp( App );
// 注册全局指令
isHasBtn( app );
if ( import.meta.env.DEV )
{
  import( "vue-devtools" ).then( ( mod ) => mod.install() );
}
//循环注册Element Plus图标组件
for ( const [ key, component ] of Object.entries( ElementPlusIconsVue ) )
{
  app.component( key, component );
}
// 使用Element Plus组件库
app.use( allGlobleComponent );
app.use( ElementPlus, {
  locale: zhCn,
} );
app.use( pinia );
app.use( router );
import "../permission";
app.mount( "#app" );
