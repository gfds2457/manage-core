<template>
  <div class="ai-qa">
    <!-- 中间对话列 -->
    <section class="qa-main">
      <!-- 页面标题栏 -->
      <header class="qa-header">
        <div class="qa-heading">
          <h2 class="qa-title">AI 问答</h2>
          <!-- 会话标题：第一轮问答结束后由后端生成，生成前/失败时固定为「新对话」 -->
          <span v-if=" showDialog " class="qa-conv-title">{{ chatTitle }}</span>
        </div>
        <div class="qa-header-actions">
          <button class="ghost-btn" @click=" addChat ">新建会话</button>
          <button class="ghost-btn" @click=" openHistory ">历史会话</button>
        </div>
      </header>

      <!-- 后端状态提示：页面加载时预检测，提前告知用户后端是否可用 -->
      <div v-if=" backendStatus === 'offline' || backendStatus === 'degraded' " class="backend-alert"
        :class=" backendStatus ">
        <el-icon class="backend-alert-icon">
          <WarningFilled />
        </el-icon>
        <div class="backend-alert-body">
          <div class="backend-alert-title">
            {{ backendStatus === 'offline' ? 'AI 后端未连接' : 'AI 后端部分能力降级' }}
          </div>
          <div class="backend-alert-desc">{{ backendNotice }}</div>
        </div>
        <el-button size="small" :loading=" healthChecking " @click=" checkBackend( true )">重新检测</el-button>
      </div>

      <!-- 空态：尚未开始对话 -->
      <div v-if=" !showDialog " class="qa-empty">
        <div class="greeting">
          <h1 class="hello">Hello Marcus</h1>
          <p class="subtitle">基于知识库的数据问答，问点什么？</p>
        </div>
        <div class="feature-cards">
          <div class="card" v-for=" card in featureCards " :key=" card.title " @click=" askExample( card.prompt )">
            <div class="card-icon">
              <el-icon>
                <component :is=" card.icon " />
              </el-icon>
            </div>
            <h3 class="card-title">{{ card.title }}</h3>
            <p class="card-desc">{{ card.desc }}</p>
          </div>
        </div>
      </div>

      <!-- 对话区 -->
      <div v-else class="qa-stream" ref="dialogSectionRef">
        <template v-for=" ( item, index ) in messageList " :key=" index ">
          <!-- 用户提问：左侧竖线标记，不做气泡，和设计稿保持一致 -->
          <div v-if=" item.role === 'user' " class="turn turn-user">
            <div class="user-accent"></div>
            <div class="user-question">
              <template v-if=" Array.isArray( item.content ) ">
                <template v-for=" ( contentItem, contentIndex ) in item.content " :key=" contentIndex ">
                  <img v-if=" contentItem.type === 'image_url' " :src=" contentItem.image_url?.url "
                    class="user-image" />
                  <span v-else-if=" contentItem.type === 'text' " class="user-text">{{ contentItem.text }}</span>
                </template>
              </template>
              <template v-else>{{ item.content }}</template>
            </div>
          </div>

          <!-- 工具卡片：把后端推来的卡片名与模型参数透传给卡片组件，
               选择动作只把后续问题填进输入框，不替用户直接发起模型调用 -->
          <div v-else-if=" item.role === 'tool' && item.cardName " class="turn turn-ai">
            <BrandCard :card-name=" item.cardName " :card-args=" item.arguments " @select=" askExample " />
          </div>

          <!-- AI 回答 -->
          <div v-else-if=" item.role === 'assistant' " class="turn turn-ai">
            <div class="ai-answer" :class=" { 'ai-answer-error': item.isError } ">
              <VueMarkdown :markdown=" formatAnswer( item.content || '' ) " :remark-plugins=" [ remarkGfm ] "
                :rehype-plugins=" [ highlightPlugin ] " :custom-attrs=" mdCustomAttrs " />
              <!-- 生成图片：正文里以 markdown 图片语法回填，这里单独渲染以保证尺寸受控 -->
              <img v-if=" pickInlineImage( item.content ) " :src=" pickInlineImage( item.content ) " alt="生成的图片"
                class="answer-image" />
              <!-- 检索降级提示：检索为空或向量服务不可用时给出友好说明，不影响正常回答 -->
              <div v-if=" !item.isError && item.ragNotice " class="rag-notice">{{ item.ragNotice }}</div>
            </div>

            <!-- 回答元信息：数据来源、更新时间与复制/重新生成操作 -->
            <div v-if=" !item.isError " class="answer-meta">
              <span class="answer-meta-text">
                数据来源 {{ datasourceLabel }} · 更新时间 {{ formatTime( item.time ) }}
              </span>
              <div class="answer-meta-actions">
                <button class="meta-btn" @click=" copyAnswer( item )">复制</button>
                <button class="meta-btn" :disabled=" sending " @click=" regenerate( index )">重新生成</button>
              </div>
            </div>
          </div>
        </template>

        <!-- 思考中提示 -->
        <div v-if=" thinkDialog " class="turn turn-ai">
          <div class="ai-answer thinking">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-text">{{ thinkingText }}</span>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <footer class="qa-composer">
        <div class="composer-box" :class=" { 'is-busy': sending } ">
          <!-- 已选文件预览 -->
          <div v-if=" selectedFiles.length > 0 " class="file-preview-list">
            <div v-for=" ( item, index ) in selectedFiles " :key=" index " class="file-preview-item">
              <img v-if=" item.type === 'image' " :src=" item.preview " :alt=" item.name " class="preview-image" />
              <div v-else class="preview-icon">
                <el-icon>
                  <Files />
                </el-icon>
              </div>
              <div class="file-info">
                <span class="file-name">{{ item.name }}</span>
                <span class="file-size">{{ item.size }}</span>
              </div>
              <button class="remove-file-btn" @click=" removeSelectedFile( index )">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 回车直接发送。必须写成 sendChat() 而不是 sendChat：
               Vue 会把内联语句里的函数引用当作事件处理器调用并传入原生事件对象，
               该事件对象随后被当成「待发送文本」走进了 .trim()，直接抛
               TypeError: (overrideText ?? inputText.value).trim is not a function，
               表现就是按回车完全发不出消息 -->
          <textarea v-model=" inputText " class="composer-input" rows="1" placeholder="输入你的问题，例如：上个月退款率最高的三个类目是哪些？"
            @keydown.enter.exact.prevent=" sendChat()"></textarea>

          <div class="composer-bar">
            <label class="upload-btn" title="上传图片">
              <input type="file" class="file-input" @change=" handleFileSelect " name="file" />
              <el-icon>
                <Folder />
              </el-icon>
            </label>

            <div class="composer-controls">
              <!-- 数据源：当前后端固定为配置的 MySQL 库，选项由接口层统一下发 -->
              <label class="picker">
                <select v-model=" currentDatasource " class="picker-select">
                  <option v-for=" item in datasourceList " :key=" item.value " :value=" item.value ">
                    {{ item.label }}
                  </option>
                </select>
              </label>
              <!-- 模型 -->
              <label class="picker">
                <select v-model=" currentModel " class="picker-select">
                  <option v-for=" item in modelList " :key=" item.value " :value=" item.value ">
                    {{ item.label }}
                  </option>
                </select>
              </label>

              <button class="send-btn" :class=" { 'stop-btn': sending } "
                @click=" sending ? stopGenerate() : sendChat()">
                {{ sending ? '停止' : '发送' }}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </section>

    <!-- 右侧引用来源面板 -->
    <SourcePanel :sources=" activeSources " :vector-count=" vectorCount " />

    <!-- 历史会话抽屉 -->
    <!-- ref 值两侧不能带空格：静态 ref 名是按字面字符串匹配的，
         " chatHistoryRef " 匹配不到 setup 里的同名变量，loadChatHistory 会静默失效 -->
    <chatHistory v-model=" drawerFlag " ref="chatHistoryRef" :active-convert-id=" currentChatId "
      @getItemConvert=" getItemConvert " @new-chat=" addChat " />
  </div>
