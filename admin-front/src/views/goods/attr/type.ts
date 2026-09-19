export interface newAttrInterface {
  attrId?: number | string;
  attrName: string;
  attrValueList: Array<string>;
}

// 回收站中的商品属性：在原属性数据基础上增加软删除时间戳
export interface DeletedAttrItemInterface extends newAttrInterface {
  deleteTime: string;
}

export interface updateAttrInterface {
  code?: number;
  data: newAttrInterface;
  message?: string;
  ok?: boolean;
}

export interface attrItemInterface {
  attrValue: string;
  editFlag?: number;
}

export interface deleteResInterface {
  code?: number;
  data: null;
  msg?: string;
  ok?: boolean;
}
