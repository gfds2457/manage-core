import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { createSvgIconsPlugin } from "vite-plugin-svg-icons";

export default defineConfig({
  plugins: [
    vue(),
    createSvgIconsPlugin({
      // 图标路径补全完整
      iconDirs: [path.resolve(process.cwd(), "src/assets/icons")],
      symbolId: "icon-[dir]-[name]",
    }),
    // mock 接口已迁移到独立后端项目 ../admin-mock-backend（Express + CORS），
    // 前端通过 VITE_API_BASE_URL 跨域直连，不再需要 vite-plugin-mock 与 proxy
  ],
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // scss全局变量注入，字符串引号规范
        additionalData: `@use '@/styles/variable.scss' as *;`,
      },
    },
  },
});