</template>

<script setup lang="ts">
defineOptions( {
  name: "AiChat",
} );
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import
{
  createChat, getTitle, fetchChatStream, getUserFeature, uploadImg,
  checkAiHealth, cancelChatStream, isChatStreaming, AI_API_BASE_URL,
  AI_DATASOURCE, AI_MODEL_OPTIONS, isImageModel,
} from "@/API/ai-chat";
import { getAiChatUserId } from "@/utils/aiUserId";
import { getKbStats } from "@/API/knowledge";
import { AiBusinessError, classifyAiError, logAiError } from "@/utils/aiError";
import type { AiErrorInfo } from "@/utils/aiError";
import { getEnvReport } from "@/utils/aiEnv";
import ChatHistory from "./chatHistory.vue";
import SourcePanel from "./sourcePanel.vue";
import type { ItemChatInterface, RagSourceInterface } from "./type";
import { VueMarkdown } from '@crazydos/vue-markdown'
import remarkGfm from 'remark-gfm'
import highlightPlugin from 'rehype-highlight'
import BrandCard from "./brandCard.vue";
import { Files, Folder, Timer, TrendCharts, Notebook } from '@element-plus/icons-vue'

// 当前登录用户 ID：取自登录态（见 utils/aiUserId），不再所有账号共用 "001"
const USER_ID = getAiChatUserId();

/** 会话标题默认值：第一轮问答结束前、以及请求异常/中断时都用它兜底 */
const DEFAULT_TITLE = "新对话";

/** 带圈序号，回答正文中的引用标记与右侧来源面板的序号一一对应 */
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

// 数据
// 卡片是否显示（false 表示空态，true 表示已进入对话）
const showDialog = ref( false );
// 输入框文本
const inputText = ref( "" );
// 对话列表
const messageList = ref<any[]>( [] );
// 思考中提示
const thinkDialog = ref( false );
// 对话区域引用 （用于滚动到底部）
const dialogSectionRef = ref<HTMLElement | null>( null );
// 对话历史抽屉是否显示
const drawerFlag = ref( false );
// 当前对话id
const currentChatId = ref( "" );
// 当前对话标题：默认「新对话」，仅在成功拿到后端标题后才替换
const chatTitle = ref( DEFAULT_TITLE );
// 对话历史抽屉实例
const chatHistoryRef = ref();
// 用户特点
const userFeature = ref( "" );
// 数据源选项与当前选中值
const datasourceList = ref( [ AI_DATASOURCE ] );
const currentDatasource = ref( AI_DATASOURCE.value );
// 模型列表
const modelList = ref( AI_MODEL_OPTIONS.map( item => ( { ...item } ) ) );
// 当前模型
const currentModel = ref( AI_MODEL_OPTIONS[ 0 ].value );
// 思考中提示文案：切换模型后立刻跟着变。
// 图片模型走的是图片生成链路，不再检索知识库，沿用问答文案会误导用户
const thinkingText = computed( () =>
  isImageModel( currentModel.value ) ? "图片生成中…" : "正在检索知识库并生成回答…"
);
// 向量库条数：后端未返回时为 null，面板按「--」展示
const vectorCount = ref<number | null>( null );
// 已选择文件列表（base64 在选择时就上传好并缓存，发送时直接复用，避免重复上传）
const selectedFiles = ref<{
  file: File; name: string; size: string; type: string; preview: string; base64: string;
}[]>( [] )
// 是否正在接收 AI 回复：既控制发送/停止按钮，也用于拦截重复发送
const sending = ref( false );
// 后端健康状态
const backendStatus = ref<"unknown" | "online" | "degraded" | "offline">( "unknown" );
// 后端状态提示文案
const backendNotice = ref( "" );
// 健康检测是否进行中
const healthChecking = ref( false );

