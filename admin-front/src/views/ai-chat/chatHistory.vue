<template>
  <!-- v-model 绑定的是 computed 而不是 props.modelValue：
       直接写 v-model="props.modelValue" 时，抽屉自己关闭（点遮罩、按 ESC）会往
       只读的 props 上赋值，父组件的 drawerFlag 一直停在 true，
       于是「历史会话」按钮再也打不开抽屉 -->
  <el-drawer v-model=" visible " direction="rtl" size="320px" :show-close=" false " :with-header=" false "
    class="chat-history-drawer">
    <div class="chat-history">
      <header class="history-header">
        <button class="icon-btn" title="返回" @click=" closeDrawer ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 class="history-title">历史会话</h2>
      </header>

      <div class="history-list" v-loading=" loading ">
        <div v-if=" !loading && allChat.length === 0 " class="history-empty">暂无历史会话</div>

        <div class="history-item" v-for=" ( item, index ) in allChat " :key=" item.convertId || index "
          :class=" { active: item.convertId === activeConvertId } " @click=" getItemChat( index )">
          <span class="item-name">{{ item.title || '新对话' }}</span>
        </div>
      </div>

      <footer class="history-footer">
        <button class="new-chat-btn" @click=" createNewChat ">新建会话</button>
      </footer>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
defineOptions( { name: "ChatHistory" } );
import { computed, ref } from "vue";
import { getAllChat, getSingleChat } from "@/API/ai-chat";
import { getAiChatUserId } from "@/utils/aiUserId";
import { classifyAiError, logAiError } from "@/utils/aiError";
import { ElMessage } from "element-plus";

const $emit = defineEmits( [ 'update:modelValue', "getItemConvert", "newChat" ] );

// 数据
// 接收父组件传递的modelValue
const props = defineProps( {
  modelValue: { type: Boolean, default: false },
  // 当前会话 ID：用于在列表里高亮正在查看的会话
  activeConvertId: { type: String, default: "" },
} );
// 当前登录用户 ID：取登录态里的用户 id（见 utils/aiUserId），父组件也可以覆盖
const userId = ref( getAiChatUserId() );
// 列表加载中
const loading = ref( false );

/**
 * 抽屉显隐。
 * 读取直接透传 props，写入走 emit：这样 el-drawer 内部关闭（遮罩点击、ESC）
 * 也能把状态同步回父组件，抽屉才可能被反复打开
 */
const visible = computed( {
  get: () => props.modelValue,
  set: ( value: boolean ) => $emit( "update:modelValue", value ),
} );

// 方法
// 关闭抽屉
const closeDrawer = () =>
{
  visible.value = false;
};

// 新建会话：由父组件负责清空对话区，这里只关闭抽屉
const createNewChat = () =>
{
  closeDrawer();
  $emit( "newChat" );
};

// 存储所有对话
const allChat = ref<{ title: string; convertId: string }[]>( [] );

// 获得所有历史对话
// 失败时降级为空列表并提示，避免未捕获的 Promise 异常冒到控制台
const getAllChatHistory = async ( id?: string ) =>
{
  if ( id ) userId.value = id;
  loading.value = true;
  try
  {
    const res = await getAllChat( userId.value );
    allChat.value = Array.isArray( res.data ) ? res.data : [];
  } catch ( err )
  {
    const info = classifyAiError( err, "获取历史会话" );
    logAiError( "获取历史会话", info, err );
    allChat.value = [];
    ElMessage( { type: "error", message: info.friendly, duration: 4000 } );
  } finally
  {
    loading.value = false;
  }
};

// 点击历史对话,获取对话详情
const getItemChat = async ( index: number ) =>
{
  const convertId = allChat.value[ index ]?.convertId;
  if ( !convertId ) return;

  try
  {
    const res = await getSingleChat( userId.value, convertId );
    if ( res.status === 200 && res.data?.data )
    {
      // 关闭抽屉
      closeDrawer();
      // convertId 必须随会话数据一起上抛：
      // 父组件若从消息对象的键名里推导会话 ID，会拿到 "list" 这种字段名
      $emit( "getItemConvert", { ...res.data.data, convertId } );
    }
  } catch ( err )
  {
    const info = classifyAiError( err, "获取会话详情" );
    logAiError( "获取会话详情", info, err );
    ElMessage( { type: "error", message: info.friendly, duration: 4000 } );
  }
};
// 给父组件暴露方法
defineExpose( { getAllChatHistory } );
</script>

<style scoped lang="scss">
/* 配色与 AI 问答页保持一致：浅底 + 细分割线 + 深靛蓝主色 */
$ink: #1f2937;
$muted: #9ca3af;
$line: #eceef2;
$accent: #26307a;
$accent-soft: rgba(38, 48, 122, 0.08);

.chat-history-drawer :deep(.el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.chat-history {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

/* 顶部：与问答页标题栏同款的分割线与内边距 */
.history-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px;
  border-bottom: 1px solid $line;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: $accent;
    background: $accent-soft;
  }

  svg {
    width: 17px;
    height: 17px;
  }
}

.history-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: $ink;
}

/* 列表：卡片式条目，hover 用主色描边，与问答页的 ghost-btn 呼应 */
.history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 16px 4px;
}

.history-empty {
  padding: 48px 0;
  text-align: center;
  font-size: 13px;
  color: $muted;
}

.history-item {
  padding: 11px 14px;
  margin-bottom: 10px;
  border: 1px solid $line;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: $accent;
    border-color: $accent;
    background: $accent-soft;
  }

  &.active {
    border-color: $accent;
    background: $accent-soft;
  }
}

.item-name {
  display: block;
  font-size: 13px;
  line-height: 1.6;
  color: $ink;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item:hover .item-name,
.history-item.active .item-name {
  color: $accent;
}

/* 底部：主色实心按钮，和问答页的「发送」按钮同一套视觉 */
.history-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid $line;
}

.new-chat-btn {
  width: 100%;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: $accent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.88;
  }
}
</style>
