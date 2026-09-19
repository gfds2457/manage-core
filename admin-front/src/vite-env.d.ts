declare module "virtual:svg-icons-register";
//识别css模块
declare module "*.css";
// 自定义环境变量声明（取值见 .env.development）
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AI_API_BASE_URL: string;
  /** 知识库同步令牌，属凭据，配置在 .env.development.local（不入库） */
  readonly VITE_KB_SYNC_TOKEN?: string;
}
// 识别vue模块
declare module "*.vue" {
  import type { Component } from "vue";
  const component: Component;
  export default component;
}
