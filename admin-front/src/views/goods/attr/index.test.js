import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, provide, inject } from "vue";

/* ------------------------------------------------------------------ *
 * happy-dom 未提供这些浏览器 API，element-plus 部分组件会用到，补最小桩
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
if (!globalThis.matchMedia) {
  globalThis.matchMedia = () => ({
    matches: false,
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
 * 模块 mock
 * - @/API/category：组件用到的四个接口全部 mock
 * - element-plus：只暴露 ElMessage（组件本体与真实 useRecycleBin 都取它）
 * - @/store/modules/category：组件通过 category() 拿到 C3Id / attrData / getArr
 * - @/utils/permission：模板中 v-hasBtn="PERM.GOODS_ATTR_WRITE" 需要 PERM 可求值
 * 注意：@/composables/useRecycleBin 不 mock，使用真实实现，
 * 因此断言要贴合真实实现（恢复成功后本地过滤 + onRestored，不重新拉取回收站）。
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  addUpdateReq: vi.fn(),
  deleteReq: vi.fn(),
  getDeletedArrList: vi.fn(),
  restoreArr: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  // 真实 useRecycleBin 在回收站为空时会调用 ElMessage.warning
  messageWarning: vi.fn(),
  getArr: vi.fn(),
  reset: vi.fn(),
  store: {
    C3Id: "",
    attrData: [],
  },
}));

vi.mock("@/API/category", () => ({
  addUpdateReq: mocks.addUpdateReq,
  deleteReq: mocks.deleteReq,
  getDeletedArrList: mocks.getDeletedArrList,
  restoreArr: mocks.restoreArr,
}));

vi.mock("element-plus", () => ({
  ElMessage: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    warning: mocks.messageWarning,
  },
}));

vi.mock("@/store/modules/category", () => ({
  default: () => ({
    C3Id: mocks.store.C3Id,
    attrData: mocks.store.attrData,
    getArr: mocks.getArr,
    $reset: mocks.reset,
  }),
}));

vi.mock("@/utils/permission", () => ({
  PERM: { GOODS_ATTR_WRITE: "goods:attr:write" },
}));

import AttrList from "./index.vue";

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

const ElDialogStub = {
  name: "ElDialog",
  props: { modelValue: Boolean, title: String, width: [String, Number] },
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
      validate: () => Promise.resolve(true),
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

// 组件模板里用了 <Category :flag="flag" />，测试环境没有全局注册，补一个桩
const CategoryStub = {
  name: "Category",
  props: { flag: [Number, String] },
  setup() {
    return () => h("div", { class: "category-stub" });
  },
};

const components = {
  ElCard: ElCardStub,
  ElButton: ElButtonStub,
  ElTable: ElTableStub,
  ElTableColumn: ElTableColumnStub,
  ElDialog: ElDialogStub,
  ElForm: ElFormStub,
  ElFormItem: ElFormItemStub,
  ElInput: ElInputStub,
  ElAlert: ElAlertStub,
  ElTag: ElTagStub,
  ElPopconfirm: ElPopconfirmStub,
  Category: CategoryStub,
};

const mountAttr = () =>
  mount(AttrList, {
    global: {
      components,
      // v-hasBtn / v-loading 只需要空指令桩；v-focus 是组件内部定义的局部指令
      directives: { loading: {}, hasBtn: {} },
    },
  });

/* ------------------------------------------------------------------ *
 * 测试数据与辅助函数
 * ------------------------------------------------------------------ */
const getButtonsByText = (wrapper, text) =>
  wrapper.findAllComponents(ElButtonStub).filter((btn) => btn.text().trim() === text);

const findButtonByIcon = (wrapper, icon) =>
  wrapper.findAllComponents(ElButtonStub).find((btn) => btn.props("icon") === icon);

const clickButtonByIcon = async (wrapper, icon) => {
  const btn = findButtonByIcon(wrapper, icon);
  if (!btn) throw new Error(`未找到 icon=${icon} 的按钮`);
  await btn.trigger("click");
  await flushPromises();
  return btn;
};

