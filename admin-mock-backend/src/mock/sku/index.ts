import { PERM } from "../../permission/codes";
import type { MockItem } from "../../adapter";
// sku全部数据
// 导出给 audit 模块：上下架审核通过后需要把这里的 isSale 真正改掉
export const skuData = [
  {
    id: 32,
    createTime: "2021-12-10 01:31:42",
    updateTime: "2023-03-14 23:35:06",
    spuId: 11,
    price: 9898,
    skuName:
      "华为智慧屏 SE 55英寸 超薄电视 超高清智能液晶电视机 HD55DESA 2+16GB",
    skuDesc:
      "华为智慧屏 SE 55英寸 超薄电视 广色域鸿鹄画质 超高清智能液晶电视机 HD55DESA 2+16GB华为智慧屏 SE 55英寸 超薄",
    weight: "3.00",
    tmId: 3,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/1/800/800",
    isSale: 1,
    // 多张商品图
    skuImageList: [
      "https://picsum.photos/id/1/800/800",
      "https://picsum.photos/id/2/800/800",
      "https://picsum.photos/id/3/800/800",
    ],
    // 平台参数属性（多条）
    skuAttrValueList: [
      {
        attrId: 101,
        attrName: "屏幕面板",
        valueId: 1001,
        valueName: "4K LCD软屏",
      },
      {
        attrId: 102,
        attrName: "处理器",
        valueId: 1005,
        valueName: "鸿鹄818芯片",
      },
      {
        attrId: 103,
        attrName: "音响功率",
        valueId: 1009,
        valueName: "30W立体环绕音响",
      },
    ],
    // 销售选择属性（多条，下单可选规格）
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2001,
        saleAttrValueName: "55英寸",
      },
      {
        saleAttrId: 202,
        saleAttrName: "运行内存",
        saleAttrValueId: 2005,
        saleAttrValueName: "2GB",
      },
      {
        saleAttrId: 203,
        saleAttrName: "存储内存",
        saleAttrValueId: 2009,
        saleAttrValueName: "16GB",
      },
    ],
  },
  {
    id: 33,
    createTime: "2022-01-05 10:20:10",
    updateTime: "2023-02-10 15:12:33",
    spuId: 11,
    price: 6999,
    skuName: "华为智慧屏 SE 65英寸 超薄全面屏 4K智能电视",
    skuDesc: "65英寸4K超清，鸿鹄818芯片，MEMC运动防抖，家用智能液晶电视",
    weight: "4.20",
    tmId: 3,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/10/800/800",
    isSale: 1,
    skuImageList: [
      "https://picsum.photos/id/10/800/800",
      "https://picsum.photos/id/11/800/800",
      "https://picsum.photos/id/12/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 101,
        attrName: "屏幕面板",
        valueId: 1002,
        valueName: "4K ADS硬屏",
      },
      {
        attrId: 102,
        attrName: "运动补偿",
        valueId: 1006,
        valueName: "MEMC动态防抖",
      },
      {
        attrId: 104,
        attrName: "色域标准",
        valueId: 1010,
        valueName: "92% DCI-P3广色域",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2002,
        saleAttrValueName: "65英寸",
      },
      {
        saleAttrId: 202,
        saleAttrName: "运行内存",
        saleAttrValueId: 2005,
        saleAttrValueName: "2GB",
      },
      {
        saleAttrId: 203,
        saleAttrName: "存储内存",
        saleAttrValueId: 2010,
        saleAttrValueName: "32GB",
      },
    ],
  },
  {
    id: 34,
    createTime: "2022-03-12 08:45:22",
    updateTime: "2023-01-22 09:11:44",
    spuId: 12,
    price: 2599,
    skuName: "小米电视A55 55英寸 4K超高清智能平板电视",
    skuDesc: "金属全面屏，远场语音，家用卧室客厅液晶电视",
    weight: "2.80",
    tmId: 5,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/20/800/800",
    isSale: 0,
    skuImageList: [
      "https://picsum.photos/id/20/800/800",
      "https://picsum.photos/id/21/800/800",
      "https://picsum.photos/id/22/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 101,
        attrName: "边框材质",
        valueId: 1003,
        valueName: "一体金属窄边框",
      },
      {
        attrId: 105,
        attrName: "语音控制",
        valueId: 1007,
        valueName: "远场小爱语音",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2001,
        saleAttrValueName: "55英寸",
      },
      {
        saleAttrId: 204,
        saleAttrName: "机身颜色",
        saleAttrValueId: 2013,
        saleAttrValueName: "深空灰",
      },
    ],
  },
  {
    id: 35,
    createTime: "2022-04-18 14:22:11",
    updateTime: "2023-04-01 11:22:33",
    spuId: 12,
    price: 3299,
    skuName: "小米电视S65 65英寸 120Hz高刷游戏电视",
    skuDesc: "120Hz高刷新率，HDMI2.1，金属超薄机身，游戏影音两用电视",
    weight: "4.60",
    tmId: 5,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/30/800/800",
    isSale: 1,
    skuImageList: [
      "https://picsum.photos/id/30/800/800",
      "https://picsum.photos/id/31/800/800",
      "https://picsum.photos/id/32/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 106,
        attrName: "刷新率",
        valueId: 1008,
        valueName: "120Hz MEMC高刷",
      },
      {
        attrId: 107,
        attrName: "游戏接口",
        valueId: 1011,
        valueName: "HDMI2.1 4K120输入",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2002,
        saleAttrValueName: "65英寸",
      },
      {
        saleAttrId: 205,
        saleAttrName: "分区背光",
        saleAttrValueId: 2016,
        saleAttrValueName: "百级分区背光",
      },
    ],
  },
  {
    id: 36,
    createTime: "2022-05-20 09:10:05",
    updateTime: "2023-02-15 16:44:12",
    spuId: 13,
    price: 4599,
    skuName: "海信E3H 75英寸 4K悬浮全面屏智能电视",
    skuDesc: "75英寸超大屏，U+超画质引擎，杜比全景声，客厅观影首选",
    weight: "5.30",
    tmId: 8,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/40/800/800",
    isSale: 1,
    skuImageList: [
      "https://picsum.photos/id/40/800/800",
      "https://picsum.photos/id/41/800/800",
      "https://picsum.photos/id/42/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 108,
        attrName: "画质引擎",
        valueId: 1012,
        valueName: "海信U+超画质引擎",
      },
      {
        attrId: 109,
        attrName: "音效",
        valueId: 1014,
        valueName: "杜比全景声2.1",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2003,
        saleAttrValueName: "75英寸",
      },
      {
        saleAttrId: 206,
        saleAttrName: "底座款式",
        saleAttrValueId: 2019,
        saleAttrValueName: "悬浮金属底座",
      },
    ],
  },
  {
    id: 37,
    createTime: "2022-06-11 16:33:40",
    updateTime: "2023-03-20 08:12:55",
    spuId: 13,
    price: 5299,
    skuName: "海信游戏电视E7H 65英寸 144Hz高刷",
    skuDesc: "144Hz原生高刷，百级分区背光，专业游戏模式，低延迟输入",
    weight: "4.80",
    tmId: 8,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/50/800/800",
    isSale: 1,
    skuImageList: [
      "https://picsum.photos/id/50/800/800",
      "https://picsum.photos/id/51/800/800",
      "https://picsum.photos/id/52/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 106,
        attrName: "刷新率",
        valueId: 1015,
        valueName: "原生144Hz可变刷新率",
      },
      {
        attrId: 110,
        attrName: "输入延迟",
        valueId: 1016,
        valueName: "12ms超低游戏延迟",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2002,
        saleAttrValueName: "65英寸",
      },
      {
        saleAttrId: 207,
        saleAttrName: "背光分区",
        saleAttrValueId: 2022,
        saleAttrValueName: "144级MiniLED分区",
      },
    ],
  },
  {
    id: 38,
    createTime: "2022-07-03 11:55:21",
    updateTime: "2023-01-10 10:33:22",
    spuId: 14,
    price: 1999,
    skuName: "TCL V8E 50英寸 4K高清智能平板电视",
    skuDesc: "入门家用款，超薄金属边框，全场景语音，租房卧室适配",
    weight: "2.50",
    tmId: 9,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/60/800/800",
    isSale: 0,
    skuImageList: [
      "https://picsum.photos/id/60/800/800",
      "https://picsum.photos/id/61/800/800",
      "https://picsum.photos/id/62/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 111,
        attrName: "定位",
        valueId: 1017,
        valueName: "租房入门经济型",
      },
      {
        attrId: 105,
        attrName: "语音",
        valueId: 1018,
        valueName: "全场景AI语音助手",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2000,
        saleAttrValueName: "50英寸",
      },
      {
        saleAttrId: 208,
        saleAttrName: "底座",
        saleAttrValueId: 2025,
        saleAttrValueName: "简易塑料底座",
      },
    ],
  },
  {
    id: 39,
    createTime: "2022-08-15 13:44:09",
    updateTime: "2023-04-12 15:22:44",
    spuId: 14,
    price: 3699,
    skuName: "TCL Q10G Pro 55英寸 MiniLED量子点电视",
    skuDesc: "MiniLED背光，量子点广色域，120Hz高刷，家用高端观影电视",
    weight: "3.20",
    tmId: 9,
    category3Id: 86,
    skuDefaultImg: "https://picsum.photos/id/70/800/800",
    isSale: 1,
    skuImageList: [
      "https://picsum.photos/id/70/800/800",
      "https://picsum.photos/id/71/800/800",
      "https://picsum.photos/id/72/800/800",
    ],
    skuAttrValueList: [
      {
        attrId: 112,
        attrName: "背光技术",
        valueId: 1019,
        valueName: "MiniLED微米级背光",
      },
      {
        attrId: 113,
        attrName: "色彩技术",
        valueId: 1020,
        valueName: "量子点Pro 2023广色域",
      },
    ],
    skuSaleAttrValueList: [
      {
        saleAttrId: 201,
        saleAttrName: "屏幕尺寸",
        saleAttrValueId: 2001,
        saleAttrValueName: "55英寸",
      },
      {
        saleAttrId: 209,
        saleAttrName: "控光分区",
        saleAttrValueId: 2028,
        saleAttrValueName: "240级背光分区",
      },
    ],
  },
];

