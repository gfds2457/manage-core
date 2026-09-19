import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, provide, inject } from "vue";

/* ------------------------------------------------------------------ *
 * 模块 mock
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  getPermission: vi.fn(),
  AddPermission: vi.fn(),
  UpdatePermission: vi.fn(),
  DeletePermission: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock("@/API/role", () => ({
  getPermission: mocks.getPermission,
}));

vi.mock("@/API/menu", () => ({
  AddPermission: mocks.AddPermission,
  UpdatePermission: mocks.UpdatePermission,
  DeletePermission: mocks.DeletePermission,
}));

vi.mock("element-plus", () => ({
  ElMessage: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
  },
}));

import MenuList from "./index.vue";

/* ------------------------------------------------------------------ *
 * Element Plus stub
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
  setup(props, { slots }) {
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

const components = {
  ElCard: ElCardStub,
  ElButton: ElButtonStub,
  ElTable: ElTableStub,
  ElTableColumn: ElTableColumnStub,
  ElDialog: ElDialogStub,
  ElForm: ElFormStub,
  ElFormItem: ElFormItemStub,
  ElInput: ElInputStub,
};

const mountMenu = () =>
  mount(MenuList, {
    global: {
      components,
      directives: {},
    },
  });

/* ------------------------------------------------------------------ *
 * 辅助函数与夹具
 * ------------------------------------------------------------------ */
const getButtonsByText = (wrapper, text) =>
  wrapper.findAllComponents(ElButtonStub).filter((btn) => btn.text().trim() === text);

// 行内按钮：仅取未 disabled 的（菜单行 type=1 的「编辑 / 删除」是禁用的）
const getEnabledButtonsByText = (wrapper, text) =>
  getButtonsByText(wrapper, text).filter((btn) => !btn.props("disabled"));

// 弹窗内的两个输入框（名称 / 权限值）
const dialogInputs = (wrapper) => wrapper.findAll(".el-dialog .el-input");

const menuRow = { id: 2, pid: 1, name: "商品管理", code: "goods", type: 1 };
const permRow = { id: 3, pid: 2, name: "商品查询", code: "goods:query", type: 2 };

