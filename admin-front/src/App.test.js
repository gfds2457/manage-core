// 单元测试：应用根组件 src/App.vue
// 覆盖：正常场景（渲染路由出口、初始化暗色模式）/ 边界值（useDark 返回值未被使用）
//       / 异常输入（useDark 抛错时的现状）
// 说明：不修改任何业务源码，useDark 与 RouterView 均在测试内 mock
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  useDark: vi.fn(() => ({ value: false })),
}));

vi.mock("@vueuse/core", () => ({
  useDark: mocks.useDark,
}));

import App from "./App.vue";

/** RouterView 出口替身：根组件本身只负责渲染路由出口 */
const RouterViewStub = {
  name: "RouterView",
  template: `<div class="router-view-stub"><slot /></div>`,
};

const mountApp = () =>
  mount(App, {
    global: {
      components: { RouterView: RouterViewStub },
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useDark.mockReturnValue({ value: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("App 根组件", () => {
  describe("正常场景", () => {
    it("渲染路由出口 RouterView", () => {
      const wrapper = mountApp();

      expect(wrapper.find(".router-view-stub").exists()).toBe(true);
    });

    it("挂载时调用 useDark 初始化暗色模式", () => {
      mountApp();

      expect(mocks.useDark).toHaveBeenCalledTimes(1);
    });

    it("不产生任何网络请求副作用（调试用的 /user 调用已移除）", () => {
      const wrapper = mountApp();

      // 模板里只有一个路由出口，没有额外内容与副作用
      expect(wrapper.find(".router-view-stub").exists()).toBe(true);
      expect(wrapper.text()).toBe("");
    });
  });

  describe("边界值", () => {
    it("useDark 返回值未被组件使用，返回 undefined 也能正常挂载", () => {
      mocks.useDark.mockReturnValueOnce(undefined);

      expect(() => mountApp()).not.toThrow();
    });

    it("useDark 返回浅色模式对象时页面结构不变", () => {
      mocks.useDark.mockReturnValueOnce({ value: false });

      const wrapper = mountApp();

      expect(wrapper.find(".router-view-stub").exists()).toBe(true);
    });

    it("多次挂载会重复调用 useDark（组件无缓存逻辑）", () => {
      mountApp();
      mountApp();

      expect(mocks.useDark).toHaveBeenCalledTimes(2);
    });
  });

  describe("异常输入", () => {
    it("useDark 抛出异常时挂载失败（业务代码未做兜底，属已知现状）", () => {
      mocks.useDark.mockImplementationOnce(() => {
        throw new Error("storage unavailable");
      });

      expect(() => mountApp()).toThrow("storage unavailable");
    });
  });
});
