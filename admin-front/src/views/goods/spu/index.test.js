/**
 * src/views/goods/spu/index.vue（SPU 列表页）单元测试
 *
 * 写法对齐同项目 src/views/goods/brand/index.test.js：
 *   - vi.hoisted 集中放 mock，vi.mock 隔离 API / 三级分类仓库 / element-plus；
 *   - el-* 组件全部用自写的 render 函数桩（不依赖运行时模板编译）；
 *   - Category / spuForm / skuForm 换成最小桩（spuForm / skuForm 需要 expose 方法）；
 *   - v-hasBtn / v-loading 用全局指令桩。
 *
 * 与 index.vue 实现对照后的三个关键事实（决定了断言怎么写）：
 *   1. watch(() => getCategory.C3Id) 不是 immediate，所以挂载时不会自动拉列表；
 *      列表由「三级分类变化 / 分页变化」触发，测试里显式调用 getSpuAll。
 *   2. getSpuAll 只在 code == 200 时写数据，非 200 保留旧数据，
 *      但没有 try/catch —— 网络异常会向上抛，这里如实断言 rejects。
 *   3. useRecycleBin 用真实现（不 mock）：
 *      isSuccess 判定 ok === true || code === 200；
 *      getMessage 只读 res.message ?? res.msg ?? fallback（不读 data.message）；
 *      空回收站会 ElMessage.warning；
 *      恢复成功后只在本地过滤回收站列表（不重新 fetchList），并回调 onRestored（= getSpuAll）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, provide, inject, nextTick } from "vue";
import { PERM } from "@/utils/permission";

/* ------------------------------------------------------------------ *
 * 模块 mock
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  getSpuReq: vi.fn(),
  getSkuList: vi.fn(),
  deleteSpu: vi.fn(),
  getDeletedSpuList: vi.fn(),
  restoreSpu: vi.fn(),
  categoryReset: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
}));

// 三级分类仓库：index.vue 只用到 C3Id（按钮禁用判断、请求参数）与卸载时的 $reset
const categoryStore = vi.hoisted(() => ({ C3Id: 3 }));

vi.mock("@/store/modules/category", () => ({
  default: () => ({ C3Id: categoryStore.C3Id, $reset: mocks.categoryReset }),
}));

vi.mock("@/API/spu", () => ({
  getSpuReq: mocks.getSpuReq,
  getSkuList: mocks.getSkuList,
  deleteSpu: mocks.deleteSpu,
  getDeletedSpuList: mocks.getDeletedSpuList,
  restoreSpu: mocks.restoreSpu,
}));

// index.vue 与 useRecycleBin 都只从 element-plus 取 ElMessage，
// el-* 组件由下面的桩提供，所以不需要 ElementPlus 默认导出
vi.mock("element-plus", () => ({
  ElMessage: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    warning: mocks.messageWarning,
  },
}));

// 子组件：index.vue 会通过 ref 调它们的方法，所以桩里 expose 同名方法用于断言。
// 根节点必须是真实元素：模板上写了 v-show，v-show 会往根元素写 style，
// 若桩渲染 null（注释节点）会因注释节点没有 .style 而抛错。
vi.mock("./spuForm.vue", async () => {
  const { defineComponent, h: createElement } = await import("vue");
  const addSpuAttr = vi.fn();
  const allSpu = vi.fn();
  return {
    default: defineComponent({
      name: "spuForm",
      setup(_, { expose }) {
        expose({ addSpuAttr, allSpu });
        return () => createElement("div", { class: "stub-spu-form" });
      },
    }),
    addSpuAttr,
    allSpu,
  };
});

vi.mock("./skuForm.vue", async () => {
  const { defineComponent, h: createElement } = await import("vue");
  const getSkuData = vi.fn();
  return {
    default: defineComponent({
      name: "skuForm",
      setup(_, { expose }) {
        expose({ getSkuData });
        return () => createElement("div", { class: "stub-sku-form" });
      },
    }),
    getSkuData,
  };
});

import SpuIndex from "./index.vue";
import {
  addSpuAttr as spuFormAddSpuAttr,
  allSpu as spuFormAllSpu,
} from "./spuForm.vue";
import { getSkuData as skuFormGetSkuData } from "./skuForm.vue";

// useRecycleBin 的异常分支会 console.error，屏蔽掉避免测试输出噪音
vi.spyOn(console, "error").mockImplementation(() => {});

/* ------------------------------------------------------------------ *
 * 浏览器 API 兜底
 * 本测试把所有 el-* 组件都换成了桩，理论上用不到这些；
 * 但 Element Plus 的样式/尺寸相关 API 有时会被间接触达，这里做廉价保险。
 * ------------------------------------------------------------------ */
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

