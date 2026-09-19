import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, provide, inject } from "vue";

/* ------------------------------------------------------------------ *
 * 模块 mock
 * ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  reUserInfo: vi.fn(),
  reAddOrUpdateUser: vi.fn(),
  reUserList: vi.fn(),
  reUpdateUserRole: vi.fn(),
  reDeleteUserRole: vi.fn(),
  reSearchUser: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
  validate: vi.fn(),
  userLogout: vi.fn(),
}));

vi.mock("@/API/user", () => ({
  reUserInfo: mocks.reUserInfo,
  reAddOrUpdateUser: mocks.reAddOrUpdateUser,
  reUserList: mocks.reUserList,
  reUpdateUserRole: mocks.reUpdateUserRole,
  reDeleteUserRole: mocks.reDeleteUserRole,
  reSearchUser: mocks.reSearchUser,
}));

vi.mock("element-plus", () => ({
  ElMessage: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    warning: mocks.messageWarning,
  },
}));

// 用户 store：id 刻意与测试数据错开，避免命中「编辑当前用户 -> location.reload()」分支
vi.mock("@/store/modules/user", () => ({
  default: () => ({ id: 999, userLogout: mocks.userLogout }),
}));

import UserManage from "./index.vue";

/* ------------------------------------------------------------------ *
 * Element Plus stub（全部用 render 函数，避免运行期模板编译）
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
  emits: ["selection-change"],
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

const ElDrawerStub = {
  name: "ElDrawer",
  props: {
    modelValue: Boolean,
    title: String,
    direction: String,
    size: [String, Number],
  },
  emits: ["update:modelValue"],
  setup(props, { slots }) {
    return () =>
      h(
        "div",
        {
          class: "el-drawer",
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

// 抽屉里新增的「用户角色」多选下拉，仅用于渲染，交互由 editUser 回填驱动
const ElSelectStub = {
  name: "ElSelect",
  props: {
    modelValue: [Array, String, Number],
    multiple: Boolean,
    placeholder: String,
  },
  emits: ["update:modelValue", "change"],
  setup(props, { slots }) {
    return () => h("div", { class: "el-select" }, slots.default ? slots.default() : []);
  },
};

const ElOptionStub = {
  name: "ElOption",
  props: { label: [String, Number], value: [String, Number] },
  setup(props, { slots }) {
    return () => h("div", { class: "el-option" }, slots.default ? slots.default() : []);
  },
};

const ElCheckboxStub = {
  name: "ElCheckbox",
  props: {
    modelValue: [Boolean, Array, String],
    label: [String, Number],
    value: [String, Number],
    indeterminate: Boolean,
  },
  emits: ["update:modelValue", "change"],
  setup(props, { slots }) {
    return () => h("label", { class: "el-checkbox" }, slots.default ? slots.default() : []);
  },
};

// 把 modelValue 暴露到 data-checked 上，方便断言「分配角色抽屉的勾选内容」
const ElCheckboxGroupStub = {
  name: "ElCheckboxGroup",
  props: { modelValue: { type: Array, default: () => [] } },
  emits: ["update:modelValue", "change"],
  setup(props, { slots }) {
    return () =>
      h(
        "div",
        {
          class: "el-checkbox-group",
          "data-checked": JSON.stringify(props.modelValue ?? []),
        },
        slots.default ? slots.default() : [],
      );
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
  ElDrawer: ElDrawerStub,
  ElForm: ElFormStub,
  ElFormItem: ElFormItemStub,
  ElInput: ElInputStub,
  ElSelect: ElSelectStub,
  ElOption: ElOptionStub,
  ElCheckbox: ElCheckboxStub,
  ElCheckboxGroup: ElCheckboxGroupStub,
  ElPopconfirm: ElPopconfirmStub,
};

const mountUser = () =>
  mount(UserManage, {
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

// 搜索卡片里的 el-input（页面里还有抽屉内的多个 el-input，必须按容器限定）
const searchInput = (wrapper) => wrapper.find(".search-form .el-input");

const currentPageAttr = (wrapper) =>
  wrapper.find(".el-pagination").attributes("data-current-page");

const checkedRolesAttr = (wrapper) =>
  wrapper.find(".el-checkbox-group").attributes("data-checked");

const userRow = {
  id: 1,
  username: "张三",
  name: "小张",
  roleName: "管理员",
  createTime: "2024-01-01 00:00:00",
  updateTime: "2024-01-02 00:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validate.mockResolvedValue(true);
  mocks.reUserInfo.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.reSearchUser.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });
  mocks.reUserList.mockResolvedValue({ code: 200, data: [] });
  mocks.reUpdateUserRole.mockResolvedValue({ code: 200, data: true });
  mocks.reDeleteUserRole.mockResolvedValue({ code: 200, data: true });
  mocks.reAddOrUpdateUser.mockResolvedValue({ code: 200, data: true });
});

/* ------------------------------------------------------------------ *
 * 1. 用户列表渲染
 * ------------------------------------------------------------------ */
