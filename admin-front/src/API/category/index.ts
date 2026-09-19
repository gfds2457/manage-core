import request from "@/utils/request";
import type { addArrInterface } from "./type";
const Api = {
  C1_URL: "/category/getLevel1",
  C2_URL: "/category/getLevel2",
  C3_URL: "/category/getLevel3",
  Arr_URL: "/product/attr/getAttrByCateId",
  addArr_URL: "/product/attr/addAttr",
  updateArr_URL: "/product/attr/updateAttr",
  deleteArr_URL: "/attribute/delete",
  DeletedArrList_URL: "/product/attr/recycle/deletedList",
  RestoreArr_URL: "/product/attr/recycle/restore",
};
// 获取一级商品信息
export const reqC1 = () =>
{
  return request.get( Api.C1_URL );
};
// 获得商品二级信息
// get传params，post传body
export const reqC2 = ( id: number | string ) =>
{
  return request.get( Api.C2_URL, { params: { level1Id: id } } );
};
// 获取商品三级信息
export const reqC3 = ( id: number | string ) =>
{
  return request.get( Api.C3_URL, { params: { level2Id: id } } );
};
// 获取商品属性+属性值
export const reqArr = ( id: number | string ) =>
{
  return request.get( Api.Arr_URL, { params: { cate3Id: id } } );
};

// 修改商品属性，新增商品属性
export const addUpdateReq = ( data: addArrInterface ) =>
{
  if ( data.attrId )
  {
    Number( data.attrId );
    return request.put( Api.updateArr_URL, data );
  }
  return request.post( Api.addArr_URL, data );
};
// 删除商品属性（软删除，30天内可在回收站恢复）
export const deleteReq = ( attrId: number | string | undefined ) =>
{
  return request.delete( Api.deleteArr_URL, { data: { attrId } } );
};
// 获取已软删除的商品属性列表（回收站）
export const getDeletedArrList = () =>
{
  return request.get( Api.DeletedArrList_URL );
};
// 恢复误删商品属性
export const restoreArr = ( attrId: number | string | undefined ) =>
{
  return request.put( Api.RestoreArr_URL, { attrId } );
};
