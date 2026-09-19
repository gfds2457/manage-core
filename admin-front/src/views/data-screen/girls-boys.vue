<template>
  <div class="proportion-module">
    <div class="module-header">
      <div class="header-title">
        <span class="title-text">男女比例</span>
        <div class="title-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>
    <div class="module-content">
      <div class="person">
        <div class="gender-item male">
          <div class="gender-label">男士</div>
          <div class="gender-icon">
            <img src="@/assets/dataScreen/boy.png" alt="男士" />
          </div>
          <span class="gender-text">男士 {{ GENDER_RATIO.male }}%</span>
        </div>
        <div class="gender-item female">
          <div class="gender-label">女士</div>
          <div class="gender-icon">
            <img src="@/assets/dataScreen/girl.png" alt="女士" />
          </div>
          <span class="gender-text">女士 {{ GENDER_RATIO.female }}%</span>
        </div>
      </div>
      <div class="chart-container">
        <div ref="charts" class="charts-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as echarts from 'echarts';
import 'echarts-liquidfill'
// 大屏数据统一来源，当前为演示数据
import { GENDER_RATIO } from './screen-data';
const charts = ref<HTMLElement | null>( null );
// 初始化图表函数
const initChart = () =>
{
  if ( !charts.value ) return;
  // 初始化图表
  const chart = echarts.init( charts.value );
  // 配置图表
  chart.setOption( {
    tooltip: {
      show: true,
      trigger: 'axis',
      axisPointer: {
        type: 'line',
      },
    },
    grid: {
      top: 5,
      bottom: 5,
      left: 5,
      right: 5,
    },
    xAxis: {
      show: false,
      min: 0,
      max: 100,
    },
    yAxis: {
      show: false,
      type: 'category',
      data: [ '比例' ],
    },
    series: [ {
      type: 'bar',
      barWidth: 16,
      stack: 'total',
      itemStyle: {
        borderRadius: [ 8, 0, 0, 8 ],
      },
      data: [ {
        value: GENDER_RATIO.male,
        itemStyle: {
          color: '#00C6FF',
        },
      } ],
    }, {
      type: 'bar',
      barWidth: 16,
      stack: 'total',
      itemStyle: {
        borderRadius: [ 0, 8, 8, 0 ],
      },
      data: [ {
        value: GENDER_RATIO.female,
        itemStyle: {
          color: '#FF6B8A',
        },
      } ],
    } ],
  } );
}
onMounted( () =>
{
  initChart();
} );
</script>


<style scoped lang="scss">
.proportion-module {
  width: 80%;
  height: 260px;
  margin-top: 20px;
  background: linear-gradient(135deg, rgba(0, 50, 120, 0.8) 0%, rgba(0, 30, 80, 0.9) 100%);
  border: 1px solid rgba(0, 122, 255, 0.5);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  z-index: 10;
}

.proportion-module::before {
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
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 15px 20px;
  height: calc(100% - 50px);
  gap: 10px;

  .person {
    display: flex;
    gap: 100px;
  }
}

.gender-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  &.male .gender-label {
    margin-bottom: 8px;
    background: linear-gradient(180deg, rgba(0, 122, 255, 0.6) 0%, rgba(0, 80, 200, 0.4) 100%);
    border-color: rgba(0, 122, 255, 0.6);
    color: #00C6FF;
  }

  &.male .gender-icon {
    filter: hue-rotate(0deg) saturate(1.5);
  }

  &.male .gender-text {
    color: #00C6FF;
  }

  &.female .gender-label {
    margin-bottom: 8px;
    background: linear-gradient(180deg, rgba(255, 80, 120, 0.6) 0%, rgba(200, 50, 100, 0.4) 100%);
    border-color: rgba(255, 80, 120, 0.6);
    color: #FF6B8A;
  }

  &.female .gender-icon {
    filter: hue-rotate(320deg) saturate(2);
  }

  &.female .gender-text {
    color: #FF6B8A;
  }
}

.gender-label {
  padding: 4px 16px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 14px;
  font-weight: bold;
}

.gender-icon {
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.gender-text {
  font-size: 14px;
  font-weight: 500;
}

.module-footer {
  padding: 10px 15px;
}

.progress-bar {
  display: flex;
  height: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.chart-container {
  width: 100%;
  height: 50px;
}

.charts-container {
  width: 100%;
  height: 100%;
}
</style>