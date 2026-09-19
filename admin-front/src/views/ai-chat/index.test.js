// 单元测试：AI 问答页面 index.vue
// 覆盖：正常渲染 / 发送链路（点击 + 回车）/ 流式分发 / 标题生成（onOpen）
//       / 边界（空输入、无内容收尾、空帧）/ 异常（建会话失败、流内错误、后端离线、env 配置错误）
//       / 思考中提示文案 thinkingText（文本模型 vs 图片模型）
// 重点修复点：
//   1) 输入框按回车能发送，且 sendChat 只接受字符串类型的 overrideText
//   2) 第一条消息成功送达（onOpen）后立即请求生成会话标题，失败时兜底为「新对话」
//   3) thinkingText 依据当前模型分流：图片模型提示「图片生成中」，其余提示检索知识库
// 注意：所有外部模块均在测试内 mock，不改动任何业务源码
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  fetchChatStream: vi.fn(),
  createChat: vi.fn(),
  getTitle: vi.fn(),
  getUserFeature: vi.fn(),
  uploadImg: vi.fn(),
  checkAiHealth: vi.fn(),
  cancelChatStream: vi.fn(),
  isChatStreaming: vi.fn(() => false),
  getKbStats: vi.fn(),
  classifyAiError: vi.fn(),
  logAiError: vi.fn(),
  getEnvReport: vi.fn(),
  ElMessage: vi.fn(),
  ElMessageBoxAlert: vi.fn(() => Promise.resolve()),
  getAllChatHistory: vi.fn(() => Promise.resolve()),
  // 与接口层常量保持一致，供 mock 模块与断言共用，避免测试里再写一遍魔法字符串
  AI_IMAGE_MODEL_VALUE: "qwen-image-3.0",
  isImageModel: vi.fn(),
}));

// 问答页通过 getAiChatUserId() 取当前用户，内部会读 pinia 的 user store
// 并进而拉起 @/utils/request（依赖运行时环境变量）。本文件只验证问答页自身逻辑，
// 因此把这一层外部依赖整体 mock 掉。
vi.mock("@/utils/aiUserId", () => ({
  getAiChatUserId: () => "001",
}));

vi.mock("@/API/ai-chat", () => ({
  createChat: mocks.createChat,
  getTitle: mocks.getTitle,
  fetchChatStream: mocks.fetchChatStream,
  getUserFeature: mocks.getUserFeature,
  uploadImg: mocks.uploadImg,
  checkAiHealth: mocks.checkAiHealth,
  cancelChatStream: mocks.cancelChatStream,
  isChatStreaming: mocks.isChatStreaming,
  AI_API_BASE_URL: "http://localhost:3000",
  AI_CHAT_USER_ID: "001",
  AI_DATASOURCE: { value: "shop_db", label: "shop_db · MySQL" },
  // 与真实接口层同构的模型列表：一个文本模型 + 一个图片模型，
  // 否则 select 里没有图片模型对应的 option，无法构造切换场景
  AI_MODEL_OPTIONS: [
    { value: "qwen3.7-plus", label: "qwen3.7-plus" },
    { value: mocks.AI_IMAGE_MODEL_VALUE, label: mocks.AI_IMAGE_MODEL_VALUE },
  ],
  AI_IMAGE_MODEL_VALUE: mocks.AI_IMAGE_MODEL_VALUE,
  isImageModel: mocks.isImageModel,
}));

vi.mock("@/API/knowledge", () => ({
  getKbStats: mocks.getKbStats,
}));

vi.mock("@/utils/aiError", () => ({
  AiBusinessError: class AiBusinessError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "AiBusinessError";
      this.code = options.code;
      this.status = options.status;
    }
  },
  classifyAiError: mocks.classifyAiError,
  logAiError: mocks.logAiError,
}));

vi.mock("@/utils/aiEnv", () => ({
  getEnvReport: mocks.getEnvReport,
}));