// 回收站：存放已软删除的SKU，额外记录删除时间 deleteTime
// 列表接口只读取 skuData，所以移入该数组的SKU会立刻从原列表消失
const deletedSkuData: Array<(typeof skuData)[number] & { deleteTime: string }> =
  [];

export default [
  // 回收站列表接口：返回 30 天内被软删除的SKU（按删除时间倒序）
  // 多带一层 recycle 路径：/api/admin/product/:page 会匹配任意单段路径，
  // 单段写法会被该通用路由抢先匹配
  {
    url: "/api/admin/product/recycle/deletedSkuList",
    method: "get",
    response: () => {
      const records = [...deletedSkuData].sort(
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
  // 恢复SKU接口：从回收站取回，重新放回原列表头部
  {
    url: "/api/admin/product/recycle/restoreSku",
    method: "put",
    permission: PERM.GOODS_SKU_WRITE,
    response: ({ body }) => {
      const restoreId = Number(body.id);
      const restoreIndex = deletedSkuData.findIndex(
        (item) => item.id === restoreId,
      );
      if (restoreIndex === -1) {
        return {
          code: 200,
          data: null,
          message: "恢复失败，回收站中不存在该SKU",
          ok: false,
        };
      }
      // 取出该SKU并去掉 deleteTime，恢复为普通SKU数据
      const [restored] = deletedSkuData.splice(restoreIndex, 1);
      delete (restored as Partial<typeof restored>).deleteTime;
      skuData.unshift(restored);
      return {
        code: 200,
        data: null,
        message: "恢复SKU成功",
        ok: true,
      };
    },
  },
  // 获取SKU分页列表接口
  {
    url: "/api/admin/product/list/:pageNo/:pageSize",
    method: "get",
    // 兼容路径params参数，和截图写法对齐
    response: ({ params }) => {
      const pageNo = Number(params?.pageNo ?? 1);
      const pageSize = Number(params?.pageSize ?? 10);
      // 分页截取数据
      const startIndex = (pageNo - 1) * pageSize;
      const endIndex = pageNo * pageSize;
      const records = skuData.slice(startIndex, endIndex);
      // 后端标准分页返回结构
      return {
        code: 200,
        message: "成功",
        data: {
          records,
          total: skuData.length,
          current: pageNo,
          size: pageSize,
          pages: Math.ceil(skuData.length / pageSize),
        },
        ok: true,
      };
    },
  },
  // 商品上架下架接口
  {
    url: "/api/admin/product/onSale/:skuId/:status",
    method: "put",
    permission: PERM.GOODS_SKU_WRITE,
    response: (ctx) => {
      // 兼容各种 mock 框架传参形式：优先取 ctx.params，其次 ctx.query，再退到 ctx.request
      const params =
        ctx?.params ||
        ctx?.query ||
        (ctx.request && (ctx.request.params || ctx.request.query)) ||
        {};
      // DEBUG: 打印 ctx 帮助排查问题
      try {
        console.log("[mock] onSale ctx:", ctx);
        console.log(
          "[mock] onSale received params:",
          params,
          "status type:",
          typeof params.status,
          "url:",
          ctx?.url,
        );
      } catch (e) {
        console.error("[mock] 打印 ctx 时出错", e);
      }

      // 如果从 ctx.* 未能取到 params（某些环境下 path 参数不会被解析），尝试从 url 回退解析
      let skuIdRaw = params.skuId;
      let statusRaw = params.status;
      if ((skuIdRaw === undefined || statusRaw === undefined) && ctx?.url) {
        const m = String(ctx.url).match(/onSale\/([^\/]+)\/([^\/?&]+)/);
        if (m) {
          skuIdRaw = skuIdRaw === undefined ? m[1] : skuIdRaw;
          statusRaw = statusRaw === undefined ? m[2] : statusRaw;
          console.log("[mock] parsed params from url:", {
            skuIdRaw,
            statusRaw,
          });
        }
      }
      // 解析路径参数（优先使用回退解析到的 skuIdRaw/statusRaw）
      const targetSkuId = Number(skuIdRaw);
      const saleStatus = Number(statusRaw);

      // 校验状态参数合法性：只能是0或1
      if (![0, 1].includes(saleStatus)) {
        return {
          code: 500,
          message: "状态参数错误，仅支持0(下架)、1(上架)",
          ok: false,
          data: null,
        };
      }

      // 查找对应SKU
      const targetSku = skuData.find((item) => item.id === targetSkuId);
      if (!targetSku) {
        return {
          code: 500,
          message: `未找到id为${targetSkuId}的SKU商品`,
          ok: false,
          data: null,
        };
      }

      // 修改上下架状态，同步更新更新时间
      targetSku.isSale = saleStatus;
      const now = new Date();
      targetSku.updateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      // 组装返回提示文案
      const tipText = saleStatus === 1 ? "商品上架成功" : "商品下架成功";
      return {
        code: 200,
        message: tipText,
        ok: true,
        data: targetSku, // 返回修改后的完整SKU数据
      };
    },
  },
  // 获取SKU详情接口
  {
    url: "/api/admin/product/getSkuInfo/:skuId",
    method: "get",
    response: (ctx) => {
      const params =
        ctx?.params ||
        ctx?.query ||
        (ctx.request && (ctx.request.params || ctx.request.query)) ||
        {};

      let skuIdRaw = params?.skuId;
      if (skuIdRaw === undefined && ctx?.url) {
        const m = String(ctx.url).match(/getSkuInfo\/([^\/?&]+)/);
        if (m) {
          skuIdRaw = m[1];
        }
      }

      const skuId = Number(skuIdRaw);
      if (!Number.isInteger(skuId)) {
        return {
          code: 500,
          message: "skuId参数错误",
          ok: false,
          data: null,
        };
      }

      const skuInfo = skuData.find((item) => item.id === skuId);
      if (!skuInfo) {
        return {
          code: 500,
          message: `不存在id为${skuId}的SKU商品`,
          ok: false,
          data: null,
        };
      }

      return {
        code: 200,
        message: "成功",
        ok: true,
        data: skuInfo,
      };
    },
  },
  // 删除已有SKU商品接口（软删除：移入回收站，30 天内可通过恢复接口取回）
  {
    url: "/api/admin/product/deleteSku/:skuId",
    method: "delete",
    permission: PERM.GOODS_SKU_WRITE,
    response: (ctx) => {
      const params =
        ctx?.params ||
        ctx?.query ||
        (ctx.request && (ctx.request.params || ctx.request.query)) ||
        {};

      let skuIdRaw = params.skuId;
      if (skuIdRaw === undefined && ctx?.url) {
        const m = String(ctx.url).match(/deleteSku\/([^\/]+)(?:\?|$)/);
        if (m) {
          skuIdRaw = m[1];
        }
      }

      const delId = Number(skuIdRaw);
      if (!Number.isInteger(delId)) {
        return {
          code: 500,
          message: "删除失败：skuId参数错误",
          ok: false,
          data: null,
        };
      }

      const delIndex = skuData.findIndex((item) => item.id === delId);

      if (delIndex === -1) {
        return {
          code: 500,
          message: `删除失败：不存在id=${delId}的SKU商品`,
          ok: false,
          data: null,
        };
      }

      // 从原列表移除，带上删除时间放进回收站，而不是直接销毁数据
      const [deleted] = skuData.splice(delIndex, 1);
      deletedSkuData.push({
        ...deleted,
        deleteTime: new Date().toISOString(),
      });

      return {
        code: 200,
        message: "SKU商品删除成功",
        ok: true,
        data: null,
      };
    },
  },
] as MockItem[];
