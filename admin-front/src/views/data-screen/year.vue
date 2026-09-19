<template>
  <div class="year-module">
    <div class="module-header">
      <div class="header-left">
        <div class="tag-icon"></div>
        <span class="header-title">年度游客量对比</span>
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
import { YEAR_COMPARISON } from './screen-data';

const chartRef = ref<HTMLElement | null>( null );
let chartInstance: echarts.ECharts | null = null;

const months = YEAR_COMPARISON.months;

/** 把 #rrggbb 转成带透明度的 rgba，面积图渐变沿用对应线条色 */
const withAlpha = ( hex: string, alpha: number ) =>
{
  const value = hex.replace( "#", "" );
  const r = parseInt( value.slice( 0, 2 ), 16 );
  const g = parseInt( value.slice( 2, 4 ), 16 );
  const b = parseInt( value.slice( 4, 6 ), 16 );
  return `rgba(${ r }, ${ g }, ${ b }, ${ alpha })`;
};

onMounted( () =>
{
  if ( !chartRef.value ) return;
  // 这里原先写的是 if (!chartInstance) return —— 挂载时它本来就是 null，
  // 于是函数直接返回，年度游客量对比图从来没渲染出来过
  chartInstance?.dispose();
  chartInstance = echarts.init( chartRef.value );
  chartInstance.setOption( {
    backgroundColor: 'transparent',
    legend: {
      data: YEAR_COMPARISON.series.map( ( item ) => item.name ),
      top: 0,
      right: 20,
      textStyle: {
        color: '#fff',
        fontSize: 11,
      },
      itemWidth: 12,
      itemHeight: 12,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#fff',
        },
      },
    },
    grid: {
      left: 55,
      right: 20,
      top: 40,
      bottom: 35,
    },
    xAxis: {
      type: 'category',
      data: months,
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
      name: '(人数)',
      nameTextStyle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
      },
      min: 0,
      max: YEAR_COMPARISON.maxValue,
      interval: YEAR_COMPARISON.interval,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 122, 255, 0.15)',
        },
      },
    },
    // 线条色与面积渐变都由数据里的 color 推导，避免颜色在数据与样式里各写一遍
    series: YEAR_COMPARISON.series.map( ( item ) => ( {
      name: item.name,
      type: 'line',
      data: item.data,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        color: item.color,
        width: 2,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient( 0, 0, 0, 1, [
          { offset: 0, color: withAlpha( item.color, 0.4 ) },
          { offset: 1, color: withAlpha( item.color, 0.05 ) },
        ] ),
      },
    } ) ),
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
.year-module {
  width: 80%;
  height: 95%;
  margin-left: 20%;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.8) 0%, rgba(0, 30, 80, 0.9) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  z-index: 10;
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
  z-index: 10;
  pointer-events: none;
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
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
