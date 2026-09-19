import request from "@/utils/request";
import type {
  GetSpuParamsInterface,
  SkuDataInterface,
} from "./type";
import type { SpuRecordsInterface } from "@/views/goods/spu/type";
const api = {
  getSpuURL: "/admin/product/",
  getSpuBrandURL: "/admin/product/baseTrademark/getTrademarkList",
  getSpuImgURL: "/admin/product/spuImageList/",
  getSpuAttrUPL: "/admin/product/baseSaleAttrList/",
  addSpuURL: "/admin/product/saveSpuInfo",
  updateSpuURL: "/admin/product/updateSpuInfo",
  addSkuURL: "/admin/product/saveSkuInfo",
  getSkuListURL: "/admin/product/getSkuListBySpuId",
  deleteSpuURL: "/admin/product/deleteSpu",
  deletedSpuListURL: "/admin/product/recycle/deletedSpuList",
  restoreSpuURL: "/admin/product/recycle/restoreSpu",
};
// 获取全部spu请求
export const getSpuReq = ( params: GetSpuParamsInterface ) =>
{
  return request.get( `${ api.getSpuURL }${ params.page }`, {
    params: params.query,
  } );
};
// 获取全部品牌请求
export const getSpuBrand = () =>
{
  return request.get( api.getSpuBrandURL );
};
// 获取品牌图片
export const getSpuImg = ( spuId: number | undefined ) =>
{
  return request.get( `${ api.getSpuImgURL }${ spuId }` );
};
// 获取对应销售属性接口
export const getSpuAttr = ( spuId: number | undefined ) =>
{
  return request.get( `${ api.getSpuAttrUPL }${ spuId }` );
};
// 新增或修改spu
export const addUpdateSpu = ( data: SpuRecordsInterface ) =>
{
  if ( !data.id )
  {
    return request.post( api.addSpuURL, data );
  }
  return request.post( api.updateSpuURL, data );
};
// 新增sku
export const addSku = ( data: SkuDataInterface ) =>
{
  return request.post( api.addSkuURL, data );
};
// 获取sku列表
export const getSkuList = ( spuId: number | undefined ) =>
{
  return request.get( api.getSkuListURL, { params: { spuId } } );
};
// 删除已有spu（软删除，30天内可在回收站恢复）
export const deleteSpu = ( spuId: number | undefined ) =>
{
  return request.delete( api.deleteSpuURL, { params: { id: spuId } } );
};
// 获取已软删除的spu列表（回收站）
export const getDeletedSpuList = () =>
{
  return request.get( api.deletedSpuListURL );
};
// 恢复误删spu
export const restoreSpu = ( spuId: number | undefined ) =>
{
  return request.put( api.restoreSpuURL, { id: spuId } );
};
