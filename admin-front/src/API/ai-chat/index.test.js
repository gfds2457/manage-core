// 单元测试：AI 对话接口层
// 覆盖：常量导出 / HTTP 接口 / 响应拦截器 / 健康检查 / SSE 流（正常、边界、异常）
//       / isImageModel 模型分流判定（正常、边界、异常输入）
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/utils/aiEnv", () => ({
  getEnvReport: () => ({ ok: true, aiBaseUrl: "http://localhost:3000", issues: [] }),
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
  classifyAiError: vi.fn(() => ({ type: "network", friendly: "无法连接 AI 后端", detail: "detail" })),
}));

vi.mock("@Microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(() => Promise.resolve()),
}));

vi.mock("axios", () => {
  const handlers = {};
  const instance = {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    interceptors: {
      response: {
        use: vi.fn((onFulfilled, onRejected) => {
          handlers.fulfilled = onFulfilled;
          handlers.rejected = onRejected;
        }),
      },
    },
  };

  return {
    default: {
      create: vi.fn(() => instance),
      get: vi.fn(),
      __instance: instance,
      __handlers: handlers,
    },
  };
});

import axios from "axios";
import { fetchEventSource } from "@Microsoft/fetch-event-source";
import {
  AI_API_BASE_URL,
  AI_CHAT_USER_ID,
  AI_DATASOURCE,
  AI_MODEL_OPTIONS,
  AI_IMAGE_MODEL_VALUE,
  checkAiHealth,
  isChatStreaming,
  isImageModel,
  cancelChatStream,
  fetchChatStream,
  getAllChat,
  createChat,
  getTitle,
  getSingleChat,
  getUserFeature,
  uploadImg,
} from "./index";

beforeEach(() => {
  vi.clearAllMocks();
  // 一次性 mock 队列不会被 clearAllMocks 清空，这里显式重置避免用例间串味
  axios.get.mockReset();
  axios.__instance.post.mockImplementation(() => Promise.resolve({ data: { success: true } }));
  cancelChatStream("测试前置清理");
});

afterEach(() => {
  cancelChatStream("测试后清理");
});

