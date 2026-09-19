<template>
  <div class="login-page" @mousemove=" onGlowMove ">
    <!-- 全屏跟随鼠标的蓝光：铺在整个登录页，登录卡白底会自然把它挡在下面 -->
    <div ref="glowRef" class="page-glow" aria-hidden="true"></div>

    <!-- 左栏：数据脉络。纯装饰，交互只做「聚焦哪一类字段，哪条脉络亮起」 -->
    <div class="flow" aria-hidden="true">
      <svg viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid slice">
        <line v-for=" ( line, i ) in FLOW_LINES " :key=" line.key " class="flow-line"
          :class=" { 'is-active': isActive( line.group ), 'is-hover': hoverLine === line.key } "
          :style=" { transitionDelay: done ? `${ i * 12 }ms` : '0ms' } " :x1=" line.x1 " :y1=" line.y1 " :x2=" line.x2 "
          :y2=" line.y2 " />
        <circle v-for=" ( node, i ) in FLOW_NODES " :key=" node.key " class="flow-node" :class=" {
          'is-hub': node.hub,
          'is-ready': isReady( node ),
          'is-active': isActive( node.group ),
          'is-hover': hoverNode === node.key,
        } " :style=" { transitionDelay: done ? `${ i * 45 }ms` : '0ms' } " :cx=" node.x " :cy=" node.y "
          :r=" node.hub ? 5.5 : 4 " />
        <!-- 命中层：透明加粗的线 / 圆，只负责接住鼠标，让 1px 的细线也点得住 -->
        <g class="flow-hit">
          <line v-for=" line in FLOW_LINES " :key=" `h-${ line.key }` " :x1=" line.x1 " :y1=" line.y1 " :x2=" line.x2 "
            :y2=" line.y2 " @mouseenter=" hoverLine = line.key" @mouseleave=" hoverLine = ''" />
          <circle v-for=" node in FLOW_NODES " :key=" `h-${ node.key }` " :cx=" node.x " :cy=" node.y " r="16"
            @mouseenter=" hoverNode = node.key" @mouseleave=" hoverNode = ''" />
        </g>
      </svg>
      <div class="flow-caption">数据脉络 · 已连通 {{ litCount }} 个节点</div>
    </div>

    <!-- 右栏：登录 -->
    <div class="panel">
      <el-form ref="loginForm" class="login-card" :model=" form " :rules=" rules ">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 40 40">
            <rect width="40" height="40" rx="9" fill="#409eff" />
            <path d="M11 28 L20 20 L29 12" stroke="#fff" stroke-width="1.6" fill="none" opacity="0.9" />
            <circle cx="11" cy="28" r="2.6" fill="#fff" />
            <circle cx="20" cy="20" r="2.2" fill="#fff" opacity="0.85" />
            <circle cx="29" cy="12" r="2.6" fill="#fff" />
          </svg>
          <div class="brand-text">
            <div class="brand-name">数据管理后台</div>
            <div class="brand-sub">Data Console</div>
          </div>
        </div>

        <div class="welcome">{{ greeting }}，{{ form.username || "访客" }}</div>
        <div class="welcome-sub">请输入账号密码继续</div>

        <el-form-item prop="username">
          <el-input v-model=" form.username " placeholder="用户名" autocomplete="username" @focus="activeGroup = 'account'"
            @blur="activeGroup = ''">
            <template #prefix>
              <el-icon>
                <User />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input v-model=" form.password " type="password" placeholder="密码" autocomplete="current-password"
            show-password @focus="activeGroup = 'password'" @blur="activeGroup = ''" @keyup.enter=" handleLogin ">
            <template #prefix>
              <el-icon>
                <Lock />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>

        <div class="demo-tip">
          <span>演示账号</span>
          <button class="demo-fill" type="button" @click=" fillDemo ">admin / 123456</button>
        </div>

        <el-button class="submit" type="primary" size="large" :loading=" loading " @mouseenter="activeGroup = 'flow'"
          @mouseleave=" leaveFlow " @click=" handleLogin ">
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance, FormItemRule } from "element-plus";
import { User, Lock } from "@element-plus/icons-vue";
import userStore from "@/store/modules/user";

