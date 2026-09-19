/**
 * 服务启动引导
 *
 * 存在的意义：必填配置项缺失时，src/env.js 会在「模块求值阶段」就抛出 ConfigError。
 * 那发生在 src/index.js 第一行代码执行之前，因此 index.js 里的 try/catch 根本来不及生效，
 * 用户看到的是一段裸堆栈而不是可操作的修复指引。
 *
 * 这里用动态 import 把应用加载延后到 try/catch 内，
 * 保证「配置缺失」和「配置组合非法」两类错误都能输出同一份友好提示。
 *
 * 注意：本文件不能静态 import "./env.js"。
 * 那样 env.js 的求值异常会发生在 bootstrap 自身求值阶段，
 * try/catch 同样来不及生效——判定只能靠 err.name。
 */

try {
  await import("./index.js");
} catch (err) {
  if (err?.name === "ConfigError") {
    console.error(`\n[启动失败] ${err.message}\n`);
    process.exit(1);
  }
  // 非配置类错误交由 Node 默认行为输出完整堆栈，便于定位真实缺陷
  throw err;
}
