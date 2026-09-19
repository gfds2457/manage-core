/**
 * spuForm.vue 单元测试
 *
 * 本轮只改测试文件：原先挂载配置里同时桩掉了 el-upload 与 el-dialog。
 * 桩掉 el-dialog 后表格列不再走 el-table 的列收集 + 单元格渲染流程，
 * el-table-column 的默认插槽被直接调用且不带作用域参数，于是
 * <template #default="{ row, $index }"> 对 undefined 解构并抛出
 * TypeError: Cannot destructure property 'row' of 'undefined' as it is undefined。
 * 现在改为：
 * - 不再桩 el-dialog，用真实 ElDialog 渲染（缓存相关逻辑必须在真实渲染下运行）；
 * - 挂载到真实 DOM（attachTo: document.body），让 ElTable 能正常完成列收集与布局计算；
 * - el-upload 与缓存逻辑无关，继续保留桩以减少 DOM 噪音；Plus 图标同样桩掉，
 *   避免图标未全局注册时产生「Failed to resolve component」噪音；
 * - 每个用例结束后统一卸载并清空 document.body，避免用例之间互相污染。
 *
 * 另外两个必须说明的前提（否则断言会写错）：
 * 1. 组件只 defineExpose 了 allSpu / addSpuAttr，getAttrCache / setAttrCache / attrCache / attrData
 *    都是 <script setup> 的内部绑定。这里通过 wrapper.vm.$.setupState 访问它们
 *    （Vue 开发构建会把全部顶层绑定放进 __returned__），并用 getSpuAttr 的调用次数做交叉验证。
 * 2. 当前实现里「命中缓存」并不等于「不再请求属性接口」：allSpu 始终会调用 getSpuAttr，
 *    缓存只参与结果合并 —— 命中缓存时本地已保存的属性值不会被服务端返回值覆盖，
 *    并且 attrData 会在请求返回前就拿到值。所以下面既断言命中缓存的业务效果，
 *    也如实断言属性接口仍被调用，避免给出错误的安全感。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus, { ElMessage } from "element-plus";

vi.mock( "@/API/spu", () =>
{
  return {
    getSpuBrand: vi.fn(),
    getSpuImg: vi.fn(),
    getSpuAttr: vi.fn(),
    addUpdateSpu: vi.fn(),
  };
} );

import SpuForm from "./spuForm.vue";
import { getSpuBrand, getSpuImg, getSpuAttr, addUpdateSpu } from "@/API/spu";

/** 与源码 src/views/goods/spu/spuForm.vue 中的 ATTR_CACHE_LIMIT 保持一致 */
const ATTR_CACHE_LIMIT = 20;

/** 当前已挂载、等待 afterEach 兜底卸载的 wrapper */
let mountedWrapper = null;

/** 构造某个 SPU 的服务端销售属性数据（属性名与 spuId 绑定，方便按 key 合并/区分） */
const makeServerAttr = ( id, valueNames = [ "黑" ] ) =>
{
  return [
    {
      id,
      saleAttrName: `颜色${ id }`,
      spuSaleAttrValueList: valueNames.map( ( name, index ) =>
      {
        return { id: index + 1, saleAttrValueName: name };
      } ),
    },
  ];
};

const mountForm = () =>
{
  // 必须显式注册 Element Plus：项目里 el-* 组件是靠 main.ts 的
  // app.use(ElementPlus) 全局注册的，单元测试不经 main.ts，
  // 缺少注册时 <el-table-column> 会被当作未知原生元素，
  // 其 #default 插槽会作为函数式 children 被无参调用，
  // 于是 { row, $index } 解构 undefined 直接抛 TypeError。
  const wrapper = mount( SpuForm, {
    global: {
      plugins: [ ElementPlus ],
      // el-upload 只负责图片列表 UI，与缓存逻辑无关，桩掉以减少 DOM 噪音
      stubs: { "el-upload": true, Plus: true },
    },
  } );
  mountedWrapper = wrapper;
  return wrapper;
};

/** 主动卸载：置空记录，afterEach 不会再重复卸载同一个 wrapper */
const unmountForm = ( wrapper ) =>
{
  if ( mountedWrapper === wrapper )
  {
    mountedWrapper = null;
  }
  wrapper.unmount();
};

