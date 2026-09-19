import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, nextTick, inject, provide } from "vue";

/* ------------------------------------------------------------------ *
 * 模块 mock
 * - @/API/audit/index 整体 mock，避免真实请求；
 * - element-plus 只保留 ElMessage（组件用它做提示），断言更直观；
 * - @/store/modules/user 是 pinia store，测试环境没有激活的 pinia，
 *   直接调用会抛错，因此替换成固定的「当前登录用户」；
 * - @/utils/permission 提供模板里 v-hasBtn 用的 PERM 常量；
 * - @/utils/format 只影响展示，固定成可预测的字符串。
 * 注意：@/composables/useRecycleBin 故意不 mock，
 *   组件里的 isSuccess / getMessage 走真实实现，
 *   这样「失败时透传后端 message」的断言才真正有意义。
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  getAuditList: vi.fn(),
  approveAudit: vi.fn(),
  rejectAudit: vi.fn(),
  batchAudit: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
  validate: vi.fn(),
}));

vi.mock("@/API/audit/index", () => ({
  getAuditList: mocks.getAuditList,
  approveAudit: mocks.approveAudit,
  rejectAudit: mocks.rejectAudit,
  batchAudit: mocks.batchAudit,
}));

vi.mock("element-plus", () => ({
  ElMessage: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    warning: mocks.messageWarning,
  },
  ElMessageBox: { confirm: vi.fn() },
}));

vi.mock("@/store/modules/user", () => ({
  default: () => ({ userName: "测试审核员" }),
}));

vi.mock("@/utils/permission", () => ({
  PERM: { GOODS_REVIEW_AUDIT: "goods:review:audit" },
}));

vi.mock("@/utils/format", () => ({
  formatTime: (value) => (value ? `T(${value})` : "-"),
}));

import ReviewList from "./index.vue";
import { PERM } from "@/utils/permission";

/* ------------------------------------------------------------------ *
 * v-hasBtn 指令桩：记录指令值，用来断言「四处控件的权限码都是
 * PERM.GOODS_REVIEW_AUDIT」。指令本身不做任何权限判断（空实现语义）。
 * ------------------------------------------------------------------ */
const hasBtnValues = [];
const hasBtnDirective = {
  mounted(el, binding) {
    hasBtnValues.push(binding.value);
  },
};

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

const ElRadioGroupStub = {
  name: "ElRadioGroup",
  props: { modelValue: [Number, String] },
  emits: ["update:modelValue", "change"],
  setup(props, { slots }) {
    return () => h("div", { class: "el-radio-group" }, slots.default ? slots.default() : []);
  },
};

