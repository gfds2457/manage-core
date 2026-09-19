<template>
  <div>
    <template v-for="item in props.menuList" :key="item.path">
      <el-menu-item
        v-if="!item.children && !item.meta.hide"
        :index="getFullPath(item.path)"
        @click="toRoute"
        :class="{ 'is-fold': main.collapse }"
      >
        <template #title>
          <el-icon>
            <component :is="item.meta.icon"></component>
          </el-icon>
          <p>{{ item.meta.title }}</p>
        </template>
      </el-menu-item>
      <el-menu-item
        v-if="item.children && item.children.length == 1"
        :index="getFullPath(item.children[0].path)"
        @click="toRoute"
        :class="{ 'is-fold': main.collapse }"
      >
        <template #title>
          <el-icon>
            <component :is="item.meta.icon"></component>
          </el-icon>
          <p>{{ item.children[0].meta.title }}</p>
        </template>
      </el-menu-item>
      <el-sub-menu
        :index="item.path"
        v-if="item.children && item.children.length > 1 && !item.meta.hide"
        :default-active="data.path"
      >
        <template #title>
          <el-icon>
            <component :is="item.meta.icon"></component>
          </el-icon>
          <p v-if="!main.collapse">{{ item.meta.title }}</p>
        </template>
        <MyMenu :menuList="item.children" :parentPath="item.path" />
      </el-sub-menu>
      <template
        v-if="item.children && item.children.length > 1 && item.meta.hide"
      >
        <MyMenu :menuList="item.children" :parentPath="item.path" />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "MyMenu" });
import { useRouter, useRoute } from "vue-router";
import type { MenuItemClicked } from "element-plus";
import mainData from "@/store/modules/home-main.ts";
const props = defineProps(["menuList", "parentPath"]);
const router = useRouter();
const data = useRoute();
const main = mainData();
const getFullPath = (path: string): string => {
  if (path.startsWith("/")) {
    return path;
  }
  return props.parentPath ? `${props.parentPath}/${path}` : `/${path}`;
};
function toRoute(e: MenuItemClicked) {
  router.push(e.index);
}
</script>

<style lang="scss" scoped>
.el-menu-item {
  border-radius: 8px;
  &.is-fold {
    font-size: 0px;
  }
}
/* 选中状态的菜单项背景 */
.el-menu-item:hover {
  background: linear-gradient(
    90deg,
    rgba(230, 230, 255, 0.3),
    /* 左侧浅紫粉 */ rgba(173, 216, 255, 0.6),
    /* 中间浅天蓝 */ rgba(255, 220, 255, 0.4) /* 右侧浅粉紫 */
  );
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

/* 可选：模拟截图里的细碎星光效果（可选加） */
.el-menu-item:hover::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.8) 1px,
    transparent 1px
  );
  background-size: 15px 15px;
  opacity: 0.7;
  pointer-events: none;
}
</style>
