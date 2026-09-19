import type { Directive } from "vue";

declare module "vue" {
  export interface ComponentCustomProperties {
    // 声明全局指令
    vHasBtn: Directive;
  }
}
export {};
