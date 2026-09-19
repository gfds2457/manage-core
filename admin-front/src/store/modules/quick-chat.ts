import { defineStore } from "pinia";
import {
  cancelChatStream,
  createChat,
  fetchChatStream,
  getTitle,
} from "@/API/ai-chat";
import { getAiChatUserId } from "@/utils/aiUserId";
import { classifyAiError, logAiError } from "@/utils/aiError";

/**
 * 首页「AI 问答速测」会话仓库。
 *
 * 为什么不放在组件里：
 * 首页速测面板随路由切换会被卸载重建，消息放在组件的 ref 上离开页面就全丢了；
 * 流式回答的写回同样不能挂在组件生命周期上，否则切走页面后收尾回调无处落地，
 * 半截回答和标题都会丢。把会话状态与流式收发一起收在仓库里，
 * 组件只负责渲染与滚动，切页面、退到别的路由再回来内容都还在。
 */

/** 后端 SSE 推来的检索命中片段（字段与完整对话页一致） */
export interface QuickRagSource {
  source?: string;
  docType?: string;
  title?: string;
  docId?: string;
  text?: string;
  score?: number;
}

/** 首页速测的一条消息：只保留角色、正文与检索来源 */
export interface QuickMessage {
  role: "user" | "assistant";
  content: string;
  /** 本条回答命中的知识库 / 商品片段，字段由后端 SSE 的 rag_sources 推送 */
  sources?: QuickRagSource[];
  /** 检索降级提示（检索为空或向量服务不可用） */
  ragNotice?: string;
  isError?: boolean;
  /** 用户中途停止 / 被其它请求顶掉，正文是截断的 */
  isStopped?: boolean;
}

/** 标题占位值：第一轮问答结束前、以及标题请求异常或中断时都用它 */
export const QUICK_CHAT_DEFAULT_TITLE = "新对话";

/** 会话缓存键。用 sessionStorage：刷新页面能续上，关掉标签页自动清空 */
const STORAGE_KEY = "dashboard-quick-chat";

/** 流式增量写缓存的节流间隔：每来一块就写一次 sessionStorage 没必要 */
const PERSIST_THROTTLE_MS = 500;

/**
 * 会话代次。清空会话时递增，让仍在回调里的旧长连接不再往新列表里写内容。
 * 放在模块级而非 state：它只是并发控制的游标，不需要参与响应式与持久化。
 */
let streamToken = 0;

/** 上次写缓存的时间戳，用于节流 */
let lastPersistAt = 0;

interface CachedChat {
  messages: QuickMessage[];
  chatId: string;
  title: string;
}

/** 读取上一次的会话缓存，任何异常都退回空会话，不能因为脏数据让首页白屏 */
const readCache = (): CachedChat => {
  const empty: CachedChat = { messages: [], chatId: "", title: QUICK_CHAT_DEFAULT_TITLE };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      chatId: typeof parsed?.chatId === "string" ? parsed.chatId : "",
      title: typeof parsed?.title === "string" && parsed.title
        ? parsed.title
        : QUICK_CHAT_DEFAULT_TITLE,
    };
  } catch (err) {
    console.warn("[首页速测] 会话缓存解析失败，已按空会话处理：", err);
    return empty;
  }
};

