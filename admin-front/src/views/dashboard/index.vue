<template>
  <div class="dashboard">
    <!-- 核心指标 -->
    <el-row :gutter=" 16 " v-loading=" metricsLoading ">
      <el-col v-for=" card in metricCards " :key=" card.key " :span=" 8 ">
        <el-card class="metric-card" shadow="hover">
          <div class="metric-head">
            <el-icon class="metric-icon" :style=" { color: card.color } ">
              <component :is=" card.icon " />
            </el-icon>
            <span class="metric-title">{{ card.title }}</span>
            <el-tag v-if=" card.mock " size="small" type="warning" effect="plain">演示数据</el-tag>
          </div>
          <div class="metric-main">
            <span class="metric-value">{{ card.mainValue }}</span>
            <span class="metric-label">{{ card.mainLabel }}</span>
          </div>
          <div class="metric-sub">
            <span v-for=" sub in card.sub " :key=" sub ">{{ sub }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- AI 速测 + 快捷入口 -->
    <el-row :gutter=" 16 " class="row-gap">
      <el-col :span=" 16 ">
        <AiPanel />
      </el-col>
      <el-col :span=" 8 ">
        <el-card class="quick-card" shadow="hover">
          <template #header>
            <span class="card-title">
              <el-icon>
                <Promotion />
              </el-icon>
              快捷访问
            </span>
          </template>
          <div v-for=" entry in quickEntries " :key=" entry.path " class="quick-entry" @click="toPage( entry.path )">
            <el-icon class="quick-icon">
              <component :is=" entry.icon " />
            </el-icon>
            <div class="quick-text">
              <div class="quick-name">{{ entry.title }}</div>
              <div class="quick-desc">{{ entry.desc }}</div>
            </div>
            <el-icon class="quick-arrow">
              <ArrowRight />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 访问趋势 + 最近操作日志 -->
    <el-row :gutter=" 16 " class="row-gap">
      <el-col :span=" 14 ">
        <el-card shadow="hover">
          <template #header>
            <div class="panel-header">
              <span class="card-title">
                <el-icon>
                  <TrendCharts />
                </el-icon>
                访问趋势
              </span>
              <el-tag size="small" type="warning" effect="plain">近 14 天 · 演示数据</el-tag>
            </div>
          </template>
          <VisitTrend :points=" trend " />
        </el-card>
      </el-col>
      <el-col :span=" 10 ">
        <el-card shadow="hover">
          <template #header>
            <div class="panel-header">
              <span class="card-title">
                <el-icon>
                  <Tickets />
                </el-icon>
                最近操作日志
              </span>
              <div class="log-actions">
                <!-- 停留期间自动轮询，回到标签页也会立刻补一次，不需要手动点刷新 -->
                <el-tag size="small" type="success" effect="plain">实时</el-tag>
                <el-button size="small" icon="Refresh" :loading=" logLoading " @click="loadLogs()">
                  刷新
                </el-button>
              </div>
            </div>
          </template>
          <el-scrollbar height="210px" v-loading=" logLoading ">
            <el-empty v-if=" logs.length === 0 " description="暂无操作记录" :image-size=" 60 " />
            <!-- 每条日志固定三要素：操作人 + 操作行为 + 操作时间 -->
            <div v-for=" log in logs " :key=" log.id " class="log-item">
              <el-avatar class="log-avatar" :size=" 26 ">
                {{ operatorInitial( log.operator ) }}
              </el-avatar>
              <div class="log-main">
                <div class="log-line">
                  <span class="log-operator" :title=" log.operator ">
                    {{ log.operator || "未知操作人" }}
                  </span>
                  <el-tag size="small" :type=" logTagType( log.status ) ">{{ log.action }}</el-tag>
                </div>
                <div class="log-target" :title=" log.target ">{{ log.target }}</div>
                <div class="log-time">
                  <el-icon>
                    <Clock />
                  </el-icon>
                  {{ formatTime( log.time ) }}
                </div>
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
defineOptions( {
  name: "dashboardIndex",
} );
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getDashboardData, getRecentLogs, getVisitTrend } from "@/API/dashboard";
import type { DashboardData, OperationLogItem, VisitTrendPoint } from "@/API/dashboard";
import { formatTime } from "@/utils/format";
import AiPanel from "./aiPanel.vue";
import VisitTrend from "./visitTrend.vue";

