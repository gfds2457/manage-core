import express from "express";
import cors from "cors";
import mocks from "./mock";
import { registerMocks } from "./adapter";

const app = express();
const PORT = Number( process.env.PORT ) || 3001;

// CORS：开发环境允许任意来源跨域直连；
// cors 包默认会反射请求的 Origin 与 Access-Control-Request-Headers，
// 前端携带的 Authorization 头与 el-upload 的 multipart 请求均可放行
app.use( cors() );

// 解析 JSON body（express.json 对 DELETE 等所有方法的请求体同样生效，
// 前端品牌删除接口是 DELETE + JSON body）
app.use( express.json() );

// 按聚合数组顺序注册全部 mock 路由
registerMocks( app, mocks );

// 未匹配到的路由统一返回 404 JSON 兜底
app.use( ( req, res ) =>
{
  res.status( 404 ).json( { code: 404, message: `Not Found: ${ req.originalUrl }` } );
} );

app.listen( PORT, () =>
{
  console.log(
    `[admin-mock-backend] 已启动: http://localhost:${ PORT }，共注册 ${ mocks.length } 条 mock 路由`,
  );
} );