// 属性名称特意取「只会出现在测试数据里」的值，避免和模板中的固定文案冲突
const rowWithValues = {
  attrId: "5",
  attrName: "颜色",
  attrValueList: ["红", "蓝"],
};

// 回收站的删除记录（attrId 是恢复接口真正需要传的参数）
const deletedAttr = {
  attrId: 9,
  attrName: "尺码",
  attrValueList: ["S", "M"],
  deleteTime: "2024-01-01 00:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.store.C3Id = "3";
  mocks.store.attrData = [];
  mocks.addUpdateReq.mockResolvedValue({ code: 200, data: true });
  mocks.deleteReq.mockResolvedValue({ code: 200, data: true });
  mocks.getDeletedArrList.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.restoreArr.mockResolvedValue({ code: 200, data: true });
});

/* ------------------------------------------------------------------ *
 * 1. 保存（save）
 * ------------------------------------------------------------------ */
describe("保存商品属性（save）", () => {
  it("成功：走 addUpdateReq 提交表单数据，提示成功、刷新列表并回到列表态", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    // 通过「编辑」按钮进入编辑卡片（此时 attrValueList 非空，「保存」按钮可用）
    await clickButtonByIcon(wrapper, "Edit");
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(1);

    await getButtonsByText(wrapper, "保存")[0].trigger("click");
    await flushPromises();

    expect(mocks.addUpdateReq).toHaveBeenCalledTimes(1);
    expect(mocks.addUpdateReq).toHaveBeenCalledWith({
      attrId: "5",
      attrName: "颜色",
      attrValueList: ["红", "蓝"],
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("添加商品属性成功");
    expect(mocks.getArr).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).not.toHaveBeenCalled();
    // 保存成功后回到列表卡片（编辑卡片被销毁）
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(0);
  });

  it("失败：优先透传后端 message、提示错误、不刷新列表、仍停留在编辑态", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];
    mocks.addUpdateReq.mockResolvedValue({ code: 500, message: "属性保存失败啦" });

    const wrapper = mountAttr();
    await flushPromises();

    await clickButtonByIcon(wrapper, "Edit");
    await getButtonsByText(wrapper, "保存")[0].trigger("click");
    await flushPromises();

    // index.vue 的 save 失败分支已改为 getMessage(res, "添加商品属性失败")：
    // 响应里带了 message，因此优先展示后端返回的文案。
    expect(mocks.messageError).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).toHaveBeenCalledWith("属性保存失败啦");
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.getArr).not.toHaveBeenCalled();
    // 失败时仍停留在编辑态
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(1);
  });

  it("失败且响应无 message：回退到兜底文案「添加商品属性失败」", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];
    // 故意不提供 message 字段，验证 getMessage 的兜底分支
    mocks.addUpdateReq.mockResolvedValue({ code: 500 });

    const wrapper = mountAttr();
    await flushPromises();

    await clickButtonByIcon(wrapper, "Edit");
    await getButtonsByText(wrapper, "保存")[0].trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).toHaveBeenCalledWith("添加商品属性失败");
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.getArr).not.toHaveBeenCalled();
    // 失败时仍停留在编辑态
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * 2. 删除属性（deleteArr，软删除）
 * ------------------------------------------------------------------ */