const router = useRouter();
// 各指标初始为 null，代表「暂未取到」，界面统一显示 -
const data = ref<DashboardData>( {
  goods: { spuTotal: null, skuTotal: null, brandTotal: null },
  kbDocTotal: null,
  kbVectorChunks: null,
  kbQueuePending: null,
  kbLastSyncAt: "",
} );
const metricsLoading = ref( false );
const logs = ref<OperationLogItem[]>( [] );
const logLoading = ref( false );
// 趋势为演示数据，本地生成，不受后端影响
const trend = ref<VisitTrendPoint[]>( getVisitTrend( 14 ) );

// 数值展示：取不到就显示 -
const showNum = ( value: number | null ) =>
  typeof value === "number" ? value.toLocaleString() : "-";

const metricCards = computed( () =>
{
  const todayCount = trend.value.length ? trend.value[ trend.value.length - 1 ].count : null;
  const totalCount = trend.value.reduce( ( sum, item ) => sum + item.count, 0 );
  return [
    {
      key: "goods",
      title: "商品统计",
      icon: "GoodsFilled",
      color: "#409eff",
      mock: false,
      mainLabel: "SPU 总数",
      mainValue: showNum( data.value.goods.spuTotal ),
      sub: [
        `SKU：${ showNum( data.value.goods.skuTotal ) }`,
        `品牌：${ showNum( data.value.goods.brandTotal ) }`,
      ],
    },
    {
      key: "kb",
      title: "知识库文档",
      icon: "Collection",
      color: "#67c23a",
      mock: false,
      mainLabel: "文档数量",
      mainValue: showNum( data.value.kbDocTotal ),
      sub: [
        `向量分块：${ showNum( data.value.kbVectorChunks ) }`,
        `待入队：${ showNum( data.value.kbQueuePending ) }`,
      ],
    },
    {
      key: "ai",
      title: "AI 问答访问量",
      icon: "ChatDotRound",
      color: "#e6a23c",
      mock: true,
      mainLabel: "今日访问",
      mainValue: showNum( todayCount ),
      sub: [ `近 14 天合计：${ showNum( totalCount ) }` ],
    },
  ];
} );

// 快捷入口：目标就是现有页面，这里只做跳转，不额外造页面
const quickEntries = [
  { title: "商品新增", desc: "进入 SPU 管理，选完三级分类即可添加", icon: "Plus", path: "/goods/spu" },
  { title: "知识库管理", desc: "文档统计、手动同步、检索调试", icon: "Collection", path: "/kb/manage" },
  { title: "AI 完整问答页", desc: "多轮对话、历史会话、图片提问", icon: "ChatLineRound", path: "/ai-dialog/chat" },
];

const toPage = ( path: string ) =>
{
  router.push( path );
};

// 0 待处理 / 1 已通过 / 2 已驳回
const logTagType = ( status: number ) =>
{
  if ( status === 0 ) return "warning";
  if ( status === 1 ) return "success";
  return "danger";
};

// 头像占位文字：取操作人名字首字，取不到时用「?」，避免出现空白圆圈
const operatorInitial = ( operator: string ) => ( operator || "?" ).trim().charAt( 0 ) || "?";

const loadMetrics = async () =>
{
  metricsLoading.value = true;
  try
  {
    data.value = await getDashboardData();
  } finally
  {
    metricsLoading.value = false;
  }
};

