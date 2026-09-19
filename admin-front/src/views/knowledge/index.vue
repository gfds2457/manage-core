<template>
  <div class="kb-manage">
    <!-- 概览与同步 -->
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="panel-header">
          <span class="card-title">
            <el-icon><Collection /></el-icon>
            知识库概览
          </span>
          <div class="panel-actions">
            <el-button size="small" icon="Refresh" :loading="loading" @click="loadStats">
              刷新
            </el-button>
            <el-button
              size="small"
              type="primary"
              icon="Upload"
              :loading="syncing"
              @click="startSync(false)"
            >
              增量同步
            </el-button>
            <el-button
              size="small"
              type="warning"
              icon="RefreshRight"
              :loading="syncing"
              @click="confirmRebuild"
            >
              全量重建
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="statsError"
        type="warning"
        :closable="false"
        show-icon
        :title="statsError"
        style="margin-bottom: 12px"
      />

      <el-descriptions :column="4" border>
        <el-descriptions-item label="清单文档数">
          {{ showNum(stats?.manifestDocs) }}
        </el-descriptions-item>
        <el-descriptions-item label="向量文档数">
          {{ showNum(stats?.vectorDocs) }}
        </el-descriptions-item>
        <el-descriptions-item label="向量分块数">
          {{ showNum(stats?.vectorChunks) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近同步时间">
          {{ stats?.lastSyncAt ? formatTime(stats.lastSyncAt) : "-" }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 同步队列：手动同步是异步入队，这里把进度露出来，避免以为没生效 -->
      <div class="queue-row">
        <span class="queue-title">同步队列</span>
        <el-tag size="small" :type="queueDraining ? 'warning' : 'success'" effect="plain">
          {{ queueDraining ? "处理中" : "空闲" }}
        </el-tag>
        <span class="queue-item">待处理：{{ showNum(queue?.pending) }}</span>
        <span class="queue-item">成功：{{ showNum(queue?.succeeded) }}</span>
        <span class="queue-item">失败：{{ showNum(queue?.failed) }}</span>
        <span v-if="queue?.lastTask" class="queue-item queue-weak">
          最近任务：{{ queue.lastTask.label }} · {{ formatTime(queue.lastTask.at) }}
        </span>
      </div>
      <el-alert
        v-if="queue?.lastError"
        type="error"
        :closable="false"
        show-icon
        style="margin-top: 8px"
        :title="`最近失败：${queue.lastError.label} — ${queue.lastError.message}`"
      />
    </el-card>

    <!-- 检索调试 -->
    <el-card shadow="never" class="search-card">
      <template #header>
        <span class="card-title">
          <el-icon><Search /></el-icon>
          检索调试
        </span>
      </template>

      <div class="search-row">
        <el-input
          v-model="question"
          placeholder="输入一个问题，看看会命中哪些知识片段"
          clearable
          @keyup.enter="doSearch"
        />
        <el-input-number v-model="topK" :min="1" :max="20" :step="1" controls-position="right" />
        <el-button type="primary" icon="Search" :loading="searching" @click="doSearch">
          检索
        </el-button>
      </div>

      <el-alert
        v-if="searchError"
        type="warning"
        :closable="false"
        show-icon
        :title="searchError"
        style="margin-top: 12px"
      />
      <el-alert
        v-else-if="searchResult?.notice"
        type="info"
        :closable="false"
        show-icon
        style="margin-top: 12px"
        :title="searchResult.notice"
      />

      <template v-if="searchResult">
        <div class="search-meta">
          <span>命中 {{ searchResult.count }} 条</span>
          <span v-if="searchResult.rewritten">
            改写后的问题：{{ searchResult.rewrittenQuery }}
          </span>
          <el-tag v-if="searchResult.degraded" size="small" type="warning" effect="plain">
            检索降级
          </el-tag>
        </div>

        <el-empty
          v-if="searchResult.hits.length === 0"
          description="没有命中任何片段"
          :image-size="60"
        />
        <div v-else class="hit-list">
          <div v-for="hit in searchResult.hits" :key="hit.id" class="hit-item">
            <div class="hit-head">
              <el-tag size="small" effect="plain">{{ hit.docType || hit.source || "知识" }}</el-tag>
              <span class="hit-title">{{ hit.title || hit.docId }}</span>
              <span v-if="typeof hit.score === 'number'" class="hit-score">
                {{ (hit.score * 100).toFixed(1) }}%
              </span>
            </div>
            <div class="hit-text">{{ hit.text }}</div>
          </div>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: "knowledgeManage",
});
import { computed, onBeforeUnmount, onBeforeMount, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getKbQueue,
  getKbStats,
  searchKb,
  syncKb,
} from "@/API/knowledge";
import type { KbQueueStatus, KbSearchData, KbStatsData } from "@/API/knowledge";
import { classifyAiError, logAiError } from "@/utils/aiError";
import { formatTime } from "@/utils/format";

const stats = ref<KbStatsData | null>(null);
const queue = ref<KbQueueStatus | null>(null);
const statsError = ref("");
const loading = ref(false);
const syncing = ref(false);

const question = ref("");
const topK = ref(5);
const searching = ref(false);
const searchResult = ref<KbSearchData | null>(null);
const searchError = ref("");

// 队列轮询：手动同步只是入队，靠轮询才能看到真正的处理进度
let queueTimer: ReturnType<typeof setInterval> | null = null;

const showNum = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString() : "-";

// 队列里有活时才显示「处理中」，让同步状态一眼可辨
const queueDraining = computed(
  () => Boolean(queue.value?.draining) || (queue.value?.pending ?? 0) > 0,
);

const stopPoll = () => {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
};

const pollQueue = async () => {
  try {
    const res = await getKbQueue();
    queue.value = res.data.data;
    if (!queueDraining.value) {
      stopPoll();
      // 队列跑完再刷新一次统计，保证文档数与队列状态对得上
      void loadStats();
    }
  } catch (err) {
    stopPoll();
    logAiError("同步队列轮询", classifyAiError(err, "同步队列"), err);
  }
};

const startPoll = () => {
  stopPoll();
  void pollQueue();
  queueTimer = setInterval(() => void pollQueue(), 3000);
};

const loadStats = async () => {
  loading.value = true;
  try {
    const res = await getKbStats();
    stats.value = res.data.data;
    queue.value = res.data.data.queue ?? null;
    statsError.value = "";
  } catch (err) {
    const info = classifyAiError(err, "知识库统计");
    logAiError("知识库统计", info, err);
    statsError.value = `${info.friendly}（知识库接口连的是 AI 后端）`;
    stats.value = null;
  } finally {
    loading.value = false;
  }
};

const startSync = async (force: boolean) => {
  syncing.value = true;
  try {
    const res = await syncKb(force);
    ElMessage.success(res.data.message || (force ? "已触发全量重建" : "已触发增量同步"));
    startPoll();
  } catch (err) {
    const info = classifyAiError(err, "知识库同步");
    logAiError("知识库同步", info, err);
    ElMessage.error(info.friendly);
  } finally {
    syncing.value = false;
  }
};

// 全量重建会清掉现有向量后重新写入，属于不可逆操作，先让用户确认
const confirmRebuild = async () => {
  try {
    await ElMessageBox.confirm(
      "全量重建会按清单重新生成所有向量，过程较慢且期间检索结果可能不完整，确认继续？",
      "全量重建知识库",
      { type: "warning", confirmButtonText: "确认重建", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  void startSync(true);
};

const doSearch = async () => {
  const keyword = question.value.trim();
  if (!keyword) {
    ElMessage.warning("请输入要检索的问题");
    return;
  }
  searching.value = true;
  searchError.value = "";
  try {
    const res = await searchKb(keyword, { topK: topK.value });
    searchResult.value = res.data.data;
  } catch (err) {
    const info = classifyAiError(err, "知识库检索");
    logAiError("知识库检索", info, err);
    searchError.value = info.friendly;
    searchResult.value = null;
  } finally {
    searching.value = false;
  }
};

onBeforeMount(() => {
  loadStats();
  void pollQueue();
});

onBeforeUnmount(stopPoll);
</script>

<style scoped lang="scss">
.kb-manage {
  height: 100%;
  padding-bottom: 16px;
  overflow-y: auto;
}

.search-card {
  margin-top: 16px;
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

.queue-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: #606266;

  .queue-title {
    font-size: 13px;
    font-weight: 500;
  }

  .queue-weak {
    color: #909399;
  }
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
}

.hit-list {
  margin-top: 8px;
}

.hit-item {
  padding: 10px 0;
  border-bottom: 1px dashed #ebeef5;

  &:last-child {
    border-bottom: none;
  }

  .hit-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #303133;
  }

  .hit-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .hit-score {
    color: #909399;
    font-size: 12px;
  }

  .hit-text {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.7;
    color: #606266;
    white-space: pre-wrap;
  }
}
</style>
