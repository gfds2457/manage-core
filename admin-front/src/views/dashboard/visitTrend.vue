<template>
  <div ref="chartRef" class="visit-chart"></div>
</template>

<script setup lang="ts">
defineOptions({
  name: "VisitTrendChart",
});
import * as echarts from "echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { VisitTrendPoint } from "@/API/dashboard";

const props = defineProps<{ points: VisitTrendPoint[] }>();
const chartRef = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;

const handleResize = () => {
  chart?.resize();
};

const render = () => {
  if (!chart) return;
  chart.setOption({
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: props.points.map((item) => item.date),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#dcdfe6" } },
      axisLabel: { color: "#909399", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f0f2f5" } },
      axisLabel: { color: "#909399", fontSize: 11 },
    },
    series: [
      {
        type: "line",
        name: "访问量",
        smooth: true,
        symbol: "none",
        data: props.points.map((item) => item.count),
        lineStyle: { color: "#409eff", width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64, 158, 255, 0.35)" },
            { offset: 1, color: "rgba(64, 158, 255, 0.02)" },
          ]),
        },
      },
    ],
  });
};

onMounted(() => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value);
  render();
  window.addEventListener("resize", handleResize);
});

// 数据是同步生成的，首次渲染时可能还没赋值，这里跟着 props 更新
watch(() => props.points, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped lang="scss">
.visit-chart {
  width: 100%;
  height: 236px;
}
</style>
