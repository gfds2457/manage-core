// 单元测试：历史会话抽屉 chatHistory.vue
// 覆盖：正常场景（列表拉取/渲染、抽屉开关、新建会话、点击会话回传 convertId）
//       / 边界值（空列表、无标题兜底、缺 convertId）/ 异常输入（列表与详情接口失败）
// 重点：抽屉可见性由 computed 双向绑定，而不是直接写 props，因此可以反复打开关闭
// 注意：所有外部模块均在测试内 mock，不改动任何业务源码
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  getAllChat: vi.fn(),
  getSingleChat: vi.fn(),
  classifyAiError: vi.fn(() => ({
    type: "network",
    friendly: "无法连接 AI 后端",
    detail: "detail",
  })),
  logAiError: vi.fn(),
  ElMessage: vi.fn(),
}));

// chatHistory.vue 通过 getAiChatUserId() 取当前用户，
// 其内部会读 pinia 的 user store 并进而拉起 @/utils/request（依赖运行时环境变量）。
// 组件测试只关心「拿到的 userId 怎么用」，因此把这一层外部依赖整体 mock 掉。
vi.mock("@/utils/aiUserId", () => ({
  getAiChatUserId: () => "001",
}));

vi.mock("@/API/ai-chat", () => ({
  getAllChat: mocks.getAllChat,
  getSingleChat: mocks.getSingleChat,
  AI_CHAT_USER_ID: "001",
}));

vi.mock("@/utils/aiError", () => ({
  classifyAiError: mocks.classifyAiError,
  logAiError: mocks.logAiError,
}));

vi.mock("element-plus", () => ({
  ElMessage: mocks.ElMessage,
}));

import ChatHistory from "./chatHistory.vue";

/** el-drawer 替身：仅当 modelValue 为真时渲染插槽内容，便于断言抽屉的显隐 */
const ElDrawerStub = {
  name: "ElDrawer",
  props: ["modelValue", "direction", "size", "showClose", "withHeader"],
  emits: ["update:modelValue"],
  template: `<div class="el-drawer-stub" v-if="modelValue"><slot /></div>`,
};

