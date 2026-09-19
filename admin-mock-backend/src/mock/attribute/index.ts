import { PERM } from "../../permission/codes";
import type { MockItem } from "../../adapter";
// 模拟分类静态数据
// 一级分类
const level1List = [
  { id: 1, name: "手机" },
  { id: 2, name: "电脑" },
  { id: 3, name: "家电" },
];
// 二级分类（parentId关联一级id）
const level2List = [
  { id: 11, name: "手机通讯", parentId: 1 },
  { id: 12, name: "手机配件", parentId: 1 },
  { id: 21, name: "笔记本电脑", parentId: 2 },
  { id: 22, name: "台式整机", parentId: 2 },
  { id: 31, name: "大家电", parentId: 3 },
  { id: 32, name: "小家电", parentId: 3 },
];
// 三级分类（parentId关联二级id）
const level3List = [
  { id: 111, name: "手机", parentId: 11 },
  { id: 112, name: "对讲机", parentId: 11 },
  { id: 121, name: "手机壳", parentId: 12 },
  { id: 122, name: "充电器", parentId: 12 },
  { id: 211, name: "游戏本", parentId: 21 },
  { id: 212, name: "轻薄本", parentId: 21 },
];
// 商品属性数据（对应三级分类id=111）
let attrData = [
  {
    attrId: 1,
    attrName: "手机一级",
    attrValueList: [
      "苹果手机",
      "苹果手机",
      "安卓手机",
      "安卓手机222",
      "安卓手机111",
      "安卓手机",
      "安卓手机222",
      "安卓手机",
      "安卓手机111",
      "苹果手机",
      "苹果手机",
      "安卓手机",
    ],
  },
  {
    attrId: 2,
    attrName: "电池容量",
    attrValueList: ["1200mAh以下", "3000mAh以上", "1200mAh到3000mAh"],
  },
  {
    attrId: 3,
    attrName: "运行内存",
    attrValueList: ["128G", "6G", "256G"],
  },
  {
    attrId: 4,
    attrName: "机身内存",
    attrValueList: ["128G", "512G", "64G", "256G", "1T", "32G"],
  },
  {
    attrId: 5,
    attrName: "CPU型号",
    attrValueList: ["骁龙730G", "麒麟990", "骁龙439", "骁龙845", "5G骁龙768G"],
  },
  {
    attrId: 6,
    attrName: "屏幕尺寸",
    attrValueList: [
      "6.75-6.84英寸",
      "6.55-6.64英寸",
      "6.95英寸及以上",
      "6.85-6.94英寸",
      "6.65-6.74英寸",
      "6.0-6.24英寸",
    ],
  },
];

// 回收站：存放已软删除的商品属性，额外记录删除时间 deleteTime
// 列表接口只读取 attrData，所以移入该数组的属性会立刻从原列表消失
const deletedAttrData: Array<
  (typeof attrData)[number] & { deleteTime: string }
> = [];

