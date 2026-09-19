import { PERM } from "../../permission/codes";
import type { MockItem } from "../../adapter";
// 模拟SPU基础数据源
const spuData = [
  {
    id: 1,
    spuName: "小米14",
    description: "小米旗舰手机，骁龙8 Gen3",
    category3Id: 111,
    tmId: 2,
    spuSaleAttrList: [],
    spuImageList: [],
  },
  {
    id: 2,
    spuName: "iPhone 15",
    description: "苹果A16芯片",
    category3Id: 111,
    tmId: 1,
    spuSaleAttrList: [],
    spuImageList: [],
  },
  {
    id: 3,
    spuName: "荣耀Magic6",
    description: "鹰眼抓拍",
    category3Id: 111,
    tmId: 4,
    spuSaleAttrList: [],
    spuImageList: [],
  },
  {
    id: 4,
    spuName: "华为Pura70",
    description: "国产旗舰",
    category3Id: 111,
    tmId: 3,
    spuSaleAttrList: [],
    spuImageList: [],
  },
  {
    id: 5,
    spuName: "vivo S19",
    description: "人像拍照手机",
    category3Id: 111,
    tmId: 6,
    spuSaleAttrList: [],
    spuImageList: [],
  },
  {
    id: 6,
    spuName: "OPPO Find X7",
    description: "天玑9300",
    category3Id: 111,
    tmId: 5,
    spuSaleAttrList: [],
    spuImageList: [],
  },
];
// 回收站：存放已软删除的SPU，额外记录删除时间 deleteTime
// 列表接口只读取 spuData，所以移入该数组的SPU会立刻从原列表消失
const deletedSpuData: Array<( typeof spuData )[ number ] & { deleteTime: string }> =
  [];

