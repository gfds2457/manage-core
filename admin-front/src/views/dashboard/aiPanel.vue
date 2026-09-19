<template>
  <el-card class="ai-panel" shadow="hover">
    <template #header>
      <div class="panel-header">
        <div class="panel-title">
          <span class="card-title">
            <el-icon><ChatDotRound /></el-icon>
            AI 问答速测
          </span>
          <!-- 会话标题：第一轮问答结束后由后端生成，生成前 / 请求异常 / 中断都固定为「新对话」 -->
          <el-tag
            v-if="messageList.length > 0"
            class="conv-title"
            size="small"
            effect="plain"
            type="info"
          >
            {{ quickChat.title }}
          </el-tag>
        </div>
        <div class="panel-actions">
          <el-button
            size="small"
            icon="Delete"
            :disabled="quickChat.sending || messageList.length === 0"
            @click="clearAll"
          >
            清空
          </el-button>
          <el-button size="small" type="primary" icon="ChatLineRound" @click="goFullChat">
            前往完整对话页
          </el-button>
        </div>
      </div>
    </template>

    <el-scrollbar ref="scrollRef" class="msg-area">
      <div v-if="messageList.length === 0" class="empty-tip">
        在首页直接提问即可测试 RAG，例如「有哪些适合敏感肌的洗面奶？」，回答下方会附带本次命中的商品 / 知识片段。
      </div>
      <div
        v-for="(msg, index) in messageList"
        :key="index"
        class="msg-row"
        :class="msg.role"
      >
        <div class="msg-bubble" :class="{ 'is-error': msg.isError }">
          <VueMarkdown
            v-if="msg.role === 'assistant' && msg.content"
            class="msg-md"
            :markdown="msg.content"
            :remark-plugins="[remarkGfm]"
          />
          <template v-else-if="msg.content">{{ msg.content }}</template>
          <span v-if="msg.role === 'assistant' && !msg.content && quickChat.sending" class="typing">
            思考中…
          </span>
          <!-- 中途停止 / 被顶掉：正文是截断的，标记出来避免误以为回答就这样 -->
          <span v-if="msg.isStopped" class="stopped-tip">（已停止生成）</span>

          <!-- 检索命中：商品与知识片段都列出来，方便一眼看出 RAG 召回得对不对 -->
          <div v-if="msg.sources && msg.sources.length" class="rag-sources">
            <div class="rag-header">检索命中（{{ msg.sources.length }}）</div>
            <div v-for="(item, sourceIndex) in msg.sources" :key="sourceIndex" class="rag-item">
              <el-tag size="small" effect="plain" :type="isProductSource(item) ? 'success' : 'info'">
                {{ isProductSource(item) ? "商品" : item.source || "知识" }}
              </el-tag>
              <span class="rag-title" :title="item.text">{{ item.title || item.docId }}</span>
              <span v-if="typeof item.score === 'number'" class="rag-score">
                {{ (item.score * 100).toFixed(1) }}%
              </span>
            </div>
          </div>
          <div v-else-if="msg.ragNotice" class="rag-notice">{{ msg.ragNotice }}</div>
        </div>
      </div>
    </el-scrollbar>

    <div class="input-row">
      <el-input
        v-model="input"
        placeholder="问一个商品相关问题，快速验证 RAG 召回效果"
        :disabled="quickChat.sending"
        @keyup.enter="send"
      />
      <el-button v-if="quickChat.sending" type="danger" icon="VideoPause" @click="stop">
        停止
      </el-button>
      <el-button
        v-else
        type="primary"
        icon="Promotion"
        :disabled="!input.trim()"
        @click="send"
      >
        发送
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
defineOptions({
  name: "DashboardAiPanel",
});
import { computed, nextTick, onBeforeMount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { VueMarkdown } from "@crazydos/vue-markdown";
import remarkGfm from "remark-gfm";
import quickChatStore from "@/store/modules/quick-chat";
import type { QuickRagSource } from "@/store/modules/quick-chat";

const router = useRouter();
// 会话状态（消息、会话 ID、标题、发送中）全部收在仓库里：
// 本组件随路由切换会被卸载重建，状态放组件内切页面就丢了
const quickChat = quickChatStore();
const messageList = computed(() => quickChat.messages);
const input = ref("");
const scrollRef = ref<{
  wrapRef?: HTMLElement;
  setScrollTop: (value: number) => void;
} | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    const wrap = scrollRef.value?.wrapRef;
    if (wrap) scrollRef.value?.setScrollTop(wrap.scrollHeight);
  });
};