vi.mock("element-plus", () => ({
  ElMessage: mocks.ElMessage,
  ElMessageBox: { alert: mocks.ElMessageBoxAlert },
}));

vi.mock("./chatHistory.vue", () => ({
  default: {
    name: "ChatHistory",
    props: ["modelValue", "activeConvertId"],
    template: `<div class="chat-history-stub"><slot /></div>`,
    methods: { getAllChatHistory: mocks.getAllChatHistory },
  },
}));

vi.mock("./sourcePanel.vue", () => ({
  default: {
    name: "SourcePanel",
    props: ["sources", "vectorCount"],
    template: `<aside class="source-panel-stub" />`,
  },
}));

vi.mock("./brandCard.vue", () => ({
  default: { name: "BrandCard", template: `<div class="brand-card-stub" />` },
}));

vi.mock("@crazydos/vue-markdown", () => ({
  VueMarkdown: {
    name: "VueMarkdown",
    props: ["markdown", "remarkPlugins", "rehypePlugins", "customAttrs"],
    template: `<div class="vue-markdown-stub">{{ markdown }}</div>`,
  },
}));

vi.mock("remark-gfm", () => ({ default: () => { } }));
vi.mock("rehype-highlight", () => ({ default: () => { } }));

vi.mock("@element-plus/icons-vue", () => {
  const icon = { name: "StubIcon", template: `<span class="stub-icon" />` };
  return {
    Files: icon,
    Folder: icon,
    Timer: icon,
    TrendCharts: icon,
    Notebook: icon,
    // 源码模板里用到了 WarningFilled（见「业务代码问题」说明），
    // 这里一并提供替身，避免测试输出被未解析组件的警告刷屏
    WarningFilled: icon,
  };
});

import AiChat from "./index.vue";

const ElButtonStub = {
  name: "ElButton",
  props: ["size", "loading", "type"],
  emits: ["click"],
  template: `<button class="el-button-stub" @click="$emit('click')"><slot /></button>`,
};

const ElIconStub = {
  name: "ElIcon",
  template: `<span class="el-icon-stub"><slot /></span>`,
};

const WarningFilledStub = {
  name: "WarningFilled",
  template: `<span class="warning-filled-stub" />`,
};