// 全部品牌数据
const tmData = [
  {
    id: 27331,
    tmName: "再来只猫",
    logoUrl: "http://139.198.127.41:9000/sph/20230419/_DSC2318.JPG",
  },
  {
    id: 27330,
    tmName: "asDXA",
    logoUrl:
      "http://139.198.127.41:9000/sph/20230419/rBHu8mHmKC6AQ-j2AAAb72A3E00942.jpg",
  },
  { id: 27329, tmName: "vd", logoUrl: "" },
  {
    id: 27327,
    tmName: "小米",
    logoUrl: "http://139.198.127.41:9000/sph/logo/xiaomi.jpg",
  },
  {
    id: 27326,
    tmName: "华为",
    logoUrl: "http://139.198.127.41:9000/sph/logo/huawei.jpg",
  },
  {
    id: 27325,
    tmName: "苹果",
    logoUrl: "http://139.198.127.41:9000/sph/logo/apple.jpg",
  },
  {
    id: 27324,
    tmName: "三星",
    logoUrl: "http://139.198.127.41:9000/sph/logo/samsung.jpg",
  },
  {
    id: 27323,
    tmName: "耐克",
    logoUrl: "http://139.198.127.41:9000/sph/logo/nike.jpg",
  },
  {
    id: 27322,
    tmName: "阿迪达斯",
    logoUrl: "http://139.198.127.41:9000/sph/logo/adidas.jpg",
  },
  {
    id: 27321,
    tmName: "李宁",
    logoUrl: "http://139.198.127.41:9000/sph/logo/lining.jpg",
  },
  {
    id: 27320,
    tmName: "安踏",
    logoUrl: "http://139.198.127.41:9000/sph/logo/anta.jpg",
  },
  {
    id: 27319,
    tmName: "戴尔",
    logoUrl: "http://139.198.127.41:9000/sph/logo/dell.jpg",
  },
  {
    id: 27318,
    tmName: "联想",
    logoUrl: "http://139.198.127.41:9000/sph/logo/lenovo.jpg",
  },
  {
    id: 27317,
    tmName: "索尼",
    logoUrl: "http://139.198.127.41:9000/sph/logo/sony.jpg",
  },
  {
    id: 27316,
    tmName: "罗技",
    logoUrl: "http://139.198.127.41:9000/sph/logo/logitech.jpg",
  },
];
// 商品品牌图片
const spuImgData = [
  {
    id: 101,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 1,
    imgName: "xiaomi14_01.png",
    imgUrl: "https://picsum.photos/id/1/300/300",
  },
  {
    id: 102,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 1,
    imgName: "xiaomi14_02.png",
    imgUrl: "https://picsum.photos/id/2/300/300",
  },
  // spuId=2 iPhone15图片
  {
    id: 201,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 2,
    imgName: "iphone15_01.png",
    imgUrl: "https://picsum.photos/id/3/300/300",
  },
  // spuId=3 荣耀Magic6图片
  {
    id: 301,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 3,
    imgName: "magic6_01.png",
    imgUrl: "https://picsum.photos/id/4/300/300",
  },
  // spuId=4 华为Pura70图片
  {
    id: 401,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 4,
    imgName: "pura70_01.png",
    imgUrl: "https://picsum.photos/id/5/300/300",
  },
  // spuId=5 vivo S19图片
  {
    id: 501,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 5,
    imgName: "vivos19_01.png",
    imgUrl: "https://picsum.photos/id/6/300/300",
  },
  // spuId=6 OPPO Find X7图片
  {
    id: 601,
    createTime: "2023-04-19 11:30:50",
    updateTime: "2023-04-19 11:30:50",
    spuId: 6,
    imgName: "findx7_01.png",
    imgUrl: "https://picsum.photos/id/7/300/300",
  },
];
const saleAttrData = [
  // 适配小米14 spuId=1
  {
    id: 1,
    baseSaleAttrId: 1,
    saleAttrName: "机身颜色",
    targetSpuId: 1,
    spuSaleAttrValueList: [
      { id: 1001, saleAttrValueName: "曜石黑" },
      { id: 1002, saleAttrValueName: "雪山白" },
      { id: 1003, saleAttrValueName: "旷野绿" },
    ],
  },
  {
    id: 2,
    baseSaleAttrId: 2,
    saleAttrName: "运行内存",
    targetSpuId: 1,
    spuSaleAttrValueList: [
      { id: 1004, saleAttrValueName: "12GB" },
      { id: 1005, saleAttrValueName: "16GB" },
      { id: 1006, saleAttrValueName: "24GB" },
    ],
  },
  {
    id: 3,
    baseSaleAttrId: 3,
    saleAttrName: "机身存储",
    targetSpuId: 1,
    spuSaleAttrValueList: [
      { id: 1007, saleAttrValueName: "256G" },
      { id: 1008, saleAttrValueName: "512G" },
      { id: 1009, saleAttrValueName: "1TB" },
    ],
  },

  // 适配iPhone 15 spuId=2
  {
    id: 4,
    baseSaleAttrId: 4,
    saleAttrName: "苹果配色",
    targetSpuId: 2,
    spuSaleAttrValueList: [
      { id: 2001, saleAttrValueName: "星光色" },
      { id: 2002, saleAttrValueName: "蓝色" },
      { id: 2003, saleAttrValueName: "粉色" },
    ],
  },
  {
    id: 5,
    baseSaleAttrId: 5,
    saleAttrName: "网络版本",
    targetSpuId: 2,
    spuSaleAttrValueList: [
      { id: 2004, saleAttrValueName: "5G全网通" },
      { id: 2005, saleAttrValueName: "美版无锁" },
      { id: 2006, saleAttrValueName: "港版双卡" },
    ],
  },
  {
    id: 6,
    baseSaleAttrId: 6,
    saleAttrName: "存储容量",
    targetSpuId: 2,
    spuSaleAttrValueList: [
      { id: 2007, saleAttrValueName: "128G" },
      { id: 2008, saleAttrValueName: "256G" },
      { id: 2009, saleAttrValueName: "512G" },
    ],
  },

  // 适配荣耀Magic6 spuId=3
  {
    id: 7,
    baseSaleAttrId: 7,
    saleAttrName: "后盖材质",
    targetSpuId: 3,
    spuSaleAttrValueList: [
      { id: 3001, saleAttrValueName: "素皮黑" },
      { id: 3002, saleAttrValueName: "玻璃银" },
      { id: 3003, saleAttrValueName: "陶瓷白" },
    ],
  },
  {
    id: 8,
    baseSaleAttrId: 8,
    saleAttrName: "屏幕规格",
    targetSpuId: 3,
    spuSaleAttrValueList: [
      { id: 3004, saleAttrValueName: "直屏版" },
      { id: 3005, saleAttrValueName: "曲面屏" },
      { id: 3006, saleAttrValueName: "折叠大屏" },
    ],
  },

  // 适配华为Pura70 spuId=4
  {
    id: 9,
    baseSaleAttrId: 9,
    saleAttrName: "镜头规格",
    targetSpuId: 4,
    spuSaleAttrValueList: [
      { id: 4001, saleAttrValueName: "5000万主摄" },
      { id: 4002, saleAttrValueName: "长焦三摄" },
      { id: 4003, saleAttrValueName: "Ultra四摄" },
    ],
  },
  {
    id: 10,
    baseSaleAttrId: 10,
    saleAttrName: "鸿蒙版本",
    targetSpuId: 4,
    spuSaleAttrValueList: [
      { id: 4004, saleAttrValueName: "鸿蒙4.0" },
      { id: 4005, saleAttrValueName: "鸿蒙4.2" },
      { id: 4006, saleAttrValueName: "鸿蒙5.0" },
    ],
  },

  // 适配vivo S19 spuId=5
  {
    id: 11,
    baseSaleAttrId: 11,
    saleAttrName: "人像滤镜",
    targetSpuId: 5,
    spuSaleAttrValueList: [
      { id: 5001, saleAttrValueName: "原生人像" },
      { id: 5002, saleAttrValueName: "柔光胶片" },
      { id: 5003, saleAttrValueName: "冷调清透" },
    ],
  },
  {
    id: 12,
    baseSaleAttrId: 12,
    saleAttrName: "充电功率",
    targetSpuId: 5,
    spuSaleAttrValueList: [
      { id: 5004, saleAttrValueName: "80W快充" },
      { id: 5005, saleAttrValueName: "120W快充" },
      { id: 5006, saleAttrValueName: "200W闪充" },
    ],
  },

  // 适配OPPO Find X7 spuId=6
  {
    id: 13,
    baseSaleAttrId: 13,
    saleAttrName: "处理器版本",
    targetSpuId: 6,
    spuSaleAttrValueList: [
      { id: 6001, saleAttrValueName: "天玑9300" },
      { id: 6002, saleAttrValueName: "天玑9300+" },
      { id: 6003, saleAttrValueName: "骁龙8 Gen4" },
    ],
  },
  {
    id: 14,
    baseSaleAttrId: 14,
    saleAttrName: "影像套装",
    targetSpuId: 6,
    spuSaleAttrValueList: [
      { id: 6004, saleAttrValueName: "普通主摄" },
      { id: 6005, saleAttrValueName: "哈苏标准版" },
      { id: 6006, saleAttrValueName: "哈苏大师版" },
    ],
  },

  // 通用公共销售属性（所有spu都能使用）targetSpuId=0
  {
    id: 15,
    baseSaleAttrId: 15,
    saleAttrName: "质保年限",
    targetSpuId: 0,
    spuSaleAttrValueList: [
      { id: 9001, saleAttrValueName: "1年质保" },
      { id: 9002, saleAttrValueName: "2年延保" },
      { id: 9003, saleAttrValueName: "3年全保" },
    ],
  },
  {
    id: 16,
    baseSaleAttrId: 16,
    saleAttrName: "套餐版本",
    targetSpuId: 0,
    spuSaleAttrValueList: [
      { id: 9004, saleAttrValueName: "单机版" },
      { id: 9005, saleAttrValueName: "充电套装" },
      { id: 9006, saleAttrValueName: "全家配件包" },
    ],
  },
];
// sku数据
const skuData = [
  {
    id: 37,
    spuId: 1, // 小米14 spuId=1
    tmId: 2,
    price: 1222,
    weight: "190.00",
    skuName: "小米14 12+256G 黑色",
    skuDesc: "小米骁龙8 Gen3旗舰",
    skuDefaultImg: "https://picsum.photos/id/10/300/300",
    isSale: 0,
    skuAttrValueList: null,
    skuSaleAttrValueList: null,
    skuImageList: null,
    createTime: "2023-04-21 11:14:41",
    updateTime: "2023-04-21 11:14:41",
  },
  {
    id: 38,
    spuId: 1,
    tmId: 2,
    price: 1499,
    weight: "190.00",
    skuName: "小米14 16+512G 白色",
    skuDesc: "小米骁龙8 Gen3旗舰",
    skuDefaultImg: "https://picsum.photos/id/11/300/300",
    isSale: 0,
    skuAttrValueList: null,
    skuSaleAttrValueList: null,
    skuImageList: null,
    createTime: "2023-04-21 11:15:20",
    updateTime: "2023-04-21 11:15:20",
  },
  {
    id: 39,
    spuId: 2, // iPhone15 spuId=2
    tmId: 1,
    price: 4999,
    weight: "173.00",
    skuName: "iPhone15 128G 粉色",
    skuDesc: "苹果A16芯片",
    skuDefaultImg: "https://picsum.photos/id/12/300/300",
    isSale: 0,
    skuAttrValueList: null,
    skuSaleAttrValueList: null,
    skuImageList: null,
    createTime: "2023-04-21 11:16:10",
    updateTime: "2023-04-21 11:16:10",
  },
  {
    id: 40,
    spuId: 4, // 华为Pura70 spuId=4
    tmId: 3,
    price: 5499,
    weight: "185.00",
    skuName: "华为Pura70 12+512G 青山黛",
    skuDesc: "国产旗舰",
    skuDefaultImg: "https://picsum.photos/id/13/300/300",
    isSale: 0,
    skuAttrValueList: null,
    skuSaleAttrValueList: null,
    skuImageList: null,
    createTime: "2023-04-21 11:17:44",
    updateTime: "2023-04-21 11:17:43",
  },
  {
    id: 41,
    spuId: 6, // OPPO Find X7 spuId=6
    tmId: 5,
    price: 6999,
    weight: "182.00",
    skuName: "OPPO Find X7 16+1TB 海阔天空",
    skuDesc: "天玑9300",
    skuDefaultImg: "https://picsum.photos/id/14/300/300",
    isSale: 0,
    skuAttrValueList: null,
    skuSaleAttrValueList: null,
    skuImageList: null,
    createTime: "2023-04-21 11:17:44",
    updateTime: "2023-04-21 11:17:43",
  },
];