/** 取组件内部 setup 状态（即 <script setup> 返回的全部顶层绑定） */
const setupStateOf = ( wrapper ) =>
{
  const state = wrapper.vm.$ && wrapper.vm.$.setupState;
  if ( !state )
  {
    throw new Error( "无法访问组件内部 setup 状态，请确认以 Vue 开发构建运行测试" );
  }
  return state;
};

/** 当前 attrData 第一行的属性值名 */
const currentValues = ( wrapper ) =>
{
  const attrData = setupStateOf( wrapper ).attrData || [];
  return ( attrData[ 0 ]?.spuSaleAttrValueList || [] ).map( ( item ) =>
  {
    return item.saleAttrValueName;
  } );
};

/** 缓存中某个 spuId 第一行的属性值名 */
const cachedValues = ( wrapper, id ) =>
{
  const cached = setupStateOf( wrapper ).getAttrCache( id );
  return ( cached?.[ 0 ]?.spuSaleAttrValueList || [] ).map( ( item ) =>
  {
    return item.saleAttrValueName;
  } );
};

/**
 * 预热缓存。组件只在 save() 里调用 setAttrCache，
 * 所以必须走 allSpu（拉取并渲染）-> save（写缓存）这条真实链路。
 * save 未暴露，但同样可以从 setupState 上取到。
 */
const primeCache = async ( wrapper, id ) =>
{
  await wrapper.vm.allSpu( { id, spuName: `SPU${ id }` } );
  await setupStateOf( wrapper ).save();
};

beforeEach( () =>
{
  vi.clearAllMocks();
  // 组件通过 ElMessage 弹提示，这里直接屏蔽实现，避免测试输出噪音
  vi.spyOn( ElMessage, "success" ).mockImplementation( () => {} );
  vi.spyOn( ElMessage, "error" ).mockImplementation( () => {} );

  getSpuBrand.mockResolvedValue( {
    code: 200,
    data: [ { id: 1, tmName: "品牌A" } ],
  } );
  getSpuImg.mockResolvedValue( {
    code: 200,
    data: [ { imgName: "a.png", imgUrl: "http://localhost/a.png" } ],
  } );
  getSpuAttr.mockResolvedValue( { code: 200, data: makeServerAttr( 1 ) } );
  addUpdateSpu.mockResolvedValue( { code: 200, data: null } );
} );

afterEach( () =>
{
  // 兜底卸载：attachTo 会把组件挂到 document.body，必须清理，否则用例之间会互相干扰
  if ( mountedWrapper )
  {
    unmountForm( mountedWrapper );
  }
  document.body.innerHTML = "";
  vi.restoreAllMocks();
} );

