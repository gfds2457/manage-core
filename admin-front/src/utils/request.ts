import axios from "axios";
import { ElMessage } from "element-plus";
import useUser from "@/store/modules/user";
import { getEnvReport } from "@/utils/aiEnv";
const request = axios.create( {
  // 直连独立 mock 后端（../admin-mock-backend，Express + CORS，端口 3001），
  // 地址可在 .env.development 中用 VITE_API_BASE_URL 覆盖。
  // 取值统一走环境变量校验模块：归一化与非法值回退只在一处生效，
  // 避免「校验报告显示已回退、实际请求仍用旧值」这种两边对不上的情况
  baseURL: getEnvReport().mockBaseUrl,
  timeout: 5000,
} );

request.interceptors.request.use( ( config ) =>
{
  const User = useUser();
  const token = User.token;
  if ( token )
  {
    if ( !config.headers )
    {
      config.headers = {};
    }
    config.headers.Authorization = token.startsWith( "Bearer " )
      ? token
      : `Bearer ${ token }`;
  }
  return config;
} );

request.interceptors.response.use(
  ( response ) =>
  {
    return response.data;
  },
  ( err ) =>
  {
    // 提示文案此前是乱码（中文被二次编码损坏），用户看到的是「缃戠粶鍑虹幇闂」这类
    // 无法阅读的字符，等于没有任何提示作用，这里统一恢复为可读中文
    let message = "网络出现问题";
    try
    {

      if ( err && err.response && err.response.status )
      {
        const status = err.response.status;
        switch ( status )
        {
          case 401:
            message = "TOKEN 已过期，请重新登录";
            break;
          case 403:
            message = "无权访问该资源";
            break;
          case 404:
            message = "请求地址错误";
            break;
          case 500:
            message = "服务器出现问题";
            break;
          default:
            message = "网络出现问题";
            break;
        }
      } else if ( err && err.message )
      {
        message = err.message;
      }
    } catch ( e )
    {
      console.error( "响应拦截器处理错误时出错", e );
      message = "网络出现问题";
    }
    console.error( "request error:", err );
    ElMessage.error( message );
    return Promise.reject( err );
  },
);
export default request;