/* ------------------------------------------------------------------ *
 * Element Plus 组件桩
 * ElTable + ElTableColumn 通过 provide/inject 传递行数据，
 * 这样作用域插槽 #default="{ row }" 能拿到正确的 row，
 * 不会出现「插槽被无参调用 → 解构 undefined 抛 TypeError」的问题。
 * ------------------------------------------------------------------ */
const ElCardStub = {
  name: "ElCard",
  setup(props, { slots }) {
    return () =>
      h("div", { class: "el-card" }, [
        slots.header ? slots.header() : null,
        slots.default ? slots.default() : null,
        slots.footer ? slots.footer() : null,
      ]);
  },
};

const ElButtonStub = {
  name: "ElButton",
  props: {
    type: String,
    disabled: Boolean,
    icon: String,
    size: String,
    loading: Boolean,
  },
  emits: ["click"],
  setup(props, { slots, emit }) {
    return () =>
      h(
        "button",
        {
          class: "el-button",
          disabled: props.disabled,
          onClick: (event) => emit("click", event),
        },
        slots.default ? slots.default() : [],
      );
  },
};

const ElTableStub = {
  name: "ElTable",
  props: {
    data: { type: Array, default: () => [] },
    border: Boolean,
    rowKey: [String, Function],
    emptyText: String,
  },
  setup(props, { slots }) {
    // 列组件从最近的表格取行数据；主表格与两个弹窗表格是并列关系，不会互相串
    provide("__tableRows", () => props.data);
    return () =>
      h("div", { class: "el-table" }, [
        slots.empty ? slots.empty() : null,
        slots.default ? slots.default() : null,
      ]);
  },
};

const ElTableColumnStub = {
  name: "ElTableColumn",
  props: {
    prop: String,
    label: String,
    type: String,
    width: [String, Number],
    minWidth: [String, Number],
    align: String,
    fixed: [String, Boolean],
  },
  setup(props, { slots }) {
    const getRows = inject("__tableRows", null);
    return () => {
      const rows = getRows ? getRows() : [];
      return h(
        "div",
        { class: "el-table-column" },
        rows.map((row, index) =>
          h("div", { class: "cell", key: index }, [
            slots.default
              ? slots.default({ row, $index: index })
              : props.prop
                ? String(row[props.prop] ?? "")
                : "",
          ]),
        ),
      );
    };
  },
};

const ElPaginationStub = {
  name: "ElPagination",
  props: {
    currentPage: [Number, String],
    pageSize: [Number, String],
    total: [Number, String],
    pageSizes: Array,
    layout: String,
    background: Boolean,
  },
  emits: [
    "update:currentPage",
    "update:pageSize",
    "current-change",
    "size-change",
  ],
  setup(props) {
    return () =>
      h("div", {
        class: "el-pagination",
        "data-current-page": String(props.currentPage),
        "data-page-size": String(props.pageSize),
        "data-total": String(props.total),
      });
  },
};

const ElDialogStub = {
  name: "ElDialog",
  props: {
    modelValue: Boolean,
    title: String,
    width: [String, Number],
  },
  emits: ["update:modelValue"],
  setup(props, { slots }) {
    return () =>
      h(
        "div",
        {
          class: "el-dialog",
          "data-title": props.title,
          style: props.modelValue ? "" : "display:none",
        },
        [slots.default ? slots.default() : null, slots.footer ? slots.footer() : null],
      );
  },
};

const ElAlertStub = {
  name: "ElAlert",
  props: { type: String, closable: Boolean, showIcon: Boolean, title: String },
  setup(props, { slots }) {
    return () => h("div", { class: "el-alert" }, slots.default ? slots.default() : []);
  },
};

const ElTagStub = {
  name: "ElTag",
  props: { type: String },
  setup(props, { slots }) {
    return () => h("span", { class: "el-tag" }, slots.default ? slots.default() : []);
  },
};

const ElImageStub = {
  name: "ElImage",
  props: { src: String, fit: String },
  setup(props) {
    return () => h("img", { class: "el-image", src: props.src });
  },
};