// 和截图分类接口格式保持一致，统一导出数组
export default [
  // 回收站列表接口：返回 30 天内被软删除的SPU（按删除时间倒序）
  // 多带一层 recycle 路径：/api/admin/product/:page 会匹配任意单段路径，
  // 单段写法会被该通用路由抢先匹配
  {
    url: "/api/admin/product/recycle/deletedSpuList",
    method: "get",
    response: () =>
    {
      const records = [ ...deletedSpuData ].sort(
        ( a, b ) =>
          new Date( b.deleteTime ).getTime() - new Date( a.deleteTime ).getTime(),
      );
      return {
        code: 200,
        data: records,
        message: "操作成功",
        ok: true,
      };
    },
  },
  // 恢复SPU接口：从回收站取回，重新放回原列表头部
  {
    url: "/api/admin/product/recycle/restoreSpu",
    method: "put",
    permission: PERM.GOODS_SPU_WRITE,
    response: ( { body } ) =>
    {
      const restoreId = Number( body.id );
      const restoreIndex = deletedSpuData.findIndex(
        ( item ) => item.id === restoreId,
      );
      if ( restoreIndex === -1 )
      {
        return {
          code: 200,
          data: null,
          message: "恢复失败，回收站中不存在该SPU",
          ok: false,
        };
      }
      // 取出该SPU并去掉 deleteTime，恢复为普通SPU数据
      const [ restored ] = deletedSpuData.splice( restoreIndex, 1 );
      delete ( restored as Partial<typeof restored> ).deleteTime;
      spuData.unshift( restored );
      return {
        code: 200,
        data: null,
        message: "恢复SPU成功",
        ok: true,
      };
    },
  },
  // 根据spuId获取对应sku列表接口
  {
    url: "/api/admin/product/getSkuListBySpuId",
    method: "get",
    // 前端通过 query/params 传 spuId，mock 这里兼容两种写法
    response: ( { query, params } ) =>
    {
      const spuId = Number( query?.spuId ?? params?.spuId );
      const targetSkuList = skuData.filter( ( item ) => item.spuId === spuId );
      return {
        code: 200,
        message: "成功",
        data: targetSkuList,
        ok: true,
      };
    },
  },
  // 获取SKU分页列表接口
  {
    url: "/api/admin/product/list",
    method: "get",
    response: ( { query } ) =>
    {
      const page = Number( query.page || 1 );
      const pageSize = Number( query.pageSize || 6 );
      const startIndex = ( page - 1 ) * pageSize;
      const records = skuData.slice( startIndex, startIndex + pageSize );
      return {
        code: 200,
        data: {
          records,
          total: skuData.length,
        },
        msg: "success",
        ok: true,
      };
    },
  },
  // 获取SPU分页列表接口
  {
    url: "/api/admin/product/:page",
    method: "get",
    response: ( { query, url } ) =>
    {
      // 路径参数：当前页码（vite-plugin-mock 不传 params，需从 url 解析）
      const page = Number( url?.match( /\/product\/(\d+)/ )?.[ 1 ] || 1 );
      // 查询参数：三级分类id、品牌id
      const category3Id = query.category3Id ? Number( query.category3Id ) : null;
      const tmId = query.tmId ? Number( query.tmId ) : null;
      const pageSize = query.pageSize ? Number( query.pageSize ) : 3;

      // 过滤数据
      let filterData = [ ...spuData ];
      if ( category3Id )
      {
        filterData = filterData.filter(
          ( item ) => item.category3Id === category3Id,
        );
      }
      if ( tmId )
      {
        filterData = filterData.filter( ( item ) => item.tmId === tmId );
      }

      // 分页切割
      const total = filterData.length;
      const pages = Math.ceil( total / pageSize );
      const startIndex = ( page - 1 ) * pageSize;
      const records = filterData.slice( startIndex, startIndex + pageSize );

      return {
        code: 200,
        data: {
          ok: true,
          records,
          total,
          size: pageSize,
          current: page,
          searchCount: true,
          pages,
        },
        msg: "success",
        ok: true,
      };
    },
  },
  // 获取全部品牌
  {
    url: "/api/admin/product/baseTrademark/getTrademarkList",
    method: "get",
    response: () =>
    {
      // 直接返回全部品牌数组（无分页、无筛选，对应swagger返回格式）
      return {
        code: 200,
        data: tmData,
      };
    },
  },
  // 获取品牌图片
  {
    // 接口地址规范：路径传参spuId，后端标准写法
    url: "/api/admin/product/spuImageList/:spuId",
    method: "get",
    response: ( { url } ) =>
    {
      // 从url提取路径参数spuId
      const spuId = Number( url.match( /\/spuImageList\/(\d+)/ )?.[ 1 ] );
      // 过滤出当前spu对应的所有图片
      const targetImgList = spuImgData.filter( ( item ) => item.spuId === spuId );
      // 返回结构和图一Response格式完全匹配 {code:200, data: SpuImg[]}
      return {
        code: 200,
        data: targetImgList,
      };
    },
  },
  // 根据spuId获取对应销售属性接口
  {
    url: "/api/admin/product/baseSaleAttrList/:spuId",
    method: "get",
    response: ( { url } ) =>
    {
      // 截取路径上的spuId
      const spuId = Number( url.match( /\/baseSaleAttrList\/(\d+)/ )?.[ 1 ] );
      // 只返回当前 SPU 自己对应的销售属性，避免新增/编辑时自动带出默认通用属性
      const filterAttrList = saleAttrData.filter(
        ( item ) => item.targetSpuId === spuId,
      );
      return {
        code: 200,
        message: "成功",
        data: filterAttrList,
        ok: true,
      };
    },
  },
  // 新增SPU接口 POST
  {
    url: "/api/admin/product/saveSpuInfo",
    method: "post",
    permission: PERM.GOODS_SPU_WRITE,
    response: ( { body } ) =>
    {
      // body 是前端提交的SpuData，无id
      const newSpu: SpuData = {
        ...body,
        id: Date.now(), // mock生成唯一id
      };
      spuData.push( newSpu );
      if ( body.spuSaleAttrList?.length )
      {
        body.spuSaleAttrList.forEach( ( attrItem ) =>
        {
          const existingAttr = saleAttrData.find(
            ( item ) =>
              item.targetSpuId === newSpu.id &&
              item.saleAttrName === attrItem.saleAttrName,
          );
          if ( existingAttr )
          {
            existingAttr.spuSaleAttrValueList =
              attrItem.spuSaleAttrValueList || [];
          } else
          {
            saleAttrData.push( {
              ...attrItem,
              id: Date.now() + Math.random(),
              baseSaleAttrId: attrItem.baseSaleAttrId || 0,
              targetSpuId: newSpu.id,
            } );
          }
        } );
      }
      return {
        code: 200,
        // 返回新建记录，便于调用方（含知识库增量同步）拿到稳定主键
        data: newSpu,
        message: "新增SPU成功",
        ok: true,
      };
    },
  },

  // 更新已有SPU接口 POST
  {
    url: "/api/admin/product/updateSpuInfo",
    method: "post",
    permission: PERM.GOODS_SPU_WRITE,
    response: ( { body } ) =>
    {
      // body直接等于post里的第二个参数，所有传值时data外不能加{}
      // body 携带完整SpuData（包含id）
      const targetId = body.id;
      const index = spuData.findIndex( ( item ) => item.id === targetId );
      if ( index !== -1 )
      {
        spuData[ index ] = body;
        const currentSaleAttrList = saleAttrData.filter(
          ( item ) => item.targetSpuId !== targetId,
        );
        saleAttrData.splice( 0, saleAttrData.length, ...currentSaleAttrList );
        body.spuSaleAttrList?.forEach( ( attrItem ) =>
        {
          saleAttrData.push( {
            ...attrItem,
            id: attrItem.id || Date.now() + Math.random(),
            baseSaleAttrId: attrItem.baseSaleAttrId || 0,
            targetSpuId: targetId,
          } );
        } );
        return {
          code: 200,
          data: null,
          message: "更新SPU成功",
          ok: true,
        };
      } else
      {
        return {
          code: 201,
          data: null,
          message: "未找到对应SPU，更新失败",
          ok: false,
        };
      }
    },
  },
  // 新增SKU接口 POST
  {
    url: "/api/admin/product/saveSkuInfo",
    method: "post",
    permission: PERM.GOODS_SKU_WRITE,
    response: ( { body } ) =>
    {
      const maxId = skuData.length
        ? Math.max( ...skuData.map( ( item ) => item.id ) )
        : 0;
      const newSku = {
        id: maxId + 1,
        ...body,
      };
      skuData.push( newSku );
      return {
        code: 200,
        message: "新增SKU成功",
        // 返回新建记录，便于调用方（含知识库增量同步）拿到稳定主键
        data: newSku,
        ok: true,
      };
    },
  },
  // 更新SKU接口 PUT（按 id 就地修改，不新增记录）
  {
    url: "/api/admin/product/updateSkuInfo",
    method: "put",
    permission: PERM.GOODS_SKU_WRITE,
    response: ( { body } ) =>
    {
      const formData = ( body ?? {} ) as {
        id?: number;
        skuName?: string;
        price?: number;
        weight?: string;
        skuDesc?: string;
        skuDefaultImg?: string;
      };
      const { id } = formData;
      if ( !id )
      {
        return { code: 500, message: "更新失败：id不能为空", ok: false, data: null };
      }
      const index = skuData.findIndex( ( item ) => item.id === id );
      if ( index === -1 )
      {
        return {
          code: 500,
          message: `更新失败：不存在id=${ id } 的SKU商品`,
          ok: false,
          data: null,
        };
      }
      const target = skuData[ index ] as Record<string, unknown>;
      // 只覆盖提交上来的字段，未提交的保持原值
      const editableFields = [ "skuName", "price", "weight", "skuDesc", "skuDefaultImg" ];
      editableFields.forEach( ( field ) =>
      {
        if ( formData[ field as keyof typeof formData ] !== undefined )
        {
          target[ field ] = formData[ field as keyof typeof formData ];
        }
      } );
      // 价格与重量属于「非法输入拦截」范围，后端也兜一道，负数直接拒
      const price = Number( target.price );
      const weight = Number( target.weight );
      if ( Number.isNaN( price ) || price < 0 )
      {
        return { code: 500, message: "价格不能为负数", ok: false, data: null };
      }
      if ( Number.isNaN( weight ) || weight < 0 )
      {
        return { code: 500, message: "重量不能为负数", ok: false, data: null };
      }
      target.updateTime = new Date().toISOString();
      return {
        code: 200,
        message: "修改SKU成功",
        data: target,
        ok: true,
      };
    },
  },
  // 删除SPU接口（软删除：移入回收站，30 天内可通过恢复接口取回）
  {
    url: "/api/admin/product/deleteSpu",
    method: "delete",
    permission: PERM.GOODS_SPU_WRITE,
    response: ( { query, params } ) =>
    {
      // 兼容 query 或 params 传参
      const delSpuId = Number( query?.id ?? params?.id );
      const delIndex = spuData.findIndex( ( item ) => item.id === delSpuId );
      if ( delIndex === -1 )
      {
        return {
          code: 200,
          data: null,
          message: "删除失败，不存在该SPU",
          ok: false,
        };
      }
      // 从原列表移除，带上删除时间放进回收站，而不是直接销毁数据
      const [ deleted ] = spuData.splice( delIndex, 1 );
      deletedSpuData.push( {
        ...deleted,
        deleteTime: new Date().toISOString(),
      } );
      return {
        code: 200,
        data: null,
        message: "删除SPU成功",
        ok: true,
      };
    },
  },
] as MockItem[];
