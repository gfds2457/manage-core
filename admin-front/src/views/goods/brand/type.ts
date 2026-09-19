export interface BrandItemInterface
{
  id: number;
  tmName: string;
  logoUrl: string;
}
export interface addDeleteResponse
{
  code?: number;
  data: null;
  message?: string;
  ok?: boolean;
}
// 回收站中的品牌：在原品牌基础上增加软删除时间戳
export interface DeletedBrandItemInterface extends BrandItemInterface
{
  deleteTime: string;
}