const CategoryStub = {
  name: "Category",
  props: { flag: { type: Number, default: 0 } },
  setup() {
    return () => h("div", { class: "stub-category" });
  },
};

const components = {
  ElCard: ElCardStub,
  ElButton: ElButtonStub,
  ElTable: ElTableStub,
  ElTableColumn: ElTableColumnStub,
  ElPagination: ElPaginationStub,
  ElDialog: ElDialogStub,
  ElAlert: ElAlertStub,
  ElTag: ElTagStub,
  ElImage: ElImageStub,
  Category: CategoryStub,
};

/**
 * v-hasBtn 指令桩：记录 binding.value，用于断言模板上的权限点取自 PERM 常量。
 * （组件指令会被应用到组件根元素，mounted 钩子在挂载后的 nextTick 触发）
 */
let hasBtnBindings = [];
const hasBtnRecorder = {
  mounted(_el, binding) {
    hasBtnBindings.push(binding.value);
  },
};

const mountPage = () => {
  hasBtnBindings = [];
  return mount(SpuIndex, {
    global: {
      components,
      directives: { loading: {}, hasBtn: hasBtnRecorder },
    },
  });
};

/* ------------------------------------------------------------------ *
 * 测试数据与辅助函数
 * ------------------------------------------------------------------ */
const spuRow = { id: 1, spuName: "SPU1", description: "描述1" };

const deletedSpu = {
  id: 11,
  spuName: "待恢复SPU",
  description: "已软删除的描述",
  deleteTime: "2024-01-01 00:00:00",
};

/** 取组件内部 setup 状态（<script setup> 的全部顶层绑定，已被 proxyRefs 解包） */
const setupStateOf = (wrapper) => {
  const state = wrapper.vm.$ && wrapper.vm.$.setupState;
  if (!state) {
    throw new Error("无法访问组件内部 setup 状态，请确认以 Vue 开发构建运行测试");
  }
  return state;
};

const allButtons = (wrapper) => wrapper.findAllComponents(ElButtonStub);

/** 按按钮文字查找（添加SPU / 回收站 / 恢复） */
const getButtonsByText = (wrapper, text) =>
  allButtons(wrapper).filter((btn) => btn.text().includes(text));

/** 只匹配「纯图标」按钮，避免把「添加SPU（icon=Plus）」这类带文字按钮也命中 */
const getIconOnlyButtons = (wrapper, icon) =>
  allButtons(wrapper).filter(
    (btn) => btn.props("icon") === icon && btn.text().trim() === "",
  );

/** 让列表渲染出 spuRow 这一行 */
const loadRow = async (wrapper) => {
  mocks.getSpuReq.mockResolvedValue({
    code: 200,
    data: { records: [spuRow], total: 1 },
  });
  await setupStateOf(wrapper).getSpuAll();
  await nextTick();
};

beforeEach(() => {
  vi.clearAllMocks();
  categoryStore.C3Id = 3;
  mocks.getSpuReq.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.getSkuList.mockResolvedValue({ code: 200, data: [] });
  mocks.deleteSpu.mockResolvedValue({ code: 200, data: null });
  mocks.getDeletedSpuList.mockResolvedValue({
    code: 200,
    data: { records: [], total: 0 },
  });
  mocks.restoreSpu.mockResolvedValue({ code: 200, data: null });
});

/* ------------------------------------------------------------------ *
 * 1. 列表拉取
 * ------------------------------------------------------------------ */