type FlowGroup = "account" | "password" | "flow";

interface FlowNode
{
  key: string;
  x: number;
  y: number;
  group: FlowGroup;
  hub: boolean;
}

interface FlowLine
{
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  group: FlowGroup;
}

/* ---------- 数据脉络：三条链 + 若干跨链支线 ---------- */
// x 统一压在 185~815：svg 是 slice 裁切，容器比视框更「竖」，
// 横向只能露出视框中段（约 160~840），坐标贴边就会被裁到看不见
const CHAINS: Record<FlowGroup, Array<[ number, number ]>> = {
  account: [
    [ 185, 596 ],
    [ 267, 566 ],
    [ 353, 528 ],
    [ 444, 486 ],
    [ 538, 432 ],
    [ 638, 372 ],
    [ 732, 306 ],
    [ 815, 238 ],
  ],
  password: [
    [ 232, 468 ],
    [ 323, 428 ],
    [ 414, 382 ],
    [ 504, 330 ],
    [ 595, 272 ],
    [ 686, 208 ],
    [ 777, 142 ],
  ],
  flow: [
    [ 368, 258 ],
    [ 462, 212 ],
    [ 556, 162 ],
    [ 648, 110 ],
  ],
};

// 主干节点：即便没有交互也保持主色，作为静态的视觉锚点
const HUBS = [ "account-3", "account-7", "password-3", "password-6", "flow-0", "flow-2" ];

const CROSS_LINKS: Array<[ string, string ]> = [
  [ "account-1", "password-0" ],
  [ "account-3", "password-2" ],
  [ "account-5", "password-4" ],
  [ "flow-0", "password-2" ],
  [ "flow-1", "password-3" ],
  [ "flow-2", "password-4" ],
];

// 节点按 y 从下到上排列，登录成功时点亮顺序才连贯
const FLOW_NODES: FlowNode[] = Object.entries( CHAINS )
  .flatMap( ( [ group, points ] ) =>
    points.map( ( [ x, y ], i ) => ( {
      key: `${ group }-${ i }`,
      x,
      y,
      group: group as FlowGroup,
      hub: HUBS.includes( `${ group }-${ i }` ),
    } ) ),
  )
  .sort( ( a, b ) => b.y - a.y );

const NODE_MAP = new Map( FLOW_NODES.map( ( node ) => [ node.key, node ] ) );

const FLOW_LINES: FlowLine[] = [
  ...Object.entries( CHAINS ).flatMap( ( [ group, points ] ) =>
    points.slice( 1 ).map( ( [ x, y ], i ) => ( {
      key: `${ group }-l${ i }`,
      group: group as FlowGroup,
      x1: points[ i ][ 0 ],
      y1: points[ i ][ 1 ],
      x2: x,
      y2: y,
    } ) ),
  ),
  ...CROSS_LINKS.flatMap( ( [ from, to ] ) =>
  {
    const a = NODE_MAP.get( from );
    const b = NODE_MAP.get( to );
    if ( !a || !b ) return [];
    return [ { key: `${ from }~${ to }`, group: a.group, x1: a.x, y1: a.y, x2: b.x, y2: b.y } ];
  } ),
];

/* ---------- 状态 ---------- */
const router = useRouter();
const route = useRoute();
const accountStore = userStore();

const USERNAME_RE = /^[a-zA-Z0-9]{1,10}$/;
const PASSWORD_RE = /^[a-zA-Z0-9]{6,}$/;

const form = reactive( {
  username: "admin",
  password: "123456",
} );

const loginForm = ref<FormInstance>();
const loading = ref( false );
const done = ref( false );
const activeGroup = ref<FlowGroup | "">( "" );
// 默认预填了 admin / 123456，不该一进页面就把两条链全描蓝，只对「被碰过」的字段做就绪反馈
const touched = ref<FlowGroup[]>( [] );
// 鼠标划过的线 / 点，用来在对应位置亮起蓝光
const hoverLine = ref( "" );
const hoverNode = ref( "" );

watch( activeGroup, ( group ) =>
{
  if ( group && group !== "flow" && !touched.value.includes( group ) )
  {
    touched.value.push( group );
  }
} );

