import type { Express, Request, Response } from "express";
import { maybeSyncKnowledge } from "./kb/sync.js";
import { maybeRecordOperation } from "./operation/record.js";
import { checkAuth } from "./permission/guard.js";

// 与 vite-plugin-mock 的 mock 项结构保持一致：
// { url, method, response } 数组，原样复用 admin-front 迁移过来的 mock 模块
export interface MockItem {
  url: string;
  method?: string;
  /**
   * 访问该接口所需的权限码（见 permission/codes.ts）。
   * 不声明时表示「登录即可访问」，例如查询自身信息的 /api/user/info
   * 与商品域的只读接口——读权限对所有登录用户开放，单列一个码没有区分度。
   */
  permission?: string;
  /** true = 完全放行，连登录都不要求。仅登录接口需要 */
  public?: boolean;
  // ctx 类型保持 any：各 mock 模块对 response 入参有不同的自定义类型声明，
  // 适配层作为边界不做强约束，具体类型由各 mock 模块自己保证
  response: (ctx: any) => any;
}

/**
 * 把 mock 项数组注册成 Express 路由。
 *
 * 关键点：
 * 1. 必须按数组顺序 for 循环注册——Express 先注册先匹配，
 *    与 vite-plugin-mock 的匹配语义一致（例如 spu 的 /api/admin/product/:page
 *    是单段通配，依赖注册顺序保证 /recycle/... 等多段路径不被抢匹配）。
 * 2. Express 5 原生支持 /:param 路径段，mock 里的 url 无需转换。
 * 3. ctx 提供超集字段 { headers, query, body, params, url }：
 *    - sku 模块读 params（如 /list/:pageNo/:pageSize）
 *    - spu 模块读 query + url（用正则从 url 解析路径参数）
 *    - user/role 模块读 headers.authorization 与 body
 * 4. 响应统一 res.json()（HTTP 状态码恒为 200，业务码在返回体的 code 字段），
 *    与 vite-plugin-mock 行为一致。
 * 5. 写接口成功后触发知识库增量同步（异步、不阻塞响应）。
 *    真实项目接 MySQL 时，该调用点等价于「await connection.commit() 之后」。
 * 6. 接口鉴权在调用 mock.response 之前完成：没通过就直接返回 401/403，
 *    业务代码一行都不会执行。这是「拒绝未授权访问」的落点——
 *    鉴权必须前置，放在 response 之后就成了「先干了再说」。
 * 7. 高敏感操作在响应发出后留痕（见 operation/record.ts）。
 */
export function registerMocks(app: Express, mocks: MockItem[]): void {
  for (const mock of mocks) {
    const method = (mock.method || "get").toLowerCase();
    (app as any)[method](mock.url, async (req: Request, res: Response) => {
      try {
        const ctx: any = {
          headers: req.headers,
          query: req.query,
          params: req.params,
          // body 兜底空对象，避免 GET/无 body 请求在 mock 里解构时报错
          body: req.body ?? {},
          url: req.originalUrl,
        };

        // 鉴权前置。放行时 checkAuth 会把当前用户挂到 ctx.user 上，
        // 供下面的操作日志取「操作人」
        const authError = checkAuth(mock, ctx);
        if (authError) {
          return res.json({ ...authError, ok: false, data: null });
        }

        const result = await mock.response(ctx);
        res.json(result);

        // 业务数据写入成功后，异步刷新对应单条知识的向量。
        // maybeSyncKnowledge 内部已做成功判定与异常吞没，绝不抛错、绝不阻塞响应。
        maybeSyncKnowledge({ ...ctx, method, url: ctx.url }, result);

        // 高敏感操作留痕。同样是成功判定 + 异常吞没，不干扰响应
        maybeRecordOperation({ ...ctx, method, url: ctx.url }, result);
      } catch (error) {
        console.error(
          `[admin-mock-backend] 处理 ${method.toUpperCase()} ${mock.url} 出错:`,
          error,
        );
        res.status(500).json({ code: 500, message: "服务器内部错误" });
      }
    });
  }
}
