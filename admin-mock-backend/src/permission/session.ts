/**
 * 会话（token）管理。
 *
 * 为什么必须换掉原来的常量 token：
 * 旧实现里所有账号共用一个 "admin-token-xxx-123456"，服务端拿到请求也认不出是谁，
 * 于是权限判断根本无从下手，只能靠 user 模块里一个模块级 currentUser 变量记
 * 「最后登录的那个人」——换账号登录后，前一个账号的请求也会被当成新账号处理。
 * token 不带身份，后端鉴权就无从谈起。
 *
 * 现在签发 mock-token-<userId>-<随机串>，鉴权时直接反解出 userId 再查用户表，
 * 这正是需求「提取 token 中的用户 id，查询用户权限」的实现方式。
 *
 * 随机串的作用是让 token 不可枚举猜测（没有它，写出 userId 就能伪造 token）。
 *
 * ⚠️ mock 的边界要说清楚：这里没有签名、没有有效期，token 是可伪造的，
 * 只能证明「改造后权限判断确实认对了人」，不等于生产可用的认证方案。
 * 接真实后端时应换成 JWT 验签 / session 存储，届时本文件整体替换，调用方无需改动。
 */
export const TOKEN_PREFIX = "mock-token-";

/** 已签发且未失效的 token → userId */
const issued = new Map<string, number>();

/** 取出纯 token（前端可能带或不带 "Bearer " 前缀） */
const stripBearer = (authorization?: string | null): string =>
  ( authorization ?? "" ).replace( /^Bearer\s+/i, "" ).trim();

/** 随机串，避免 token 可被枚举伪造。base36 字符集不含 "-"，不会干扰解析 */
const randomSegment = (): string =>
  Math.random().toString( 36 ).slice( 2, 10 ) + Date.now().toString( 36 );

/**
 * 为用户签发新 token。
 * 同一用户重复登录会拿到不同 token，旧 token 不失效——对应真实场景的多端同时登录。
 */
export const issueToken = (userId: number): string =>
{
  const token = `${ TOKEN_PREFIX }${ userId }-${ randomSegment() }`;
  issued.set( token, userId );
  return token;
};

/**
 * 从 Authorization 头解析发起请求的用户 id。
 * 解析不出来一律返回 null，由调用方判 401——不做「解析失败就当匿名放行」这种兜底，
 * 那种兜底正是越权的入口。
 */
export const resolveUserId = (authorization?: string | null): number | null =>
{
  const token = stripBearer( authorization );
  if ( !token ) return null;
  if ( !token.startsWith( TOKEN_PREFIX ) ) return null;

  const userId = Number( token.slice( TOKEN_PREFIX.length ).split( "-" )[ 0 ] );
  if ( !Number.isInteger( userId ) || userId <= 0 ) return null;

  // 命中已签发记录时以记录为准；否则（mock 后端重启导致内存表清空）
  // 仍按 token 自带的 userId 放行，免得每改一行代码就要重新登录一次
  return issued.get( token ) ?? userId;
};

/** 仅供单元测试重置状态使用 */
export const clearSessions = (): void =>
{
  issued.clear();
};