// 新增消息与流式增量都跟着滚到底：用「条数 + 最后一条正文长度」做触发条件
const lastTick = computed(() => {
  const last = quickChat.messages[quickChat.messages.length - 1];
  return `${quickChat.messages.length}|${last?.content.length ?? 0}`;
});

watch(lastTick, () => scrollToBottom());

// 从缓存恢复上次对话后，进页面直接停在最新一条
onBeforeMount(() => {
  scrollToBottom();
});

const goFullChat = () => {
  router.push("/ai-dialog/chat");
};

// 商品来源判定：后端文档类型 / 来源名的写法不唯一，判不出来时按知识片段展示
const isProductSource = (item: QuickRagSource) =>
  /product|goods|sku|spu|商品|货品/i.test(
    `${item?.docType || ""}${item?.source || ""}${item?.title || ""}`,
  );

const send = async () => {
  const question = input.value.trim();
  if (!question || quickChat.sending) return;
  input.value = "";
  await quickChat.send(question);
};

const stop = () => {
  quickChat.stop();
};

const clearAll = () => {
  quickChat.clear();
};

/*
 * 这里刻意不在卸载时断流：
 * 回答的写回已经在仓库里，中途切页面时继续收完，回来能看到完整回答，
 * 这正是「切换页面内容不丢失」要的效果。
 * 长连接不会失控：正常结束会自行关闭，异常时接口层还有 60s 空闲超时兜底。
 */
</script>

<style scoped lang="scss">
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 468px;

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 12px 16px;
  }
}

.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  .conv-title {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.msg-area {
  flex: 1;
  min-height: 0;
}

.empty-tip {
  padding: 24px 8px;
  font-size: 13px;
  line-height: 1.8;
  color: #909399;
}

.msg-row {
  display: flex;
  margin-bottom: 10px;

  &.user {
    justify-content: flex-end;
  }

  .msg-bubble {
    max-width: 92%;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.7;
    color: #303133;
    background: #f5f7fa;
    word-break: break-word;

    &:hover {
      background: #eef1f6;
    }
  }

  &.user .msg-bubble {
    color: #fff;
    background: var(--el-color-primary);
  }

  .is-error {
    color: #f56c6c;
    background: rgba(245, 108, 108, 0.08);
  }

  .typing {
    color: #909399;
  }

  .stopped-tip {
    margin-left: 4px;
    color: #a8abb2;
  }
}

.msg-md {
  :deep(p) {
    margin: 0 0 6px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(ul),
  :deep(ol) {
    margin: 4px 0;
    padding-left: 20px;
  }

  :deep(pre) {
    margin: 6px 0;
    padding: 8px;
    overflow-x: auto;
    background: #282c34;
    border-radius: 4px;
    // 深色底必须显式配上浅色字：只设背景不设颜色时，代码块会继承气泡的深色文字，
    // 渲染出来就是一个没有任何内容的黑框（AI 返回 ```ts 代码块时必现）
    color: #e5e7eb;
    // 代码块内的空白与换行按原文原样保留，不做折行压缩
    white-space: pre;

    code {
      padding: 0;
      color: inherit;
      background: none;
    }
  }

  :deep(code) {
    padding: 1px 4px;
    border-radius: 3px;
    font-family: Consolas, Monaco, monospace;
    font-size: 12px;
    color: #c7254e;
    background: rgba(0, 0, 0, 0.06);
  }

  :deep(table) {
    border-collapse: collapse;

    th,
    td {
      padding: 2px 6px;
      border: 1px solid #dcdfe6;
    }
  }
}

.rag-sources {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #dcdfe6;

  .rag-header {
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #606266;
  }

  .rag-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    font-size: 12px;
    color: #606266;
  }

  .rag-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rag-score {
    flex-shrink: 0;
    color: #a8abb2;
  }
}

.rag-notice {
  margin-top: 6px;
  font-size: 12px;
  color: #a8abb2;
}

.input-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
