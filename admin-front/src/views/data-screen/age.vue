<template>
  <div class="age-module">
    <div class="module-header">
      <div class="header-title">
        <span class="title-text">年龄比例</span>
        <div class="title-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>
    <div class="module-content">
      <div class="chart-wrapper">
        <div ref="chartRef" class="chart-container"></div>
      </div>
      <!-- 图例与饼图共用同一份数据，避免两处各写一遍导致对不上 -->
      <div class="legend-wrapper">
        <div class="legend-item" v-for=" item in AGE_DISTRIBUTION " :key=" item.name ">
          <span class="legend-color" :style=" { background: item.color } "></span>
          <span class="legend-text">{{ item.name }}</span>
          <span class="legend-value">{{ item.value }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { ref, onMounted, onUnmounted } from 'vue';
// 大屏数据统一来源，当前为演示数据
import { AGE_DISTRIBUTION } from './screen-data';


const chartRef = ref<HTMLElement | null>( null );
let chartInstance: echarts.ECharts | null = null;

onMounted( () =>
{
  if ( !chartRef.value ) return;
  // 这里原先写的是 if (!chartInstance) return —— 挂载时它本来就是 null，
  // 于是函数直接返回，年龄比例饼图从来没渲染出来过
  chartInstance?.dispose();
  chartInstance = echarts.init( chartRef.value );
  chartInstance.setOption( {
    series: [ {
      type: 'pie',
      radius: [ '40%', '75%' ],
      center: [ '35%', '50%' ],
      itemStyle: {
        borderRadius: 8,
        borderColor: 'rgba(0, 30, 80, 0.9)',
        borderWidth: 2,
      },
      label: {
        show: true,
        position: 'inside',
        formatter: '{d}%',
        color: '#fff',
        fontSize: 12,
      },
      labelLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
      data: AGE_DISTRIBUTION.map( ( item ) => ( {
        value: item.value,
        name: item.name,
        itemStyle: { color: item.color },
      } ) ),
    } ],
  } );

  window.addEventListener( 'resize', handleResize );
} );
// ===================== 自动轮播高亮 =====================
let currentIndex = -1;
// 定时器要存下来，组件卸载时清掉，否则离屏后还在空跑
let highlightTimer: number | null = null;
highlightTimer = window.setInterval( () =>
{
  const seriesIndex = 0; // 只有一个 series
  const dataLen = AGE_DISTRIBUTION.length;

  // 取消上一个高亮
  if ( currentIndex >= 0 )
  {
    chartInstance?.dispatchAction( {
      type: "downplay",
      seriesIndex,
      dataIndex: currentIndex,
    } );
  }

  // 计算下一个高亮索引
  currentIndex = ( currentIndex + 1 ) % dataLen;

  // 高亮当前扇区
  chartInstance?.dispatchAction( {
    type: "highlight",
    seriesIndex,
    dataIndex: currentIndex,
  } );

  // 显示 tooltip
  chartInstance?.dispatchAction( {
    type: "showTip",
    seriesIndex,
    dataIndex: currentIndex,
  } );
}, 2000 );

const handleResize = () =>
{
  chartInstance?.resize();
};

onUnmounted( () =>
{
  window.removeEventListener( 'resize', handleResize );
  if ( highlightTimer !== null )
  {
    clearInterval( highlightTimer );
    highlightTimer = null;
  }
  chartInstance?.dispose();
} );
</script>

<style scoped lang="scss">
.age-module {
  width: 80%;
  height: 250px;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.8) 0%, rgba(0, 30, 80, 0.9) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

.age-module::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 153, 0, 0.8) 50%, transparent 100%);
}

.module-header {
  padding: 8px 15px;
  background: linear-gradient(90deg, rgba(0, 80, 180, 0.3) 0%, rgba(0, 50, 130, 0.1) 100%);
  border-bottom: 1px solid rgba(0, 122, 255, 0.2);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 8px rgba(255, 153, 0, 0.6);
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

.module-content {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 15px 20px;
  height: calc(100% - 50px);
}

.chart-wrapper {
  width: 100%;
  height: 200px;
}

.chart-container {
  width: 100%;
  height: 100%;
}

.legend-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform: translateX(-20%);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  width: 80px;
}

.legend-value {
  font-size: 13px;
  font-weight: bold;
  color: #fff;
}
</style>