const greeting = computed( () =>
{
  const hour = new Date().getHours();
  if ( hour < 12 ) return "上午好";
  if ( hour === 12 ) return "中午好";
  if ( hour < 18 ) return "下午好";
  return "晚上好";
} );

const isActive = ( group: FlowGroup ) => done.value || activeGroup.value === group;

const isReady = ( node: FlowNode ) =>
{
  if ( !touched.value.includes( node.group ) ) return false;
  if ( node.group === "account" ) return USERNAME_RE.test( form.username );
  if ( node.group === "password" ) return PASSWORD_RE.test( form.password );
  return false;
};

// 默认只显示主干节点的连通数，交互时实时反映当前脉络的规模
const litCount = computed( () =>
{
  if ( done.value ) return FLOW_NODES.length;
  if ( !activeGroup.value ) return FLOW_NODES.filter( ( node ) => node.hub ).length;
  return FLOW_NODES.filter( ( node ) => node.group === activeGroup.value ).length;
} );

/* ---------- 表单校验 ---------- */
function validatorUsername (
  _rule: FormItemRule,
  value: string,
  callback: ( error?: Error ) => void,
)
{
  if ( USERNAME_RE.test( value ) ) callback();
  else callback( new Error( "账号至少1位数,最多10位数之间" ) );
}

function validatorPassword (
  _rule: FormItemRule,
  value: string,
  callback: ( error?: Error ) => void,
)
{
  if ( PASSWORD_RE.test( value ) ) callback();
  else callback( new Error( "密码至少6位数" ) );
}

const rules = reactive( {
  username: [ { trigger: "change", validator: validatorUsername } ],
  password: [ { trigger: "change", validator: validatorPassword } ],
} );

const fillDemo = () =>
{
  form.username = "admin";
  form.password = "123456";
};

// 鼠标移出按钮时收掉脉络高亮，但输入框还聚焦着就别抢它的高亮
const leaveFlow = () =>
{
  if ( activeGroup.value === "flow" ) activeGroup.value = "";
};

/* ---------- 登录 ---------- */
const handleLogin = async () =>
{
  const valid = await loginForm.value?.validate().catch( () => false );
  if ( !valid ) return;

  loading.value = true;
  activeGroup.value = "flow";
  try
  {
    await accountStore.userLogin( { ...form } );
    done.value = true;
    ElMessage( { message: `${ greeting.value }，${ form.username }`, type: "success" } );
    // 等脉络点亮的动效走完再跳转
    await new Promise( ( resolve ) => setTimeout( resolve, 620 ) );
    router.push( ( route.query.redirect as string ) || "/" );
  } catch ( err )
  {
    console.warn( "[登录] 失败:", err );
    loading.value = false;
    activeGroup.value = "";
    ElMessage( { message: "登录失败", type: "error" } );
  }
};

/* ---------- 光晕跟随光标（整页范围） ---------- */
const glowRef = ref<HTMLDivElement | null>( null );
let glowFrame = 0;

const onGlowMove = ( e: MouseEvent ) =>
{
  // 蓝光是全屏 fixed 定位的，直接用视口坐标；页面本身不滚动，无需换算
  const x = e.clientX;
  const y = e.clientY;
  if ( glowFrame ) return;
  glowFrame = requestAnimationFrame( () =>
  {
    glowFrame = 0;
    if ( glowRef.value )
    {
      glowRef.value.style.transform = `translate3d(${ x }px, ${ y }px, 0)`;
    }
  } );
};

onBeforeUnmount( () =>
{
  if ( glowFrame ) cancelAnimationFrame( glowFrame );
} );
</script>

<style lang="scss" scoped>
.login-page {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #fff;
}

/* 全屏蓝光：fixed 铺满视口，跟随鼠标，不参与布局也不吃事件 */
.page-glow {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1;
  width: 260px;
  height: 260px;
  margin: -130px 0 0 -130px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(64, 158, 255, 0.14) 0%, rgba(64, 158, 255, 0) 70%);
  pointer-events: none;
  transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* 左栏：脉络 */
.flow {
  position: relative;
  z-index: 2;
  flex: 1 1 58%;
  overflow: hidden;

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
}