// 空态引导卡片：点击即把示例问题填进输入框，降低首次使用成本
const featureCards = [
  { title: "近 30 天经营概况", desc: "订单、退款、转化率的环比变化", icon: TrendCharts, prompt: "近 30 天的订单量和退款率分别是多少？" },
  { title: "退款原因分析", desc: "定位退款率最高的类目与商品", icon: Notebook, prompt: "上个月退款率最高的三个类目是哪些？" },
  { title: "商品数据速查", desc: "按类目、价格区间查询商品明细", icon: Timer, prompt: "当前在售商品一共有多少个？" },
];

// 会话代次：每次发起新请求 / 切换会话 / 新建对话都会自增。
// 旧的流式回调发现代次不匹配就直接丢弃，避免过期回答写进新界面
let streamToken = 0;
// 本次会话是否已经请求过生成标题。
// 标题只在第一条消息成功送达后请求一次：重复请求既多花一次大模型调用，
// 两次返回的标题还会互相覆盖
let titleRequested = false;
// 错误弹窗互斥锁：一次操作可能触发多处失败，避免弹窗堆叠
let errorDialogShowing = false;

// 计算属性
/** 当前展示的引用来源：取最近一条带来源的 AI 回答，与右侧面板一一对应 */
const activeSources = computed<RagSourceInterface[]>( () =>
{
  for ( let i = messageList.value.length - 1; i >= 0; i-- )
  {
    const item = messageList.value[ i ];
    if ( item.role === "assistant" && Array.isArray( item.sources ) && item.sources.length > 0 )
    {
      return item.sources;
    }
  }
  return [];
} );

/** 数据源展示名，用于回答下方的「数据来源」标注 */
const datasourceLabel = computed( () =>
{
  const hit = datasourceList.value.find( item => item.value === currentDatasource.value );
  return hit?.label || AI_DATASOURCE.label;
} );

/** Markdown 渲染类名映射，保持与全局 md.scss 一致的排版 */
const mdCustomAttrs = {
  p: { class: 'md_p' }, h1: { class: 'md_h1' }, h2: { class: 'md_h2' }, h3: { class: 'md_h3' },
  h4: { class: 'md_h4' }, h5: { class: 'md_h5' }, h6: { class: 'md_h6' }, div: { class: 'md_div' }, ul: { class: 'md_ul' },
  ol: { class: 'md_ol' }, li: { class: 'md_li' }, blockquote: { class: 'md_blockquote' }, a: { class: 'md_a' },
  pre: { class: 'md_pre' }, code: { class: 'md_code' }, table: { class: 'md_table' }, th: { class: 'md_th' }, td: { class: 'md_td' },
  tr: { class: 'md_tr' }, hr: { class: 'md_hr' }, strong: { class: 'md_strong' }, em: { class: 'md_em' }, img: { class: 'md_img' }
};

// 方法
/** 取带圈序号，超出 20 时退回 (n) 形式 */
const circled = ( num: number ): string => CIRCLED[ num - 1 ] || `(${ num })`;

/**
 * 把回答正文里的引用标记转成设计稿中的带圈序号。
 * 后端检索上下文以【片段N】标注每个片段，模型回答时常原样带出；
 * 只处理这一种标记，不做 [N] 之类的宽泛匹配，避免误伤正常的 markdown 链接语法。
 * @param text 模型返回的原始 markdown
 * @returns 引用标记已替换为带圈序号的 markdown
 */
const formatAnswer = ( text: string ): string =>
  String( text || "" ).replace( /【\s*(?:片段)?\s*(\d+)\s*】/g, ( _, num: string ) => circled( Number( num ) ) );

/**
 * 取出正文中的生成图片地址。
 * 流式接口以 `![生成的图片](url)` 的形式回填图片，markdown 渲染出的尺寸不可控，
 * 这里单独取 URL 交给 img 标签渲染。
 * @param content 回答正文
 * @returns 图片地址，没有则返回空字符串
 */
const pickInlineImage = ( content: unknown ): string =>
{
  if ( typeof content !== "string" ) return "";
  const matched = content.match( /!\[.*?\]\((.*?)\)/ );
  return matched ? matched[ 1 ] : "";
};

/**
 * 时间戳格式化为 YYYY-MM-DD HH:mm。
 * @param time 毫秒时间戳；缺失时返回占位符
 */
