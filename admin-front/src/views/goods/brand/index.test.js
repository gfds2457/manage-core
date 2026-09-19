import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, provide, inject } from "vue";

/* ------------------------------------------------------------------ *
 * 模块 mock
 * 注意：@/composables/useRecycleBin 不再 mock，直接使用真实实现，
 * 因此下面的断言需要贴合真实实现的行为（恢复后本地过滤，不重新拉取回收站）。
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  getBrandList: vi.fn(),
  reqAddUpdateBrand: vi.fn(),
  reqDeleteBrand: vi.fn(),
  reqGetDeletedBrandList: vi.fn(),
  reqRestoreBrand: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  // 真实 useRecycleBin 在回收站为空时会调用 ElMessage.warning
  messageWarning: vi.fn(),
  messageBoxConfirm: vi.fn(),
  validate: vi.fn(),
}));

vi.mock("@/API/product", () => ({
  getBrandList: mocks.getBrandList,
  reqAddUpdateBrand: mocks.reqAddUpdateBrand,
  reqDeleteBrand: mocks.reqDeleteBrand,
  reqGetDeletedBrandList: mocks.reqGetDeletedBrandList,
  reqRestoreBrand: mocks.reqRestoreBrand,
}));

vi.mock("element-plus", () => ({
  ElMessage: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    warning: mocks.messageWarning,
  },
  ElMessageBox: { confirm: mocks.messageBoxConfirm },
}));

// 真实 useRecycleBin 会从 element-plus 取 ElMessage，因此上面的 mock 对组件与 composable 同时生效
import BrandList from "./index.vue";

/* ------------------------------------------------------------------ *
 * Element Plus 组件 stub（全部用 render 函数，避免运行期模板编译）
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
  props: { type: String, disabled: Boolean, icon: String, size: String, loading: Boolean },
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
    provide("__tableRows", () => props.data);
    return () => h("div", { class: "el-table" }, slots.default ? slots.default() : []);
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
  emits: ["update:currentPage", "update:pageSize", "current-change", "size-change"],
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
  props: { modelValue: Boolean, title: String, width: [String, Number], beforeClose: Function },
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

const ElFormStub = {
  name: "ElForm",
  props: { model: Object, rules: Object, inline: Boolean, labelWidth: [String, Number] },
  setup(props, { slots, expose }) {
    expose({
      validate: () => mocks.validate(),
      clearValidate: () => {},
      resetFields: () => {},
    });
    return () => h("form", { class: "el-form" }, slots.default ? slots.default() : []);
  },
};

const ElFormItemStub = {
  name: "ElFormItem",
  props: { label: String, prop: String, labelWidth: [String, Number] },
  setup(props, { slots }) {
    return () => h("div", { class: "el-form-item" }, slots.default ? slots.default() : []);
  },
};

const ElInputStub = {
  name: "ElInput",
  props: { modelValue: { default: "" }, placeholder: String, type: String },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        class: "el-input",
        value: props.modelValue,
        onInput: (event) => emit("update:modelValue", event.target.value),
      });
  },
};

const ElUploadStub = {
  name: "ElUpload",
  props: {
    action: String,
    showFileList: Boolean,
    onSuccess: Function,
    beforeUpload: Function,
  },
  setup(props, { slots }) {
    return () => h("div", { class: "el-upload" }, slots.default ? slots.default() : []);
  },
};

const ElIconStub = {
  name: "ElIcon",
  setup(props, { slots }) {
    return () => h("i", { class: "el-icon" }, slots.default ? slots.default() : []);
  },
};

const PlusStub = {
  name: "Plus",
  setup() {
    return () => h("i", { class: "plus-icon" });
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

const ElPopconfirmStub = {
  name: "ElPopconfirm",
  props: { title: String },
  emits: ["confirm"],
  setup(props, { slots, emit }) {
    return () =>
      h("span", { class: "el-popconfirm" }, [
        slots.reference ? slots.reference() : null,
        h(
          "button",
          {
            type: "button",
            class: "popconfirm-confirm",
            onClick: () => emit("confirm"),
          },
          "确认",
        ),
      ]);
  },
};

const components = {
  ElCard: ElCardStub,
  ElButton: ElButtonStub,
  ElTable: ElTableStub,
  ElTableColumn: ElTableColumnStub,
  ElPagination: ElPaginationStub,
  ElDialog: ElDialogStub,
  ElForm: ElFormStub,
  ElFormItem: ElFormItemStub,
  ElInput: ElInputStub,
  ElUpload: ElUploadStub,
  ElIcon: ElIconStub,
  ElAlert: ElAlertStub,
  ElTag: ElTagStub,
  ElPopconfirm: ElPopconfirmStub,
  Plus: PlusStub,
};

const mountBrand = () =>
  mount(BrandList, {
    global: {
      components,
      directives: { loading: {}, hasBtn: {} },
    },
  });

/* ------------------------------------------------------------------ *
 * 测试数据与辅助函数
 * ------------------------------------------------------------------ */
