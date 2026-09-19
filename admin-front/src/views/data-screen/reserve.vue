<template>
  <div class="reserve-module">
    <div class="module-header">
      <div class="header-left">
        <div class="tag-icon"></div>
        <span class="header-title">预约渠道数据统计</span>
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
import { RESERVE_CHANNELS } from './screen-data';

const chartRef = ref<HTMLElement | null>( null );
let chartInstance: echarts.ECharts | null = null;

onMounted( () =>
{
  if ( !chartRef.value ) return;

  chartInstance = echarts.init( chartRef.value );
  chartInstance.setOption( {
    backgroundColor: 'transparent',
    legend: {
      orient: 'vertical',
      left: 20,
      top: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 12,
      },
      itemWidth: 14,
      itemHeight: 14,
      data: RESERVE_CHANNELS.map( ( item ) => ( { name: item.name, icon: 'circle' } ) ),
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b} : {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: [ '35%', '60%' ],
        center: [ '65%', '50%' ],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: 'rgba(0, 30, 80, 0.9)',
          borderWidth: 4,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: false,
          },
        },
        labelLine: {
          show: false,
        },
        data: RESERVE_CHANNELS.map( ( item ) => ( {
          value: item.value,
          name: item.name,
          itemStyle: {
            color: new echarts.graphic.LinearGradient( 0, 0, 1, 1, [
              { offset: 0, color: item.gradient[ 0 ] },
              { offset: 1, color: item.gradient[ 1 ] },
            ] ),
          },
        } ) ),
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
.reserve-module {
  width: 80%;
  height: 70%;
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
  padding: 15px 20px;
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
