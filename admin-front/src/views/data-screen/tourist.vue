<template>
  <div class="tourist-module">
    <div class="module-header">
      <div class="header-title">
        <span class="title-text">实时游客统计</span>
        <div class="title-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
      <div class="header-right">
        <span class="reserve-total">可预约总量{{ TOURIST_STAT.reserveTotal }}人</span>
      </div>
    </div>
    <div class="module-content">
      <!-- 数字逐位渲染，位数由数据本身决定，不再把每一位写死在模板里 -->
      <div class="number-display">
        <div v-for=" ( digit, index ) in touristDigits " :key=" index " class="number-item">
          {{ digit }}
        </div>
        <div class="number-item text">人</div>
      </div>
      <div class="charts-wrapper">
        <div class="charts" ref="charts" style="margin-top: 10px;"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { computed, ref, onMounted, onUnmounted } from 'vue'
import 'echarts-liquidfill'
// 大屏数据统一来源，当前为演示数据
import { TOURIST_STAT } from './screen-data';

const charts = ref<HTMLElement | null>( null );
let myChart: echarts.ECharts | null = null;
// 实时游客数按位拆开，模板逐位渲染
const touristDigits = computed( () => String( TOURIST_STAT.count ).split( '' ) );

onMounted( () =>
{
  if ( !charts.value )
  {
    console.error( '图表容器不存在' );
    return;
  }

  try
  {
    myChart = echarts.init( charts.value );
    myChart.setOption( {
      series: [
        {
          type: 'liquidFill',
          radius: '100%',
          center: [ '50%', '50%' ],
          // 两层波浪，和效果图双层水波一致
          data: TOURIST_STAT.fillLevels,
          // 青绿色渐变水波，匹配效果图浅青色调
          color: [
            new echarts.graphic.LinearGradient( 0, 0, 0, 1, [
              { offset: 0, color: '#26d8bc' },
              { offset: 1, color: '#00c6ff' }
            ] ),
            new echarts.graphic.LinearGradient( 0, 0, 0, 1, [
              { offset: 0, color: '#1fc9a8' },
              { offset: 1, color: '#00b8e6' }
            ] )
          ],
          // 内部深色背景
          backgroundStyle: {
            color: 'rgba(0, 50, 120, 0.3)'
          },
          // 外圈虚线圆环（核心还原效果）
          outline: {
            show: true,
            borderDistance: 6, // 虚线和水球的间距
            itemStyle: {
              borderColor: 'rgba(0, 222, 255, 0.5)',
              borderWidth: 2,
              borderType: 'dashed' // 虚线样式
            }
          },
          // 中间文字「预约量」
          label: {
            show: true,
            color: '#fff',
            fontSize: 18,
            fontWeight: 500,
            formatter: '预约量'
          },
          // 关闭波浪多余阴影，贴合深色大屏风格
          itemStyle: {
            shadowBlur: 0
          },
          // 波浪动画柔和
          waveAnimation: {
            duration: 4000
          }
        }
      ]
    } );

    window.addEventListener( 'resize', handleResize );
  } catch ( error )
  {
    console.error( '水球图初始化失败:', error );
  }
} );
// 监听窗口变化，调整图表大小
const handleResize = () =>
{
  myChart?.resize();
};
// 组件卸载时，移除事件监听和销毁图表
onUnmounted( () =>
{
  window.removeEventListener( 'resize', handleResize );
  myChart?.dispose();
} );
</script>

<style scoped lang="scss">
.tourist-module {
  width: 80%;
  height: 300px;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.8) 0%, rgba(0, 30, 80, 0.9) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

.tourist-module::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 122, 255, 0.9) 50%, transparent 100%);
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: linear-gradient(90deg, rgba(0, 80, 180, 0.4) 0%, rgba(0, 50, 130, 0.2) 100%);
  border-bottom: 1px solid rgba(0, 122, 255, 0.3);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-text {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 8px rgba(0, 122, 255, 0.6);
}

.title-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  background: linear-gradient(180deg, #ff9900 0%, #ff6600 100%);
  border-radius: 50%;
}

.reserve-total {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.module-content {
  padding: 20px 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 15px;
  height: calc(100% - 60px);
}

.charts-wrapper {
  width: 100%;
  height: 150px;
}

.charts {
  width: 100%;
  height: 100%;
}

.number-display {
  display: flex;
  gap: 6px;
}

.number-item {
  width: 36px;
  height: 48px;
  background: linear-gradient(180deg, rgba(0, 100, 200, 0.6) 0%, rgba(0, 60, 140, 0.8) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 28px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10px rgba(0, 122, 255, 0.8);
  font-family: "Courier New", monospace;

  &.text {
    font-size: 18px;
    width: auto;
    padding: 0 10px;
  }
}
</style>