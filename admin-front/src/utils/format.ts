// 将时间字符串格式化为 YYYY-MM-DD HH:mm:ss
// 说明：useRecycleBin 与品牌页里还各有一份同样逻辑的局部实现，
// 新代码请统一用这里的，后续可以逐步收敛过去
export const formatTime = ( time: string ) => {
  if ( !time ) return "";
  const date = new Date( time );
  const pad = ( n: number ) => String( n ).padStart( 2, "0" );
  return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad( date.getDate() ) } ${ pad( date.getHours() ) }:${ pad( date.getMinutes() ) }:${ pad( date.getSeconds() ) }`;
};