.flow-line {
  stroke: #e4e7ed;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  transition:
    stroke 0.35s ease,
    stroke-width 0.2s ease,
    stroke-opacity 0.35s ease,
    filter 0.2s ease;

  &.is-active {
    stroke: #409eff;
    stroke-opacity: 0.9;
  }

  // 划过：这条线本身亮起并泛出蓝光
  &.is-hover {
    stroke: #409eff;
    stroke-width: 1.6;
    stroke-opacity: 1;
    filter: drop-shadow(0 0 5px rgba(64, 158, 255, 0.8));
  }
}

.flow-node {
  fill: #fff;
  stroke: #c8cdd6;
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
  transform-box: fill-box;
  transform-origin: center;
  transition:
    transform 0.3s ease,
    fill 0.3s ease,
    stroke 0.3s ease,
    filter 0.3s ease;

  &.is-hub {
    fill: #409eff;
    stroke: #409eff;
  }

  // 校验通过：该链的节点描边转主色，算一个「输入到位」的即时反馈
  &.is-ready {
    stroke: #409eff;
  }

  &.is-active {
    fill: #409eff;
    stroke: #409eff;
    transform: scale(1.45);
    filter: drop-shadow(0 0 6px rgba(64, 158, 255, 0.55));
  }

  // 划过：这个点放大并亮起一圈蓝光
  &.is-hover {
    fill: #409eff;
    stroke: #409eff;
    transform: scale(2.2);
    filter: drop-shadow(0 0 10px rgba(64, 158, 255, 0.9));
  }
}

/* 命中层：透明、加粗，只为了让细线细点更容易被划过 */
.flow-hit {
  line {
    fill: none;
    stroke: transparent;
    stroke-width: 18;
    pointer-events: stroke;
  }

  circle {
    fill: transparent;
    pointer-events: all;
  }
}

.flow-caption {
  position: absolute;
  left: 40px;
  bottom: 32px;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #909399;
}

/* 右栏：登录卡 */
.panel {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 0 0 42%;
  align-items: center;
  justify-content: center;
  padding: 48px;
  transform: translateX(-9%);
}

.login-card {
  width: 360px;
  max-width: 100%;
  padding: 32px 28px 28px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.03);

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;

    .brand-mark {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
    }

    .brand-name {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .brand-sub {
      margin-top: 2px;
      font-size: 12px;
      letter-spacing: 0.5px;
      color: #909399;
    }
  }

  .welcome {
    margin-top: 28px;
    font-size: 24px;
    font-weight: 500;
    color: #303133;
  }

  .welcome-sub {
    margin: 6px 0 22px;
    font-size: 13px;
    color: #909399;
  }

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-input__wrapper) {
    height: 44px;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 0 0 1px #dcdfe6 inset;
    transition: box-shadow 0.2s ease;

    &:hover {
      box-shadow: 0 0 0 1px #c0c4cc inset;
    }

    &.is-focus {
      box-shadow:
        0 0 0 1px #409eff inset,
        0 0 0 4px rgba(64, 158, 255, 0.1);
    }
  }

  :deep(.el-input__prefix) {
    color: #a8abb2;
    transition:
      color 0.2s ease,
      transform 0.2s ease;
  }

  :deep(.el-input__wrapper.is-focus .el-input__prefix) {
    color: #409eff;
    transform: scale(1.08);
  }

  :deep(.el-form-item__error) {
    color: #d23939;
  }
}

.demo-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
  font-size: 12px;
  color: #909399;

  .demo-fill {
    padding: 0;
    border: none;
    background: none;
    font-size: 12px;
    color: #409eff;
    cursor: pointer;
    border-bottom: 1px dashed rgba(64, 158, 255, 0.5);

    &:hover {
      border-bottom-style: solid;
    }
  }
}

.submit {
  width: 100%;
  height: 44px;
  border-radius: 6px;
  letter-spacing: 4px;
}

/* 窄屏：只留登录 */
@media (max-width: 900px) {
  .flow {
    display: none;
  }

  .panel {
    flex: 1 1 100%;
    padding: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-glow {
    display: none;
  }

  .flow-line,
  .flow-node {
    transition: none;
  }
}
</style>