const getButtonsByText = (wrapper, text) =>
  wrapper.findAllComponents(ElButtonStub).filter((btn) => btn.text().trim() === text);

// 品牌名刻意取一个「只会出现在这一行」的标记：
// 弹窗里的提示文案「已删除品牌将保留 30 天」本身就含「已删除品牌」四个字，
// 若拿它当判据，断言「恢复后行已消失」会被这段提示文案救活，永远为真。
const deletedBrand = {
  id: 11,
  tmName: "待恢复品牌",
  logoUrl: "http://img/11.png",
  deleteTime: "2024-01-01 00:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validate.mockResolvedValue(true);
  mocks.getBrandList.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.reqGetDeletedBrandList.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.reqRestoreBrand.mockResolvedValue({ code: 200, data: true });
  mocks.reqDeleteBrand.mockResolvedValue({ code: 200, data: true });
  mocks.reqAddUpdateBrand.mockResolvedValue({ code: 200, data: true });
});

/* ------------------------------------------------------------------ *
 * 1. 品牌列表渲染
 * ------------------------------------------------------------------ */
describe("品牌列表渲染", () => {
  it("挂载时按第一页（pageSize=5）请求并渲染品牌", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [{ id: 1, tmName: "华为", logoUrl: "http://img/1.png" }], total: 1 },
    });

    const wrapper = mountBrand();
    await flushPromises();

    expect(mocks.getBrandList).toHaveBeenCalledTimes(1);
    expect(mocks.getBrandList).toHaveBeenCalledWith(1, 5);
    expect(wrapper.text()).toContain("华为");
    expect(wrapper.find(".el-pagination").attributes("data-total")).toBe("1");
  });

  it("边界值：空列表时表格存在但不渲染任何品牌行", async () => {
    const wrapper = mountBrand();
    await flushPromises();

    expect(wrapper.find(".el-table").exists()).toBe(true);
    expect(mocks.getBrandList).toHaveBeenCalledWith(1, 5);
    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. 品牌名筛选 / 列表刷新
 *    说明：该组件本身未提供前端关键字搜索入口（模板只有「添加品牌 / 回收站」，
 *    getBrandList(pageNum, pageSize) 也不接收关键字），品牌名筛选由后端完成。
 *    因此这里以「列表随分页条件变化重新请求，并且只渲染接口返回的品牌」作为等价覆盖。
 * ------------------------------------------------------------------ */
describe("品牌列表按条件刷新（品牌名筛选由后端完成）", () => {
  it("翻页时按新页码重新请求，并且只渲染接口返回的品牌", async () => {
    mocks.getBrandList
      .mockResolvedValueOnce({
        code: 200,
        data: {
          records: [
            { id: 1, tmName: "华为", logoUrl: "http://img/1.png" },
            { id: 2, tmName: "小米", logoUrl: "http://img/2.png" },
          ],
          total: 2,
        },
      })
      .mockResolvedValueOnce({
        code: 200,
        data: { records: [{ id: 2, tmName: "小米", logoUrl: "http://img/2.png" }], total: 1 },
      });

    const wrapper = mountBrand();
    await flushPromises();
    expect(wrapper.text()).toContain("华为");
    expect(wrapper.text()).toContain("小米");

    const pagination = wrapper.findComponent(ElPaginationStub);
    pagination.vm.$emit("update:currentPage", 2);
    await flushPromises();

    expect(mocks.getBrandList).toHaveBeenLastCalledWith(2, 5);
    expect(wrapper.text()).toContain("小米");
    expect(wrapper.text()).not.toContain("华为");
  });
});

/* ------------------------------------------------------------------ *
 * 3. 删除品牌走确认弹窗
 * ------------------------------------------------------------------ */
describe("删除品牌走确认弹窗", () => {
  it("点击 popconfirm 确认后调用删除接口并刷新列表", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [{ id: 7, tmName: "华为", logoUrl: "http://img/1.png" }], total: 1 },
    });

    const wrapper = mountBrand();
    await flushPromises();

    const confirmBtn = wrapper.find(".popconfirm-confirm");
    expect(confirmBtn.exists()).toBe(true);
    await confirmBtn.trigger("click");
    await flushPromises();

    expect(mocks.reqDeleteBrand).toHaveBeenCalledTimes(1);
    expect(mocks.reqDeleteBrand).toHaveBeenCalledWith(7);
    expect(mocks.messageSuccess).toHaveBeenCalledWith("已移入回收站，30天内可恢复");
    // 删除成功后刷新列表
    expect(mocks.getBrandList).toHaveBeenCalledTimes(2);
  });

  it("删除失败时提示错误且不刷新列表", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [{ id: 7, tmName: "华为", logoUrl: "http://img/1.png" }], total: 1 },
    });
    mocks.reqDeleteBrand.mockResolvedValue({ code: 500, message: "删除失败" });

    const wrapper = mountBrand();
    await flushPromises();

    await wrapper.find(".popconfirm-confirm").trigger("click");
    await flushPromises();

    // 真实 getMessage 会优先取 message 字段
    expect(mocks.messageError).toHaveBeenCalledWith("删除失败");
    expect(mocks.getBrandList).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * 4. 回收站渲染（真实 useRecycleBin：打开时拉取并渲染）
 * ------------------------------------------------------------------ */