const formatTime = ( time?: number ): string =>
{
  if ( !time ) return "--";
  const date = new Date( time );
  const pad = ( num: number ) => String( num ).padStart( 2, "0" );
  return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad( date.getDate() ) } ${ pad( date.getHours() ) }:${ pad( date.getMinutes() ) }`;
};

/** 点击空态卡片：把示例问题填进输入框 */
const askExample = ( prompt: string ) =>
{
  inputText.value = prompt;
};

/** 打开历史会话抽屉，并拉取最新列表 */
const openHistory = () =>
{
  drawerFlag.value = true;
  void loadChatHistory();
};

/** 复制一条回答的正文（图片类回答只复制文字部分） */
const copyAnswer = async ( item: any ) =>
{
  const text = typeof item.content === "string" ? item.content : "";
  if ( !text )
  {
    ElMessage( { type: "warning", message: "这条回答没有可复制的文本", duration: 2000 } );
    return;
  }
  try
  {
    await navigator.clipboard.writeText( text );
    ElMessage( { type: "success", message: "已复制到剪贴板", duration: 1500 } );
  } catch ( err )
  {
    // 非 https 或用户拒绝授权时剪贴板不可用，降级为提示，不影响其它功能
    const info = classifyAiError( err, "复制回答" );
    logAiError( "复制回答", info, err );
    ElMessage( { type: "error", message: "当前环境不支持自动复制，请手动选择文本", duration: 3000 } );
  }
};

/**
 * 重新生成：把该回答之前的用户提问原样重发一次。
 * 只重发问题本身，不重复写入用户消息，避免对话区出现两条一样的提问。
 * @param index 该条回答在消息列表中的下标
 */
const regenerate = ( index: number ) =>
{
  if ( sending.value || isChatStreaming() )
  {
    ElMessage( { type: "warning", message: "AI 正在回复中，请先停止当前生成", duration: 2000 } );
    return;
  }

  // 回溯找到这条回答对应的用户提问
  let question = "";
  for ( let i = index - 1; i >= 0; i-- )
  {
    const item = messageList.value[ i ];
    if ( item.role === "user" )
    {
      question = typeof item.content === "string"
        ? item.content
        : ( item.content || [] ).filter( ( c: any ) => c.type === "text" ).map( ( c: any ) => c.text ).join( " " );
      break;
    }
  }

  if ( !question.trim() )
  {
    ElMessage( { type: "warning", message: "找不到对应的提问，无法重新生成", duration: 2000 } );
    return;
  }

  // 移除这条回答及其后的全部消息，让新一轮结果顶替旧结果
  messageList.value.splice( index );
  void sendChat( question, { skipUserEcho: true } );
};

/**
 * 页面加载时预检测 AI 后端是否在线。
 * 把「服务没起来」提前告诉用户，避免用户输完问题才收到连接失败。
 * @param manual 是否由用户手动触发的重新检测（手动触发时才弹提示）
 */
const checkBackend = async ( manual = false ) =>
{
  if ( healthChecking.value ) return;
  healthChecking.value = true;
  try
  {
    const result = await checkAiHealth();
    backendStatus.value = result.online
      ? ( result.status === "degraded" ? "degraded" : "online" )
      : "offline";
    backendNotice.value = backendStatus.value === "online" ? "" : result.message;

    if ( backendStatus.value === "online" )
    {
      // 排障用日志，只在开发环境输出，生产环境不往用户控制台写这些细节
      if ( import.meta.env.DEV )
      {
        console.log( `[AI 对话] 后端健康检测通过（${ result.latencyMs }ms）：${ result.detail }` );
      }
    } else
    {
      console.error( `[AI 对话] 后端健康检测异常：${ result.detail }` );
      if ( manual )
      {
        ElMessage( {
          type: result.online ? "warning" : "error",
          message: result.message,
          duration: 5000,
        } );
      }
    }
  } finally
  {
    healthChecking.value = false;
  }
};

/**
 * 弹出错误提示。
 * 网络故障与业务报错给不同的标题，让用户一眼判断该找谁解决：
 * 前者是自己没启后端，后者要找后端同学。
 * @param info 归一化后的错误信息
 */
const showErrorDialog = async ( info: AiErrorInfo ) =>
{
  if ( info.type === "canceled" || errorDialogShowing ) return;

  const titleMap: Record<string, string> = {
    network: "无法连接 AI 后端",
    timeout: "AI 响应超时",
    business: "AI 服务返回异常",
    unknown: "AI 对话请求失败",
  };

  errorDialogShowing = true;
  try
  {
    await ElMessageBox.alert( info.friendly, titleMap[ info.type ] || "AI 对话请求失败", {
      confirmButtonText: "我知道了",
      type: "error",
    } );
  } catch
  {
    // 用户直接关闭弹窗时 Promise 会 reject，属正常交互，无需处理
  } finally
  {
    errorDialogShowing = false;
  }
};

/**
 * 追加一条 AI 兜底回复。
 * 请求失败时若只保留用户消息，界面会出现「问了没人答」的空档，
 * 用户无法判断是还在思考还是已经失败，因此必须补一条明确的兜底消息。
 * @param content 兜底文案
 * @param isError 是否按异常样式展示
 */
const appendAssistantFallback = ( content: string, isError = true ) =>
{
  messageList.value.push( {
    role: "assistant",
    content,
    id: `fallback-${ Date.now() }`,
    time: Date.now(),
    isError,
  } );
  thinkDialog.value = false;
  scrollToBottom();
};

/** 按错误类型生成兜底文案 */
const buildFallbackText = ( info: AiErrorInfo ): string =>
{
  switch ( info.type )
  {
    case "network":
      return `AI走神中... 无法连接 AI 后端服务（${ AI_API_BASE_URL }），请确认 admin-ai-backend 已启动后重试。`;
    case "timeout":
      return "AI走神中... 等待响应超时，请稍后重试。";
    case "business":
      return `AI走神中... 服务返回异常：${ info.friendly }`;
    default:
      return "AI走神中... 本次请求没有正常完成，请稍后重试。";
  }
};

/**
 * 统一的失败收尾。
 * 四件事：结束加载态、保留用户消息、补一条 AI 兜底回复并弹提示，
 * 以及在尚未生成标题时把会话标题固定回「新对话」。
 * @param token 本次请求的会话代次，代次已过期说明用户已经切走，直接丢弃
 * @param info 归一化后的错误信息
 * @param rawError 原始异常，用于输出技术日志
 */
const handleChatFailure = ( token: number, info: AiErrorInfo, rawError?: unknown ) =>
{
  if ( token !== streamToken ) return;

  thinkDialog.value = false;
  sending.value = false;

  // 主动取消不是故障：不弹错误弹窗，也不打错误日志。
  // 中断属于「没有正常完成第一轮」，标题保持默认值
  if ( info.type === "canceled" )
  {
    appendAssistantFallback( "已停止生成。", false );
    return;
  }

  logAiError( "发送消息", info, rawError );
  appendAssistantFallback( buildFallbackText( info ) );
  void showErrorDialog( info );

  // 网络故障顺手刷新后端状态，把顶部横幅点亮，
  // 用户不用刷新页面就能看到「后端挂了」的提示
  if ( info.type === "network" )
  {
    void checkBackend();
  }
};

/**
 * 停止生成。
 * 有活跃长连接时交给取消回调统一收尾；没有活跃连接（例如卡在建会话阶段）
 * 则本地直接收尾，保证按钮状态立刻恢复，不出现一直转圈的情况。
 */
const stopGenerate = () =>
{
  if ( !sending.value ) return;
  const canceled = cancelChatStream( "用户点击停止生成" );
  if ( canceled ) return;

  // 没有活跃长连接，说明请求还卡在建会话阶段。
  // 这里必须先让这次 sendChat 作废，否则它稍后拿到会话 ID 仍会继续发起流式请求，
  // 回答会紧跟在「已停止生成」后面冒出来，用户点了停止却停不下来
  streamToken++;
  sending.value = false;
  thinkDialog.value = false;
  appendAssistantFallback( "已停止生成。", false );
};

// 滚动到底部
const scrollToBottom = () =>
{
  nextTick( () =>
  {
    if ( dialogSectionRef.value )
    {
      dialogSectionRef.value.scrollTop = dialogSectionRef.value.scrollHeight;
    }
  } );
};

// 文件选择处理
const handleFileSelect = async ( event: Event ) =>
{
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if ( !files || files.length === 0 ) return

  const fileList = Array.from( files );
  // 并行上传：各文件之间互不依赖，串行 await 会让 N 个文件退化成 N 次往返，
  // 明显拖慢「选择文件」的响应。allSettled 保证单个失败不影响其余文件
  const results = await Promise.allSettled( fileList.map( file => uploadImg( file ) ) );

  results.forEach( ( result, index ) =>
  {
    const file = fileList[ index ];

    /** 单个文件失败的统一提示与日志，避免把异常抛到事件回调外（会变成未捕获异常） */
    const reportFailure = ( err: unknown ) =>
    {
      const info = classifyAiError( err, `上传图片 ${ file.name }` );
      logAiError( "上传图片", info, err );
      ElMessage( { type: "error", message: info.friendly, duration: 4000 } );
    };

    if ( result.status === "rejected" )
    {
      reportFailure( result.reason );
      return;
    }

    const base64 = result.value.data?.data;
    if ( !base64 )
    {
      reportFailure( new AiBusinessError( "上传图片失败：接口未返回图片数据" ) );
      return;
    }

    selectedFiles.value.push( {
      file,
      name: file.name,
      size: formatFileSize( file.size ),
      type: file.type.split( "/" )[ 0 ],
      preview: base64,
      // 选择时就缓存好 base64，发送时直接复用，省掉一次重复上传
      base64,
    } );
  } );

  target.value = '';
};

// #region 格式化文件大小
const formatFileSize = ( bytes: number ): string =>
{
  if ( bytes < 1024 ) return bytes + ' B';
  if ( bytes < 1024 * 1024 ) return ( bytes / 1024 ).toFixed( 1 ) + ' KB';
  return ( bytes / ( 1024 * 1024 ) ).toFixed( 1 ) + ' MB';
};

// 移除已选择的文件
const removeSelectedFile = ( index: number ) =>
{
  const file = selectedFiles.value[ index ];
  if ( file.preview )
  {
    URL.revokeObjectURL( file.preview );
  }
  selectedFiles.value.splice( index, 1 );
};

/**
 * 发送消息
 * @param overrideText 指定要发送的问题（重新生成时复用原问题，不走输入框）。
 *        类型放宽为 unknown：它可能被模板以事件对象的形式传进来，
 *        这里统一按「非字符串即视为未指定」处理，保证 .trim() 不会作用在事件对象上
 * @param options.skipUserEcho 是否跳过「把用户消息推入列表」这一步，
 *        重新生成时消息列表已经清理过，重复推送会出现两条相同的提问
 */
const sendChat = async ( overrideText?: unknown, options: { skipUserEcho?: boolean } = {} ) =>
{
  // 防重复提交：生成中不再响应新的发送。
  // 否则两条长连接的回调会同时往 messageList 里写，回答内容互相穿插。
  // 同时看接口层的连接状态：本地 sending 标志万一与真实连接失同步，
  // isChatStreaming 仍是权威判据
  if ( sending.value || isChatStreaming() )
  {
    ElMessage( { type: "warning", message: "AI 正在回复中，可点击停止按钮中断后再发送", duration: 2000 } );
    return;
  }

  // 只有字符串才算「指定了问题」；事件对象等其它入参一律回落到输入框内容。
  // 直接对入参调 .trim() 会在按回车发送时抛 TypeError，消息发不出去
  const hasOverride = typeof overrideText === "string";
  const keyword = ( hasOverride ? overrideText : inputText.value ).trim();

  // 检查输入是否为空
  if ( keyword === "" && ( !selectedFiles.value || selectedFiles.value.length === 0 ) )
  {
    return;
  }

  // 1.页面展示处理
  showDialog.value = true;
  if ( !hasOverride )
  {
    inputText.value = "";
  }
  thinkDialog.value = true;
  sending.value = true;
  // 领取本次请求的代次，后续所有异步回调都靠它判断自己是否已经过期
  const token = ++streamToken;

  const files = selectedFiles.value || [];
  // 图片 base64 在选择文件时已经上传好，这里直接复用，不再重复请求后端
  const imageBase64List: string[] = files.map( item => item.base64 ).filter( Boolean );

  // 用户消息先落到界面：不管后面请求成功还是失败都保留这条消息，
  // 之前失败时会 pop 掉，导致用户以为自己的问题根本没发出去
  if ( !options.skipUserEcho )
  {
    if ( files.length > 0 )
    {
      const contentItems: any[] = [];
      files.forEach( item =>
      {
        if ( item.base64 )
        {
          contentItems.push( { type: "image_url", image_url: { url: item.base64 } } );
        }
      } );
      if ( keyword )
      {
        contentItems.push( { type: "text", text: keyword } );
      }
      messageList.value.push( { role: "user", content: contentItems, time: Date.now() } );
    } else
    {
      messageList.value.push( { role: "user", content: keyword, time: Date.now() } );
    }
  }

  // 清理已选择的文件预览
  selectedFiles.value.forEach( file =>
  {
    if ( file.preview )
    {
      URL.revokeObjectURL( file.preview );
    }
  } );
  selectedFiles.value = [];

  scrollToBottom();

  // 2.创建对话
  if ( !currentChatId.value )
  {
    try
    {
      const res = await createChat( USER_ID );
      if ( res.status === 200 && res.data.data )
      {
        currentChatId.value = res.data.data;
        // 新会话从「新对话」起步，消息成功送达后（见 onOpen）再换成后端生成的标题，
        // 生成失败或超时则一直保持这个兜底标题
        chatTitle.value = DEFAULT_TITLE;
      }
      else
      {
        throw new AiBusinessError( "创建会话失败：接口未返回会话 ID" );
      }
    } catch ( err )
    {
      handleChatFailure( token, classifyAiError( err, "创建会话" ), err );
      return;
    }
    // 建会话是异步的，期间用户可能点了停止、切了会话或新建了对话。
    // 代次对不上就直接退出，避免「已经停止」之后又把回答流进来
    if ( token !== streamToken ) return;
  }

  // 用来区分AI的单条回复信息
  let assistantMsgId = "";
  // 本次回复是否产出了任何可展示内容。
  // 不能只看 assistantMsgId：工具卡片与生成图片这两条分支不写 assistantMsgId，
  // 用它会把这些正常回复误判成「没有收到有效回复」
  let hasContent = false;
  // 本次问答命中的知识库来源
  // 后端在调用大模型之前就会推送来源，此时助手消息还未创建，故先暂存
  let pendingRagSources: RagSourceInterface[] = [];
  // 知识库降级提示（检索为空 / 向量服务不可用等）
  let pendingRagNotice = "";
  // 流中途由后端推送的业务错误（后端把异常以 { error } 写进 SSE 里）
  let streamBusinessError = "";

  // 3.发送消息，并且流式获取聊天记录
  fetchChatStream( {
    keyword,
    userId: USER_ID,
    convertId: currentChatId.value,
    userFeature: userFeature.value,
    model: currentModel.value,
    datasource: currentDatasource.value,
    files: imageBase64List,
    // 消息成功送达后端（收到响应头）就立刻生成标题，不必等整段回答生成完毕。
    // 后端在写响应头之前已把这条用户消息落库，标题可以只依据提问本身生成
    onOpen: () =>
    {
      if ( token !== streamToken ) return;
      void refreshChatTitle( token, keyword );
    },
    onMessage: ( data ) =>
    {
      // 用户已经切走 / 换会话 / 取消，本次回调直接作废
      if ( token !== streamToken ) return;
      if ( data.done ) return;
      // 3.0后端在流中抛错：属于业务报错，先记下来，
      // 等长连接关闭后统一收尾，避免这里与 onclose 重复处理
      if ( data.error )
      {
        streamBusinessError = String( data.error );
        return;
      }
      // 3.1知识库检索来源：挂到回答上，同时供右侧引用面板展示
      if ( data.type === "rag_sources" )
      {
        pendingRagSources = Array.isArray( data.sources ) ? data.sources : [];
        pendingRagNotice = data.notice || "";
        return;
      }
      // 3.2判断传来信息是否为前端卡片
      if ( data.role === "tool" && data.cardName )
      {
        messageList.value.push( {
          role: "tool",
          content: data.content || "",
          cardName: data.cardName,
          arguments: data.arguments,
          id: data.id
        } );
        hasContent = true;
        thinkDialog.value = false;
        scrollToBottom();
        return;
      }
      // 3.3判断传来信息是否为img
      if ( data.imageUrl )
      {
        messageList.value.push( {
          role: "assistant",
          content: `![生成的图片](${ data.imageUrl })`,
          time: Date.now(),
          sources: pendingRagSources,
          ragNotice: pendingRagNotice,
        } );
        hasContent = true;
        thinkDialog.value = false;
        scrollToBottom();
        return;
      }
      // 3.4判断传来消息是否为空
      if ( !data.choices?.[ 0 ]?.delta ) return;
      const content = data.choices[ 0 ].delta.content || "";
      if ( content === "" ) return;
      // 3.5剩下的信息为文字信息
      // 3.5.1第一次收到流式文字消息,创建一个空的消息对象
      if ( !assistantMsgId )
      {
        assistantMsgId = data.id || "";
        hasContent = true;
        messageList.value.push( {
          role: "assistant",
          content: "",
          id: assistantMsgId,
          time: Date.now(),
          // 把暂存的知识库来源挂到这条回答上，便于溯源查看
          sources: pendingRagSources,
          ragNotice: pendingRagNotice
        } );
        thinkDialog.value = false;
      }
      const index = messageList.value.findIndex( item => item.id === assistantMsgId );
      if ( index !== -1 )
      {
        //3.5.2往这条空消息里面响应式更新数据
        messageList.value[ index ].content += content;
        scrollToBottom();
      }
    },
    // 长连接关闭后触发
    onComplete: () =>
    {
      if ( token !== streamToken ) return;
      sending.value = false;
      thinkDialog.value = false;
      scrollToBottom();

      // 流中途收到业务错误：按业务报错统一收尾
      if ( streamBusinessError )
      {
        handleChatFailure( token, {
          type: "business",
          friendly: `AI 服务处理失败：${ streamBusinessError }`,
          detail: `SSE 流中返回 error 字段：${ streamBusinessError }`,
        } );
        return;
      }

      // 整条流正常结束但一条内容都没收到：补兜底提示，
      // 否则界面上只有用户提问、没有任何回应，看起来像卡住了
      if ( !hasContent )
      {
        appendAssistantFallback( "AI走神中... 本次没有收到有效回复，请重试。" );
      }
      // 标题已在 onOpen（消息成功送达）时请求过，这里不再重复触发：
      // 每次问答都调一次大模型总结纯属浪费，且两次返回的标题会互相覆盖
    },
    // 请求失败：交给统一收尾处理
    onError: ( info, rawError ) =>
    {
      handleChatFailure( token, info, rawError );
    },
  } );
};

/**
 * 生成会话标题。
 * 在第一条消息成功送达后端时调用（见 fetchChatStream 的 onOpen）：
 * 此时后端已把提问落库，标题可以立刻基于这条提问生成，不必等回答写完。
 * 后续轮次沿用已有标题，不会重复请求大模型。
 * 标题只是锦上添花，失败只打日志不弹提示，标题保持默认的「新对话」兜底。
 * @param token 会话代次，已过期则不再回写标题
 * @param question 本轮提问，仅用于日志
 */
const refreshChatTitle = async ( token: number, question: string ) =>
{
  // 已有正式标题说明不是第一轮，直接跳过
  if ( chatTitle.value && chatTitle.value !== DEFAULT_TITLE ) return;
  // 本次会话已经请求过，不重复触发
  if ( titleRequested ) return;

  // 判断本轮是不是第一轮：消息列表里只有一条用户提问
  const userTurns = messageList.value.filter( item => item.role === "user" );
  if ( userTurns.length !== 1 )
  {
    return;
  }

  const currentConvertId = currentChatId.value;
  if ( !currentConvertId ) return;

  // 先占位再发请求：请求进行中若又有回调进来，不会重复触发
  titleRequested = true;

  try
  {
    const titleRes = await getTitle( USER_ID, currentConvertId );
    if ( token !== streamToken ) return;
    if ( titleRes.status !== 200 || !Array.isArray( titleRes.data ) ) return;

    const chatInfo = titleRes.data.find(
      ( item: { convertId: string } ) => item.convertId === currentConvertId
    );
    const title = chatInfo?.title;
    // 后端在会话没有有效消息时会返回「空对话」，它对用户没有意义，保持默认标题
    if ( title && title !== "空对话" )
    {
      chatTitle.value = title;
    }
    if ( import.meta.env.DEV )
    {
      console.log( `[AI 对话] 会话标题：${ chatTitle.value }（提问：${ question }）` );
    }
  } catch ( err )
  {
    const info = classifyAiError( err, "获取会话标题" );
    logAiError( "获取会话标题", info, err );
  }
};

/** 获得一个用户的单条对话（从历史抽屉点进来） */
const getItemConvert = ( data: ItemChatInterface ) =>
{
  // 切换会话：进行中的回答已不属于当前界面，递增代次让它作废，
  // 否则旧回答会继续追加到新会话的消息列表里
  streamToken++;
  if ( sending.value )
  {
    cancelChatStream( "切换历史会话，终止进行中的回复" );
  }
  sending.value = false;
  thinkDialog.value = false;

  showDialog.value = true;
  messageList.value = data.list || [];
  // convertId 由 chatHistory 一并带出：历史会话的后续提问必须落回原会话，
  // 之前从 data 的键名里推导会导致 convertId 变成 "list"
  currentChatId.value = data.convertId || "";
  chatTitle.value = data.title || DEFAULT_TITLE;
  // 换了一个会话，标题的请求状态要跟着重置，否则新会话永远拿不到标题
  titleRequested = false;
  scrollToBottom();
};

/** 新建会话：清空当前对话，回到空态 */
const addChat = async () =>
{
  chatTitle.value = DEFAULT_TITLE;
  inputText.value = "";
  // 新会话要重新具备「第一条消息成功后生成标题」的资格
  titleRequested = false;

  // 新建对话意味着旧会话的回复已经没有归属，先作废并断掉长连接，
  // 否则旧回答会持续写进新会话的界面
  streamToken++;
  if ( sending.value )
  {
    cancelChatStream( "新建对话，终止进行中的回复" );
  }
  sending.value = false;
  thinkDialog.value = false;

  if ( messageList.value.length === 0 )
  {
    showDialog.value = false;
    currentChatId.value = "";
    return;
  }
  messageList.value = [];
  // 会话 ID 置空：下一次发送会重新建会话，避免新问题落进旧会话
  currentChatId.value = "";
  // 回到空态，让用户看到引导卡片
  showDialog.value = false;
};

// 监听消息列表变化，滚动到底部
watch( [ messageList, thinkDialog ], () =>
{
  scrollToBottom();
} );

/** 拉取历史会话列表（失败不影响问答主流程） */
const loadChatHistory = async () =>
{
  try
  {
    await chatHistoryRef.value?.getAllChatHistory( USER_ID );
  } catch ( err )
  {
    const info = classifyAiError( err, "获取历史会话" );
    logAiError( "获取历史会话", info, err );
  }
};

/** 拉取用户特点（失败降级为空字符串，不影响对话） */
const loadUserFeature = async () =>
{
  try
  {
    const res = await getUserFeature( USER_ID );
    if ( res.data?.success )
    {
      userFeature.value = res.data.data;
    }
    if ( import.meta.env.DEV )
    {
      console.log( "[AI 对话] 用户特点获取成功:", res.data );
    }
  } catch ( err )
  {
    const info = classifyAiError( err, "获取用户特点" );
    logAiError( "获取用户特点", info, err );
  }
};

/** 拉取向量库规模，展示在引用面板底部（失败降级为 --） */
const loadVectorCount = async () =>
{
  try
  {
    const res = await getKbStats();
    const count = res.data?.data?.vectorChunks;
    vectorCount.value = typeof count === "number" && count >= 0 ? count : null;
  } catch ( err )
  {
    const info = classifyAiError( err, "获取向量库统计" );
    logAiError( "获取向量库统计", info, err );
    vectorCount.value = null;
  }
};

// 页面一加载，滚动到底部
onMounted( () =>
{
  scrollToBottom();

  // 环境变量校验：配置写错时立刻提示，
  // 避免用户在后端地址不对的情况下反复重试
  const envReport = getEnvReport();
  if ( !envReport.ok )
  {
    const firstError = envReport.issues.find( issue => issue.level === "error" );
    if ( firstError )
    {
      ElMessage( { type: "error", message: firstError.message, duration: 8000 } );
    }
  }

  void checkBackend();
  void loadChatHistory();
  void loadUserFeature();
  void loadVectorCount();
} );

onUnmounted( () =>
{
  // 离开页面必须断掉长连接：流式回调在组件销毁后仍会执行，
  // 继续往已销毁的响应式数据里写值
  streamToken++;
  cancelChatStream( "页面卸载" );
  selectedFiles.value.forEach( file =>
  {
    if ( file.preview )
    {
      URL.revokeObjectURL( file.preview );
    }
  } );
} );
</script>

<style scoped lang="scss">
/* 设计稿配色：以深靛蓝为主色，替代原紫色渐变，整体保持浅底 + 细分割线 */
$ink: #1f2937;
$muted: #9ca3af;
$line: #eceef2;
$accent: #26307a;
$accent-soft: rgba(38, 48, 122, 0.08);

.ai-qa {
  display: flex;
  height: calc(100vh - $nav-height);
  margin-top: -20px;
  background: #fff;
  overflow: hidden;
}

.qa-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 标题栏 */
.qa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 32px;
  border-bottom: 1px solid $line;
}

.qa-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.qa-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: $ink;
  transform: translateY(2px);
}

.qa-conv-title {
  font-size: 13px;
  color: $muted;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qa-header-actions {
  display: flex;
  gap: 10px;
}

.ghost-btn {
  padding: 7px 16px;
  font-size: 13px;
  color: $ink;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: $accent;
    border-color: $accent;
    background: $accent-soft;
  }
}

/* 后端状态横幅 */
.backend-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 32px 0;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: 10px;
}

.backend-alert.offline {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
}

.backend-alert.degraded {
  color: #b45309;
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.35);
}

.backend-alert-icon {
  flex-shrink: 0;
  font-size: 18px;
}

.backend-alert-body {
  flex: 1;
  min-width: 0;
}

.backend-alert-title {
  font-size: 14px;
  font-weight: 600;
}

.backend-alert-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  opacity: 0.85;
}

/* 空态 */
.qa-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.greeting {
  text-align: center;
  margin-bottom: 44px;
}

.hello {
  margin: 0 0 14px;
  font-size: 40px;
  font-weight: 700;
  color: $accent;
}

.subtitle {
  margin: 0;
  font-size: 18px;
  color: $muted;
}

.feature-cards {
  display: flex;
  gap: 20px;
}

.card {
  width: 250px;
  padding: 22px;
  border: 1px solid $line;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: $accent;
    box-shadow: 0 6px 20px rgba(38, 48, 122, 0.08);
    transform: translateY(-3px);
  }
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: $accent-soft;
  color: $accent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: $ink;
}

.card-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: $muted;
}

/* 对话区 */
.qa-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 32px;
}

.turn {
  margin-bottom: 28px;
}

/* 用户提问：左侧深色竖线 + 正文，不用气泡 */
.turn-user {
  display: flex;
  gap: 14px;
}

.user-accent {
  width: 3px;
  flex-shrink: 0;
  border-radius: 2px;
  background: $accent;
}

.user-question {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 15px;
  line-height: 1.7;
  color: $ink;
  padding-top: 2px;
}

.user-text {
  font-size: 15px;
  line-height: 1.7;
  color: $ink;
}

.user-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 10px;
  object-fit: cover;
}

.turn-ai {
  display: flex;
  flex-direction: column;
}

.ai-answer {
  font-size: 14px;
  line-height: 1.9;
  color: #374151;
}

/* AI 兜底回复：用偏红底色和正常回答区分开，让用户一眼看出这条不是模型输出 */
.ai-answer-error {
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #b91c1c;
}

.answer-image {
  max-width: 320px;
  border-radius: 10px;
  margin-top: 8px;
}

/* 检索降级提示 */
.rag-notice {
  margin-top: 8px;
  font-size: 12px;
  color: $muted;
}

/* 回答元信息行 */
.answer-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed $line;
}

.answer-meta-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: $muted;
}

.answer-meta-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.meta-btn {
  padding: 4px 10px;
  font-size: 12px;
  color: #6b7280;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: $accent;
    background: $accent-soft;
  }

  &:disabled {
    color: #d1d5db;
    cursor: not-allowed;
  }
}

/* 思考中 */
.thinking {
  display: flex;
  align-items: center;
  gap: 6px;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $accent;
  opacity: 0.4;
  animation: thinking-blink 1.2s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes thinking-blink {

  0%,
  80%,
  100% {
    opacity: 0.25;
  }

  40% {
    opacity: 1;
  }
}

.thinking-text {
  margin-left: 6px;
  font-size: 13px;
  color: $muted;
}

/* 输入区 */
.qa-composer {
  padding: 16px 32px 22px;
  border-top: 1px solid $line;
}

.composer-box {
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  padding: 12px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-within {
    border-color: $accent;
    box-shadow: 0 0 0 3px $accent-soft;
  }
}

.composer-input {
  width: 100%;
  min-height: 64px;
  max-height: 160px;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.7;
  color: $ink;
  font-family: inherit;

  &::placeholder {
    color: $muted;
  }
}

.composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.composer-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 数据源 / 模型 下拉：原生 select 配合自定义箭头，便于和设计稿的小尺寸对齐 */
.picker {
  position: relative;
  display: inline-flex;

  &::after {
    content: "";
    position: absolute;
    right: 9px;
    top: 50%;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid #909399;
    border-bottom: 1.5px solid #909399;
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
  }
}

.picker-select {
  appearance: none;
  padding: 6px 26px 6px 10px;
  font-size: 13px;
  color: $ink;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    border-color: $accent;
  }

  &:focus {
    outline: none;
    border-color: $accent;
  }
}

.send-btn {
  min-width: 72px;
  padding: 7px 18px;
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

/* 生成中切换为停止按钮 */
.send-btn.stop-btn {
  background: #475569;
}

/* 文件预览 */
.file-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.file-preview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid $line;
  border-radius: 8px;
}

.preview-image {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
}

.preview-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: $accent-soft;
  color: $accent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: $ink;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: $muted;
}

.remove-file-btn {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: $muted;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
}

.upload-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s ease;

  &:hover {
    color: $accent;
    background: $accent-soft;
  }
}

.file-input {
  display: none;
}
</style>