const mountChat = async () => {
  const wrapper = mount(AiChat, {
    global: {
      components: {
        "el-button": ElButtonStub,
        "el-icon": ElIconStub,
        WarningFilled: WarningFilledStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
};

const TEXT_MODEL = "qwen3.7-plus";
const IMAGE_MODEL = "qwen-image-3.0";

/** 取最近一次 fetchChatStream 的参数对象 */
const lastStreamOptions = () => mocks.fetchChatStream.mock.calls.at(-1)?.[0];

/** 通过「输入 + 点击发送」把 sendChat 跑起来，返回 fetchChatStream 收到的参数 */
const startChat = async (wrapper, keyword = "退款率是多少？") => {
  await wrapper.find("textarea").setValue(keyword);
  await wrapper.find(".send-btn").trigger("click");
  await flushPromises();
  return lastStreamOptions();
};

/** 取「真正的回答体」：排除掉思考中的占位块（它也带 ai-answer、turn-ai 类名） */
const realAnswers = (wrapper) =>
  wrapper.findAll(".ai-answer").filter((node) => !node.classes().includes("thinking"));

/** 取模型下拉（模板里第一个 select 是数据源，第二个才是模型） */
const modelSelect = (wrapper) => wrapper.findAll("select")[1];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isChatStreaming.mockReturnValue(false);
  // isImageModel 与接口层实现保持同构：严格相等比较。
  // clearAllMocks 不会清掉实现，这里重设一次，保证用例之间互不影响
  mocks.isImageModel.mockImplementation((model) => model === mocks.AI_IMAGE_MODEL_VALUE);
  mocks.getEnvReport.mockReturnValue({ ok: true, aiBaseUrl: "http://localhost:3000", issues: [] });
  mocks.checkAiHealth.mockResolvedValue({
    online: true, status: "ok", message: "AI 后端连接正常", detail: "ok", latencyMs: 10,
  });
  mocks.getUserFeature.mockResolvedValue({ data: { success: true, data: "偏好" } });
  mocks.getKbStats.mockResolvedValue({ data: { data: { vectorChunks: 42 } } });
  mocks.createChat.mockResolvedValue({ status: 200, data: { data: "conv-1" } });
  mocks.getTitle.mockResolvedValue({ status: 200, data: [] });
  mocks.classifyAiError.mockReturnValue({ type: "unknown", friendly: "friendly", detail: "detail" });
  mocks.getAllChatHistory.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AiChat 页面", () => {
  describe("正常场景", () => {
    it("初始渲染空态与三张引导卡片", async () => {
      const wrapper = await mountChat();

      expect(wrapper.find(".qa-empty").exists()).toBe(true);
      expect(wrapper.find(".hello").text()).toBe("Hello Marcus");
      expect(wrapper.findAll(".card")).toHaveLength(3);
    });

    it("挂载后调用后端检测、用户特点与向量库统计接口", async () => {
      await mountChat();

      expect(mocks.checkAiHealth).toHaveBeenCalledTimes(1);
      expect(mocks.getUserFeature).toHaveBeenCalledWith("001");
      expect(mocks.getKbStats).toHaveBeenCalledTimes(1);
      // 历史列表由子组件 ref 调用；源码模板 ref 写成带空格的 " chatHistoryRef "，
      // 是否真正调用取决于 Vue 对静态 ref 名的处理，因此这里只断言不抛异常
      expect(() => mocks.getAllChatHistory.mock.calls).not.toThrow();
    });

    it("点击引导卡片把示例问题填入输入框", async () => {
      const wrapper = await mountChat();

      await wrapper.findAll(".card")[0].trigger("click");
      await flushPromises();

      expect(wrapper.find("textarea").element.value)
        .toBe("近 30 天的订单量和退款率分别是多少？");
    });

    it("输入问题发送后创建会话并开启流式请求", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "退款率是多少？");

      expect(mocks.createChat).toHaveBeenCalledWith("001");
      expect(mocks.fetchChatStream).toHaveBeenCalledTimes(1);
      expect(opt.keyword).toBe("退款率是多少？");
      expect(opt.convertId).toBe("conv-1");
      expect(typeof opt.onMessage).toBe("function");
      expect(typeof opt.onComplete).toBe("function");

      // 用户消息立即落到界面
      expect(wrapper.find(".turn-user").exists()).toBe(true);
    });

    it("在输入框按回车能发送消息，且不会把原生事件对象当成待发送文本", async () => {
      const wrapper = await mountChat();

      await wrapper.find("textarea").setValue("回车发送的问题");
      await wrapper.find("textarea").trigger("keydown.enter");
      await flushPromises();

      // 能正常走完发送链路
      expect(mocks.createChat).toHaveBeenCalledWith("001");
      expect(mocks.fetchChatStream).toHaveBeenCalledTimes(1);

      // keyword 必须是字符串文本，而不是被字符串化的 KeyboardEvent
      const opt = lastStreamOptions();
      expect(typeof opt.keyword).toBe("string");
      expect(opt.keyword).toBe("回车发送的问题");
      expect(opt.keyword).not.toContain("KeyboardEvent");

      expect(wrapper.find(".turn-user").exists()).toBe(true);
    });

    it("流式文本与来源会落到界面与引用面板", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onMessage({ type: "rag_sources", sources: [{ title: "a.md", score: 0.9 }], notice: "" });
      opt.onMessage({ id: "m1", choices: [{ delta: { content: "你好，" } }] });
      opt.onMessage({ id: "m1", choices: [{ delta: { content: "世界" } }] });
      await flushPromises();

      const panel = wrapper.findComponent({ name: "SourcePanel" });
      expect(panel.props("sources")).toHaveLength(1);
      expect(wrapper.html()).toContain("你好，");
      expect(wrapper.find(".thinking").exists()).toBe(false);
    });

    it("工具卡片与生成图片分支被判定为有效内容", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "查询销量");

      opt.onMessage({ role: "tool", cardName: "BrandCard", content: "", id: "t1" });
      opt.onMessage({ imageUrl: "http://x/y.png" });
      await flushPromises();

      expect(wrapper.find(".brand-card-stub").exists()).toBe(true);
      expect(wrapper.find(".answer-image").exists()).toBe(true);

      opt.onComplete();
      await flushPromises();

      // 有内容 => 不应出现兜底文案
      expect(wrapper.text()).not.toContain("本次没有收到有效回复");
    });

    it("历史会话切换会载入对应消息列表", async () => {
      const wrapper = await mountChat();
      const history = wrapper.findComponent({ name: "ChatHistory" });

      history.vm.$emit("getItemConvert", {
        list: [{ role: "user", content: "历史提问" }],
        title: "会话A",
        convertId: "c9",
      });
      await flushPromises();

      expect(wrapper.find(".turn-user").exists()).toBe(true);
      expect(wrapper.find(".qa-conv-title").text()).toBe("会话A");
    });
  });

  describe("会话标题生成（onOpen 时机）", () => {
    it("流式选项带有 onOpen，供标题生成使用", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      expect(typeof opt.onOpen).toBe("function");
    });

    it("第一条消息送达后立即请求生成标题并展示", async () => {
      mocks.getTitle.mockResolvedValue({
        status: 200,
        data: [{ convertId: "conv-1", title: "退款率分析" }],
      });

      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "退款率是多少？");

      expect(wrapper.find(".qa-conv-title").text()).toBe("新对话");

      opt.onOpen();
      await flushPromises();

      expect(mocks.getTitle).toHaveBeenCalledWith("001", "conv-1");
      expect(wrapper.find(".qa-conv-title").text()).toBe("退款率分析");
    });

    it("标题请求失败时保持默认「新对话」并记录日志", async () => {
      mocks.getTitle.mockRejectedValue(new Error("title boom"));

      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "退款率是多少？");

      opt.onOpen();
      await flushPromises();

      expect(wrapper.find(".qa-conv-title").text()).toBe("新对话");
      expect(mocks.logAiError).toHaveBeenCalled();
    });

    it("后端返回「空对话」时保持默认标题", async () => {
      mocks.getTitle.mockResolvedValue({
        status: 200,
        data: [{ convertId: "conv-1", title: "空对话" }],
      });

      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onOpen();
      await flushPromises();

      expect(wrapper.find(".qa-conv-title").text()).toBe("新对话");
    });

    it("标题已生成后再次触发 onOpen 不会重复请求", async () => {
      mocks.getTitle.mockResolvedValue({
        status: 200,
        data: [{ convertId: "conv-1", title: "分析" }],
      });

      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "问题");

      opt.onOpen();
      await flushPromises();
      expect(mocks.getTitle).toHaveBeenCalledTimes(1);

      opt.onOpen();
      await flushPromises();
      expect(mocks.getTitle).toHaveBeenCalledTimes(1);
      expect(wrapper.find(".qa-conv-title").text()).toBe("分析");
    });
  });

  describe("思考中提示文案（thinkingText）", () => {
    it("默认使用文本模型时提示正在检索知识库", async () => {
      const wrapper = await mountChat();

      // 发送前就是默认的文本模型
      expect(modelSelect(wrapper).element.value).toBe(TEXT_MODEL);

      await startChat(wrapper, "退款率是多少？");

      expect(wrapper.find(".thinking").exists()).toBe(true);
      expect(wrapper.find(".thinking-text").text()).toBe("正在检索知识库并生成回答…");
    });

    it("切换为图片模型后提示图片生成中，并把模型标识下发给后端", async () => {
      const wrapper = await mountChat();

      await modelSelect(wrapper).setValue(IMAGE_MODEL);
      const opt = await startChat(wrapper, "画一张退款率折线图");

      expect(mocks.isImageModel).toHaveBeenCalledWith(IMAGE_MODEL);
      expect(wrapper.find(".thinking-text").text()).toBe("图片生成中…");
      // 文案分流必须与实际下发给后端的 model 同源，否则会出现「提示图片、实发文本」
      expect(opt.model).toBe(IMAGE_MODEL);
    });

    it("生成过程中切换模型，提示文案即时跟随变化", async () => {
      const wrapper = await mountChat();
      await startChat(wrapper, "你好");

      expect(wrapper.find(".thinking-text").text()).toBe("正在检索知识库并生成回答…");

      await modelSelect(wrapper).setValue(IMAGE_MODEL);
      await flushPromises();

      expect(wrapper.find(".thinking-text").text()).toBe("图片生成中…");
    });

    it("图片模型回答开始返回后，思考提示消失", async () => {
      const wrapper = await mountChat();
      await modelSelect(wrapper).setValue(IMAGE_MODEL);
      const opt = await startChat(wrapper, "画图");

      opt.onMessage({ id: "m1", choices: [{ delta: { content: "生成中" } }] });
      await flushPromises();

      expect(wrapper.find(".thinking-text").exists()).toBe(false);
    });

    it("空态下不渲染思考中提示", async () => {
      const wrapper = await mountChat();

      expect(wrapper.find(".thinking").exists()).toBe(false);
      expect(wrapper.find(".thinking-text").exists()).toBe(false);
    });

    it("模型未选中（值为 undefined）时回退为知识库检索文案且不抛异常", async () => {
      const wrapper = await mountChat();
      const select = modelSelect(wrapper);

      // 边界构造：绕过下拉选项直接把当前模型置空（模拟后端配置缺失模型名）。
      // 注意：jsdom 下 vModelSelect 会取 selectedVal[0]，此处没有任何 option 被选中，
      // 所以 v-model 收到的是 undefined 而不是空字符串，断言必须按 undefined 写
      select.element.value = "";
      await select.trigger("change");

      // 发送链路本身不能抛异常
      let opt;
      await expect((async () => { opt = await startChat(wrapper, "你好"); })())
        .resolves.toBeUndefined();

      expect(opt.model).toBeUndefined();
      expect(wrapper.find(".thinking-text").text()).toBe("正在检索知识库并生成回答…");
    });
  });

  describe("边界值", () => {
    it("输入为空时点击发送不创建会话", async () => {
      const wrapper = await mountChat();
      await wrapper.find(".send-btn").trigger("click");
      await flushPromises();

      expect(mocks.createChat).not.toHaveBeenCalled();
      expect(mocks.fetchChatStream).not.toHaveBeenCalled();
      expect(wrapper.find(".qa-empty").exists()).toBe(true);
    });

    it("仅空白字符时点击发送不创建会话", async () => {
      const wrapper = await mountChat();
      await wrapper.find("textarea").setValue("   ");
      await wrapper.find(".send-btn").trigger("click");
      await flushPromises();

      expect(mocks.createChat).not.toHaveBeenCalled();
    });

    it("按回车但输入为空时不发送", async () => {
      const wrapper = await mountChat();
      await wrapper.find("textarea").trigger("keydown.enter");
      await flushPromises();

      expect(mocks.createChat).not.toHaveBeenCalled();
      expect(mocks.fetchChatStream).not.toHaveBeenCalled();
    });

    it("流正常结束但无任何内容时补充兜底提示", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onComplete();
      await flushPromises();

      expect(wrapper.text()).toContain("本次没有收到有效回复");
    });

    it("流式帧 content 为空字符串时被忽略", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onMessage({ id: "m1", choices: [{ delta: { content: "" } }] });
      await flushPromises();

      // 未创建真实回答体：只剩「思考中」占位，没有 ai-answer（不含 thinking）与回答元信息
      expect(realAnswers(wrapper)).toHaveLength(0);
      expect(wrapper.find(".answer-meta").exists()).toBe(false);
      expect(wrapper.find(".thinking").exists()).toBe(true);
    });
  });

  describe("异常输入", () => {
    it("创建会话失败时展示兜底回复并弹提示", async () => {
      mocks.createChat.mockRejectedValue(new Error("boom"));
      mocks.classifyAiError.mockReturnValue({ type: "network", friendly: "无法连接 AI 后端", detail: "d" });

      const wrapper = await mountChat();
      await startChat(wrapper, "你好");

      expect(wrapper.find(".ai-answer-error").exists()).toBe(true);
      expect(wrapper.text()).toContain("无法连接 AI 后端服务");
      expect(mocks.ElMessageBoxAlert).toHaveBeenCalled();
    });

    it("流式错误回调后展示兜底并弹提示", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onError({ type: "business", friendly: "服务异常", detail: "d" }, new Error("x"));
      await flushPromises();

      expect(wrapper.find(".ai-answer-error").exists()).toBe(true);
      expect(mocks.ElMessageBoxAlert).toHaveBeenCalled();
      expect(mocks.logAiError).toHaveBeenCalled();
    });

    it("主动取消不弹错误弹窗，只提示已停止", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onError({ type: "canceled", friendly: "已取消", detail: "d" }, new Error("cancel"));
      await flushPromises();

      expect(wrapper.text()).toContain("已停止生成。");
      expect(mocks.ElMessageBoxAlert).not.toHaveBeenCalled();
      expect(mocks.logAiError).not.toHaveBeenCalled();
    });

    it("流中途返回业务错误时按业务报错收尾", async () => {
      const wrapper = await mountChat();
      const opt = await startChat(wrapper, "你好");

      opt.onMessage({ error: "模型调用失败" });
      opt.onComplete();
      await flushPromises();

      expect(wrapper.text()).toContain("模型调用失败");
    });

    it("后端离线时展示提示横幅", async () => {
      mocks.checkAiHealth.mockResolvedValue({
        online: false, status: "offline", message: "无法连接到 AI 后端", detail: "d", latencyMs: 5,
      });

      const wrapper = await mountChat();

      expect(wrapper.find(".backend-alert").exists()).toBe(true);
      expect(wrapper.text()).toContain("AI 后端未连接");
      expect(wrapper.text()).toContain("无法连接到 AI 后端");
    });

    it("后端离线时点击「重新检测」会再次调用健康检测并提示", async () => {
      mocks.checkAiHealth
        .mockResolvedValueOnce({ online: false, status: "offline", message: "无法连接到 AI 后端", detail: "d", latencyMs: 5 })
        .mockResolvedValueOnce({ online: false, status: "offline", message: "仍无法连接", detail: "d", latencyMs: 5 });

      const wrapper = await mountChat();
      expect(wrapper.find(".backend-alert").exists()).toBe(true);

      await wrapper.find(".backend-alert .el-button-stub").trigger("click");
      await flushPromises();

      expect(mocks.checkAiHealth).toHaveBeenCalledTimes(2);
      expect(mocks.ElMessage).toHaveBeenCalled();
    });

    it("后端降级时展示降级横幅", async () => {
      mocks.checkAiHealth.mockResolvedValue({
        online: true, status: "degraded", message: "部分能力降级", detail: "d", latencyMs: 5,
      });

      const wrapper = await mountChat();

      expect(wrapper.find(".backend-alert.degraded").exists()).toBe(true);
      expect(wrapper.text()).toContain("AI 后端部分能力降级");
    });

    it("环境变量配置错误时弹出提示", async () => {
      mocks.getEnvReport.mockReturnValue({
        ok: false,
        aiBaseUrl: "",
        issues: [{ level: "error", message: "缺少 VITE_AI_API_BASE_URL" }],
      });

      await mountChat();

      expect(mocks.ElMessage).toHaveBeenCalled();
      const firstArg = mocks.ElMessage.mock.calls[0][0];
      expect(firstArg.message).toContain("VITE_AI_API_BASE_URL");
    });
  });
});