const ElRadioButtonStub = {
  name: "ElRadioButton",
  props: { value: [Number, String], label: [Number, String] },
  setup(props, { slots }) {
    return () => h("label", { class: "el-radio-button" }, slots.default ? slots.default() : []);
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
  emits: ["selection-change"],
  setup(props, { slots }) {
    provide("__tableRows", () => props.data);
    return () =>
      h("div", { class: "el-table" }, [
        ...(slots.default ? slots.default() : []),
        props.data.length === 0 && props.emptyText
          ? h("div", { class: "el-table__empty-text" }, props.emptyText)
          : null,
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
    selectable: [Function, Boolean],
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
              : props.type === "index"
                ? String(index + 1)
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
          "data-visible": String(Boolean(props.modelValue)),
          style: props.modelValue ? "" : "display:none",
        },
        [slots.default ? slots.default() : null, slots.footer ? slots.footer() : null],
      );
  },
};

const ElFormStub = {
  name: "ElForm",
  props: { model: Object, rules: [Object, Array], inline: Boolean, labelWidth: [String, Number] },
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
  props: {
    modelValue: { default: "" },
    placeholder: String,
    type: String,
    rows: [String, Number],
    clearable: Boolean,
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => {
      const onInput = (event) => emit("update:modelValue", event.target.value);
      // textarea 与 input 分开渲染，方便测试里按标签定位表单
      return props.type === "textarea"
        ? h("textarea", {
            class: "el-textarea",
            value: props.modelValue,
            placeholder: props.placeholder,
            onInput,
          })
        : h("input", {
            class: "el-input",
            value: props.modelValue,
            placeholder: props.placeholder,
            onInput,
          });
    };
  },
};

const ElImageStub = {
  name: "ElImage",
  props: { src: String, fit: String },
  setup(props) {
    return () => h("img", { class: "el-image", src: props.src });
  },
};

const ElTagStub = {
  name: "ElTag",
  props: { type: String },
  setup(props, { slots }) {
    return () =>
      h("span", { class: "el-tag", "data-type": props.type }, slots.default ? slots.default() : []);
  },
};

const ElAlertStub = {
  name: "ElAlert",
  props: { type: String, closable: Boolean, showIcon: Boolean, title: String },
  setup(props, { slots }) {
    return () => h("div", { class: "el-alert" }, slots.default ? slots.default() : []);
  },
};

const components = {
  ElCard: ElCardStub,
  ElButton: ElButtonStub,
  ElRadioGroup: ElRadioGroupStub,
  ElRadioButton: ElRadioButtonStub,
  ElTable: ElTableStub,
  ElTableColumn: ElTableColumnStub,
  ElPagination: ElPaginationStub,
  ElDialog: ElDialogStub,
  ElForm: ElFormStub,
  ElFormItem: ElFormItemStub,
  ElInput: ElInputStub,
  ElImage: ElImageStub,
  ElTag: ElTagStub,
  ElAlert: ElAlertStub,
};

const mountReview = () =>
  mount(ReviewList, {
    global: {
      components,
      // loading / hasBtn 都是空指令桩，只保证模板能正常渲染
      directives: { loading: {}, hasBtn: hasBtnDirective },
    },
  });

/* ------------------------------------------------------------------ *
 * 测试数据与辅助函数
 * ------------------------------------------------------------------ */
const pendingAudit = {
  id: 101,
  skuId: 1,
  skuName: "测试SKU-待审核",
  skuDefaultImg: "http://img/101.png",
  price: 199,
  weight: 1.2,
  targetIsSale: 1,
  currentIsSale: 0,
  status: 0,
  applyUserName: "张三",
  applyTime: "2024-05-01 10:00:00",
  auditUserName: "",
  auditTime: "",
  auditRemark: "",
};

const pendingAudit2 = {
  ...pendingAudit,
  id: 104,
  skuName: "测试SKU-待审核2",
  targetIsSale: 0,
  currentIsSale: 1,
};

const approvedAudit = {
  ...pendingAudit,
  id: 102,
  skuName: "测试SKU-已通过",
  status: 1,
  auditUserName: "李四",
  auditTime: "2024-05-02 09:00:00",
  auditRemark: "同意上架",
};

const rejectedAudit = {
  ...pendingAudit,
  id: 103,
  skuName: "测试SKU-已驳回",
  status: 2,
  auditUserName: "李四",
  auditTime: "2024-05-02 09:30:00",
  auditRemark: "图片不合规",
};

// 按文案「精确匹配」按钮：trim 后必须完全相等。
// 不能用 includes 之类的包含匹配：否则 "驳回" 会同时命中工具栏的 "批量驳回"，
// 既会让 toHaveLength 的计数失真，也会让 [0] 取到工具栏按钮（点错按钮）。
const getButtonsByText = (wrapper, text) =>
  wrapper.findAllComponents(ElButtonStub).filter((btn) => btn.text().trim() === text);

// 模拟 el-table 抛出的 selection-change
const selectRows = async (wrapper, rows) => {
  wrapper.findComponent(ElTableStub).vm.$emit("selection-change", rows);
  await nextTick();
};

// 打开驳回弹窗并提交
const openRejectDialogByClick = async (wrapper, buttonText) => {
  const btn = getButtonsByText(wrapper, buttonText)[0];
  expect(btn.exists()).toBe(true);
  await btn.trigger("click");
  await nextTick();
  return wrapper.find(".el-dialog");
};

beforeEach(() => {
  vi.clearAllMocks();
  hasBtnValues.length = 0;
  mocks.validate.mockResolvedValue(true);
  mocks.getAuditList.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.approveAudit.mockResolvedValue({ code: 200, data: true });
  mocks.rejectAudit.mockResolvedValue({ code: 200, data: true });
  mocks.batchAudit.mockResolvedValue({ code: 200, data: true });
});

/* ------------------------------------------------------------------ *
 * 1. 列表拉取（onBeforeMount）
 * ------------------------------------------------------------------ */
describe("审核列表拉取", () => {
  it("挂载时按默认条件（第 1 页 / 待审核 / 无关键字）请求并渲染数据", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit, approvedAudit, rejectedAudit], total: 3 },
    });

    const wrapper = mountReview();
    await flushPromises();

    expect(mocks.getAuditList).toHaveBeenCalledTimes(1);
    // statusFilter 默认 0（待审核），keyword 为空
    expect(mocks.getAuditList).toHaveBeenCalledWith(1, 10, 0, "");

    expect(wrapper.find(".el-pagination").attributes("data-total")).toBe("3");
    expect(wrapper.text()).toContain("测试SKU-待审核");
    expect(wrapper.text()).toContain("测试SKU-已通过");
    expect(wrapper.text()).toContain("测试SKU-已驳回");
    // 申请人 / 审核留痕
    expect(wrapper.text()).toContain("张三");
    expect(wrapper.text()).toContain("李四");
    expect(wrapper.text()).toContain("同意上架");
  });

  it("边界值：接口返回空列表时不渲染任何行，但表格与分页仍在", async () => {
    const wrapper = mountReview();
    await flushPromises();

    expect(wrapper.find(".el-table").exists()).toBe(true);
    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
    expect(wrapper.find(".el-pagination").attributes("data-total")).toBe("0");
  });

  it("异常输入：接口返回非 200 时只记录日志，列表保持为空（兜底不抛异常）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAuditList.mockResolvedValue({ code: 500, message: "服务异常" });

    const wrapper = mountReview();
    await flushPromises();

    expect(mocks.getAuditList).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
    expect(wrapper.find(".el-table__empty-text").text()).toBe("暂无审核记录");
    expect(wrapper.find(".el-pagination").attributes("data-total")).toBe("0");

    errorSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ *
 * 2. 单条审核通过 approveOne
 * ------------------------------------------------------------------ */
describe("单条审核通过", () => {
  it("点击「通过」提交 approveAudit（带审核人）并刷新列表", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });

    const wrapper = mountReview();
    await flushPromises();

    const approveButtons = getButtonsByText(wrapper, "通过");
    expect(approveButtons).toHaveLength(1);

    await approveButtons[0].trigger("click");
    await flushPromises();

    expect(mocks.approveAudit).toHaveBeenCalledTimes(1);
    expect(mocks.approveAudit).toHaveBeenCalledWith({
      auditId: 101,
      auditUserName: "测试审核员",
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("审核通过，商品状态已更新");
    // 成功后重新拉取列表
    expect(mocks.getAuditList).toHaveBeenCalledTimes(2);
  });

  it("失败（403 无权限）时透传后端 message，且不刷新列表", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });
    mocks.approveAudit.mockResolvedValue({
      code: 403,
      message: "无权限执行该操作（当前角色：xx）",
    });

    const wrapper = mountReview();
    await flushPromises();

    await getButtonsByText(wrapper, "通过")[0].trigger("click");
    await flushPromises();

    // 真实 getMessage 会优先取后端 message
    expect(mocks.messageError).toHaveBeenCalledWith("无权限执行该操作（当前角色：xx）");
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    // 只有挂载时那一次请求
    expect(mocks.getAuditList).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * 3. 批量通过 batchApprove
 * ------------------------------------------------------------------ */
describe("批量通过", () => {
  it("未勾选时按钮禁用；勾选后点击提交 batchAudit(action=approve) 并清空勾选", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit, pendingAudit2], total: 2 },
    });

    const wrapper = mountReview();
    await flushPromises();

    // 未勾选 -> 禁用
    expect(getButtonsByText(wrapper, "批量通过")[0].element.disabled).toBe(true);

    await selectRows(wrapper, [pendingAudit, pendingAudit2]);
    expect(getButtonsByText(wrapper, "批量通过")[0].element.disabled).toBe(false);

    await getButtonsByText(wrapper, "批量通过")[0].trigger("click");
    await flushPromises();

    expect(mocks.batchAudit).toHaveBeenCalledTimes(1);
    expect(mocks.batchAudit).toHaveBeenCalledWith({
      auditIds: [101, 104],
      action: "approve",
      auditUserName: "测试审核员",
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("批量审核通过，商品状态已更新");
    expect(mocks.getAuditList).toHaveBeenCalledTimes(2);
  });

  it("失败时提示后端 message，且不刷新列表", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit, pendingAudit2], total: 2 },
    });
    mocks.batchAudit.mockResolvedValue({ code: 500, message: "批量审核失败" });

    const wrapper = mountReview();
    await flushPromises();

    await selectRows(wrapper, [pendingAudit, pendingAudit2]);
    await getButtonsByText(wrapper, "批量通过")[0].trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledWith("批量审核失败");
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.getAuditList).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * 4. 驳回：openRejectDialog -> confirmReject（单条 + 批量）
 * ------------------------------------------------------------------ */
