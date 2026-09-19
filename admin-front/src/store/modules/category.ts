import { defineStore } from "pinia";
import { reqC1, reqC2, reqC3, reqArr } from "@/API/category";
interface level1ItemInterface {
  id: number;
  name: string;
}
interface C1ResInterface {
  code?: number;
  data: level1ItemInterface[];
  msg?: string;
  ok?: boolean;
}
interface AttrResInterface {
  code?: number;
  data: attrDataInterface[];
  msg?: string;
  ok?: boolean;
}
interface attrDataInterface {
  attrId: number;
  attrName: string;
  attrValueList: string[];
}
interface AllcategoryINterface {
  C1Arr: level1ItemInterface[];
  C2Arr: level1ItemInterface[];
  C3Arr: level1ItemInterface[];
  C1Id: number | string;
  C2Id: number | string;
  C3Id: number | string;
  attrData: attrDataInterface[];
}
const category = defineStore("category", {
  // state是一个方法，通过return存储数据
  state: (): AllcategoryINterface => {
    return {
      // 一级商品信息，发送请求后则一直储存，在页面刷新或关掉标签后清空
      C1Arr: [],
      C1Id: "",
      // 二级商品信息
      C2Arr: [],
      C2Id: "",
      // 三级商品信息
      C3Arr: [],
      C3Id: "",
      // 商品属性+属性值请求
      attrData: [],
    };
  },
  // 直接放函数，不用声明
  actions: {
    // 获得商品一级信息
    async getC1() {
      const res: C1ResInterface = await reqC1();
      if (res.code == 200) {
        this.C1Arr = res.data;
      }
    },
    // 获得商品二级信息 await用处为调用方法后可以将得到的值直接赋值给仓库
    async getC2(id: number | string) {
      const res: C1ResInterface = await reqC2(id);
      if (res.code == 200) {
        this.C2Arr = res.data;
      }
    },
    async getC3(id: number | string) {
      const res: C1ResInterface = await reqC3(id);
      if (res.code == 200) {
        this.C3Arr = res.data;
      }
    },
    //商品属性+属性值请求
    async getArr(id: number | string) {
      const res: AttrResInterface = await reqArr(id);
      if (res.code === 200) {
        this.attrData = res.data;
      }
    },
  },
});
export default category;
