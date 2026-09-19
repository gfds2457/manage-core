<template>
  <RouterView></RouterView>
</template>

<script setup lang="ts">
// 引入useDark
import { useDark } from '@vueuse/core'
// 自动控制<html class="dark">，自动存localStorage刷新不丢失
const isDark = useDark()
// 此处曾有一个调试用的 request.get("/user")：
// 该接口在 mock 后端并不存在，每次进入网站都会 404 并弹出一次红色错误提示，
// 且它的返回值只被 console.log 消费，删除后不影响任何业务逻辑
</script>
<style lang="scss" scoped></style>