describe("用户列表渲染", () => {
  it("挂载时按第一页（pageSize=5）请求并渲染用户列表", async () => {
    mocks.reUserInfo.mockResolvedValue({
      code: 200,
      data: { records: [userRow], total: 1 },
    });

    const wrapper = mountUser();
    await flushPromises();

    expect(mocks.reUserInfo).toHaveBeenCalledTimes(1);
    expect(mocks.reUserInfo).toHaveBeenCalledWith(1, 5);
    expect(wrapper.text()).toContain("张三");
    expect(wrapper.text()).toContain("管理员");
    expect(wrapper.find(".el-pagination").attributes("data-total")).toBe("1");
  });

  it("挂载时加载角色列表，供抽屉下拉使用", async () => {
    mountUser();
    await flushPromises();

    expect(mocks.reUserList).toHaveBeenCalledTimes(1);
  });

  it("边界值：空列表时表格存在但不渲染任何用户行", async () => {
    const wrapper = mountUser();
    await flushPromises();

    expect(wrapper.find(".el-table").exists()).toBe(true);
    expect(mocks.reUserInfo).toHaveBeenCalledWith(1, 5);
    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
  });

  it("异常输入：列表接口返回非 200 时不抛异常且不渲染数据", async () => {
    mocks.reUserInfo.mockResolvedValue({ code: 500, message: "服务异常" });

    const wrapper = mountUser();
    await flushPromises();

    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. 关键字搜索
 * ------------------------------------------------------------------ */
describe("关键字搜索", () => {
  it("输入用户名点击搜索时，按关键字调用搜索接口并渲染结果", async () => {
    mocks.reSearchUser.mockResolvedValue({
      code: 200,
      data: { records: [{ ...userRow, id: 2, username: "李四" }], total: 1 },
    });

    const wrapper = mountUser();
    await flushPromises();

    await searchInput(wrapper).setValue("李四");
    await getButtonsByText(wrapper, "搜索")[0].trigger("click");
    await flushPromises();

    expect(mocks.reSearchUser).toHaveBeenCalledTimes(1);
    expect(mocks.reSearchUser).toHaveBeenCalledWith({ keyword: "李四" });
    expect(wrapper.text()).toContain("李四");
  });

  it("边界值：搜索无结果时表格不渲染任何行", async () => {
    mocks.reSearchUser.mockResolvedValue({ code: 200, data: { records: [], total: 0 } });

    const wrapper = mountUser();
    await flushPromises();

    await searchInput(wrapper).setValue("不存在");
    await getButtonsByText(wrapper, "搜索")[0].trigger("click");
    await flushPromises();

    expect(mocks.reSearchUser).toHaveBeenCalledWith({ keyword: "不存在" });
    expect(wrapper.findAll(".el-table-column .cell")).toHaveLength(0);
  });

  it("异常输入：搜索接口失败时提示后端 message 且不抛异常", async () => {
    mocks.reSearchUser.mockResolvedValue({ code: 500, message: "搜索失败" });

    const wrapper = mountUser();
    await flushPromises();

    await searchInput(wrapper).setValue("赵六");

    let thrown = null;
    try {
      await getButtonsByText(wrapper, "搜索")[0].trigger("click");
      await flushPromises();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeNull();
    expect(mocks.reSearchUser).toHaveBeenCalledWith({ keyword: "赵六" });
    // getMessage 优先返回后端 message，兜底文案仅在无 message 时生效
    expect(mocks.messageError).toHaveBeenCalledWith("搜索失败");
  });
});

/* ------------------------------------------------------------------ *
 * 3. 重置（本轮修复的核心行为）
 * ------------------------------------------------------------------ */
describe("重置搜索条件", () => {
  it("点击重置后：清空关键字、页码回到第 1 页、并重新发起列表请求", async () => {
    const wrapper = mountUser();
    await flushPromises();
    expect(mocks.reUserInfo).toHaveBeenCalledTimes(1);
    expect(mocks.reUserInfo).toHaveBeenCalledWith(1, 5);

    // 制造「非默认」状态：先翻到第 2 页
    const pagination = wrapper.findComponent(ElPaginationStub);
    pagination.vm.$emit("update:currentPage", 2);
    pagination.vm.$emit("current-change", 2);
    await flushPromises();
    expect(mocks.reUserInfo).toHaveBeenLastCalledWith(2, 5);
    expect(currentPageAttr(wrapper)).toBe("2");

    // 再填入搜索关键字
    await searchInput(wrapper).setValue("王五");
    expect(searchInput(wrapper).element.value).toBe("王五");

    const callsBefore = mocks.reUserInfo.mock.calls.length;

    await getButtonsByText(wrapper, "重置")[0].trigger("click");
    await flushPromises();

    // 1) searchKeyword 被清空（输入框回到空串）
    expect(searchInput(wrapper).element.value).toBe("");
    // 2) currentPage4 回到第 1 页
    expect(currentPageAttr(wrapper)).toBe("1");
    // 3) 重新发起列表请求，且是按第 1 页请求
    expect(mocks.reUserInfo.mock.calls.length).toBe(callsBefore + 1);
    expect(mocks.reUserInfo).toHaveBeenLastCalledWith(1, 5);
  });

  it("边界值：已处于第 1 页且无关键字时点击重置，仍会重新请求第 1 页", async () => {
    const wrapper = mountUser();
    await flushPromises();
    expect(currentPageAttr(wrapper)).toBe("1");

    const callsBefore = mocks.reUserInfo.mock.calls.length;
    await getButtonsByText(wrapper, "重置")[0].trigger("click");
    await flushPromises();

    expect(mocks.reUserInfo.mock.calls.length).toBe(callsBefore + 1);
    expect(mocks.reUserInfo).toHaveBeenLastCalledWith(1, 5);
    expect(searchInput(wrapper).element.value).toBe("");
  });
});

/* ------------------------------------------------------------------ *
 * 4. 分页切换
 * ------------------------------------------------------------------ */
describe("分页切换", () => {
  it("切换页码时按新页码重新请求", async () => {
    const wrapper = mountUser();
    await flushPromises();

    const pagination = wrapper.findComponent(ElPaginationStub);
    pagination.vm.$emit("update:currentPage", 3);
    pagination.vm.$emit("current-change", 3);
    await flushPromises();

    expect(mocks.reUserInfo).toHaveBeenLastCalledWith(3, 5);
    expect(currentPageAttr(wrapper)).toBe("3");
  });

  it("切换每页条数时按新条数重新请求", async () => {
    const wrapper = mountUser();
    await flushPromises();

    const pagination = wrapper.findComponent(ElPaginationStub);
    pagination.vm.$emit("update:pageSize", 10);
    pagination.vm.$emit("size-change", 10);
    await flushPromises();

    expect(mocks.reUserInfo).toHaveBeenLastCalledWith(1, 10);
  });
});

/* ------------------------------------------------------------------ *
 * 5. 删除用户（接口失败不抛异常）
 * ------------------------------------------------------------------ */
describe("删除用户", () => {
  it("确认删除后调用删除接口并刷新列表", async () => {
    mocks.reUserInfo.mockResolvedValue({ code: 200, data: { records: [userRow], total: 1 } });

    const wrapper = mountUser();
    await flushPromises();

    await wrapper.find(".popconfirm-confirm").trigger("click");
    await flushPromises();

    expect(mocks.reDeleteUserRole).toHaveBeenCalledTimes(1);
    expect(mocks.reDeleteUserRole).toHaveBeenCalledWith({ ids: [1] });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("删除用户成功");
    expect(mocks.reUserInfo).toHaveBeenCalledTimes(2);
  });

  it("异常输入：删除接口失败时提示后端 message 且不抛异常", async () => {
    mocks.reUserInfo.mockResolvedValue({ code: 200, data: { records: [userRow], total: 1 } });
    mocks.reDeleteUserRole.mockResolvedValue({ code: 500, message: "删除失败" });

    const wrapper = mountUser();
    await flushPromises();

    let thrown = null;
    try {
      await wrapper.find(".popconfirm-confirm").trigger("click");
      await flushPromises();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeNull();
    // getMessage 优先返回后端 message
    expect(mocks.messageError).toHaveBeenCalledWith("删除失败");
    // 失败时不刷新列表
    expect(mocks.reUserInfo).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * 6. 新增/编辑用户：角色必填与 roleNames 提交
 * ------------------------------------------------------------------ */
describe("新增/编辑用户", () => {
  it("角色必填校验：不选角色（表单校验失败）时提示且不发起保存请求", async () => {
    // 模拟 el-form 校验因 roleNames 为空而 reject
    mocks.validate.mockRejectedValue(new Error("请至少为用户分配一个角色"));

    const wrapper = mountUser();
    await flushPromises();

    // 打开「添加用户」抽屉
    await getButtonsByText(wrapper, "添加用户")[0].trigger("click");
    await flushPromises();

    let thrown = null;
    try {
      await getButtonsByText(wrapper, "添加保存")[0].trigger("click");
      await flushPromises();
    } catch (error) {
      thrown = error;
    }

    // 校验失败被 catch 住，不向外抛，也不发请求
    expect(thrown).toBeNull();
    expect(mocks.validate).toHaveBeenCalled();
    expect(mocks.reAddOrUpdateUser).not.toHaveBeenCalled();
  });

  it("编辑用户时按 parseRoles 回填 roleNames，并在保存时提交", async () => {
    mocks.reUserInfo.mockResolvedValue({ code: 200, data: { records: [userRow], total: 1 } });

    const wrapper = mountUser();
    await flushPromises();

    // 点击行内「编辑」打开抽屉（editUser 会用 parseRoles 回填 roleNames）
    await getButtonsByText(wrapper, "编辑")[0].trigger("click");
    await flushPromises();

    // 点击抽屉的保存按钮
    await getButtonsByText(wrapper, "添加保存")[0].trigger("click");
    await flushPromises();

    expect(mocks.validate).toHaveBeenCalled();
    expect(mocks.reAddOrUpdateUser).toHaveBeenCalledTimes(1);
    expect(mocks.reAddOrUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        username: "张三",
        // roleName「管理员」经 parseRoles 拆分为数组后回填并提交
        roleNames: ["管理员"],
      }),
    );
  });
});

/* ------------------------------------------------------------------ *
 * 7. 分配角色：空 roleName 的勾选态
 * ------------------------------------------------------------------ */
describe("分配角色", () => {
  it("roleName 为空串的账号打开分配角色抽屉时，勾选为空数组（不是 [\"\"]）", async () => {
    mocks.reUserInfo.mockResolvedValue({
      code: 200,
      data: { records: [{ ...userRow, roleName: "" }], total: 1 },
    });

    const wrapper = mountUser();
    await flushPromises();

    // 打开「分配角色」抽屉
    await getButtonsByText(wrapper, "分配角色")[0].trigger("click");
    await flushPromises();

    // parseRoles("") => []，勾选内容应为空数组
    expect(checkedRolesAttr(wrapper)).toBe("[]");
  });

  it("有角色的账号打开分配角色抽屉时，勾选为已分配角色", async () => {
    mocks.reUserInfo.mockResolvedValue({
      code: 200,
      data: { records: [userRow], total: 1 },
    });

    const wrapper = mountUser();
    await flushPromises();

    await getButtonsByText(wrapper, "分配角色")[0].trigger("click");
    await flushPromises();

    expect(checkedRolesAttr(wrapper)).toBe(JSON.stringify(["管理员"]));
  });
});