describe("品牌回收站", () => {
  it("打开回收站时调用已删除品牌接口并渲染已删除品牌列表", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [{ id: 1, tmName: "华为", logoUrl: "http://img/1.png" }], total: 1 },
    });
    mocks.reqGetDeletedBrandList.mockResolvedValue({
      code: 200,
      data: { records: [deletedBrand], total: 1 },
    });

    const wrapper = mountBrand();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    expect(mocks.reqGetDeletedBrandList).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("品牌回收站");
    // 被删记录以品牌名入表
    expect(wrapper.text()).toContain("待恢复品牌");
    // 顶部提示文案本身就含「已删除品牌」，所以它不能作为「行是否还在」的判据
    expect(wrapper.text()).toContain("已删除品牌将保留 30 天");
  });

  it("边界值：回收站为空时提示 warning 且不抛异常", async () => {
    const wrapper = mountBrand();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    expect(mocks.reqGetDeletedBrandList).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("品牌回收站");
    // 真实实现：列表为空时给出警告提示
    expect(mocks.messageWarning).toHaveBeenCalledTimes(1);
  });

  it("异常输入：回收站接口抛错时捕获错误并提示，不影响已渲染的品牌列表", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [{ id: 1, tmName: "华为", logoUrl: "http://img/1.png" }], total: 1 },
    });
    mocks.reqGetDeletedBrandList.mockRejectedValue(new Error("network boom"));

    const wrapper = mountBrand();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledWith("回收站数据加载失败");
    expect(wrapper.text()).toContain("华为");
  });
});

/* ------------------------------------------------------------------ *
 * 5. 恢复品牌（真实 useRecycleBin：成功后本地过滤，不重新拉取回收站）
 * ------------------------------------------------------------------ */
describe("恢复品牌", () => {
  it("点击恢复调用恢复接口（传 row.id），并回调刷新品牌列表", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [{ id: 1, tmName: "华为", logoUrl: "http://img/1.png" }], total: 1 },
    });
    mocks.reqGetDeletedBrandList.mockResolvedValue({
      code: 200,
      data: { records: [deletedBrand], total: 1 },
    });

    const wrapper = mountBrand();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("待恢复品牌");

    const restoreBtn = getButtonsByText(wrapper, "恢复")[0];
    expect(restoreBtn.exists()).toBe(true);
    await restoreBtn.trigger("click");
    await flushPromises();

    // 恢复接口收到的是回收站行的 id（11）
    expect(mocks.reqRestoreBrand).toHaveBeenCalledTimes(1);
    expect(mocks.reqRestoreBrand).toHaveBeenCalledWith(11);
    // 真实实现使用 restoreSuccessTip
    expect(mocks.messageSuccess).toHaveBeenCalledWith("恢复成功");
    // onRestored -> brand() 刷新品牌列表
    expect(mocks.getBrandList).toHaveBeenCalledTimes(2);
    // 真实实现只在本地过滤回收站列表，不会重新调用 fetchList
    expect(mocks.reqGetDeletedBrandList).toHaveBeenCalledTimes(1);
    // 用「只属于这一行的品牌名」判断该行已从回收站移除；
    // 不能用「已删除品牌」，因为顶部提示文案「已删除品牌将保留 30 天」本身就含这几个字
    expect(wrapper.text()).not.toContain("待恢复品牌");
  });

  it("恢复失败时提示错误，且不刷新品牌列表", async () => {
    mocks.getBrandList.mockResolvedValue({
      code: 200,
      data: { records: [], total: 0 },
    });
    mocks.reqGetDeletedBrandList.mockResolvedValue({
      code: 200,
      data: { records: [deletedBrand], total: 1 },
    });
    mocks.reqRestoreBrand.mockResolvedValue({ code: 500, message: "恢复失败" });

    const wrapper = mountBrand();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    await getButtonsByText(wrapper, "恢复")[0].trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledWith("恢复失败");
    // 恢复失败不应触发 onRestored，品牌列表只在挂载时请求过一次
    expect(mocks.getBrandList).toHaveBeenCalledTimes(1);
    // 失败时记录仍留在回收站
    expect(wrapper.text()).toContain("待恢复品牌");
  });
});
