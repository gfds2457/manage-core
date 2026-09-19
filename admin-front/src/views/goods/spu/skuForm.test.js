/**
 * skuForm.vue 单元测试
 *
 * 覆盖点：
 * 1. 正常场景：合法数据下 saveSku 校验通过并调用保存接口，提交字段与表单一致
 * 2. 边界值：price / weight 为 0（el-input-number min=0 的下界）时仍能通过校验并提交
 * 3. 异常输入：skuName 为空、price 为 null、weight 为空时不应发出保存请求
 * 4. getSkuData：调用后重置表单字段并清空校验状态（父组件用 v-show 复用组件时不残留脏数据）
 *
 * 设计说明：
 * - 业务接口（@/API/spu）与 ElMessage 全部 mock，测试只关心组件行为。
 * - el-form 用「按组件自身 rules 做同步校验」的桩替身：既避免 happy-dom 下 async-validator
 *   的异步校验时序问题，又能真实走到组件里的 rules 校验函数。
 * - el-card / el-form-item 透传插槽撑住结构，其余 element-plus 组件用空渲染桩。
 * - <script setup> 的私有绑定（rules / saveSku / skuData ...）通过 setupState 读取。
 */
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SkuForm from "./skuForm.vue";
import { addSku, getSpuAttr, getSpuImg } from "@/API/spu/index";
import { ElMessage } from "element-plus";

// 业务接口与消息提示必须 mock：测试不发真实请求
vi.mock( "@/API/spu/index", () => ( {
  getSpuAttr: vi.fn(),
  getSpuImg: vi.fn(),
  addSku: vi.fn(),
} ) );

vi.mock( "element-plus", () => ( {
  ElMessage: { success: vi.fn(), error: vi.fn() },
} ) );

/* ------------------------------------------------------------------ *
 * 组件桩
 * ------------------------------------------------------------------ */

const validateSpy = vi.fn();
const clearValidateSpy = vi.fn();

/**
 * 复刻一次「rules 校验」：组件里的 rules 只用了 required + 自定义 validator，
 * 这里同步跑一遍，返回错误列表。
 */
const collectRuleErrors = ( model, rules ) =>
{
  const errors = [];
  Object.keys( rules ?? {} ).forEach( ( field ) =>
  {
    const value = model ? model[ field ] : undefined;
    ( rules[ field ] ?? [] ).forEach( ( rule ) =>
    {
      // async-validator 的 required 语义：空值先拦一层
      // （weight 的 required 就是靠这一层兜底的，自定义 validator 对 "" 不报错）
      if (
        rule.required &&
        ( value === undefined || value === null || value === "" )
      )
      {
        errors.push( { field, message: `${ field } is required` } );
        return;
      }
      if ( typeof rule.validator !== "function" ) return;
      let error;
      rule.validator( rule, value, ( err ) =>
      {
        error = err;
      } );
      if ( error ) errors.push( { field, message: error.message } );
    } );
  } );
  return errors;
};

const ElFormStub = defineComponent( {
  name: "ElFormStub",
  inheritAttrs: false,
  props: {
    model: { type: Object, default: undefined },
    rules: { type: Object, default: undefined },
  },
  setup( props, { slots, expose } )
  {
    const validate = () =>
    {
      validateSpy();
      const errors = collectRuleErrors( props.model, props.rules );
      return errors.length ? Promise.reject( errors ) : Promise.resolve( true );
    };
    expose( { validate, clearValidate: clearValidateSpy } );
    return () => ( slots.default ? h( "form", slots.default() ) : h( "form" ) );
  },
} );

// 只负责撑住结构（el-card / el-form-item）
const PassThroughStub = defineComponent( {
  name: "PassThroughStub",
  inheritAttrs: false,
  setup( _, { slots } )
  {
    return () => ( slots.default ? slots.default() : null );
  },
} );