const quickChat = defineStore("quickChat", {
  state: () => {
    const cached = readCache();
    return {
      messages: cached.messages,
      chatId: cached.chatId,
      title: cached.title,
      sending: false,
    };
  },
  getters: {
    /** 本轮会话是否已经有正式标题 */
    hasTitle: (state) => state.title !== QUICK_CHAT_DEFAULT_TITLE,
  },
  actions: {
    /** 把当前会话落到 sessionStorage；节流只作用于流式过程中的高频写 */
    persist(immediate = true) {
      const now = Date.now();
      if (!immediate && now - lastPersistAt < PERSIST_THROTTLE_MS) return;
      lastPersistAt = now;
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            messages: this.messages,
            chatId: this.chatId,
            title: this.title,
          }),
        );
      } catch (err) {
        // 缓存写不进去不影响本次对话，只是刷新后恢复不了
        console.warn("[首页速测] 会话缓存写入失败：", err);
      }
    },

    /**
     * 首条提问前先把会话建出来：SSE 必须带 convertId 才会把回答落到会话上
     */
    async ensureChatId() {
      if (this.chatId) return;
      const res = await createChat(getAiChatUserId());
      const id = res?.data?.data;
      if (!id) throw new Error("创建会话失败：接口未返回会话 ID");
      this.chatId = id;
      this.persist();
    },

    /**
     * 发送一条提问并把流式回答写回消息列表。
     * 组件不再参与收发，因此切走页面时回答仍会继续落到仓库里。
     * @param question 提问原文
     */
    async send(question: string) {
      const text = question.trim();
      if (!text || this.sending) return;

      this.messages.push({ role: "user", content: text });
      this.persist();

      try {
        await this.ensureChatId();
      } catch (err) {
        const info = classifyAiError(err, "创建会话");
        logAiError("首页速测-创建会话", info, err);
        this.messages.push({ role: "assistant", content: info.friendly, isError: true });
        this.persist();
        return;
      }

      // 先占位一个回答气泡，流式内容往这条消息里追加。
      // 必须用数组里的代理对象：直接改普通对象不会触发视图更新
      this.messages.push({ role: "assistant", content: "" });
      const answer = this.messages[this.messages.length - 1];
      const token = streamToken;
      this.sending = true;

      // 检索来源在正文之前推送，先暂存，等第一条正文到达时挂到回答上
      let pendingSources: QuickRagSource[] = [];
      let pendingNotice = "";

      fetchChatStream({
        keyword: text,
        userId: getAiChatUserId(),
        convertId: this.chatId,
        onMessage: (data) => {
          if (token !== streamToken) return;
          if (!data || data.done || data.error) return;
          if (data.type === "rag_sources") {
            // SSE 推来的 data 是 any，这里收敛成仓库内部类型
            pendingSources = (Array.isArray(data.sources) ? data.sources : []) as QuickRagSource[];
            pendingNotice = data.notice || "";
            return;
          }
          // 首页面板不渲染工具卡片与生成图片，避免把首页撑成长页面
          if (data.imageUrl || (data.role === "tool" && data.cardName)) return;
          const content = data.choices?.[0]?.delta?.content || "";
          if (!content) return;
          if (!answer.content) {
            answer.sources = pendingSources;
            answer.ragNotice = pendingNotice;
          }
          answer.content += content;
          // 流式过程中节流写缓存：页面被刷新时不至于丢掉已经流出来的正文
          this.persist(false);
        },
        onComplete: () => {
          if (token !== streamToken) return;
          this.sending = false;
          if (!answer.content && !answer.sources?.length && !answer.ragNotice) {
            answer.content = "本次没有收到有效回复，请重试。";
          }
          this.persist();
          // 第一轮对话正常结束才生成标题，标题依赖大模型总结，失败不影响对话本身
          void this.refreshTitle(token);
        },
        onError: (info, rawError) => {
          if (token !== streamToken) return;
          this.sending = false;
          // 主动取消（用户点停止、或被完整对话页的新请求顶掉）不是故障：
          // 已经流出来的正文必须原样留下，只补一个截断标记，绝不能整条覆盖掉
          if (info.type === "canceled") {
            if (answer.content) {
              answer.isStopped = true;
            } else {
              answer.content = info.friendly;
            }
            this.persist();
            return;
          }
          logAiError("首页速测-发送消息", info, rawError);
          answer.isError = true;
          answer.content = info.friendly;
          this.persist();
        },
      });
    },

    /** 停止生成：正文保留，只标记截断 */
    stop() {
      cancelChatStream("首页速测：用户停止生成");
      this.sending = false;
      this.persist();
    },

    /** 清空会话：换一条新会话，避免上下文残留影响下一次测试 */
    clear() {
      cancelChatStream("首页速测：清空会话");
      // 代次递增：仍在回调里的旧长连接不能再往清空后的列表里写内容
      streamToken += 1;
      this.sending = false;
      this.messages = [];
      this.chatId = "";
      this.title = QUICK_CHAT_DEFAULT_TITLE;
      this.persist();
    },

    /**
     * 生成会话标题。
     * 只在「第一轮对话」结束后调用：后续轮次沿用已有标题，避免每问一次都触发大模型总结。
     * 标题只是锦上添花，失败或中断都保持默认的「新对话」，不弹提示。
     * @param token 会话代次，已过期则不再回写标题
     */
    async refreshTitle(token: number) {
      // 已有正式标题说明不是第一轮，直接跳过
      if (this.hasTitle) return;
      // 判断本轮是不是第一轮：消息列表里只有一条用户提问
      if (this.messages.filter((item) => item.role === "user").length !== 1) return;
      if (!this.chatId) return;

      try {
        const res = await getTitle(getAiChatUserId(), this.chatId);
        if (token !== streamToken) return;
        if (res?.status !== 200 || !Array.isArray(res.data)) {
          this.title = QUICK_CHAT_DEFAULT_TITLE;
          return;
        }
        const chatInfo = res.data.find(
          (item: { convertId?: string }) => item.convertId === this.chatId,
        );
        const title = chatInfo?.title;
        // 后端在会话没有有效消息时会返回「空对话」，它对用户没有意义，保持默认标题
        if (title && title !== "空对话") {
          this.title = title;
        } else {
          this.title = QUICK_CHAT_DEFAULT_TITLE;
        }
        this.persist();
      } catch (err) {
        const info = classifyAiError(err, "获取会话标题");
        logAiError("首页速测-获取会话标题", info, err);
        // 请求异常时标题固定回「新对话」
        this.title = QUICK_CHAT_DEFAULT_TITLE;
        this.persist();
      }
    },
  },
});

export default quickChat;
