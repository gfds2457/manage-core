// 请求全部spu属性返回data的records
export interface SpuRecordsInterface {
  category3Id?: number;
  description?: string;
  id?: number | undefined;
  spuImageList?: [] | undefined;
  spuName?: string;
  spuSaleAttrList?: SpuAttrItemInterface[];
  tmId?: number | null;
}

// 回收站中的SPU：在原SPU数据基础上增加软删除时间戳
export interface DeletedSpuItemInterface extends SpuRecordsInterface {
  deleteTime: string;
}

// 请求全部spu属性返回的data
export interface SpuResDataInterface<U> {
  current: number;
  ok: boolean;
  pages: number;
  records: Array<U>;
  searchCount: boolean;
  size: number;
  total: number;
}

// 获取spu属性返回数据类型
export interface GetSpuResInterface<T> {
  code?: number;
  data: T;
  msg?: string;
  message?: string;
  ok?: boolean;
}

//获取所有品牌返回数据类型
export interface BrandResItemInterface {
  id: number;
  tmName: string;
  logoUrl: string;
}

// 获取商品图片返回数据类型
export interface ImgResItemInterface {
  createTime: string;
  id: number;
  imgName: string;
  imgUrl: string;
  spuId: number;
  updateTime: string;
}
// 图片列表存储数据类型
export interface ImgListInterface {
  name: string;
  percentage: number;
  raw: File;
  response: GetSpuResInterface<string>;
  size: number;
  status: string;
  uid: number;
  url: string;
}
// 获取销售属性值返回数据类型
export interface spuAttrValueListInterface {
  id?: number;
  saleAttrValueName: string;
}

// 获取销售属性返回数据类型
export interface SpuAttrItemInterface {
  baseSaleAttrId?: number;
  id?: number;
  saleAttrName?: string;
  spuSaleAttrValueList: spuAttrValueListInterface[];
  targetSpuId?: number;
  attrIdAndValueIdList?: string | null;
}

// spu相关数据请求整体类型
export interface SpuResInterface<T> {
  code?: number;
  data?: T;
  message?: string;
  ok?: boolean;
}

// spu提交数据类型
export interface spuDataInterface {
  id?: number | string;
}

// 子组件传来changeFlag数据类型
export interface changeFlagInterface {
  flag: number;
  params: string;
}

// 选中销售属性类型
export interface attrSelectArrInterface {
  [attrId: number | string]: string | undefined;
}
// sku返回data数据类型
export interface SkuDataInterface {
  createTime: string;
  id: number;
  isSale: number;
  price: number;
  skuAttrValueList: null;
  skuDefaultImg: string;
  skuDesc: string;
  skuImageList: null;
  skuName: string;
  skuSaleAttrValueList: null;
  spuId: number;
  tmId: number;
  updateTime: string;
  weight: string;
}
