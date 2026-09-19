<template>
  <div class="nav">
    <!-- 导航栏左侧内容 -->
    <div class="nav-left">
      <el-icon @click=" isfold ">
        <component :is=" updateFlag.collapse ? 'Fold' : 'Expand' "></component>
      </el-icon>
      <!-- 动态生成面包屑 -->
      <!-- 1.点击对应面包屑，就能收集对应路由数据 -->
      <!-- 2.遍历渲染 -->
      <el-breadcrumb separator-icon="ArrowRight">
        <el-breadcrumb-item v-for=" ( item, index ) in data.matched " :key=" index " @click="toRoute( item.path )">
          <template #default>
            <el-icon>
              <component :is=" item.meta.icon "></component>
            </el-icon>
            <span>{{ item.meta.title }}</span>
          </template>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <!-- 导航栏右侧内容 -->
    <!-- 按钮功能区 -->
    <div class="nav-right">
      <el-button icon="Refresh" circle @click=" refresh " />
      <el-button icon="FullScreen" circle @click=" fullscreen " />
      <el-button icon="Setting" circle ref="buttonRef" />
      <el-switch v-model=" switchValue " class="mt-2" style="margin-left: 24px" inline-prompt active-icon="Moon"
        inactive-icon="Sunny" @change=" changeTheme " />
      <!-- 颜色选择器弹窗 -->
      <el-popover ref="popoverRef" :virtual-ref=" buttonRef " trigger="click" title="更改主题颜色" virtual-triggering>
        <el-color-picker v-model=" color " show-alpha :predefine=" predefineColors " @change=" changeColor " />
      </el-popover>
      <!-- 头像 -->
      <div class="person">
        <img :src=" userInfo.avatar " alt="头像" class="avatar" />
        <span class="userName">{{ userInfo.userName }}</span>
      </div>
      <!-- 下拉菜单 -->
      <el-dropdown>
        <el-icon class="el-icon--right">
          <arrow-down />
        </el-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click=" logout ">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions( {
  name: "Home-Nav",
} );
// 说明：element-plus 的暗黑变量样式统一在 main.ts 引入，
// 组件内再 import 全局样式会随组件一起被按需打包，容易漏掉
import { useRoute, useRouter } from "vue-router";
import { nextTick, ref, onMounted } from "vue";
import mainData from "@/store/modules/home-main";
import UserInfo from "@/store/modules/user";
const updateFlag = mainData();
const data = useRoute();
const userInfo = UserInfo();
const Router = useRouter();
// 切换黑暗模式功能开关
const switchValue = ref( false );
// 本地存储键名与默认主题色，读写用同一份常量避免拼错
const THEME_KEY = "theme";
const COLOR_KEY = "color";
const DEFAULT_COLOR = "#1e90ff";
// 收集当前颜色
const color = ref( '' );
// 预定义颜色
const predefineColors = ref( [
  '#ff4500',
  '#ff8c00',
  '#ffd700',
  '#90ee90',
  '#00ced1',
  '#1e90ff',
  '#c71585',
  'rgba(255, 69, 0, 0.68)',
  'rgb(255, 120, 0)',
  'hsv(51, 100, 98)',
  'hsva(120, 40, 94, 0.5)',
  'hsl(181, 100%, 37%)',
  'hsla(209, 100%, 56%, 0.73)',
  '#c7158577',
] )
// 引入颜色选择器
const buttonRef = ref( null );
// 方法
// 刷新功能
// 1.将控制刷新的flag存储到pinia，方便nav和main组件更改flag值 -->
// 2.点击按钮后flag变为false，卸载main组件 -->
const refresh = () =>
{
  updateFlag.flag = false;
  //nextTick在依赖全局数据updateFlag.flag的DOM元素更新后调用
  // 3.页面更新后（nextTick）将flag改为true重新挂载main组件 -->
  nextTick( () =>
  {
    updateFlag.flag = true;
  } );
};
// 应用主题：切换与初始化共用同一个入口，避免两处逻辑走偏
const applyTheme = ( val: boolean ) =>
{
  switchValue.value = val;
  document.documentElement.className = val === true ? 'dark' : '';
  localStorage.setItem( THEME_KEY, val === true ? 'dark' : 'light' );
};
// 切换主题功能
const changeTheme = ( val: boolean ) =>
{
  applyTheme( val );
};
// 全屏功能
const fullscreen = () =>
{
  let full = document.fullscreenElement;
  if ( !full )
  {
    document.documentElement.requestFullscreen();
  } else
  {
    document.exitFullscreen();
  }
};
// 退出登录功能
// 1.向后端发送退出登录请求，让后端知道（但我没接口）
// 2.清除当前用户数据，例如avatar等
// 3.跳转到登录页面
//4.再次登录时返回到之前退出登录的页面
const logout = () =>
{
  userInfo.userLogout(); //清除数据
  Router.push( { path: "/login", query: { redirect: data.path } } );
};
// 展开菜单功能
const isfold = () =>
{
  updateFlag.collapse = !updateFlag.collapse;
};
// 点击面包屑能跳转到对应路由
const toRoute = ( path: string ) =>
{
  if ( path && path !== data.path )
  {
    Router.push( path );
  }
};
// 切换颜色功能
const changeColor = ( val: string ) =>
{
  color.value = val;
  document.documentElement.style.setProperty( '--el-color-primary', val );
  // 保存到localStorage
  localStorage.setItem( COLOR_KEY, val );
};
// 组件挂载时恢复上次的主题色与明暗模式
onMounted( () =>
{
  // 颜色：读出来后还要写回 CSS 变量，
  // 否则只是选择器显示了旧颜色，页面主色其实已经还原成默认值
  const savedColor = localStorage.getItem( COLOR_KEY ) || DEFAULT_COLOR;
  color.value = savedColor;
  document.documentElement.style.setProperty( '--el-color-primary', savedColor );
  // 暗黑模式：之前只存了颜色没存明暗状态，刷新后 className 丢失
  applyTheme( localStorage.getItem( THEME_KEY ) === 'dark' );
} );
</script>

<style lang="scss" scoped>
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: $container-margin;

  .nav-left {
    display: flex;
    gap: 12px;

    .el-icon {
      cursor: pointer;
    }

    .el-breadcrumb__item {
      cursor: pointer;

      .el-breadcrumb__inner {
        vertical-align: middle;

        .el-icon {
          vertical-align: middle;
          transform: translate(-2px, -1px);
        }
      }
    }
  }

  .nav-right {
    display: flex;
    align-items: center;

    .el-button {
      margin-right: -3px;
      width: $circle-size;
      height: $circle-size;
    }

    .person {
      display: flex;
      align-items: center;

      .avatar {
        width: $circle-size;
        border-radius: 50%;
        margin: 0 5px 0 20px;
      }

      .userName {
        color: $h6;
        font-size: 13px;
        margin-right: 5px;
      }
    }
  }
}
</style>
