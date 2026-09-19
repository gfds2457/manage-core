<template>
  <div>
    <svg :color="color" :width="width" :height="height">
      <use :href="prefig + name"></use>
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps({
  prefig: {
    type: String, //ts里类型声明都要大写开头
    default: "#icon-",
  }, //给prefig配置类型和默认值
  name: String,
  color: {
    type: String,
    default: "",
  },
  width: {
    type: String,
    default: "16px",
  },
  height: {
    type: String,
    default: "16px",
  },
});
</script>

<style scoped></style>
