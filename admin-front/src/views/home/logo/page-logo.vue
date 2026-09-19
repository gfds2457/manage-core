<template>
  <div v-if="!main.collapse">
    <img :src="img" v-if="isShow" />
    <p>{{ logo.title }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import img from "@/assets/images/logo.jpg";
import { logo } from "@/setting/logo";
import mainData from "@/store/modules/home-main";
let isShow = ref(true);
const main = mainData();
</script>

<style lang="scss" scoped>
div {
  display: flex;
  margin-top: 10px;
  margin-left: 10px;
}
img {
  width: $logo-width;
  border-radius: 50%;
}
@media (max-width: 1000px) {
  img {
    display: none;
  }
}
p {
  line-height: $logo-width;
  font-size: $logo-title-fontsize;
  font-weight: $logo-title-fontweight;
  margin-left: 5px;
}
</style>
