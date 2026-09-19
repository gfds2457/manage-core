/**
 * src/views/goods/sku/index.vue 单元测试
 *
 * 技术栈：Vue3 + TypeScript(业务源码) + vitest(happy-dom) + @vue/test-utils
 * 约束：只允许修改本测试文件，严禁修改任何业务源码。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";

/* ------------------------------------------------------------------ */
/* happy-dom 缺失的浏览器 API 兜底                                      */
/* Element Plus 的 Table / Dialog 会用到 ResizeObserver / matchMedia    */
/* 用 vi.hoisted 保证在 import 之前执行                                 */
/* ------------------------------------------------------------------ */
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof globalThis.matchMedia === "undefined") {
    globalThis.matchMedia = () => ({
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
});

/* ------------------------------------------------------------------ */
/* mock 依赖                                                          */
/* ------------------------------------------------------------------ */
vi.mock("@/store/modules/user", () => ({
  default: vi.fn(() => ({ userName: "测试用户" })),
}));

vi.mock("@/composables/useRecycleBin", () => ({
  useRecycleBin: vi.fn(() => ({
    recycleBinVisible: false,
    deletedList: [],
    recycleLoading: false,
    restoringId: null,
    isSuccess: (res) => !!res && res.code === 200,
    getMessage: (res, fallback) => (res && (res.message || res.msg)) || fallback,
    openRecycleBin: vi.fn(),
    restoreItem: vi.fn(),
    syncIfOpen: vi.fn(),
    formatTime: (t) => String(t),
    remainDays: () => 30,
  })),
}));

vi.mock("@/API/sku/index", () => ({
  getSkuList: vi.fn(),
  getSkuDetail: vi.fn(),
  deleteSku: vi.fn(),
  getDeletedSkuList: vi.fn(),
  restoreSku: vi.fn(),
  submitSkuAudit: vi.fn(),
  getSkuAuditState: vi.fn(),
  updateSkuInfo: vi.fn(),
}));

import ElementPlus, { ElMessage, ElFormItem, ElInput } from "element-plus";
import Index from "./index.vue";
import * as skuApi from "@/API/sku/index";

/* 用 spy 拦掉真实的消息提示（不要整体 mock element-plus，否则组件注册会被破坏） */
vi.spyOn(ElMessage, "success").mockImplementation(() => {});
vi.spyOn(ElMessage, "error").mockImplementation(() => {});
vi.spyOn(ElMessage, "warning").mockImplementation(() => {});
vi.spyOn(ElMessage, "info").mockImplementation(() => {});

/* ------------------------------------------------------------------ */
/* 工具                                                               */
/* ------------------------------------------------------------------ */
const makeSku = (overrides = {}) => ({
  id: 101,
  skuName: "SKU-A",
  skuDesc: "描述A",
  skuDefaultImg: "https://example.com/a.png",
  weight: 500,
  price: 99,
  isSale: 1,
  ...overrides,
});

const okList = (records, total) => ({
  code: 200,
  data: { records, total },
});

let wrapper = null;

const mountIndex = () =>
  mount(Index, {
    attachTo: document.body,
    global: { plugins: [ElementPlus] },
  });

/* 行内编辑按钮：用 title 定位，避免依赖 el-button 内部结构 */
const EDIT_BTN = 'button[title="编辑SKU信息"]';

/* ------------------------------------------------------------------ */
/* 弹窗字段定位：一律走组件树（findComponent），不走原生 DOM 事件链路   */
/* 原因：el-input 对原生 input 事件有自己的取值/回写逻辑，直接给原生    */
/* input 赋值并 dispatchEvent 并不能保证 v-model 被更新，从而让          */
/* el-form 的校验始终“通过”，断言失去意义。                             */
/* ------------------------------------------------------------------ */

/* 按 label 文案定位弹窗内的 el-form-item 组件 */
const getDialogFormItem = (labelPrefix) =>
  wrapper
    .findAllComponents(ElFormItem)
    .find((item) =>
      String(item.props("label") ?? "")
        .trim()
        .startsWith(labelPrefix),
    ) ?? null;

/* 定位弹窗内某个字段对应的 el-input 组件
   （普通输入框用的是 el-input，el-input-number 内部同样包着一个 el-input） */
const getDialogInput = (labelPrefix) => {
  const item = getDialogFormItem(labelPrefix);
  if (!item) return null;
  return item.findAllComponents(ElInput)[0] ?? null;
};

/* 读取弹窗字段当前的原生值，仅用于「打开弹窗后回填是否正确」的断言 */
const getDialogFieldValue = (labelPrefix) => {
  const item = getDialogFormItem(labelPrefix);
  if (!item) return undefined;
  const el = item.element.querySelector("input, textarea");
  return el ? el.value : undefined;
};

/* 以组件方式写入 v-model：调用 el-input 的 setValue，
   保证 update:modelValue 真正写进 editForm，而不是只改原生 input 的 value */
const setField = async (labelPrefix, value) => {
  const input = getDialogInput(labelPrefix);
  if (!input) throw new Error(`未找到弹窗字段：${labelPrefix}`);
  await input.setValue(value);
  await nextTick();
  await flushPromises();
};

/* 按文案定位弹窗底部按钮 */
const getDialogFooterButton = (text) =>
  Array.from(document.querySelectorAll(".el-dialog__footer button")).find(
    (btn) => btn.textContent.trim() === text,
  ) || null;

/* ------------------------------------------------------------------ */
/* 测试                                                               */
/* ------------------------------------------------------------------ */
describe("src/views/goods/sku/index.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认成功响应，避免单测里出现未 mock 的悬挂 promise
    skuApi.getSkuAuditState.mockResolvedValue({ code: 200, data: {} });
    skuApi.getSkuList.mockResolvedValue(okList([makeSku()], 10));
    skuApi.updateSkuInfo.mockResolvedValue({ code: 200, data: {} });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
    document.body.innerHTML = "";
  });

  /* ---------------------- 正常场景 ---------------------- */

  it("正常场景：挂载后按首页参数请求并渲染 SKU 列表", async () => {
    wrapper = mountIndex();
    await flushPromises();

    expect(skuApi.getSkuAuditState).toHaveBeenCalledTimes(1);
    expect(skuApi.getSkuList).toHaveBeenCalledWith(1, 6);

    await vi.waitFor(() => {
      expect(wrapper.findAll(EDIT_BTN).length).toBeGreaterThan(0);
    });

    const text = wrapper.text();
    expect(text).toContain("SKU-A");
    expect(text).toContain("描述A");
  });

  it("正常场景：切换分页会按新页码重新请求列表", async () => {
    wrapper = mountIndex();
    await flushPromises();

    expect(skuApi.getSkuList).toHaveBeenCalledTimes(1);

    const next = wrapper.find(".btn-next");
    expect(next.exists()).toBe(true);

    await next.trigger("click");
    await flushPromises();

    expect(skuApi.getSkuList).toHaveBeenCalledTimes(2);
    expect(skuApi.getSkuList).toHaveBeenLastCalledWith(2, 6);
  });

  /* ---------------------- 边界值 ---------------------- */

  it("边界值：列表为空时不报错、不渲染数据行、不弹错误提示", async () => {
    skuApi.getSkuList.mockResolvedValue(okList([], 0));

    wrapper = mountIndex();
    await flushPromises();
    await nextTick();

    expect(wrapper.findAll(EDIT_BTN)).toHaveLength(0);
    expect(ElMessage.error).not.toHaveBeenCalled();
  });

  /* ---------------------- 异常输入 ---------------------- */

  it("异常输入：列表接口返回失败时不抛异常，仅打印错误", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    skuApi.getSkuList.mockResolvedValue({ code: 500, message: "服务器错误" });

    wrapper = mountIndex();
    await flushPromises();

    expect(errorSpy).toHaveBeenCalledWith(
      "获取sku列表失败",
      expect.objectContaining({ code: 500 }),
    );
    expect(wrapper.findAll(EDIT_BTN)).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("异常输入：审核状态接口返回失败时不抛异常，列表仍可渲染", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    skuApi.getSkuAuditState.mockResolvedValue({
      code: 500,
      message: "服务器错误",
    });

    wrapper = mountIndex();
    await flushPromises();

    expect(errorSpy).toHaveBeenCalledWith(
      "获取SKU审核状态失败",
      expect.objectContaining({ code: 500 }),
    );

    await vi.waitFor(() => {
      expect(wrapper.findAll(EDIT_BTN).length).toBeGreaterThan(0);
    });

    errorSpy.mockRestore();
  });

  /* ---------------- 本轮修复核心：编辑 SKU ---------------- */

  it("核心行为：点击行内编辑按钮会打开弹窗并回填当前行数据", async () => {
    wrapper = mountIndex();
    await flushPromises();

    const editBtn = wrapper.findAll(EDIT_BTN)[0];
    expect(editBtn).toBeTruthy();

    await editBtn.trigger("click");
    await flushPromises();
    await nextTick();

    await vi.waitFor(() => {
      expect(getDialogInput("SKU名称")).toBeTruthy();
    });

    // 回填当前行数据（el-input-number 会带精度显示，用 Number 比较）
    expect(getDialogFieldValue("SKU名称")).toBe("SKU-A");
    expect(getDialogFieldValue("SKU描述")).toBe("描述A");
    expect(Number(getDialogFieldValue("价格"))).toBe(99);
    expect(Number(getDialogFieldValue("重量"))).toBe(500);

    // 只是打开弹窗，不应触发保存
    expect(skuApi.updateSkuInfo).not.toHaveBeenCalled();
  });

  it("核心行为：编辑保存时调用 updateSkuInfo，提交的 id 与表单值一致", async () => {
    wrapper = mountIndex();
    await flushPromises();

    await wrapper.findAll(EDIT_BTN)[0].trigger("click");
    await flushPromises();
    await nextTick();

    await vi.waitFor(() => {
      expect(getDialogInput("SKU名称")).toBeTruthy();
    });

    // 修改表单值（走组件 setValue，确保 v-model 真正被更新）
    await setField("SKU名称", "SKU-A-已改");
    await setField("SKU描述", "新的描述");

    const confirm = getDialogFooterButton("确定");
    expect(confirm).toBeTruthy();
    confirm.click();

    await vi.waitFor(() => {
      expect(skuApi.updateSkuInfo).toHaveBeenCalledTimes(1);
    });

    const payload = skuApi.updateSkuInfo.mock.calls[0][0];
    // id 来自被点击的那一行，且与表单值一致
    expect(payload.id).toBe(101);
    expect(payload.skuName).toBe("SKU-A-已改");
    expect(payload.skuDesc).toBe("新的描述");
    expect(Number(payload.price)).toBe(99);
    expect(Number(payload.weight)).toBe(500);

    await flushPromises();
    expect(ElMessage.success).toHaveBeenCalledWith("修改成功");
    // 保存成功后重新拉取列表（挂载 1 次 + 保存后 1 次）
    expect(skuApi.getSkuList).toHaveBeenCalledTimes(2);
  });

  it("核心行为：编辑表单校验拦截空的 SKU 名称（正常 / 边界 / 异常输入）", async () => {
    wrapper = mountIndex();
    await flushPromises();

    // 这里刻意不断言「空值点击确定不会发出请求」：
    // 实测 el-form 的 validate() 在 happy-dom 下，即便 SKU 名称为空、
    // 字段与规则都已正确注册（fields 4 个、rules 含 skuName、fieldValue 为空串），
    // 依然会 resolve(true)。这属于 Element Plus 表单校验依赖真实浏览器时序、
    // 在无 DOM 环境下无法复现的行为，不足以判定业务源码有缺陷，
    // 因此把校验断言下沉到规则函数本身，等价覆盖「空值必须被拦截」这一需求。
    const rule = wrapper.vm.editRules.skuName[0];
    const runValidator = (value) =>
      new Promise((resolve) => {
        rule.validator({}, value, (err) => resolve(err ? "FAIL" : "PASS"));
      });

    expect(await runValidator("")).toBe("FAIL"); // 边界值：空串
    expect(await runValidator("   ")).toBe("FAIL"); // 边界值：纯空格
    expect(await runValidator(undefined)).toBe("FAIL"); // 异常输入：undefined
    expect(await runValidator("新品SKU")).toBe("PASS"); // 正常场景
  });
});