describe("AI 对话接口层", () => {
  describe("常量与配置", () => {
    it("导出后端基础地址", () => {
      expect(AI_API_BASE_URL).toBe("http://localhost:3000");
    });

    it("固定用户 ID 为 001", () => {
      expect(AI_CHAT_USER_ID).toBe("001");
    });

    it("默认数据源为 shop_db 且含展示名", () => {
      expect(AI_DATASOURCE.value).toBe("shop_db");
      expect(AI_DATASOURCE.label).toContain("shop_db");
    });

    it("模型选项非空且每项含 string 类型的 value/label", () => {
      expect(AI_MODEL_OPTIONS.length).toBeGreaterThan(0);
      AI_MODEL_OPTIONS.forEach((item) => {
        expect(typeof item.value).toBe("string");
        expect(typeof item.label).toBe("string");
      });
    });

    it("导出图片模型标识，且与后端 IMAGE_MODEL_NAME 的约定一致", () => {
      // 该值必须等于 admin-ai-backend 的 IMAGE_MODEL_NAME：
      // 后端按 `model === imageModelName` 分流，任一侧改动都会让图片链路失效
      expect(typeof AI_IMAGE_MODEL_VALUE).toBe("string");
      expect(AI_IMAGE_MODEL_VALUE).toBe("qwen-image-3.0");
    });

    it("图片模型出现在可选模型列表中（界面才能被选中）", () => {
      const values = AI_MODEL_OPTIONS.map((item) => item.value);
      expect(values).toContain(AI_IMAGE_MODEL_VALUE);
    });

    it("模型选项的 value 互不重复", () => {
      const values = AI_MODEL_OPTIONS.map((item) => item.value);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe("isImageModel 模型分流判定", () => {
    describe("正常场景", () => {
      it("传入图片模型常量时判定为图片链路", () => {
        expect(isImageModel(AI_IMAGE_MODEL_VALUE)).toBe(true);
      });

      it("传入图片模型字面量时判定为图片链路", () => {
        expect(isImageModel("qwen-image-3.0")).toBe(true);
      });

      it("模型列表中的图片模型判定为图片链路", () => {
        AI_MODEL_OPTIONS.filter((item) => item.value === AI_IMAGE_MODEL_VALUE)
          .forEach((item) => {
            expect(isImageModel(item.value)).toBe(true);
          });
      });

      it("模型列表中的文本模型一律判定为非图片链路", () => {
        AI_MODEL_OPTIONS.filter((item) => item.value !== AI_IMAGE_MODEL_VALUE)
          .forEach((item) => {
            expect(isImageModel(item.value)).toBe(false);
          });
      });

      it("传入文本模型时判定为非图片链路", () => {
        expect(isImageModel("qwen3.7-plus")).toBe(false);
      });

      it("纯函数：同一输入重复调用结果稳定，不受调用顺序影响", () => {
        expect(isImageModel(AI_IMAGE_MODEL_VALUE)).toBe(true);
        expect(isImageModel("qwen3.7-plus")).toBe(false);
        expect(isImageModel(AI_IMAGE_MODEL_VALUE)).toBe(true);
        expect(isImageModel("qwen3.7-plus")).toBe(false);
      });
    });

    describe("边界值", () => {
      it("不传参数时判定为非图片链路", () => {
        expect(isImageModel()).toBe(false);
      });

      it("传入 undefined 时判定为非图片链路", () => {
        expect(isImageModel(undefined)).toBe(false);
      });

      it("传入空字符串时判定为非图片链路", () => {
        expect(isImageModel("")).toBe(false);
      });

      it("大小写不同视为不同模型（严格区分大小写）", () => {
        expect(isImageModel("QWEN-IMAGE-3.0")).toBe(false);
        expect(isImageModel("Qwen-Image-3.0")).toBe(false);
      });

      it("模型名带前后空格时不匹配（不做 trim 兜底）", () => {
        expect(isImageModel(` ${AI_IMAGE_MODEL_VALUE} `)).toBe(false);
        expect(isImageModel(`\n${AI_IMAGE_MODEL_VALUE}`)).toBe(false);
      });

      it("仅包含图片模型名子串时不匹配（非模糊匹配）", () => {
        expect(isImageModel("qwen-image")).toBe(false);
        expect(isImageModel("qwen-image-3.0-preview")).toBe(false);
      });

      it("模型名多出结尾字符时不匹配", () => {
        expect(isImageModel(`${AI_IMAGE_MODEL_VALUE}x`)).toBe(false);
        expect(isImageModel(`${AI_IMAGE_MODEL_VALUE} `)).toBe(false);
      });
    });

    describe("异常输入", () => {
      it("传入 null 时不抛异常且判定为非图片链路", () => {
        expect(() => isImageModel(null)).not.toThrow();
        expect(isImageModel(null)).toBe(false);
      });

      it("传入数字时不抛异常且判定为非图片链路", () => {
        expect(() => isImageModel(3.0)).not.toThrow();
        expect(isImageModel(3.0)).toBe(false);
        expect(isImageModel(0)).toBe(false);
      });

      it("传入布尔值时不抛异常且判定为非图片链路", () => {
        expect(isImageModel(true)).toBe(false);
        expect(isImageModel(false)).toBe(false);
      });

      it("传入对象时不抛异常且判定为非图片链路", () => {
        const input = { value: AI_IMAGE_MODEL_VALUE };
        expect(() => isImageModel(input)).not.toThrow();
        expect(isImageModel(input)).toBe(false);
      });

      it("传入数组时不抛异常且判定为非图片链路", () => {
        expect(() => isImageModel([AI_IMAGE_MODEL_VALUE])).not.toThrow();
        expect(isImageModel([AI_IMAGE_MODEL_VALUE])).toBe(false);
      });
    });
  });

  describe("HTTP 接口", () => {
    it("createChat 请求 POST /new 并带上 userId", async () => {
      await createChat("001");

      expect(axios.__instance.post).toHaveBeenCalledWith("/new", { userId: "001" });
    });

    it("getAllChat 请求 POST /all", async () => {
      await getAllChat("001");

      expect(axios.__instance.post).toHaveBeenCalledWith("/all", { userId: "001" });
    });

    it("getTitle 请求 POST /title", async () => {
      await getTitle("001", "conv-1");

      expect(axios.__instance.post).toHaveBeenCalledWith("/title", {
        userId: "001",
        convertId: "conv-1",
      });
    });

    it("getSingleChat 请求 POST /singleChat", async () => {
      await getSingleChat("001", "conv-1");

      expect(axios.__instance.post).toHaveBeenCalledWith("/singleChat", {
        userId: "001",
        convertId: "conv-1",
      });
    });

    it("getUserFeature 请求 POST /userFeature", async () => {
      await getUserFeature("001");

      expect(axios.__instance.post).toHaveBeenCalledWith("/userFeature", { userId: "001" });
    });

    it("uploadImg 以 FormData 上传文件", async () => {
      const file = new File(["x"], "a.png", { type: "image/png" });
      await uploadImg(file);

      const [url, payload] = axios.__instance.post.mock.calls.at(-1);
      expect(url).toBe("/changeImg");
      expect(payload).toBeInstanceOf(FormData);
    });

    it("FormData 中携带的字段名固定为 file", async () => {
      const file = new File(["x"], "a.png", { type: "image/png" });
      await uploadImg(file);

      const [, payload] = axios.__instance.post.mock.calls.at(-1);
      expect(payload.get("file")).toBe(file);
    });
  });

  describe("响应拦截器", () => {
    it("success=false 时同步抛出业务异常", () => {
      const { fulfilled } = axios.__handlers;
      expect(typeof fulfilled).toBe("function");

      expect(() =>
        fulfilled({ data: { success: false, message: "参数错误" }, status: 200 })
      ).toThrowError("参数错误");
    });

    it("无 success 字段时原样返回响应", () => {
      const { fulfilled } = axios.__handlers;
      const response = { data: { foo: "bar" }, status: 200 };

      expect(fulfilled(response)).toBe(response);
    });

    it("非对象响应体时原样返回", () => {
      const { fulfilled } = axios.__handlers;
      const response = { data: "plain", status: 200 };

      expect(fulfilled(response)).toBe(response);
    });

    it("错误分支透传原始错误对象", async () => {
      const { rejected } = axios.__handlers;
      const err = new Error("network down");

      await expect(rejected(err)).rejects.toBe(err);
    });
  });

  describe("checkAiHealth 健康检测", () => {
    it("在线时返回 online=true 与 ok 状态", async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: "ok", dependencies: { db: { status: "up" } } },
      });

      const result = await checkAiHealth();

      expect(result.online).toBe(true);
      expect(result.status).toBe("ok");
      expect(result.message).toContain("正常");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("依赖降级时提示降级并列出异常依赖", async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: "degraded", dependencies: { db: { status: "down", message: "连接超时" } } },
      });

      const result = await checkAiHealth();

      expect(result.online).toBe(true);
      expect(result.status).toBe("degraded");
      expect(result.message).toContain("降级");
      expect(result.message).toContain("db");
    });

    it("请求失败时返回 offline 且不抛异常", async () => {
      axios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await checkAiHealth();

      expect(result.online).toBe(false);
      expect(result.status).toBe("offline");
      expect(result.detail).toContain("/health");
    });

    it("健康检查走独立通道，不经过业务错误拦截器", async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: false, message: "不该被判定为业务失败" },
      });

      const result = await checkAiHealth();

      expect(result.online).toBe(true);
    });
  });

  describe("fetchChatStream 流式请求", () => {
    it("调用 fetchEventSource 并传递完整请求体", () => {
      fetchChatStream({
        keyword: "hi",
        userId: "001",
        convertId: "c1",
        onMessage: vi.fn(),
        onComplete: vi.fn(),
        userFeature: "偏好",
        model: "m1",
        datasource: "shop_db",
        files: ["f1"],
      });

      expect(fetchEventSource).toHaveBeenCalledTimes(1);
      const [url, options] = fetchEventSource.mock.calls.at(-1);

      expect(url).toBe("http://localhost:3000/chat");
      expect(options.method).toBe("POST");
      expect(options.openWhenHidden).toBe(true);

      const body = JSON.parse(options.body);
      expect(body.keyword).toBe("hi");
      expect(body.userId).toBe("001");
      expect(body.convertId).toBe("c1");
      expect(body.userFeature).toBe("偏好");
      expect(body.model).toBe("m1");
      expect(body.datasource).toBe("shop_db");
      expect(body.files).toEqual(["f1"]);

      cancelChatStream("cleanup");
    });

    it("图片模型标识可原样下发给后端（与 isImageModel 判定同源）", () => {
      fetchChatStream({
        keyword: "画一张图",
        userId: "001",
        convertId: "c1",
        onMessage: vi.fn(),
        onComplete: vi.fn(),
        model: AI_IMAGE_MODEL_VALUE,
      });

      const [, options] = fetchEventSource.mock.calls.at(-1);
      const body = JSON.parse(options.body);

      expect(isImageModel(body.model)).toBe(true);

      cancelChatStream("cleanup");
    });

    it("同一时刻只保留一条连接，新请求自动取消上一条", () => {
      const firstOnError = vi.fn();

      fetchChatStream({
        keyword: "a", userId: "u", convertId: "c",
        onMessage: vi.fn(), onComplete: vi.fn(), onError: firstOnError,
      });
      expect(isChatStreaming()).toBe(true);

      fetchChatStream({
        keyword: "b", userId: "u", convertId: "c",
        onMessage: vi.fn(), onComplete: vi.fn(),
      });

      expect(firstOnError).toHaveBeenCalledTimes(1);
      expect(fetchEventSource).toHaveBeenCalledTimes(2);
      expect(isChatStreaming()).toBe(true);

      cancelChatStream("cleanup");
    });

    it("onopen 建立连接后触发调用方的 onOpen 回调", async () => {
      const onOpen = vi.fn();
      fetchChatStream({
        keyword: "k", userId: "u", convertId: "c",
        onMessage: vi.fn(), onComplete: vi.fn(), onOpen,
      });

      const [, options] = fetchEventSource.mock.calls.at(-1);
      await options.onopen({ ok: true, status: 200 });

      expect(onOpen).toHaveBeenCalledTimes(1);
      cancelChatStream("cleanup");
    });

    it("onmessage 解析 JSON 后交给回调", () => {
      const onMessage = vi.fn();
      fetchChatStream({ keyword: "k", userId: "u", convertId: "c", onMessage, onComplete: vi.fn() });

      const [, options] = fetchEventSource.mock.calls.at(-1);
      options.onmessage({ data: '{"a":1}' });

      expect(onMessage).toHaveBeenCalledWith({ a: 1 });
      cancelChatStream("cleanup");
    });

    it("onmessage 收到非法 JSON 时跳过该帧而不中断流", () => {
      const onMessage = vi.fn();
      fetchChatStream({ keyword: "k", userId: "u", convertId: "c", onMessage, onComplete: vi.fn() });

      const [, options] = fetchEventSource.mock.calls.at(-1);

      expect(() => options.onmessage({ data: "not-json" })).not.toThrow();
      expect(onMessage).not.toHaveBeenCalled();
      cancelChatStream("cleanup");
    });

    it("onclose 触发 onComplete 且只触发一次", () => {
      const onComplete = vi.fn();
      fetchChatStream({ keyword: "k", userId: "u", convertId: "c", onMessage: vi.fn(), onComplete });

      const [, options] = fetchEventSource.mock.calls.at(-1);
      options.onclose();
      options.onclose();

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("onopen 在非 2xx 时抛出业务异常", async () => {
      fetchChatStream({ keyword: "k", userId: "u", convertId: "c", onMessage: vi.fn(), onComplete: vi.fn() });

      const [, options] = fetchEventSource.mock.calls.at(-1);

      await expect(options.onopen({ ok: false, status: 500 }))
        .rejects.toThrow("流式接口返回 HTTP 500");
    });

    it("onopen 在 2xx 时正常通过", async () => {
      fetchChatStream({ keyword: "k", userId: "u", convertId: "c", onMessage: vi.fn(), onComplete: vi.fn() });

      const [, options] = fetchEventSource.mock.calls.at(-1);

      await expect(options.onopen({ ok: true, status: 200 })).resolves.toBeUndefined();
    });

    it("onerror 抛出异常以阻止库的无限重试", () => {
      fetchChatStream({ keyword: "k", userId: "u", convertId: "c", onMessage: vi.fn(), onComplete: vi.fn() });

      const [, options] = fetchEventSource.mock.calls.at(-1);

      expect(() => options.onerror(new Error("stream fail"))).toThrow("stream fail");
    });

    it("主动取消会触发 onError 且只收尾一次", () => {
      const onError = vi.fn();
      fetchChatStream({
        keyword: "k", userId: "u", convertId: "c",
        onMessage: vi.fn(), onComplete: vi.fn(), onError,
      });

      expect(cancelChatStream("用户取消")).toBe(true);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(isChatStreaming()).toBe(false);
    });

    it("无活动连接时 cancelChatStream 返回 false", () => {
      expect(cancelChatStream("空转")).toBe(false);
    });

    it("空闲超时会中断连接并触发 onError", () => {
      vi.useFakeTimers();
      try {
        const onError = vi.fn();
        fetchChatStream({
          keyword: "k", userId: "u", convertId: "c",
          onMessage: vi.fn(), onComplete: vi.fn(), onError,
        });

        vi.advanceTimersByTime(60_000);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(isChatStreaming()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("每收到一帧都会重置空闲计时器（长回答不会被误判卡死）", () => {
      vi.useFakeTimers();
      try {
        const onError = vi.fn();
        fetchChatStream({
          keyword: "k", userId: "u", convertId: "c",
          onMessage: vi.fn(), onComplete: vi.fn(), onError,
        });

        const [, options] = fetchEventSource.mock.calls.at(-1);

        // 推进 50s，再喂一帧，再推进 50s：若计时器未被重置，第二次推进就会触发超时
        vi.advanceTimersByTime(50_000);
        options.onmessage({ data: "{}" });
        vi.advanceTimersByTime(50_000);

        expect(onError).not.toHaveBeenCalled();

        cancelChatStream("cleanup");
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
