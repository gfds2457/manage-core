import type {
  SpuRecordsInterface,
  SpuAttrItemInterface,
} from "@/views/goods/spu/type";

export interface GetSpuParamsInterface
{
  page: number;
  query: {
    category3Id?: number | string | undefined;
    tmId?: number | string;
    pageSize?: number | string;
  };
}

export interface SkuDataInterface
{
  category3Id: number | null;
  spuId: number | null;
  tmId: number | null;
  skuName: string;
  price: number | null;
  weight: string;
  skuDesc: string;
  skuAttrValueList: Array<{
    attrId: number | string;
    valueId: number | string;
  }>;
  skuDefaultImg: string;
}
