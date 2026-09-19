<template>
  <div class="main">
    <router-view v-slot=" { Component } ">
      <transition name="fade">
        <component :is=" Component " />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<style lang="scss" scoped>
/* 淡入淡出动画 */
.fade-enter-from {
  opacity: 0;
  /* 动画开始/结束时，透明度为0 */
  transform: scale(0);
}

.fade-enter-active {
  transition: all 0.3s ease;
  /* 过渡的时长和曲线 */
}

.fade-enter-to {
  opacity: 1;
  /* 动画结束/开始时，透明度为1 */
  transform: scale(1);
}
</style>