// 不渲染任何内容：避免 happy-dom 下 element-plus 内部实现带来的干扰
const VoidStub = defineComponent( {
  name: "VoidStub",
  inheritAttrs: false,
  setup()
  {
    return () => null;
  },
} );

// 渲染成真实 button，这样可以通过点击覆盖「保存」按钮 → saveSku 的链路
const ElButtonStub = defineComponent( {
  name: "ElButtonStub",
  inheritAttrs: false,
  setup( _, { slots, attrs } )
  {
    return () =>
      h(
        "button",
        { type: "button", onClick: attrs.onClick },
        slots.default ? slots.default() : null,
      );
  },
} );

const globalComponents = {
  "el-card": PassThroughStub,
  "el-form": ElFormStub,
  "el-form-item": PassThroughStub,
  "el-button": ElButtonStub,
  "el-input": VoidStub,
  "el-input-number": VoidStub,
  "el-select": VoidStub,
  "el-option": VoidStub,
  "el-table": VoidStub,
  "el-table-column": VoidStub,
  "el-image": VoidStub,
  "el-image-viewer": VoidStub,
};

const createWrapper = () =>
  mount( SkuForm, { global: { components: globalComponents } } );

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

/**
 * 取 <script setup> 的内部绑定。
 * vitest 下 SFC 走的是非生产转换，所有顶层绑定都会挂到 setupState 上；
 * 若某些 @vue/test-utils 版本把绑定合并到 vm，这里做一层兜底。
 */
const setupStateOf = ( wrapper ) =>
{
  const setupState = wrapper.vm?.$?.setupState;
  if ( !setupState )
  {
    throw new Error( "拿不到 setupState，无法断言组件内部状态" );
  }
  return new Proxy( setupState, {
    get: ( target, key ) =>
      key in target ? target[ key ] : wrapper.vm?.[ key ],
  } );
};

// 手动跑一条 rule 的 validator，返回是否回调过 / 错误对象
const runValidator = ( rule, value ) =>
{
  const result = { called: false, error: undefined };
  rule.validator( rule, value, ( err ) =>
  {
    result.called = true;
    result.error = err;
  } );
  return result;
};

// 合法表单数据（和用户在表单里填的字段一一对应）
const fillValidForm = ( state ) =>
{
  state.skuData.category3Id = 3;
  state.skuData.spuId = 1;
  state.skuData.tmId = 2;
  state.skuData.skuName = "测试SKU";
  state.skuData.price = 10;
  state.skuData.weight = "12.50";
  state.skuData.skuDesc = "测试描述";
  state.skuData.skuDefaultImg = "http://img.test/default.png";
};

const SPU_DATA = { id: 1, tmId: 2, category3Id: 3 };

/* ------------------------------------------------------------------ *
 * 测试
 * ------------------------------------------------------------------ */

