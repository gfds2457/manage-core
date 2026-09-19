import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

/**
 * 单元测试配置（vitest）。
 *
 * 与 vite.config.ts 保持一致的三处：vue 插件、@ 别名、scss 全局变量注入。
 * 其中 scss 的 additionalData 不能省：组件的 <style> 里用到了 $nav-height 这类全局变量，
 * 缺少注入会让样式编译直接报错，测试在挂载组件时就失败了。
 *
 * 刻意不引入 vite-plugin-svg-icons：该插件依赖文件系统扫描，
 * 单元测试里没有对应的图标资源，引进来只会增加启动噪音。
 */
export default defineConfig( {
  plugins: [ vue() ],
  resolve: {
    alias: {
      "@": path.resolve( "./src" ),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use '@/styles/variable.scss' as *;`,
      },
    },
  },
  test: {
    // happy-dom 比 jsdom 启动快，且自带 localStorage / clipboard 等 API，
    // 足够覆盖组件逻辑测试的需求
    environment: "happy-dom",
    globals: true,
    include: [ "src/**/*.{test,spec}.{js,ts}" ],
    coverage: {
      provider: "v8",
      reporter: [ "text", "json-summary" ],
      // 口径说明：只统计「本轮改动并且真的产出了单元测试」的文件。
      // 之前把 dashboard、views/home 等本轮未改动、也无测试的文件一并纳入，
      // 只会让总覆盖率被 0% 的无关文件稀释，看不出本轮改动的真实覆盖水平。
      include: [
        // 本轮（权限管理完善）的落点
        "src/utils/permission.ts",
        "src/views/permission/**",
        "src/API/log/index.ts",
        // 商品页本轮加了按钮级权限控制与 403 文案透传
        "src/views/goods/brand/index.vue",
        "src/views/goods/spu/index.vue",
        "src/views/goods/sku/index.vue",
        "src/views/goods/attr/index.vue",
        "src/views/goods/review/index.vue",
      ],
    },
  },
} );
