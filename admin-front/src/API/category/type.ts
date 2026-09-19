export interface addArrInterface {
  attrId?: number | string;
  attrName: string;
  attrValueList: Array<
    | {
        attrValue: string;
        editFlag?: number;
      }
    | string
  >;
}
