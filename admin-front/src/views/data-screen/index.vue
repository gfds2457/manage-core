<template>
  <div class="data-screen" ref="screenRef">
    <div class="screen-wrapper" ref="wrapperRef">
      <!-- 数据大屏顶部导航栏 -->
      <div class="screen-header">
        <img src="../../assets/dataScreen/border.png" alt="" class="header-img">
        <!-- 导航栏左侧 -->
        <div class="header-left">
          <div class="header-btn">数据概览</div>
          <div class="header-btn" @click=" goHome ">首页</div>
        </div>
        <div class="header-center">
          <h1>智慧旅游可视化大数据平台</h1>
          <!-- 大屏指标没有后端接口支撑，显式标注避免被误读成真实业务数据 -->
          <span v-if=" SCREEN_DATA_IS_DEMO " class="demo-badge">演示数据</span>
        </div>
        <!-- 导航栏右侧 -->
        <div class="header-right">
          <span class="current-time">当前时间:{{ currentTime }}</span>
        </div>
      </div>
      <!-- 数据展示 -->
      <div class="screen-content" style="margin-top: 50px;">
        <div class="left-data">
          <!-- 游客数据 -->
          <Tourist />
          <!-- 人数比例 -->
          <GirlsBoys />
          <!-- 年龄分布 -->
          <Age />
        </div>
        <div class="middle-data">
          <!-- 地图 -->
          <Map />
          <!-- 趋势图 -->
          <Trend />
        </div>
        <div class="right-data">
          <!-- 景点数据 -->
          <Scenic />
          <!-- 年份数据 -->
          <Year />
          <!-- 预约数据 -->
          <Reserve />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 引入组件
import Tourist from './tourist.vue'
import GirlsBoys from './girls-boys.vue'
import Age from './age.vue'
import Map from './map.vue'
import Trend from './trend.vue'
import Scenic from './scenic.vue'
import Year from './year.vue'
import Reserve from './reserve.vue'
// 大屏数据统一来源，当前为演示数据
import { SCREEN_DATA_IS_DEMO } from './screen-data'
// 引入vue相关函数
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";

const screenRef = ref<HTMLElement | null>( null );
const wrapperRef = ref<HTMLElement | null>( null );
const currentTime = ref( "" );
const router = useRouter();
const goHome = () =>
{
  router.push( "/" );
};

const designWidth = 1920;
const designHeight = 1080;
// 更新缩放比例函数
const updateScale = () =>
{
  if ( !screenRef.value || !wrapperRef.value ) return;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const scaleX = screenWidth / designWidth;
  const scaleY = screenHeight / designHeight;
  const scale = Math.min( scaleX, scaleY );

  wrapperRef.value.style.transform = `scale(${ scale }) `;
};
// 更新时间函数
const updateTime = () =>
{
  const now = new Date();
  const year = now.getFullYear();
  const month = String( now.getMonth() + 1 ).padStart( 2, "0" );
  const day = String( now.getDate() ).padStart( 2, "0" );
  const hours = String( now.getHours() ).padStart( 2, "0" );
  const minutes = String( now.getMinutes() ).padStart( 2, "0" );
  const seconds = String( now.getSeconds() ).padStart( 2, "0" );
  currentTime.value = `${ year }年${ month }月${ day }日 ${ hours }:${ minutes }:${ seconds }`;
};

let timer: number | null = null;

onMounted( () =>
{
  updateScale();
  updateTime();
  window.addEventListener( "resize", updateScale );
  timer = window.setInterval( updateTime, 1000 );
} );

onUnmounted( () =>
{
  window.removeEventListener( "resize", updateScale );
  if ( timer )
  {
    clearInterval( timer );
  }
} );
</script>

<style scoped lang="scss">
.data-screen {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-image: url('../../assets/dataScreen/background.gif');
  background-size: cover;
  position: relative;
}

.screen-wrapper {
  width: 1920px;
  height: 1080px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  margin-left: -960px;
  margin-top: -540px;
}

.screen-header {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  position: relative;
  z-index: 10;

  .header-img {
    position: absolute;
    top: -50px;
    left: 0;
    width: 1920px;
  }
}

.header-left,
.header-right {
  transform: translateY(130%);
  display: flex;
  align-items: center;
  gap: 18px;
  margin-left: 220px;
}

.header-btn {
  padding: 6px 20px;
  background: linear-gradient(180deg, rgba(0, 122, 255, 0.4) 0%, rgba(0, 122, 255, 0.2) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  color: $text-color;
  text-shadow: $text-shadow;
  font-size: 16px;
  line-height: 24px;
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 12px;
  margin-top: -10px;

  &:hover {
    background: linear-gradient(180deg, rgba(0, 122, 255, 0.6) 0%, rgba(0, 122, 255, 0.4) 100%);
    box-shadow: 0 0 10px rgba(0, 122, 255, 0.5);
  }
}

.header-center h1 {
  font-size: 18px;
  font-weight: bold;
  color: $text-color;
  margin: 0;
  letter-spacing: 6px;
  transform: translate(12%, 70%);
}

.demo-badge {
  display: inline-block;
  margin-left: 12px;
  padding: 2px 8px;
  font-size: 12px;
  letter-spacing: 0;
  color: #ffd166;
  border: 1px solid rgba(255, 209, 102, 0.6);
  border-radius: 10px;
  transform: translate(12%, 60%);
}

.current-time {
  font-size: 14px;
  color: $text-color;
  text-shadow: $text-shadow;
  font-family: "Courier New", monospace;
  letter-spacing: 1px;
  transform: translateX(-50%);
}

.screen-content {
  display: flex;
  width: 100%;
  height: calc(100% - 50px);
  position: relative;
  gap: 30px;

  .left-data,
  .right-data {
    flex: 1;
    color: #fff;
    display: grid;
    grid-template-rows: repeat(3, 1fr);
  }

  .middle-data {
    flex: 1.4;
    display: grid;
    grid-template-rows: repeat(2, auto);
  }
}


.screen-content::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    linear-gradient(rgba(0, 122, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 122, 255, 0.08) 1px, transparent 1px);
  background-size: 40px 40px;
}
</style>