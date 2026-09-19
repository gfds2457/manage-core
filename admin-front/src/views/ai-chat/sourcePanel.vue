<template>
  <aside class="source-panel">
    <header class="source-panel-header">
      <h3 class="panel-title">引用来源</h3>
      <span class="hit-count">命中 {{ sources.length }} 条</span>
    </header>

    <div class="source-list">
      <!-- 有检索结果：逐条展示来源、摘要与相似度，供用户溯源核对 -->
      <div v-for=" ( item, index ) in sources " :key=" index " class="source-item">
        <div class="source-head">
          <span class="source-index">{{ circled( index + 1 ) }}</span>
          <span class="source-name" :title=" sourceTitle( item ) ">{{ sourceTitle( item ) }}</span>
        </div>
        <p class="source-preview">{{ item.preview || "该片段暂无摘要" }}</p>
        <div class="source-meta">
          <span v-if=" typeof item.score === 'number' " class="source-score">
            相似度 {{ item.score.toFixed( 2 ) }}
          </span>
          <!-- 行号由后端随片段一并给出，缺失时整段隐藏，不显示「第 - 行」这类空值 -->
          <span v-if=" item.startLine " class="source-lines">
            第 {{ item.startLine }}-{{ item.endLine || item.startLine }} 行
          </span>
        </div>
      </div>

      <!-- 无检索结果：明确告知本次回答没有用到知识库，避免用户误以为引用面板坏了 -->
      <div v-if=" sources.length === 0 " class="source-empty">
        <p>本次回答未命中知识库片段</p>
        <p class="source-empty-hint">提问后，命中的知识片段会显示在这里</p>
      </div>
    </div>

    <footer class="source-panel-footer">
      <span class="vector-count">向量库 · {{ vectorCountText }} 条</span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
defineOptions( { name: "SourcePanel" } );
import { computed } from "vue";
import type { RagSourceInterface } from "./type";

const props = defineProps<{
  /** 当前回答引用的知识库片段 */
  sources: RagSourceInterface[];
  /** 向量库总条数；后端未返回时传 null，界面按「--」展示而不是编造 0 */
  vectorCount?: number | null;
}>();

/** 带圈序号，与回答正文中的引用标记一一对应 */
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const circled = ( num: number ): string => CIRCLED[ num - 1 ] || `(${ num })`;

/** 来源展示名：优先文件名，其次来源路径，最后退到条目 ID，保证任何一条都有可读标题 */
const sourceTitle = ( item: RagSourceInterface ): string =>
  item.title || item.source || ( item.docId !== undefined ? `条目 ${ item.docId }` : "未知来源" );

/** 向量库条数：null / undefined 表示后端没给，用 -- 占位 */
const vectorCountText = computed( () =>
  typeof props.vectorCount === "number" ? props.vectorCount.toLocaleString() : "--"
);
</script>

<style scoped lang="scss">
.source-panel {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #eceef2;
  background: #fff;
  height: 100%;
  min-height: 0;
}

.source-panel-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 22px 20px 16px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.hit-count {
  font-size: 13px;
  color: #9ca3af;
}

.source-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px;
}

.source-item {
  padding: 14px 0;
  border-bottom: 1px solid #f1f3f6;

  &:last-child {
    border-bottom: none;
  }
}

.source-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.source-index {
  flex-shrink: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1;
}

.source-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-preview {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #9ca3af;
  /* 摘要只保留两行，避免长片段把面板撑满，破坏右侧栏的信息密度 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: #9ca3af;
}

.source-empty {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;

  p {
    margin: 0;
  }
}

.source-empty-hint {
  margin-top: 6px !important;
  font-size: 12px;
  color: #c0c4cc;
}

.source-panel-footer {
  padding: 14px 20px;
  border-top: 1px solid #f1f3f6;
}

.vector-count {
  font-size: 12px;
  color: #9ca3af;
}
</style>
