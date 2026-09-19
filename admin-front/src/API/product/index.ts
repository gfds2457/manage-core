import request from "@/utils/request";
import type { dataType } from "./type";
const API = {
  BrandList_URL: "/product/baseTrademark",
  AddBrand_URL: "/product/baseTrademark/save",
  UpdateBrand_URL: "/product/baseTrademark/update",
  DeleteBrand_URL: "/product/baseTrademark",
  DeletedBrandList_URL: "/product/baseTrademark/deleted",
  RestoreBrand_URL: "/product/baseTrademark/restore",
};
//请求全部品牌数据
export const getBrandList = ( pageNum: number = 1, pageSize: number ) =>
{
  //一定要加return,否则只是发送请求,没办法拿到promise
  return request.get( API.BrandList_URL, {
    params: {
      pageNum,
      pageSize,
    },
  } );
};
//添加和修改品牌请求
export const reqAddUpdateBrand = ( data: dataType ) =>
{
  if ( !data.id )
  {
    return request.post( API.AddBrand_URL, data );
  } else
  {
    return request.put( API.UpdateBrand_URL, data );
  }
};
// 删除品牌信息请求（软删除，30天后真正销毁）
export const reqDeleteBrand = ( id: number ) =>
{
  return request.delete( API.DeleteBrand_URL, { data: { id } } );
};
// 获取已软删除的品牌列表（回收站）
export const reqGetDeletedBrandList = () =>
{
  return request.get( API.DeletedBrandList_URL );
};
// 恢复误删品牌
export const reqRestoreBrand = ( id: number ) =>
{
  return request.put( API.RestoreBrand_URL, { id } );
};