describe("删除属性（deleteArr）", () => {
  it("成功：调用 deleteReq(row.attrId)，提示已移入回收站并刷新列表", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    const confirmBtn = wrapper.find(".popconfirm-confirm");
    expect(confirmBtn.exists()).toBe(true);
    await confirmBtn.trigger("click");
    await flushPromises();

    expect(mocks.deleteReq).toHaveBeenCalledTimes(1);
    expect(mocks.deleteReq).toHaveBeenCalledWith("5");
    expect(mocks.messageSuccess).toHaveBeenCalledWith("已移入回收站，30天内可恢复");
    expect(mocks.getArr).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).not.toHaveBeenCalled();
  });

  it("失败：透传后端 message，且不刷新列表", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];
    // 故意用一个「不可能是兜底文案」的 message，确保断言的是后端透传而不是兜底
    mocks.deleteReq.mockResolvedValue({ code: 500, message: "属性删除失败啦" });

    const wrapper = mountAttr();
    await flushPromises();

    await wrapper.find(".popconfirm-confirm").trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).toHaveBeenCalledWith("属性删除失败啦");
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.getArr).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * 3. 回收站（真实 useRecycleBin）
 * ------------------------------------------------------------------ */
describe("属性回收站", () => {
  it("「回收站」按钮能拉取已删除记录并渲染出来", async () => {
    mocks.getDeletedArrList.mockResolvedValue({
      code: 200,
      data: { records: [deletedAttr], total: 1 },
    });

    const wrapper = mountAttr();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    expect(mocks.getDeletedArrList).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".el-dialog").attributes("data-title")).toBe("商品属性回收站");
    expect(wrapper.text()).toContain("尺码");
  });

  it("恢复成功：restoreArr 收到 row.attrId，并触发 onRestored 刷新属性列表", async () => {
    mocks.getDeletedArrList.mockResolvedValue({
      code: 200,
      data: { records: [deletedAttr], total: 1 },
    });

    const wrapper = mountAttr();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    const restoreBtn = getButtonsByText(wrapper, "恢复")[0];
    expect(restoreBtn).toBeTruthy();
    await restoreBtn.trigger("click");
    await flushPromises();

    expect(mocks.restoreArr).toHaveBeenCalledTimes(1);
    expect(mocks.restoreArr).toHaveBeenCalledWith(9);
    // onRestored -> getArr 刷新属性列表
    expect(mocks.getArr).toHaveBeenCalledTimes(1);
    // 真实实现仅在本地过滤回收站列表，不会重新拉取
    expect(mocks.getDeletedArrList).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).not.toHaveBeenCalled();
  });

  it("恢复失败：透传后端 message，且不刷新属性列表", async () => {
    mocks.getDeletedArrList.mockResolvedValue({
      code: 200,
      data: { records: [deletedAttr], total: 1 },
    });
    // 同样使用「不可能是兜底文案」的 message
    mocks.restoreArr.mockResolvedValue({ code: 500, message: "属性恢复失败啦" });

    const wrapper = mountAttr();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    await getButtonsByText(wrapper, "恢复")[0].trigger("click");
    await flushPromises();

    expect(mocks.restoreArr).toHaveBeenCalledWith(9);
    expect(mocks.messageError).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).toHaveBeenCalledWith("属性恢复失败啦");
    expect(mocks.getArr).not.toHaveBeenCalled();
    // 失败时记录仍留在回收站
    expect(wrapper.text()).toContain("尺码");
  });
});

/* ------------------------------------------------------------------ *
 * 4. v-hasBtn 受控按钮：能正常渲染并触发对应方法
 * ------------------------------------------------------------------ */