/**
 * 拉取最近操作日志。
 * @param silent 后台轮询传 true：不显示加载态，否则每轮都会闪一次遮罩
 */
const loadLogs = async ( silent = false ) =>
{
  if ( !silent ) logLoading.value = true;
  try
  {
    logs.value = await getRecentLogs( 8 );
  } catch ( err )
  {
    // 拉取失败保留上一次的数据：轮询期间偶发失败就把列表清空，
    // 会让人误以为这段时间没有任何操作记录
    console.warn( "[工作台] 操作日志拉取失败:", err );
  } finally
  {
    if ( !silent ) logLoading.value = false;
  }
};

/**
 * 操作日志实时刷新。
 * 工作台没有被 keep-alive 缓存，离开再回来会重新挂载并拉一次，
 * 停留期间则靠这里的轮询补齐：轮询周期取 15s，
 * 比审核操作的频率（人工点击）快得多，又不会把后端打满。
 */
const LOG_REFRESH_INTERVAL_MS = 15_000;
let logTimer: ReturnType<typeof setInterval> | null = null;

// 切到别的标签页时没必要继续轮询，切回来立刻补一次，保证看到的不是离开前的旧数据
const handleVisibilityChange = () =>
{
  if ( document.visibilityState === "visible" )
  {
    loadLogs();
  }
};

const startLogPolling = () =>
{
  stopLogPolling();
  logTimer = setInterval( () =>
  {
    if ( document.visibilityState === "visible" ) loadLogs( true );
  }, LOG_REFRESH_INTERVAL_MS );
  document.addEventListener( "visibilitychange", handleVisibilityChange );
};

const stopLogPolling = () =>
{
  if ( logTimer )
  {
    clearInterval( logTimer );
    logTimer = null;
  }
  document.removeEventListener( "visibilitychange", handleVisibilityChange );
};

onBeforeMount( () =>
{
  loadMetrics();
  loadLogs();
} );

onMounted( startLogPolling );

onBeforeUnmount( stopLogPolling );
</script>

<style scoped lang="scss">
.dashboard {
  height: 100%;
  padding-bottom: 16px;
  overflow-y: auto;
}

.row-gap {
  margin-top: 16px;
}

.metric-card {
  .metric-head {
    display: flex;
    align-items: center;
    gap: 8px;

    .metric-icon {
      font-size: 18px;
    }

    .metric-title {
      font-size: 14px;
      color: #606266;
      font-weight: 500;
    }
  }

  .metric-main {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 12px;

    .metric-value {
      font-size: 28px;
      font-weight: 600;
      line-height: 1;
    }

    .metric-label {
      font-size: 12px;
      color: #909399;
    }
  }

  .metric-sub {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    font-size: 12px;
    color: #909399;
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

.quick-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &+.quick-entry {
    margin-top: 12px;
  }

  &:hover {
    border-color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.06);

    .quick-arrow {
      transform: translateX(4px);
    }
  }

  .quick-icon {
    font-size: 18px;
    color: var(--el-color-primary);
  }

  .quick-text {
    flex: 1;
    min-width: 0;

    .quick-name {
      font-size: 14px;
      color: #303133;
    }

    .quick-desc {
      font-size: 12px;
      color: #909399;
      margin-top: 2px;
    }
  }

  .quick-arrow {
    color: #c0c4cc;
    transition: transform 0.2s;
  }
}

.log-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed #ebeef5;

  &:last-child {
    border-bottom: none;
  }

  .log-avatar {
    flex-shrink: 0;
    font-size: 12px;
    color: #fff;
    background: var(--el-color-primary);
  }

  .log-main {
    flex: 1;
    min-width: 0;

    .log-line {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;

      .log-operator {
        flex-shrink: 0;
        font-size: 13px;
        font-weight: 500;
        color: #303133;
      }
    }

    .log-target {
      margin-top: 2px;
      font-size: 12px;
      color: #606266;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .log-time {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-top: 4px;
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