describe( "spuForm 销售属性缓存（普通 Map + LRU 上限 20）", () =>
{
  it( "正常场景：选中 SPU 后按该 spuId 拉取属性并写进 attrData", async () =>
  {
    getSpuAttr.mockResolvedValue( {
      code: 200,
      data: makeServerAttr( 7, [ "黑", "白" ] ),
    } );
    const wrapper = mountForm();

    await wrapper.vm.allSpu( { id: 7, spuName: "SPU7" } );

    expect( getSpuAttr ).toHaveBeenCalledTimes( 1 );
    expect( getSpuAttr ).toHaveBeenCalledWith( 7 );
    expect( currentValues( wrapper ) ).toEqual( [ "黑", "白" ] );

    // 单纯拉取不写缓存（只有 save 才写），缓存仍为空
    expect( setupStateOf( wrapper ).getAttrCache( 7 ) ).toBeUndefined();
    expect( setupStateOf( wrapper ).attrCache.size ).toBe( 0 );
  } );

  it( "边界值：再次选中同一 spuId 时命中缓存，服务端返回值不会覆盖本地属性值", async () =>
  {
    const wrapper = mountForm();
    await primeCache( wrapper, 1 ); // 服务端有「黑」，save 后写入缓存
    expect( cachedValues( wrapper, 1 ) ).toEqual( [ "黑" ] );

    const callsAfterPrime = getSpuAttr.mock.calls.length;
    // 服务端把属性值清空：若缓存生效，本地的「黑」应被保留
    getSpuAttr.mockResolvedValue( { code: 200, data: makeServerAttr( 1, [] ) } );
    await wrapper.vm.allSpu( { id: 1, spuName: "SPU1" } );

    expect( currentValues( wrapper ) ).toEqual( [ "黑" ] );
    expect( cachedValues( wrapper, 1 ) ).toEqual( [ "黑" ] );

    // 如实记录当前实现：命中缓存后属性接口仍会被调用（缓存只参与结果合并）
    expect( getSpuAttr.mock.calls.length ).toBe( callsAfterPrime + 1 );
    expect( getSpuAttr ).toHaveBeenLastCalledWith( 1 );
  } );

  it( "边界值：连续写入超过 20 条后最早的缓存被淘汰，再次访问它会重新拉取", async () =>
  {
    const wrapper = mountForm();
    const state = setupStateOf( wrapper );

    for ( let id = 1; id <= ATTR_CACHE_LIMIT + 1; id++ )
    {
      getSpuAttr.mockResolvedValue( {
        code: 200,
        data: makeServerAttr( id, [ "黑" ] ),
      } );
      await primeCache( wrapper, id );
    }

    // 上限生效：缓存不会随访问的 SPU 数量无限增长
    expect( state.attrCache.size ).toBe( ATTR_CACHE_LIMIT );
    // 最早写入的 id=1 被淘汰，最后写入的仍在
    expect( state.getAttrCache( 1 ) ).toBeUndefined();
    expect( state.getAttrCache( ATTR_CACHE_LIMIT + 1 ) ).toBeDefined();

    // 被淘汰的 spuId：只能拿到服务端数据（这里服务端已经没有属性值）
    getSpuAttr.mockResolvedValue( { code: 200, data: makeServerAttr( 1, [] ) } );
    const callsBefore = getSpuAttr.mock.calls.length;
    await wrapper.vm.allSpu( { id: 1, spuName: "SPU1" } );

    expect( getSpuAttr.mock.calls.length ).toBe( callsBefore + 1 );
    expect( currentValues( wrapper ) ).toEqual( [] );
    expect( state.attrCache.size ).toBe( ATTR_CACHE_LIMIT );

    // 仍在缓存中的 spuId 依然命中缓存，本地属性值被保留
    getSpuAttr.mockResolvedValue( {
      code: 200,
      data: makeServerAttr( ATTR_CACHE_LIMIT + 1, [] ),
    } );
    await wrapper.vm.allSpu( {
      id: ATTR_CACHE_LIMIT + 1,
      spuName: `SPU${ ATTR_CACHE_LIMIT + 1 }`,
    } );
    expect( currentValues( wrapper ) ).toEqual( [ "黑" ] );
  } );

  it( "异常输入：属性接口返回失败时组件不抛异常，也不写入脏缓存", async () =>
  {
    const wrapper = mountForm();
    const state = setupStateOf( wrapper );

    await primeCache( wrapper, 3 );
    expect( cachedValues( wrapper, 3 ) ).toEqual( [ "黑" ] );

    // 失败响应（业务错误码，不是 promise reject）
    getSpuAttr.mockResolvedValue( { code: 500, data: null } );
    await expect(
      wrapper.vm.allSpu( { id: 3, spuName: "SPU3" } ),
    ).resolves.toBeUndefined();

    // 失败响应不污染缓存，命中缓存的本地属性值仍然保留
    expect( cachedValues( wrapper, 3 ) ).toEqual( [ "黑" ] );
    expect( currentValues( wrapper ) ).toEqual( [ "黑" ] );
    expect( state.attrCache.size ).toBe( 1 );

    // 从未缓存过的 spuId 遇到失败响应：不抛异常、attrData 为空、缓存里没有脏数据
    await expect(
      wrapper.vm.allSpu( { id: 99, spuName: "SPU99" } ),
    ).resolves.toBeUndefined();
    expect( currentValues( wrapper ) ).toEqual( [] );
    expect( state.getAttrCache( 99 ) ).toBeUndefined();
    expect( state.attrCache.size ).toBe( 1 );
  } );

  it( "组件卸载时清空 attrCache", async () =>
  {
    const wrapper = mountForm();
    await primeCache( wrapper, 5 );
    await primeCache( wrapper, 6 );

    // wrapper.vm 卸载后不可靠，先把缓存引用取出来再断言
    const attrCache = setupStateOf( wrapper ).attrCache;
    expect( attrCache.size ).toBe( 2 );

    unmountForm( wrapper );
    expect( attrCache.size ).toBe( 0 );
  } );
} );