describe("v-hasBtn 受控按钮", () => {
  it("列表卡片中的「添加属性 / 编辑 / 删除」三个受控按钮都能渲染", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    // 添加属性（带文案）
    expect(getButtonsByText(wrapper, "添加属性")).toHaveLength(1);
    // 编辑（图标按钮，无文案）
    expect(findButtonByIcon(wrapper, "Edit")).toBeTruthy();
    // 删除（图标按钮，无文案；「回收站」按钮虽然也是 Delete 图标但有文案，需排除）
    const deleteBtn = wrapper
      .findAllComponents(ElButtonStub)
      .find((btn) => btn.props("icon") === "Delete" && btn.text().trim() === "");
    expect(deleteBtn).toBeTruthy();
  });

  it("「添加属性」按钮触发 flagAdd：切到编辑卡片并重置表单", async () => {
    const wrapper = mountAttr();
    await flushPromises();

    await getButtonsByText(wrapper, "添加属性")[0].trigger("click");
    await flushPromises();

    expect(getButtonsByText(wrapper, "添加属性值")).toHaveLength(1);
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(1);
    expect(wrapper.find(".el-input").element.value).toBe("");
    expect(wrapper.findAll(".attr-value-text")).toHaveLength(0);
  });

  it("「编辑」按钮触发 flagEdit：进入编辑卡片并回填该行数据", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    await clickButtonByIcon(wrapper, "Edit");

    expect(getButtonsByText(wrapper, "保存")).toHaveLength(1);
    expect(wrapper.find(".el-input").element.value).toBe("颜色");
    expect(wrapper.findAll(".attr-value-text").map((node) => node.text())).toEqual(["红", "蓝"]);
  });

  it("编辑卡片中的「保存」按钮受 v-hasBtn 控制，能触发 save（走 addUpdateReq）", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    await clickButtonByIcon(wrapper, "Edit");
    await getButtonsByText(wrapper, "保存")[0].trigger("click");
    await flushPromises();

    expect(mocks.addUpdateReq).toHaveBeenCalledTimes(1);
  });

  it("回收站中的「恢复」按钮受 v-hasBtn 控制，能触发 restoreItem", async () => {
    mocks.getDeletedArrList.mockResolvedValue({
      code: 200,
      data: { records: [deletedAttr], total: 1 },
    });

    const wrapper = mountAttr();
    await flushPromises();

    await getButtonsByText(wrapper, "回收站")[0].trigger("click");
    await flushPromises();

    await getButtonsByText(wrapper, "恢复")[0].trigger("click");
    await flushPromises();

    expect(mocks.restoreArr).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * 5. 编辑回填 与 取消清空
 * ------------------------------------------------------------------ */
describe("编辑与取消", () => {
  it("flagEdit 回填：字符串属性值被转成可编辑对象（editFlag=1，展示文字态）", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    await clickButtonByIcon(wrapper, "Edit");

    expect(wrapper.find(".el-input").element.value).toBe("颜色");
    expect(wrapper.findAll(".attr-value-text").map((node) => node.text())).toEqual(["红", "蓝"]);
    // 编辑卡片里不应出现初始输入态
    expect(wrapper.findAll(".el-input")).toHaveLength(1);
  });

  it("cancel：放弃编辑回到列表态，且重新进入编辑时表单是干净的", async () => {
    mocks.store.attrData = [{ ...rowWithValues }];

    const wrapper = mountAttr();
    await flushPromises();

    // 先进入编辑态，并修改表单内容
    await clickButtonByIcon(wrapper, "Edit");
    await wrapper.find(".el-input").setValue("改过的属性名");
    expect(wrapper.find(".el-input").element.value).toBe("改过的属性名");

    // 点击「取消」（编辑卡片里有两个取消按钮，都绑定 cancel）
    const cancelBtns = getButtonsByText(wrapper, "取消");
    expect(cancelBtns).toHaveLength(2);
    await cancelBtns[0].trigger("click");
    await flushPromises();

    // 回到列表卡片
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(0);
    expect(getButtonsByText(wrapper, "添加属性")).toHaveLength(1);
    expect(wrapper.find(".attr-value-text").exists()).toBe(false);
    // 主列表仍然渲染
    expect(wrapper.find(".el-table").exists()).toBe(true);

    // 再次进入编辑态时，表单已被清空（说明 cancel -> resetForm 生效）
    await getButtonsByText(wrapper, "添加属性")[0].trigger("click");
    await flushPromises();

    expect(wrapper.find(".el-input").element.value).toBe("");
    expect(wrapper.findAll(".attr-value-text")).toHaveLength(0);
    expect(getButtonsByText(wrapper, "保存")).toHaveLength(1);
  });
});