// 和截图品牌接口格式保持一致，统一导出数组
export default [
  // 回收站列表接口：返回 30 天内被软删除的商品属性（按删除时间倒序）
  {
    url: "/api/product/attr/recycle/deletedList",
    method: "get",
    response: () => {
      const records = [...deletedAttrData].sort(
        (a, b) =>
          new Date(b.deleteTime).getTime() - new Date(a.deleteTime).getTime(),
      );
      return {
        code: 200,
        data: records,
        message: "操作成功",
        ok: true,
      };
    },
  },
  // 恢复商品属性接口：从回收站取回，重新放回原列表头部
  {
    url: "/api/product/attr/recycle/restore",
    method: "put",
    permission: PERM.GOODS_ATTR_WRITE,
    response: ({ body }) => {
      const restoreId = Number(body.attrId);
      const restoreIndex = deletedAttrData.findIndex(
        (item) => Number(item.attrId) === restoreId,
      );
      if (restoreIndex === -1) {
        return {
          code: 200,
          data: null,
          message: "恢复失败，回收站中不存在该商品属性",
          ok: false,
        };
      }
      // 取出该属性并去掉 deleteTime，恢复为普通属性数据
      const [restored] = deletedAttrData.splice(restoreIndex, 1);
      delete (restored as Partial<typeof restored>).deleteTime;
      attrData.unshift(restored);
      return {
        code: 200,
        data: null,
        message: "恢复商品属性成功",
        ok: true,
      };
    },
  },
  // 1. 获取一级分类列表接口
  {
    url: "/api/category/getLevel1",
    method: "get",
    response: () => {
      return {
        code: 200,
        data: level1List,
        msg: "success",
        ok: true,
      };
    },
  },
  // 2. 根据一级分类id获取二级分类接口
  {
    url: "/api/category/getLevel2",
    method: "get",
    response: ({ query }: { query: { level1Id?: string | number } }) => {
      // 接收url参数 level1Id
      const level1Id = Number(query.level1Id);
      // 过滤对应一级下的二级分类
      const filterData = level2List.filter(
        (item) => item.parentId === level1Id,
      );
      return {
        code: 200,
        data: filterData,
        msg: "success",
        ok: true,
      };
    },
  },
  // 3. 根据二级分类id获取三级分类接口
  {
    url: "/api/category/getLevel3",
    method: "get",
    response: ({ query }: { query: { level2Id?: string | number } }) => {
      const level2Id = Number(query.level2Id);
      const filterData = level3List.filter(
        (item) => item.parentId === level2Id,
      );
      return {
        code: 200,
        data: filterData,
        msg: "success",
        ok: true,
      };
    },
  },

  // 4. 根据三级分类ID获取商品属性+属性值接口
  {
    url: "/api/product/attr/getAttrByCateId",
    method: "get",
    response: ({ query }: { query: { cate3Id?: string | number } }) => {
      const cate3Id = Number(query.cate3Id);
      // 仅三级分类111返回属性数据，其他分类返回空数组
      const data = cate3Id === 111 ? attrData : [];
      return {
        code: 200,
        data,
        msg: "success",
        ok: true,
      };
    },
  },
  // 5.新增商品属性
  {
    url: "/api/product/attr/addAttr",
    method: "post",
    permission: PERM.GOODS_ATTR_WRITE,
    response: ({
      body,
    }: {
      body: { attrName: string; attrValueList: string[] };
    }) => {
      // 自增ID
      const maxAttrId = attrData.reduce(
        (max, item) => (item.attrId > max ? item.attrId : max),
        0,
      );
      const newAttr = {
        attrId: maxAttrId + 1,
        attrName: body.attrName,
        attrValueList: body.attrValueList,
      };
      // 模拟入库，生成新数组（const兼容写法）
      attrData = [...attrData, newAttr];
      return {
        code: 200,
        data: newAttr,
        msg: "新增属性成功",
        ok: true,
      };
    },
  },
  // 7. 修改商品属性 PUT
  {
    url: "/api/product/attr/updateAttr",
    method: "put",
    permission: PERM.GOODS_ATTR_WRITE,
    response: ({
      body,
    }: {
      body: { attrId: number; attrName: string; attrValueList: string[] };
    }) => {
      const target = attrData.find((item) => item.attrId === body.attrId);
      if (!target) {
        return {
          code: 400,
          data: null,
          msg: "修改失败，属性不存在",
          ok: false,
        };
      }
      // 覆盖原有数据
      target.attrName = body.attrName;
      target.attrValueList = body.attrValueList;
      return {
        code: 200,
        data: target,
        msg: "修改属性成功",
        ok: true,
      };
    },
  },
  // 8.删除商品属性（软删除：移入回收站，30 天内可通过恢复接口取回）
  {
    url: "/api/attribute/delete",
    method: "delete",
    permission: PERM.GOODS_ATTR_WRITE,
    response: (req) => {
      // 从请求体/路径参数获取要删除的属性id
      const attrId = req.body?.attrId || req.query?.attrId;
      if (!attrId) {
        return {
          code: 500,
          data: null,
          msg: "attrId不能为空",
          ok: false,
        };
      }

      const delIndex = attrData.findIndex(
        (item) => item.attrId === Number(attrId),
      );
      if (delIndex === -1) {
        return {
          code: 200,
          data: null,
          msg: "删除失败，不存在该商品属性",
          ok: false,
        };
      }

      // 从原列表移除，带上删除时间放进回收站，而不是直接销毁数据
      const [deleted] = attrData.splice(delIndex, 1);
      deletedAttrData.push({
        ...deleted,
        deleteTime: new Date().toISOString(),
      });

      return {
        code: 200,
        data: null,
        msg: "删除成功",
        ok: true,
      };
    },
  },
] as MockItem[];