describe("驳回审核申请", () => {
  it("单条驳回：弹窗标题为「驳回审核申请」，填写理由后提交 rejectAudit", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });

    const wrapper = mountReview();
    await flushPromises();

    const dialog = await openRejectDialogByClick(wrapper, "驳回");
    expect(dialog.attributes("data-visible")).toBe("true");
    expect(dialog.attributes("data-title")).toBe("驳回审核申请");
    expect(dialog.text()).toContain("测试SKU-待审核");

    await dialog.find("textarea").setValue("图片不合规，请重新上传");
    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalledTimes(1);
    expect(mocks.rejectAudit).toHaveBeenCalledTimes(1);
    expect(mocks.rejectAudit).toHaveBeenCalledWith({
      auditId: 101,
      auditUserName: "测试审核员",
      auditRemark: "图片不合规，请重新上传",
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("已驳回，商品上下架状态保持不变");
    expect(mocks.getAuditList).toHaveBeenCalledTimes(2);
    // 成功后弹窗关闭
    expect(wrapper.find(".el-dialog").attributes("data-visible")).toBe("false");
  });

  it("单条驳回失败时提示后端 message，弹窗保持打开且不刷新列表", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });
    mocks.rejectAudit.mockResolvedValue({
      code: 403,
      message: "无权限执行该操作（当前角色：xx）",
    });

    const wrapper = mountReview();
    await flushPromises();

    const dialog = await openRejectDialogByClick(wrapper, "驳回");
    await dialog.find("textarea").setValue("资料不全");
    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledWith("无权限执行该操作（当前角色：xx）");
    expect(mocks.getAuditList).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".el-dialog").attributes("data-visible")).toBe("true");
  });

  it("批量驳回：标题为「批量驳回审核申请」，提交 batchAudit(action=reject)", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit, pendingAudit2], total: 2 },
    });

    const wrapper = mountReview();
    await flushPromises();

    await selectRows(wrapper, [pendingAudit, pendingAudit2]);
    const dialog = await openRejectDialogByClick(wrapper, "批量驳回");
    expect(dialog.attributes("data-title")).toBe("批量驳回审核申请");
    expect(dialog.text()).toContain("2");

    await dialog.find("textarea").setValue("本批次资料不完整");
    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.batchAudit).toHaveBeenCalledTimes(1);
    expect(mocks.batchAudit).toHaveBeenCalledWith({
      auditIds: [101, 104],
      action: "reject",
      auditUserName: "测试审核员",
      auditRemark: "本批次资料不完整",
    });
    expect(mocks.rejectAudit).not.toHaveBeenCalled();
    expect(mocks.getAuditList).toHaveBeenCalledTimes(2);
  });

  it("驳回理由为空（validate 返回 false）时不调用接口，弹窗保持打开", async () => {
    mocks.validate.mockResolvedValue(false);
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });

    const wrapper = mountReview();
    await flushPromises();

    await openRejectDialogByClick(wrapper, "驳回");
    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalledTimes(1);
    expect(mocks.rejectAudit).not.toHaveBeenCalled();
    expect(mocks.batchAudit).not.toHaveBeenCalled();
    expect(mocks.messageError).not.toHaveBeenCalled();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(wrapper.find(".el-dialog").attributes("data-visible")).toBe("true");
    expect(mocks.getAuditList).toHaveBeenCalledTimes(1);
  });

  it("校验抛异常（validate reject）时同样按校验失败处理，不调用接口", async () => {
    mocks.validate.mockRejectedValue(new Error("validate rejected"));
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });

    const wrapper = mountReview();
    await flushPromises();

    await openRejectDialogByClick(wrapper, "驳回");
    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.rejectAudit).not.toHaveBeenCalled();
    expect(wrapper.find(".el-dialog").attributes("data-visible")).toBe("true");
  });
});

