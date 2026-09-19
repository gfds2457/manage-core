import { PERM } from "../../permission/codes";
// 原文件依赖 vite-plugin-mock 的 MockMethod 类型，迁移到独立后端后
// 复用 adapter 中定义的 MockItem 接口（与 registerMocks 的入参类型一致）
import type { MockItem } from "../../adapter";
type MockMethod = MockItem;

// 模拟10条品牌数据
const trademarkList = [
  {
    id: 1,
    tmName: "小米",
    logoUrl: "https://picsum.photos/id/1/100/40",
  },
  {
    id: 2,
    tmName: "苹果",
    logoUrl: "https://picsum.photos/id/2/100/40",
  },
  {
    id: 3,
    tmName: "华为",
    logoUrl: "https://picsum.photos/id/3/100/40",
  },
  {
    id: 4,
    tmName: "OPPO",
    logoUrl: "https://picsum.photos/id/4/100/40",
  },
  {
    id: 5,
    tmName: "vivo",
    logoUrl: "https://picsum.photos/id/5/100/40",
  },
  {
    id: 6,
    tmName: "三星",
    logoUrl: "https://picsum.photos/id/6/100/40",
  },
  {
    id: 7,
    tmName: "荣耀",
    logoUrl: "https://picsum.photos/id/7/100/40",
  },
  {
    id: 8,
    tmName: "一加",
    logoUrl: "https://picsum.photos/id/8/100/40",
  },
  {
    id: 9,
    tmName: "realme真我",
    logoUrl: "https://picsum.photos/id/9/100/40",
  },
  {
    id: 10,
    tmName: "魅族",
    logoUrl: "https://picsum.photos/id/10/100/40",
  },
];

// 回收站：存放已软删除的品牌，额外记录删除时间 deleteTime
// 列表接口只读取 trademarkList，所以移入数组的品牌会立刻从原列表消失
const deletedTrademarkList: Array<{
  id: number;
  tmName: string;
  logoUrl: string;
  deleteTime: string;
}> = [];

export default [
  // 回收站列表接口：返回 30 天内被软删除的品牌（按删除时间倒序）
  // 必须放在 /api/product/baseTrademark 之前，避免被通用路由抢先匹配
  {
    url: "/api/product/baseTrademark/deleted",
    method: "get",
    response: () =>
    {
      const records = [ ...deletedTrademarkList ].sort(
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
  // 恢复品牌接口：从回收站取回，重新放回原列表头部
  {
    url: "/api/product/baseTrademark/restore",
    method: "put",
    permission: PERM.GOODS_BRAND_WRITE,
    response: ( { body } ) =>
    {
      const restoreId = Number( body.id );
      const restoreIndex = deletedTrademarkList.findIndex(
        ( item ) => item.id === restoreId,
      );
      if ( restoreIndex === -1 )
      {
        return {
          code: 200,
          data: null,
          message: "恢复失败，回收站中不存在该品牌",
          ok: false,
        };
      }
      // 取出该品牌并去掉 deleteTime，恢复为普通品牌数据
      const [ restored ] = deletedTrademarkList.splice( restoreIndex, 1 );
      trademarkList.unshift( {
        id: restored.id,
        tmName: restored.tmName,
        logoUrl: restored.logoUrl,
      } );
      return {
        code: 200,
        data: null,
        message: "恢复品牌成功",
        ok: true,
      };
    },
  },
  // 获取品牌信息接口
  {
    // 品牌分页查询接口，和后端规范对齐
    url: "/api/product/baseTrademark",
    method: "get",
    response: ( { query } ) =>
    {
      // 接收分页参数 pageNum / pageSize
      const pageNum = Number( query.pageNum ) || 1;
      const pageSize = Number( query.pageSize ) || 3;

      // 分页截取数据
      const start = ( pageNum - 1 ) * pageSize;
      const end = pageNum * pageSize;
      const records = trademarkList.slice( start, end );

      return {
        code: 200,
        data: {
          records, // 当前页品牌列表
          total: trademarkList.length, // 总条数10
          size: pageSize,
          current: pageNum,
          pages: Math.ceil( trademarkList.length / pageSize ),
        },
        message: "操作成功",
        ok: true,
      };
    },
  },
  // 新增品牌信息接口
  {
    url: "/api/product/baseTrademark/save",
    method: "post",
    permission: PERM.GOODS_BRAND_WRITE,
    response: ( { body } ) =>
    {
      // body 接收前端传递的品牌对象 { tmName, logoUrl }
      const newBrand = {
        id: Date.now(), // 模拟自增主键id，真实后端数据库自增
        tmName: body.tmName,
        logoUrl: body.logoUrl,
      };
      // 把新增品牌插入模拟数组头部
      trademarkList.unshift( newBrand );
      return {
        code: 200,
        // 返回新建记录，便于调用方（含知识库增量同步）拿到稳定主键
        data: newBrand,
        message: "新增品牌成功",
        ok: true,
      };
    },
  },
  // 修改品牌信息接口
  {
    url: "/api/product/baseTrademark/update",
    method: "put",
    permission: PERM.GOODS_BRAND_WRITE,
    response: ( { body } ) =>
    {
      // body 完整品牌对象 { id, tmName, logoUrl }
      // 找到需要修改的品牌下标
      const targetIndex = trademarkList.findIndex(
        ( item ) => item.id === body.id,
      );
      if ( targetIndex !== -1 )
      {
        // 覆盖原有数据，完成修改
        trademarkList[ targetIndex ] = {
          ...trademarkList[ targetIndex ],
          tmName: body.tmName,
          logoUrl: body.logoUrl,
        };
      }

      return {
        code: 200,
        data: null,
        message: "修改品牌成功",
        ok: true,
      };
    },
  },
  // 上传品牌logo图片接口
  {
    url: "/api/product/upload",
    method: "post",
    public: true,
    response: () =>
    {
      // 固定模拟线上图片地址，每次生成不同链接
      const imgUrl = `https://picsum.photos/id/${ Math.floor( Math.random() * 100 ) }/200/200`;
      return {
        code: 200,
        data: imgUrl,
        message: "图片上传成功",
        ok: true,
      };
    },
  },
  // 删除品牌接口（软删除：移入回收站，30 天内可通过恢复接口取回）
  {
    url: "/api/product/baseTrademark",
    method: "delete",
    permission: PERM.GOODS_BRAND_WRITE,
    response: ( { body } ) =>
    {
      // 改为解构body
      const delId = Number( body.id );
      const delIndex = trademarkList.findIndex( ( item ) => item.id === delId );
      if ( delIndex === -1 )
      {
        return {
          code: 200,
          data: null,
          message: "删除失败，不存在该品牌",
          ok: false,
        };
      }
      // 从原列表移除，带上删除时间放进回收站，而不是直接销毁数据
      const [ deleted ] = trademarkList.splice( delIndex, 1 );
      deletedTrademarkList.push( {
        ...deleted,
        deleteTime: new Date().toISOString(),
      } );
      return {
        code: 200,
        data: null,
        message: "删除品牌成功",
        ok: true,
      };
    },
  },
] as MockMethod[];