describe("SPU 列表拉取", () => {
  it("getSpuAll 成功：按当前分类与分页参数请求，并填充 spuData 与分页总数", async () => {
    mocks.getSpuReq.mockResolvedValue({
      code: 200,
      data: {
        records: [
          { id: 1, spuName: "SPU1", description: "描述1" },
          { id: 2, spuName: "SPU2", description: "描述2" },
        ],
        total: 42,
      },
    });

    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    // watch(() => C3Id) 不是 immediate：挂载时不会自动拉列表
    expect(mocks.getSpuReq).not.toHaveBeenCalled();

    await state.getSpuAll();

    expect(mocks.getSpuReq).toHaveBeenCalledTimes(1);
    expect(mocks.getSpuReq).toHaveBeenCalledWith({
      page: 1,
      query: { category3Id: 3, tmId: "", pageSize: 5 },
    });
    expect(state.spuData).toHaveLength(2);
    expect(state.totalPages).toBe(42);
    // 渲染层同样能看到：列表行与分页总数
    expect(wrapper.text()).toContain("SPU1");
    expect(wrapper.find(".el-pagination").attributes("data-total")).toBe("42");
  });

  it("getSpuAll 失败（业务码非 200）：不抛异常，保留上一次的列表数据", async () => {
    mocks.getSpuReq.mockResolvedValueOnce({
      code: 200,
      data: { records: [spuRow], total: 7 },
    });
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);
    await state.getSpuAll();

    mocks.getSpuReq.mockResolvedValueOnce({
      code: 500,
      data: null,
      message: "服务开小差了",
    });
    await expect(state.getSpuAll()).resolves.toBeUndefined();

    // 非 200 时组件不写数据、也不清空，页面仍显示上一次的列表
    expect(state.spuData).toHaveLength(1);
    expect(state.totalPages).toBe(7);
    expect(wrapper.text()).toContain("SPU1");
  });

  it("getSpuAll 遇到网络异常：当前实现没有 try/catch，异常会向上抛（如实记录现状）", async () => {
    mocks.getSpuReq.mockRejectedValueOnce(new Error("Network Error"));
    const wrapper = mountPage();

    await expect(setupStateOf(wrapper).getSpuAll()).rejects.toThrow(
      "Network Error",
    );
  });

  it("组件卸载时清空三级分类数据（onBeforeUnmount -> $reset）", async () => {
    const wrapper = mountPage();
    expect(mocks.categoryReset).not.toHaveBeenCalled();

    wrapper.unmount();

    expect(mocks.categoryReset).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * 2. 删除 SPU（软删除 + 回收站）
 * ------------------------------------------------------------------ */
describe("删除 SPU", () => {
  it("删除成功：提示「已移入回收站，30天内可恢复」并刷新列表", async () => {
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    await state.deleteSpuData(11);

    expect(mocks.deleteSpu).toHaveBeenCalledTimes(1);
    expect(mocks.deleteSpu).toHaveBeenCalledWith(11);
    expect(mocks.messageSuccess).toHaveBeenCalledWith(
      "已移入回收站，30天内可恢复",
    );
    // 删除成功后刷新 SPU 列表
    expect(mocks.getSpuReq).toHaveBeenCalledTimes(1);
  });

  it("删除失败：用 getMessage 透传后端 message（403 无权限）", async () => {
    const message = "无权限执行该操作（当前角色：运营）";
    mocks.deleteSpu.mockResolvedValue({ code: 403, message });
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    await state.deleteSpuData(11);

    expect(mocks.deleteSpu).toHaveBeenCalledWith(11);
    // getMessage 只读 message / msg，这里用顶层 message
    expect(mocks.messageError).toHaveBeenCalledWith(message);
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    // 失败不刷新列表
    expect(mocks.getSpuReq).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * 3. 回收站（真实 useRecycleBin）
 * ------------------------------------------------------------------ */
describe("SPU 回收站", () => {
  it("点击「回收站」按钮：打开弹窗并拉取已删除列表", async () => {
    mocks.getDeletedSpuList.mockResolvedValue({
      code: 200,
      data: { records: [deletedSpu], total: 1 },
    });
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    const recycleBtn = getButtonsByText(wrapper, "回收站")[0];
    expect(recycleBtn.exists()).toBe(true);
    await recycleBtn.trigger("click");
    await flushPromises();

    expect(state.recycleBinVisible).toBe(true);
    expect(mocks.getDeletedSpuList).toHaveBeenCalledTimes(1);
    expect(state.deletedSpuList).toHaveLength(1);
    // 被删记录以 SPU 名称入表
    expect(wrapper.text()).toContain("待恢复SPU");
    // 弹窗标题与保留期提示
    expect(wrapper.find('[data-title="SPU回收站"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("已删除SPU将保留 30 天");
    expect(state.recycleLoading).toBe(false);
  });

  it("边界值：回收站为空时提示 warning 且不抛异常", async () => {
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    await state.openRecycleBin();
    await flushPromises();

    expect(mocks.getDeletedSpuList).toHaveBeenCalledTimes(1);
    expect(state.recycleBinVisible).toBe(true);
    expect(state.deletedSpuList).toHaveLength(0);
    // 真实实现：列表为空时给出警告提示
    expect(mocks.messageWarning).toHaveBeenCalledTimes(1);
  });

  it("异常输入：回收站接口抛错时提示错误，不影响已渲染的 SPU 列表", async () => {
    const wrapper = mountPage();
    await loadRow(wrapper);
    expect(wrapper.text()).toContain("SPU1");

    mocks.getDeletedSpuList.mockRejectedValue(new Error("network boom"));
    await setupStateOf(wrapper).openRecycleBin();
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledWith("回收站数据加载失败");
    expect(wrapper.text()).toContain("SPU1");
  });

  it("恢复成功：调用恢复接口（传 row.id）、提示成功、刷新 SPU 列表且不重新拉回收站", async () => {
    mocks.getDeletedSpuList.mockResolvedValue({
      code: 200,
      data: { records: [deletedSpu], total: 1 },
    });
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    await state.openRecycleBin();
    await flushPromises();
    expect(wrapper.text()).toContain("待恢复SPU");

    const row = state.deletedSpuList[0];
    await state.restoreItem(row);
    await flushPromises();

    // rowKey 取的是 row.id
    expect(mocks.restoreSpu).toHaveBeenCalledTimes(1);
    expect(mocks.restoreSpu).toHaveBeenCalledWith(11);
    expect(mocks.messageSuccess).toHaveBeenCalledWith("恢复成功");
    // onRestored -> getSpuAll
    expect(mocks.getSpuReq).toHaveBeenCalledTimes(1);
    // 真实实现只在本地过滤，不重新拉回收站
    expect(mocks.getDeletedSpuList).toHaveBeenCalledTimes(1);
    // 用「只属于被删行的名称」判断该行已移除（顶部提示文案不含这几个字）
    expect(wrapper.text()).not.toContain("待恢复SPU");
    expect(state.deletedSpuList).toHaveLength(0);
  });

  it("恢复失败：透传后端 message（403 无权限），且不刷新 SPU 列表", async () => {
    const message = "无权限执行该操作（当前角色：运营）";
    mocks.getDeletedSpuList.mockResolvedValue({
      code: 200,
      data: { records: [deletedSpu], total: 1 },
    });
    mocks.restoreSpu.mockResolvedValue({ code: 403, message });
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    await state.openRecycleBin();
    await flushPromises();

    await state.restoreItem(state.deletedSpuList[0]);
    await flushPromises();

    expect(mocks.restoreSpu).toHaveBeenCalledWith(11);
    expect(mocks.messageError).toHaveBeenCalledWith(message);
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.getSpuReq).not.toHaveBeenCalled();
    // 失败时记录仍留在回收站
    expect(state.deletedSpuList).toHaveLength(1);
    expect(wrapper.text()).toContain("待恢复SPU");
  });

  it("弹窗里的「恢复」按钮能渲染并触发恢复", async () => {
    mocks.getDeletedSpuList.mockResolvedValue({
      code: 200,
      data: { records: [deletedSpu], total: 1 },
    });
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    await state.openRecycleBin();
    await flushPromises();

    const restoreBtn = getButtonsByText(wrapper, "恢复")[0];
    expect(restoreBtn.exists()).toBe(true);
    await restoreBtn.trigger("click");
    await flushPromises();

    expect(mocks.restoreSpu).toHaveBeenCalledWith(11);
  });
});

/* ------------------------------------------------------------------ *
 * 4. 分页切换
 * ------------------------------------------------------------------ */
describe("分页切换会重新拉取", () => {
  it("current-change：按新页码请求，并更新分页组件上的当前页", async () => {
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    const pagination = wrapper.findComponent(ElPaginationStub);
    expect(pagination.exists()).toBe(true);

    // 模板：v-model:current-page + @current-change="getSpuAll"
    pagination.vm.$emit("update:currentPage", 2);
    pagination.vm.$emit("current-change", 2);
    await flushPromises();

    expect(state.currentPage).toBe(2);
    expect(mocks.getSpuReq).toHaveBeenLastCalledWith({
      page: 2,
      query: { category3Id: 3, tmId: "", pageSize: 5 },
    });
    expect(
      wrapper.find(".el-pagination").attributes("data-current-page"),
    ).toBe("2");
  });

  it("size-change：按新的每页条数请求，并更新分页组件上的 pageSize", async () => {
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    const pagination = wrapper.findComponent(ElPaginationStub);

    // 模板：v-model:page-size + @size-change="getSpuAll"
    pagination.vm.$emit("update:pageSize", 10);
    pagination.vm.$emit("size-change", 10);
    await flushPromises();

    expect(state.pageSize).toBe(10);
    expect(mocks.getSpuReq).toHaveBeenLastCalledWith({
      page: 1,
      query: { category3Id: 3, tmId: "", pageSize: 10 },
    });
    expect(wrapper.find(".el-pagination").attributes("data-page-size")).toBe(
      "10",
    );
  });
});

/* ------------------------------------------------------------------ *
 * 5. v-hasBtn 权限按钮
 * ------------------------------------------------------------------ */
describe("v-hasBtn 权限按钮", () => {
  it("「添加SPU」按钮：分类已选中时可点击，点击后进入新增模式并调用子组件 addSpuAttr", async () => {
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);

    const addBtn = getButtonsByText(wrapper, "添加SPU")[0];
    expect(addBtn.exists()).toBe(true);
    expect(addBtn.attributes("disabled")).toBeUndefined();

    await addBtn.trigger("click");

    expect(state.spuFormFlag).toBe(1);
    expect(spuFormAddSpuAttr).toHaveBeenCalledTimes(1);
    expect(spuFormAddSpuAttr).toHaveBeenCalledWith(3);
  });

  it("边界值：未选中三级分类时「添加SPU」按钮被禁用", async () => {
    categoryStore.C3Id = null;
    const wrapper = mountPage();

    const addBtn = getButtonsByText(wrapper, "添加SPU")[0];
    expect(addBtn.exists()).toBe(true);
    expect(addBtn.attributes("disabled")).toBeDefined();
  });

  it("行内按钮：新增 SKU / 编辑 / 查看 SKU / 删除分别触发对应方法", async () => {
    const wrapper = mountPage();
    const state = setupStateOf(wrapper);
    await loadRow(wrapper);

    // 行内「+」：新增 SKU
    const skuBtn = getIconOnlyButtons(wrapper, "Plus")[0];
    expect(skuBtn.exists()).toBe(true);
    await skuBtn.trigger("click");
    expect(state.spuFormFlag).toBe(2);
    expect(skuFormGetSkuData).toHaveBeenCalledTimes(1);
    expect(skuFormGetSkuData).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, spuName: "SPU1" }),
    );

    // 行内编辑：把整行交给 spuForm
    const editBtn = getIconOnlyButtons(wrapper, "Edit")[0];
    expect(editBtn.exists()).toBe(true);
    await editBtn.trigger("click");
    expect(state.spuFormFlag).toBe(1);
    expect(spuFormAllSpu).toHaveBeenCalledTimes(1);
    expect(spuFormAllSpu).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, spuName: "SPU1" }),
    );

    // 行内查看 SKU：拉取 SKU 列表并打开弹窗
    mocks.getSkuList.mockResolvedValue({
      code: 200,
      data: [{ id: 100, skuName: "SKU-A", price: 1999, weight: 0.2 }],
    });
    const checkBtn = getIconOnlyButtons(wrapper, "Warning")[0];
    expect(checkBtn.exists()).toBe(true);
    await checkBtn.trigger("click");
    await flushPromises();
    expect(mocks.getSkuList).toHaveBeenCalledWith(1);
    expect(state.dialogFlag).toBe(true);
    expect(wrapper.find('[data-title="查看sku信息"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("SKU-A");

    // 行内删除：软删除该行
    const deleteBtn = getIconOnlyButtons(wrapper, "Delete")[0];
    expect(deleteBtn.exists()).toBe(true);
    await deleteBtn.trigger("click");
    await flushPromises();
    expect(mocks.deleteSpu).toHaveBeenCalledWith(1);
    expect(mocks.messageSuccess).toHaveBeenCalledWith(
      "已移入回收站，30天内可恢复",
    );
  });

  it("指令取值来自 PERM 常量：SPU 写权限与 SKU 写权限都出现在模板上", async () => {
    const wrapper = mountPage();
    await loadRow(wrapper);
    // 组件指令的 mounted 钩子在挂载后的 nextTick 触发
    await flushPromises();
    await nextTick();

    expect(hasBtnBindings).toContain(PERM.GOODS_SPU_WRITE);
    expect(hasBtnBindings).toContain(PERM.GOODS_SKU_WRITE);
  });
});
