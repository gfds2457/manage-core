<template>
  <div class="trend-module">
    <div class="module-header">
      <div class="header-left">
        <div class="tag-icon"></div>
        <span class="header-title">未来30天游客量趋势图</span>
      </div>
    </div>
    <div class="chart-container">
      <div ref="chartRef" class="chart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { ref, onMounted, onUnmounted } from 'vue';
// 大屏数据统一来源，当前为演示数据
import { TREND } from './screen-data';

const chartRef = ref<HTMLElement | null>( null );
let chartInstance: echarts.ECharts | null = null;

const dates = TREND.dates;
const visitorData = TREND.visitors;

onMounted( () =>
{
  if ( !chartRef.value ) return;

  chartInstance = echarts.init( chartRef.value );
  chartInstance.setOption( {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#fff',
          width: 1,
          type: 'dashed',
        },
      },
    },
    grid: {
      left: 60,
      right: 20,
      top: 30,
      bottom: 35,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: {
        lineStyle: {
          color: 'rgba(0, 122, 255, 0.3)',
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      name: '(访问量)',
      nameTextStyle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
      },
      min: 0,
      max: TREND.maxVisitors,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        formatter: ( value: number ) =>
        {
          if ( value >= 10000 )
          {
            return ( value / 10000 ).toFixed( 1 ) + 'w';
          }
          return value.toString();
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 122, 255, 0.15)',
        },
      },
    },
    series: [
      {
        type: 'line',
        data: visitorData,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#ff9900',
          width: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient( 0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 153, 0, 0.4)' },
            { offset: 0.5, color: 'rgba(255, 102, 0, 0.2)' },
            { offset: 1, color: 'rgba(0, 50, 120, 0.1)' },
          ] ),
        },
      },
    ],
  } );

  window.addEventListener( 'resize', handleResize );
} );

const handleResize = () =>
{
  chartInstance?.resize();
};

onUnmounted( () =>
{
  window.removeEventListener( 'resize', handleResize );
  chartInstance?.dispose();
} );
</script>

<style scoped lang="scss">
.trend-module {
  width: 100%;
  height: 80%;
  padding: 10px;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.8) 0%, rgba(0, 30, 80, 0.9) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  z-index: 10;
  transform: translateY(-5%);
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
  transform: translateY(30%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-icon {
  width: 10px;
  height: 20px;
  background: linear-gradient(180deg, #ff9900 0%, #ff6600 100%);
  border-radius: 0 4px 4px 0;
}

.header-title {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 8px rgba(255, 153, 0, 0.6);
}

.chart-container {
  width: 100%;
  height: 100%;
  margin-top: 60px;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