/* ------------------------------------------------------------------ *
 * 5. v-hasBtn 权限指令 + 按钮渲染 / 触发
 * ------------------------------------------------------------------ */
describe("v-hasBtn 权限指令与操作按钮", () => {
  it("四处受控按钮的指令值都是 PERM.GOODS_REVIEW_AUDIT", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });

    const wrapper = mountReview();
    await flushPromises();

    // 批量通过 / 批量驳回 / 单条通过 / 单条驳回
    expect(hasBtnValues.length).toBeGreaterThanOrEqual(4);
    hasBtnValues.forEach((value) => {
      expect(value).toBe(PERM.GOODS_REVIEW_AUDIT);
    });
    expect(wrapper.find(".el-button").exists()).toBe(true);
  });

  it("四个按钮都能正常渲染，且点击后触发对应方法", async () => {
    // 只放一条待审核记录：单条操作按钮是按行渲染的，
    // 多条待审核数据会让「通过 / 驳回」的计数不再唯一。
    // 保持只有一行，"单条操作按钮各 1 个" 才是确定的精确断言。
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [pendingAudit], total: 1 },
    });

    const wrapper = mountReview();
    await flushPromises();

    expect(getButtonsByText(wrapper, "批量通过")).toHaveLength(1);
    expect(getButtonsByText(wrapper, "批量驳回")).toHaveLength(1);
    expect(getButtonsByText(wrapper, "通过")).toHaveLength(1);
    expect(getButtonsByText(wrapper, "驳回")).toHaveLength(1);

    // 单条通过 -> approveAudit
    await getButtonsByText(wrapper, "通过")[0].trigger("click");
    await flushPromises();
    expect(mocks.approveAudit).toHaveBeenCalledTimes(1);

    // 单条驳回 -> 打开驳回弹窗（不提交接口，仅验证触发）
    await getButtonsByText(wrapper, "驳回")[0].trigger("click");
    await nextTick();
    expect(wrapper.find(".el-dialog").attributes("data-visible")).toBe("true");
  });

  it("已处理的行不再渲染单条操作按钮，只展示「已处理」", async () => {
    mocks.getAuditList.mockResolvedValue({
      code: 200,
      data: { records: [approvedAudit, rejectedAudit], total: 2 },
    });

    const wrapper = mountReview();
    await flushPromises();

    // 没有待审核单据 -> 单条操作按钮不渲染
    expect(getButtonsByText(wrapper, "通过")).toHaveLength(0);
    expect(getButtonsByText(wrapper, "驳回")).toHaveLength(0);
    // 批量按钮仍然渲染（只是禁用）
    expect(getButtonsByText(wrapper, "批量通过")).toHaveLength(1);
    expect(getButtonsByText(wrapper, "批量驳回")).toHaveLength(1);
    expect(wrapper.text()).toContain("已处理");
    // 只有批量两个按钮挂了权限码
    expect(hasBtnValues).toHaveLength(2);
  });
});