const mountChat = (props = {}) =>
  mount(ChatHistory, {
    props: { modelValue: false, ...props },
    global: {
      components: { "el-drawer": ElDrawerStub },
      directives: { loading: {} },
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAllChat.mockResolvedValue({ data: [] });
  mocks.getSingleChat.mockResolvedValue({ status: 200, data: { data: { list: [], title: "" } } });
  mocks.classifyAiError.mockReturnValue({
    type: "network",
    friendly: "无法连接 AI 后端",
    detail: "detail",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("历史会话抽屉", () => {
  describe("正常场景", () => {
    it("modelValue 为 false 时不渲染抽屉内容", () => {
      const wrapper = mountChat({ modelValue: false });

      expect(wrapper.find(".el-drawer-stub").exists()).toBe(false);
      expect(wrapper.find(".history-list").exists()).toBe(false);
    });

    it("modelValue 为 true 时渲染头部与列表区", () => {
      const wrapper = mountChat({ modelValue: true });

      expect(wrapper.find(".el-drawer-stub").exists()).toBe(true);
      expect(wrapper.find(".history-title").text()).toBe("历史会话");
      expect(wrapper.find(".history-list").exists()).toBe(true);
    });

    it("getAllChatHistory 拉取列表并按接口返回渲染", async () => {
      mocks.getAllChat.mockResolvedValue({
        data: [
          { title: "会话A", convertId: "c1" },
          { title: "会话B", convertId: "c2" },
        ],
      });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");
      await flushPromises();

      expect(mocks.getAllChat).toHaveBeenCalledWith("001");
      const items = wrapper.findAll(".history-item");
      expect(items).toHaveLength(2);
      expect(items[0].text()).toContain("会话A");
    });

    it("点击返回按钮关闭抽屉并同步 update:modelValue", async () => {
      const wrapper = mountChat({ modelValue: true });

      await wrapper.find(".icon-btn").trigger("click");

      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("抽屉可以反复打开与关闭（可见性来自 computed 双向绑定）", async () => {
      const wrapper = mountChat({ modelValue: false });

      // 第一次打开
      await wrapper.setProps({ modelValue: true });
      expect(wrapper.find(".history-list").exists()).toBe(true);
      await wrapper.find(".icon-btn").trigger("click");
      expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([false]);

      // 第二次打开：若抽屉直接写 props，第二次将无法再打开
      await wrapper.setProps({ modelValue: true });
      expect(wrapper.find(".history-list").exists()).toBe(true);
      await wrapper.find(".icon-btn").trigger("click");
      expect(wrapper.emitted("update:modelValue")).toHaveLength(2);
      expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([false]);
    });

    it("点击新建会话同时抛出 newChat 并关闭抽屉", async () => {
      const wrapper = mountChat({ modelValue: true });

      await wrapper.find(".new-chat-btn").trigger("click");

      expect(wrapper.emitted("newChat")).toHaveLength(1);
      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("点击历史项抛出 getItemConvert 并携带 convertId", async () => {
      mocks.getAllChat.mockResolvedValue({ data: [{ title: "会话A", convertId: "c1" }] });
      mocks.getSingleChat.mockResolvedValue({
        status: 200,
        data: { data: { list: [{ role: "user", content: "历史提问" }], title: "会话A" } },
      });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");
      await wrapper.find(".history-item").trigger("click");
      await flushPromises();

      expect(mocks.getSingleChat).toHaveBeenCalledWith("001", "c1");

      const emitted = wrapper.emitted("getItemConvert");
      expect(emitted).toHaveLength(1);
      expect(emitted[0][0].convertId).toBe("c1");
      expect(emitted[0][0].list).toHaveLength(1);
      expect(emitted[0][0].title).toBe("会话A");

      // 点击会话后也应关闭抽屉
      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("高亮当前会话", async () => {
      mocks.getAllChat.mockResolvedValue({
        data: [
          { title: "会话A", convertId: "c1" },
          { title: "会话B", convertId: "c2" },
        ],
      });

      const wrapper = mountChat({ modelValue: true, activeConvertId: "c2" });
      await wrapper.vm.getAllChatHistory("001");

      const items = wrapper.findAll(".history-item");
      expect(items[0].classes()).not.toContain("active");
      expect(items[1].classes()).toContain("active");
    });
  });

  describe("边界值", () => {
    it("列表为空时展示空态文案", async () => {
      mocks.getAllChat.mockResolvedValue({ data: [] });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");

      expect(wrapper.find(".history-empty").exists()).toBe(true);
      expect(wrapper.find(".history-empty").text()).toBe("暂无历史会话");
    });

    it("接口返回非数组时降级为空列表", async () => {
      mocks.getAllChat.mockResolvedValue({ data: null });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");

      expect(wrapper.findAll(".history-item")).toHaveLength(0);
      expect(wrapper.find(".history-empty").exists()).toBe(true);
    });

    it("会话标题缺失时显示「新对话」", async () => {
      mocks.getAllChat.mockResolvedValue({ data: [{ convertId: "c1" }] });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");

      expect(wrapper.find(".item-name").text()).toBe("新对话");
    });

    it("不传 id 时沿用默认用户 ID 拉取", async () => {
      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory();
      await flushPromises();

      expect(mocks.getAllChat).toHaveBeenCalledWith("001");
    });

    it("历史项缺少 convertId 时不发起详情请求", async () => {
      mocks.getAllChat.mockResolvedValue({ data: [{ title: "无 ID 会话" }] });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");
      await wrapper.find(".history-item").trigger("click");
      await flushPromises();

      expect(mocks.getSingleChat).not.toHaveBeenCalled();
      expect(wrapper.emitted("getItemConvert")).toBeUndefined();
    });

    it("详情接口返回非 200 时不抛出事件", async () => {
      mocks.getAllChat.mockResolvedValue({ data: [{ title: "会话A", convertId: "c1" }] });
      mocks.getSingleChat.mockResolvedValue({ status: 500, data: {} });

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");
      await wrapper.find(".history-item").trigger("click");
      await flushPromises();

      expect(wrapper.emitted("getItemConvert")).toBeUndefined();
    });
  });

  describe("异常输入", () => {
    it("拉取列表失败时提示并降级为空列表", async () => {
      mocks.getAllChat.mockRejectedValue(new Error("list boom"));

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");

      expect(mocks.logAiError).toHaveBeenCalled();
      expect(mocks.ElMessage).toHaveBeenCalled();
      expect(wrapper.findAll(".history-item")).toHaveLength(0);
    });

    it("拉取详情失败时提示且不抛出事件", async () => {
      mocks.getAllChat.mockResolvedValue({ data: [{ title: "会话A", convertId: "c1" }] });
      mocks.getSingleChat.mockRejectedValue(new Error("detail boom"));

      const wrapper = mountChat({ modelValue: true });
      await wrapper.vm.getAllChatHistory("001");
      await wrapper.find(".history-item").trigger("click");
      await flushPromises();

      expect(mocks.logAiError).toHaveBeenCalled();
      expect(mocks.ElMessage).toHaveBeenCalled();
      expect(wrapper.emitted("getItemConvert")).toBeUndefined();
    });
  });
});
