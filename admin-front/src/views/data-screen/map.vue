<template>
  <div class="map-module">
    <div class="module-header">
      <div class="header-left">
        <div class="tag-icon"></div>
        <span class="header-title">景区实时客流量</span>
      </div>
      <div class="header-right">
        <div class="text-box">
          <img src="@/assets/dataScreen/textBox.png" alt="预警信息" />
          <span class="warning-text">平台高峰预警信息({{ MAP_FLOW.warningCount }}条)</span>
        </div>
      </div>
    </div>
    <div class="map-container">
      <div ref="mapRef" class="map-chart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { ref, onMounted, onUnmounted } from 'vue';
import chinaJson from './china.json';
// 大屏数据统一来源，当前为演示数据
import { MAP_FLOW } from './screen-data';
const mapRef = ref<HTMLElement | null>( null );
let chartInstance: echarts.ECharts | null = null;

onMounted( () =>
{
  if ( !mapRef.value ) return;

  echarts.registerMap( 'china', chinaJson as unknown as any );

  chartInstance = echarts.init( mapRef.value );
  chartInstance.setOption( {
    backgroundColor: 'transparent',
    geo: {
      map: 'china',
      roam: true,
      zoom: 2,
      center: [ 105, 36 ],
      label: {
        show: true,
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
      },
      itemStyle: {
        areaColor: new echarts.graphic.LinearGradient( 0, 0, 1, 1, [
          { offset: 0, color: 'rgba(0, 80, 180, 0.8)' },
          { offset: 1, color: 'rgba(0, 40, 100, 0.6)' },
        ] ),
        borderColor: 'rgba(0, 122, 255, 0.5)',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#00C6FF',
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 12,
        },
      },
    },
    series: [
      {
        type: 'lines',
        coordinateSystem: 'geo',
        geoIndex: 0,
        // 客流线坐标来自演示数据模块，样式统一在这里给
        data: MAP_FLOW.lines.map( ( item ) => ( {
          name: item.label,
          coords: item.coords,
          lineStyle: {
            color: '#00C6FF',
            width: 2,
            type: 'dashed',
          },
        } ) ),
        effect: {
          show: true,
          symbol: 'arrow',
          symbolSize: 8,
        }
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
.map-module {
  width: 100%;
  height: 100%;
  background: transparent;
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
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-icon {
  width: 10px;
  height: 20px;
  background: linear-gradient(180deg, #00C6FF 0%, #007AFF 100%);
  border-radius: 0 4px 4px 0;
}

.header-title {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 8px rgba(0, 198, 255, 0.6);
}

.header-right {
  display: flex;
  align-items: center;
}

.text-box {
  position: relative;
  display: flex;
  align-items: center;
  padding: 5px 20px;
}

.text-box img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}

.warning-text {
  font-size: 14px;
  font-weight: bold;
  color: #fff;
}

.map-container {
  margin-top: 70px;
  width: 100%;
  height: 100%;
}

.map-chart {
  width: 100;
  height: 500px;
}
</style>