describe( "skuForm", () =>
{
  let wrapper;

  beforeEach( () =>
  {
    vi.clearAllMocks();
    getSpuAttr.mockResolvedValue( { code: 200, data: [] } );
    getSpuImg.mockResolvedValue( { code: 200, data: [] } );
    addSku.mockResolvedValue( { code: 200, data: null } );
    wrapper = createWrapper();
  } );

  afterEach( () =>
  {
    wrapper?.unmount();
    wrapper = undefined;
  } );

  describe( "rules 校验函数", () =>
  {
    it( "skuName：空值与纯空白报错，正常值通过", () =>
    {
      const rule = setupStateOf( wrapper ).rules.skuName[ 0 ];

      expect( runValidator( rule, "" ).error?.message ).toBe( "请输入SKU名称" );
      expect( runValidator( rule, "   " ).error?.message ).toBe( "请输入SKU名称" );

      const { called, error } = runValidator( rule, "测试SKU" );
      expect( called ).toBe( true );
      expect( error ).toBeUndefined();
    } );

    it( "price：null / NaN / 负数报错，0 与正数通过", () =>
    {
      const rule = setupStateOf( wrapper ).rules.price[ 0 ];

      expect( runValidator( rule, null ).error?.message ).toBe( "请输入价格" );
      expect( runValidator( rule, undefined ).error?.message ).toBe( "请输入价格" );
      expect( runValidator( rule, Number.NaN ).error?.message ).toBe( "请输入价格" );
      expect( runValidator( rule, -1 ).error?.message ).toBe( "价格不能为负数" );

      // 边界值：0 是合法值（el-input-number min=0 的下界）
      expect( runValidator( rule, 0 ).error ).toBeUndefined();
      expect( runValidator( rule, 10 ).error ).toBeUndefined();
    } );

    it( "weight：null / NaN / 负数报错，0 通过", () =>
    {
      const rule = setupStateOf( wrapper ).rules.weight[ 0 ];

      expect( runValidator( rule, null ).error?.message ).toBe( "请输入重量" );
      expect( runValidator( rule, undefined ).error?.message ).toBe( "请输入重量" );
      expect( runValidator( rule, Number.NaN ).error?.message ).toBe( "请输入重量" );
      expect( runValidator( rule, -1 ).error?.message ).toBe( "重量不能为负数" );

      // 边界值：0 是合法值
      expect( runValidator( rule, 0 ).error ).toBeUndefined();
      expect( runValidator( rule, "0.00" ).error ).toBeUndefined();
    } );
  } );

  describe( "saveSku 正常提交", () =>
  {
    it( "合法数据：校验通过，调用保存接口且提交字段与表单一致", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );
      state.spuAttr = [
        {
          id: 11,
          saleAttrName: "颜色",
          attrIdAndValueIdList: "11:101",
          spuSaleAttrValueList: [],
        },
        {
          id: 12,
          saleAttrName: "内存",
          attrIdAndValueIdList: "",
          spuSaleAttrValueList: [],
        },
      ];

      await state.saveSku();

      // 校验确实跑过，并进入了保存流程
      expect( validateSpy ).toHaveBeenCalled();
      expect( addSku ).toHaveBeenCalledTimes( 1 );

      const payload = addSku.mock.calls[ 0 ][ 0 ];
      expect( payload ).toMatchObject( {
        category3Id: 3,
        spuId: 1,
        tmId: 2,
        skuName: "测试SKU",
        price: 10,
        weight: "12.50",
        skuDesc: "测试描述",
        skuDefaultImg: "http://img.test/default.png",
        // 平台属性只收集选过的（空字符串那条被跳过）
        skuAttrValueList: [ { attrId: "11", valueId: "101" } ],
      } );
      // 提交的就是表单里的值
      expect( payload.skuName ).toBe( state.skuData.skuName );
      expect( payload.price ).toBe( state.skuData.price );
      expect( payload.weight ).toBe( state.skuData.weight );
      expect( ElMessage.success ).toHaveBeenCalledWith( "添加成功" );
      expect( ElMessage.error ).not.toHaveBeenCalled();
    } );

    it( "边界值：price / weight 为 0 时通过校验并正常提交", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );

      // 模拟用户在 el-input-number(min=0) 里输入 0
      state.priceModel = 0;
      state.weightModel = 0;

      expect( state.skuData.price ).toBe( 0 );
      expect( state.skuData.weight ).toBe( "0.00" );
      // 回读时 0 不能被当成空值
      expect( state.priceModel ).toBe( 0 );
      expect( state.weightModel ).toBe( 0 );

      await state.saveSku();

      expect( addSku ).toHaveBeenCalledTimes( 1 );
      expect( addSku.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
        price: 0,
        weight: "0.00",
      } );
      expect( ElMessage.success ).toHaveBeenCalledWith( "添加成功" );
    } );

    it( "点击「保存」按钮会走完整个提交流程", async () =>
    {
      fillValidForm( setupStateOf( wrapper ) );

      const saveButton = wrapper
        .findAll( "button" )
        .find( ( btn ) => btn.text().includes( "保存" ) );
      expect( saveButton ).toBeTruthy();

      await saveButton.trigger( "click" );
      await flushPromises();

      expect( addSku ).toHaveBeenCalledTimes( 1 );
      expect( ElMessage.success ).toHaveBeenCalledWith( "添加成功" );
    } );
  } );

  describe( "saveSku 异常输入不发出保存请求", () =>
  {
    it( "skuName 为空时不发请求", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );
      state.skuData.skuName = "";

      await state.saveSku();

      expect( addSku ).not.toHaveBeenCalled();
      expect( ElMessage.success ).not.toHaveBeenCalled();
    } );

    it( "skuName 只有空白字符时不发请求", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );
      state.skuData.skuName = "    ";

      await state.saveSku();

      expect( addSku ).not.toHaveBeenCalled();
    } );

    it( "price 为 null 时不发请求", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );
      state.skuData.price = null;

      await state.saveSku();

      expect( addSku ).not.toHaveBeenCalled();
      expect( ElMessage.success ).not.toHaveBeenCalled();
    } );

    it( "weight 为空时不发请求", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );
      state.skuData.weight = "";

      await state.saveSku();

      expect( addSku ).not.toHaveBeenCalled();
      expect( ElMessage.success ).not.toHaveBeenCalled();
    } );

    it( "price / weight 为负数时不发请求", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );
      state.skuData.price = -1;
      state.skuData.weight = "-1";

      await state.saveSku();

      expect( addSku ).not.toHaveBeenCalled();
    } );
  } );

  describe( "getSkuData", () =>
  {
    it( "重置表单字段并清空校验状态", async () =>
    {
      const state = setupStateOf( wrapper );
      // 先塞入「上一次」的脏数据
      fillValidForm( state );
      state.skuData.skuName = "上一条SKU";
      state.skuData.skuAttrValueList = [ { attrId: 11, valueId: 101 } ];

      getSpuAttr.mockResolvedValue( {
        code: 200,
        data: [ { id: 11, saleAttrName: "颜色", spuSaleAttrValueList: [] } ],
      } );
      getSpuImg.mockResolvedValue( {
        code: 200,
        data: [ { imgUrl: "http://img.test/1.png", imgName: "1" } ],
      } );

      await state.getSkuData( { id: 9, tmId: 8, category3Id: 7 } );
      await nextTick();

      // 带上了当前 SPU 的三级分类/SPU/品牌
      expect( state.skuData.category3Id ).toBe( 7 );
      expect( state.skuData.spuId ).toBe( 9 );
      expect( state.skuData.tmId ).toBe( 8 );

      // 上一条的数据被清干净
      expect( state.skuData.skuName ).toBe( "" );
      expect( state.skuData.price ).toBeNull();
      expect( state.skuData.weight ).toBe( "" );
      expect( state.skuData.skuDesc ).toBe( "" );
      expect( state.skuData.skuDefaultImg ).toBe( "" );
      expect( state.skuData.skuAttrValueList ).toEqual( [] );

      // 校验红字也要清掉
      expect( clearValidateSpy ).toHaveBeenCalled();

      // 接口数据回填
      expect( getSpuAttr ).toHaveBeenCalledWith( 9 );
      expect( getSpuImg ).toHaveBeenCalledWith( 9 );
      expect( state.spuAttr ).toEqual( [
        { id: 11, saleAttrName: "颜色", spuSaleAttrValueList: [] },
      ] );
      expect( state.imgData ).toEqual( [
        { imgUrl: "http://img.test/1.png", imgName: "1" },
      ] );
    } );

    it( "重置后直接保存不会提交上一次的脏数据", async () =>
    {
      const state = setupStateOf( wrapper );
      fillValidForm( state );

      await state.getSkuData( SPU_DATA );
      await nextTick();

      await state.saveSku();

      expect( addSku ).not.toHaveBeenCalled();
    } );
  } );
} );