const permissionTree = () => ({
  code: 200,
  data: [
    {
      id: 1,
      pid: 0,
      name: "全部",
      code: "all",
      type: 0,
      children: [{ ...menuRow }, { ...permRow }],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPermission.mockResolvedValue(permissionTree());
  mocks.AddPermission.mockResolvedValue({ code: 200 });
  mocks.UpdatePermission.mockResolvedValue({ code: 200 });
  mocks.DeletePermission.mockResolvedValue({ code: 200 });
});

/* ------------------------------------------------------------------ *
 * 1. 菜单树渲染
 * ------------------------------------------------------------------ */
describe("菜单树渲染", () => {
  it("挂载时请求权限列表并渲染菜单 / 权限节点", async () => {
    const wrapper = mountMenu();
    await flushPromises();

    expect(mocks.getPermission).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("商品管理");
    expect(wrapper.text()).toContain("goods");
    expect(wrapper.text()).toContain("商品查询");
    expect(wrapper.text()).toContain("goods:query");
  });

  it("边界值：没有子节点时表格存在但不渲染任何行", async () => {
    mocks.getPermission.mockResolvedValue({
      code: 200,
      data: [{ id: 1, pid: 0, name: "全部", code: "all", type: 0, children: [] }],
    });

    const wrapper = mountMenu();
    await flushPromises();

    expect(wrapper.find(".el-table").exists()).toBe(true);
    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
  });

  it("异常输入：权限接口返回非 200 时不抛异常且不渲染数据", async () => {
    mocks.getPermission.mockResolvedValue({ code: 500, message: "服务异常" });

    const wrapper = mountMenu();
    await flushPromises();

    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. 新增：无 id -> 走新增接口；pid 取当前行的 pid
 * ------------------------------------------------------------------ */
describe("新增菜单 / 权限", () => {
  it("新增时 pid 取当前行的 pid（父节点 id），且走新增接口", async () => {
    const wrapper = mountMenu();
    await flushPromises();

    // type=1 的行按钮文案是「添加菜单」
    await getButtonsByText(wrapper, "添加菜单")[0].trigger("click");
    await flushPromises();

    const inputs = dialogInputs(wrapper);
    expect(inputs).toHaveLength(2);
    await inputs[0].setValue("新增菜单");
    await inputs[1].setValue("new:menu");

    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.AddPermission).toHaveBeenCalledTimes(1);
    // pid 必须是父节点 id（即当前行的 pid=1），而不是行自身 id(2)
    expect(mocks.AddPermission).toHaveBeenCalledWith({
      name: "新增菜单",
      code: "new:menu",
      pid: 1,
      type: 1,
    });
    expect(mocks.UpdatePermission).not.toHaveBeenCalled();
  });

  it("在权限行（type=2）上新增时 type 记为 2、pid 取该行 pid", async () => {
    const wrapper = mountMenu();
    await flushPromises();

    await getButtonsByText(wrapper, "添加权限")[0].trigger("click");
    await flushPromises();

    const inputs = dialogInputs(wrapper);
    await inputs[0].setValue("新增权限");
    await inputs[1].setValue("new:perm");

    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.AddPermission).toHaveBeenCalledWith({
      name: "新增权限",
      code: "new:perm",
      pid: 2,
      type: 2,
    });
    expect(mocks.UpdatePermission).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ *
 * 3. 编辑：表单 id / pid 分别回填，保存走更新接口
 *    说明：pid 不出现在任何请求体或 DOM 中，无法直接断言；
 *    这里用「保存用的是节点自身 id(3) 而不是它的 pid(2)」以及
 *    「编辑后紧接新增时 pid 不被污染」两条用例等价覆盖 id / pid 分离这一修复点。
 * ------------------------------------------------------------------ */
describe("编辑菜单 / 权限", () => {
  it("编辑时表单 id 回填为节点自身 id，保存走更新接口（不是拿 pid 当 id）", async () => {
    const wrapper = mountMenu();
    await flushPromises();

    // 只有 type !== 1 的行「编辑」按钮可用，这里点击权限行（id=3, pid=2）
    await getEnabledButtonsByText(wrapper, "编辑")[0].trigger("click");
    await flushPromises();

    // 回填：名称 / 权限值 来自该行
    const inputs = dialogInputs(wrapper);
    expect(inputs[0].element.value).toBe("商品查询");
    expect(inputs[1].element.value).toBe("goods:query");
    // 弹窗标题进入「编辑」态
    expect(wrapper.find(".el-dialog").attributes("data-title")).toBe("编辑权限");

    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    expect(mocks.UpdatePermission).toHaveBeenCalledTimes(1);
    // 用的是节点自身 id(3)
    expect(mocks.UpdatePermission).toHaveBeenCalledWith({
      id: 3,
      name: "商品查询",
      code: "goods:query",
    });
    // 绝不能把 pid(2) 当成 id 提交（旧 bug：id 与 pid 混用）
    expect(mocks.UpdatePermission).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
    expect(mocks.AddPermission).not.toHaveBeenCalled();
  });

  it("编辑后再次新增：id 被清空（走新增接口），pid 也不被上一次编辑的行污染", async () => {
    const wrapper = mountMenu();
    await flushPromises();

    // 先编辑权限行：form.id=3、form.pid=2
    await getEnabledButtonsByText(wrapper, "编辑")[0].trigger("click");
    await flushPromises();

    // 不保存，直接对菜单行新增
    await getButtonsByText(wrapper, "添加菜单")[0].trigger("click");
    await flushPromises();

    const inputs = dialogInputs(wrapper);
    await inputs[0].setValue("新增菜单");
    await inputs[1].setValue("new:menu");
    await getButtonsByText(wrapper, "确定")[0].trigger("click");
    await flushPromises();

    // 无 id -> 走新增；pid 取菜单行的 pid(1)，而不是上一次编辑残留的 id(3) / pid(2)
    expect(mocks.AddPermission).toHaveBeenCalledWith({
      name: "新增菜单",
      code: "new:menu",
      pid: 1,
      type: 1,
    });
  });
});

/* ------------------------------------------------------------------ *
 * 4. 删除：传给接口的是 row.id，而不是 row.pid
 * ------------------------------------------------------------------ */
describe("删除菜单 / 权限", () => {
  it("删除传给接口的是 row.id 而非 row.pid", async () => {
    const wrapper = mountMenu();
    await flushPromises();

    await getEnabledButtonsByText(wrapper, "删除")[0].trigger("click");
    await flushPromises();

    expect(mocks.DeletePermission).toHaveBeenCalledTimes(1);
    expect(mocks.DeletePermission).toHaveBeenCalledWith(3); // 权限行 id
    expect(mocks.DeletePermission).not.toHaveBeenCalledWith(2); // 权限行 pid
    // 删除成功后刷新列表
    expect(mocks.getPermission).toHaveBeenCalledTimes(2);
  });

  it("异常输入：删除失败时提示错误且不刷新列表", async () => {
    mocks.DeletePermission.mockResolvedValue({ code: 500, message: "删除失败" });

    const wrapper = mountMenu();
    await flushPromises();

    await getEnabledButtonsByText(wrapper, "删除")[0].trigger("click");
    await flushPromises();

    expect(mocks.messageError).toHaveBeenCalledWith("删除失败");
    expect(mocks.getPermission).toHaveBeenCalledTimes(1);
  });
});
