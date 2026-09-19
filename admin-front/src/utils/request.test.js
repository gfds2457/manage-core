/**
 * src/utils/request.ts 单元测试
 * 技术栈：Vue3 + TypeScript + Vitest
 * 说明：只新增/调整测试文件，不修改业务源码。
 *
 * request.ts 在模块顶层就会执行 axios.create() 并注册请求/响应拦截器，
 * 因此这里把 axios 整体 mock 掉：create 返回一个假实例，拦截器注册时
 * 把回调保存到 mocks.handlers，测试中手动触发，从而精确校验拦截器逻辑。
 *
 * 关于模块初始化：request.ts 的顶层逻辑只在模块「首次求值」时执行，
 * 而 Vitest 同一 worker 内可能已经由其它测试文件加载过它，模块注册表里有缓存，
 * 这里再 import 只会拿到缓存对象、不再触发 create / interceptors.use，
 * 断言就会看到 "expected vi.fn() to be called 1 times, but got 0 times"。
 * 所以每个用例前都用 vi.resetModules() 重置注册表，再动态 import 重新加载，
 * 确保观察到的初始化行为一定来自本次加载。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() =>
{
  // 保存 request.ts 在模块加载时注册进来的拦截器回调
  const handlers = {
    requestFulfilled: undefined,
    requestRejected: undefined,
    responseFulfilled: undefined,
    responseRejected: undefined,
  };

  const instance = {
    interceptors: {
      request: {
        use: vi.fn(( onFulfilled, onRejected ) =>
        {
          handlers.requestFulfilled = onFulfilled;
          handlers.requestRejected = onRejected;
        } ),
      },
      response: {
        use: vi.fn(( onFulfilled, onRejected ) =>
        {
          handlers.responseFulfilled = onFulfilled;
          handlers.responseRejected = onRejected;
        } ),
      },
    },
    defaults: { headers: {} },
    get: vi.fn(),
    post: vi.fn(),
  };

  return {
    handlers,
    instance,
    // create 必须返回同一个实例，业务码里导出的是 create 的返回值
    create: vi.fn(() => instance),
    // ElMessage.error 的替身
    error: vi.fn(),
    // 下面两个替身刻意提升到 hoisted，而不是写在各 mock 工厂内部：
    // 工厂会被 vi.resetModules() 触发重新求值，若在工厂里新建 vi.fn()，
    // 测试文件提前拿到的引用就会失效（例如 useUser.mockReturnValue 打空）
    useUser: vi.fn(() => ( { token: "" } )),
    getEnvReport: vi.fn(() => ( { mockBaseUrl: "http://127.0.0.1:3001" } )),
  };
} );

vi.mock("axios", () => ({
  default: { create: mocks.create },
}));

vi.mock("element-plus", () => ({
  ElMessage: { error: mocks.error },
}));

vi.mock("@/store/modules/user", () => ({
  default: mocks.useUser,
}));

vi.mock("@/utils/aiEnv", () => ({
  getEnvReport: mocks.getEnvReport,
}));

// 动态 import 得到的产物：每个用例都会重新赋值，保证用的是当前注册表里的那份模块
let request;
let useUser;
let getEnvReport;

const loadRequestModule = async () =>
{
  // 先重置模块注册表，避免复用其它测试文件留下的缓存（顶层逻辑不会重跑）
  vi.resetModules();
  // create / interceptors.use 都是长期存活的 vi.fn，调用次数跨加载累积，
  // 断言「注册了几次」之前需要先清零
  mocks.create.mockClear();
  mocks.instance.interceptors.request.use.mockClear();
  mocks.instance.interceptors.response.use.mockClear();

  // 动态 import 会真正触发 request.ts 顶层逻辑（create + 注册拦截器）
  request = ( await import("@/utils/request") ).default;
  // 这两个 mock 工厂返回的就是 hoisted 里的替身，重新加载后引用不变
  useUser = mocks.useUser;
  getEnvReport = mocks.getEnvReport;
};

const invokeRequestInterceptor = ( config ) =>
  mocks.handlers.requestFulfilled( config );

const invokeResponseSuccess = ( response ) =>
  mocks.handlers.responseFulfilled( response );

const invokeResponseError = ( err ) =>
  mocks.handlers.responseRejected( err );

let consoleErrorSpy;

beforeEach(async () =>
{
  // 每个用例都重新加载 request.ts，消除「模块已被缓存、没初始化过」的假象
  await loadRequestModule();

  // 提示与 token 依赖每个用例单独设定
  mocks.error.mockClear();
  useUser.mockReset();
  useUser.mockReturnValue({ token: "" });
  consoleErrorSpy = vi.spyOn( console, "error" ).mockImplementation( () => {} );
});

afterEach(() =>
{
  consoleErrorSpy.mockRestore();
});

describe("axios 实例初始化", () =>
{
  it("baseURL 取自环境校验模块 getEnvReport().mockBaseUrl", () =>
  {
    expect( mocks.create ).toHaveBeenCalledTimes( 1 );
    const [ config ] = mocks.create.mock.calls[ 0 ];
    expect( config.baseURL ).toBe( getEnvReport().mockBaseUrl );
    expect( config.baseURL ).toBe( "http://127.0.0.1:3001" );
  } );

  it("超时时间为 5000ms", () =>
  {
    const [ config ] = mocks.create.mock.calls[ 0 ];
    expect( config.timeout ).toBe( 5000 );
  } );

  it("默认导出就是 create 出来的 axios 实例", () =>
  {
    expect( request ).toBe( mocks.instance );
  } );

  it("各注册了一个请求拦截器与响应拦截器", () =>
  {
    expect( mocks.instance.interceptors.request.use ).toHaveBeenCalledTimes( 1 );
    expect( mocks.instance.interceptors.response.use ).toHaveBeenCalledTimes( 1 );
    expect( typeof mocks.handlers.requestFulfilled ).toBe( "function" );
    expect( typeof mocks.handlers.responseFulfilled ).toBe( "function" );
    expect( typeof mocks.handlers.responseRejected ).toBe( "function" );
  } );
} );

describe("请求拦截器：token 注入", () =>
{
  it("没有 token 时不写入 Authorization", () =>
  {
    useUser.mockReturnValue({ token: "" });
    const config = { headers: {} };

    const returned = invokeRequestInterceptor( config );

    // 拦截器必须原样返回 config，否则 axios 会丢掉这次请求配置
    expect( returned ).toBe( config );
    expect( config.headers.Authorization ).toBeUndefined();
  } );

  it("没有 token 且 config.headers 缺省时，不会凭空创建 headers", () =>
  {
    useUser.mockReturnValue({ token: "" });
    const config = {};

    invokeRequestInterceptor( config );

    expect( config.headers ).toBeUndefined();
  } );

  it("裸 token 自动补上 Bearer 前缀", () =>
  {
    useUser.mockReturnValue({ token: "abc123" });
    const config = { headers: {} };

    invokeRequestInterceptor( config );

    expect( config.headers.Authorization ).toBe( "Bearer abc123" );
  } );

  it("已带 Bearer 前缀的 token 不会被重复加前缀", () =>
  {
    useUser.mockReturnValue({ token: "Bearer abc123" });
    const config = { headers: {} };

    invokeRequestInterceptor( config );

    expect( config.headers.Authorization ).toBe( "Bearer abc123" );
  } );

  it("config.headers 缺省时自动创建并写入 Authorization", () =>
  {
    useUser.mockReturnValue({ token: "abc123" });
    const config = {};

    invokeRequestInterceptor( config );

    expect( config.headers ).toEqual({ Authorization: "Bearer abc123" });
  } );

  it("保留已有的其它请求头", () =>
  {
    useUser.mockReturnValue({ token: "abc123" });
    const config = { headers: { "Content-Type": "application/json" } };

    invokeRequestInterceptor( config );

    expect( config.headers[ "Content-Type" ] ).toBe( "application/json" );
    expect( config.headers.Authorization ).toBe( "Bearer abc123" );
  } );

  it("每次请求都从 store 重新读取 token（切换账号后立即生效）", () =>
  {
    const configA = { headers: {} };
    useUser.mockReturnValue({ token: "token-a" });
    invokeRequestInterceptor( configA );
    expect( configA.headers.Authorization ).toBe( "Bearer token-a" );

    const configB = { headers: {} };
    useUser.mockReturnValue({ token: "token-b" });
    invokeRequestInterceptor( configB );
    expect( configB.headers.Authorization ).toBe( "Bearer token-b" );
  } );
} );

describe("响应拦截器：成功分支", () =>
{
  it("直接解包返回 response.data", () =>
  {
    const data = { code: 200, records: [ 1, 2, 3 ] };

    const result = invokeResponseSuccess({ data, status: 200, config: {} });

    expect( result ).toBe( data );
  } );

  it("成功时不弹出错误提示", () =>
  {
    invokeResponseSuccess({ data: { code: 200 } });

    expect( mocks.error ).not.toHaveBeenCalled();
  } );
} );

describe("响应拦截器：失败提示文案", () =>
{
  it.each( [
    [ 401, "TOKEN 已过期，请重新登录" ],
    [ 403, "无权访问该资源" ],
    [ 404, "请求地址错误" ],
    [ 500, "服务器出现问题" ],
  ] )( "HTTP %i 提示「%s」", async ( status, expected ) =>
  {
    const err = { response: { status } };

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledTimes( 1 );
    expect( mocks.error ).toHaveBeenCalledWith( expected );
  } );

  it.each( [
    [ 400 ],
    [ 418 ],
    [ 502 ],
    [ 503 ],
  ] )( "未覆盖的 HTTP %i 回退为「网络出现问题」", async ( status ) =>
  {
    const err = { response: { status } };

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledTimes( 1 );
    expect( mocks.error ).toHaveBeenCalledWith( "网络出现问题" );
  } );

  it("response.status 为 0 时回退为「网络出现问题」", async () =>
  {
    const err = { response: { status: 0 } };

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledWith( "网络出现问题" );
  } );

  it("无 response 但有 message 时，直接使用 err.message", async () =>
  {
    const err = new Error( "Network Error" );

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledTimes( 1 );
    expect( mocks.error ).toHaveBeenCalledWith( "Network Error" );
  } );

  it("无 response 且无 message 时回退为「网络出现问题」", async () =>
  {
    const err = {};

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledWith( "网络出现问题" );
  } );

  it("err 为 null 时不会抛异常，仍以通用文案 reject", async () =>
  {
    await expect( invokeResponseError( null ) ).rejects.toBeNull();

    expect( mocks.error ).toHaveBeenCalledWith( "网络出现问题" );
  } );

  it("拦截器内部处理异常时兜底为通用文案，并打印诊断日志", async () =>
  {
    const err = { response: {} };
    Object.defineProperty( err.response, "status", {
      get()
      {
        throw new Error( "boom" );
      },
      configurable: true,
    } );

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledTimes( 1 );
    expect( mocks.error ).toHaveBeenCalledWith( "网络出现问题" );
    const printed = consoleErrorSpy.mock.calls
      .flat()
      .some(
        ( arg ) =>
          typeof arg === "string" && arg.includes( "响应拦截器处理错误时出错" ),
      );
    expect( printed ).toBe( true );
  } );
} );

describe("响应拦截器：错误向上传递", () =>
{
  it("始终以原始错误对象 reject，便于上层继续处理", async () =>
  {
    const err = new Error( "Network Error" );

    const promise = invokeResponseError( err );

    await expect( promise ).rejects.toBe( err );
    expect( consoleErrorSpy ).toHaveBeenCalledWith( "request error:", err );
  } );

  it("任何失败都只弹一次提示", async () =>
  {
    const err = { response: { status: 401 } };

    await expect( invokeResponseError( err ) ).rejects.toBe( err );

    expect( mocks.error ).toHaveBeenCalledTimes( 1 );
  } );
} );
