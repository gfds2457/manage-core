import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 测试用例覆盖 RAG 入库 / 检索 / 增量更新三条核心链路，
    // 向量库与 Embedding 均为重 IO，放宽默认超时
    testTimeout: 60000,
    hookTimeout: 60000,
    // 每个测试文件独立进程，避免 LanceDB 句柄与模块级缓存相互污染
    pool: "forks",
    isolate: true,
    // 每个测试文件运行前把向量库指向独立临时目录
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/rag/**/*.js", "src/env.js"],
      exclude: ["src/rag/index.js"],
    },
  },
});
