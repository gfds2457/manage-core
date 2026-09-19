<template>
  <el-row>
    <el-col :span=" main.collapse ? 2 : 4 " class="menu">
      <logo />
      <el-scrollbar>
        <el-input placeholder="Search" prefix-icon="Search">
          <template #suffix>
            <el-icon>
              <svg-icon name="edit" />
            </el-icon>
          </template>
        </el-input>
        <h6>MAIN</h6>
        <!-- 左侧菜单 -->
        <!-- collapse为true时，el-menu会把所有非图标文本都隐藏，如果图标在#title中，他会被当成文字一起隐藏 -->
        <el-menu
          ref=" menuRef "
          :class=" { 'is-fold': main.collapse } "
          :default-active=" activeMenu "
          :default-openeds=" openedMenus "
          @open=" handleMenuOpen "
          @close=" handleMenuClose "
        >
          <!-- :collapse="true" -->
          <!-- 1.把路由数据存到pinia中，方便全局取用 -->
          <!-- 2.将路由数据引入，传给子组件（？） -->
          <!-- 3.创建menu组件，单独编写 -->
          <Menu :menuList=" routes " />
        </el-menu>
        <!-- <p v-for="item in 70" :key="item" class="scrollbar-demo-item">
          {{ item }}
        </p> -->
      </el-scrollbar>
      <!-- 注意element-plus组件最外层的标签结构也要加上 -->
    </el-col>
    <el-col :span=" main.collapse ? 22 : 20 " class="main-content">
      <div class="nav">
        <!-- 顶部导航栏 -->
        <Nav />
      </div>
      <div class="container">
        <!-- 路由展示区 -->
        <Main />
      </div>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import logo from "@/views/home/logo/page-logo.vue";
import Menu from "./menu/menu.vue";
import menuList from "@/store/modules/route.ts";
import Nav from "./nav/index.vue";
import Main from "./main/index.vue";
import mainData from "@/store/modules/home-main.ts";
import { storeToRefs } from "pinia";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
const menuStore = menuList();
const { routes } = storeToRefs( menuStore );
const main = mainData();
const route = useRoute();

// 当前高亮的菜单项：菜单里的 index 就是完整路由 path，直接跟着路由走，
// 首页快捷入口 / 编程式跳转 / 浏览器前进后退都能正确高亮
const activeMenu = computed( () => route.path );

// 已展开的一级菜单。default-openeds 只在菜单初始化时读一次，
// 所以它只负责「首次进入」的展开，路由变化后的展开见下面显式调用 open
const openedMenus = ref<string[]>( [] );
const menuRef = ref<{ open: ( index: string ) => void } | null>( null );

/**
 * 菜单项里参与判断的字段：仓库里的 routes 是路由表，这里只用得到路径、隐藏标记与子项
 */
interface MenuRouteItem
{
  path: string;
  meta?: { hide?: boolean };
  children?: MenuRouteItem[];
}

/**
 * 找出路由所属的一级菜单。
 * 一级命中用前缀匹配（/goods/spu → /goods），
 * 无子路由的顶层项（/kb/manage）自身即是一级，原样返回。
 * @param path 当前路由 path
 * @returns 命中的一级菜单项，未命中时返回 undefined
 */
const findTopMenu = ( path: string ): MenuRouteItem | undefined =>
{
  const list = ( routes.value || [] ) as MenuRouteItem[];
  return list.find( ( item ) =>
  {
    if ( item.meta?.hide ) return false;
    if ( item.path === path ) return true;
    return path.startsWith( `${ item.path }/` );
  } );
};

/**
 * 跟随路由自动展开所属一级菜单，避免跳转后菜单仍是收起的、看不出自己在哪里。
 * 快捷入口跳转、浏览器前进后退都会走到这里。
 * @param path 当前路由 path
 */
const syncOpenedMenus = async ( path: string ): Promise<void> =>
{
  const top = findTopMenu( path );
  if ( !top ) return;

  // 只有「子项超过一个」的一级菜单在界面上是 el-sub-menu，
  // 单子项的会折叠成普通菜单项，没有可展开的分组
  const isSubMenu = Array.isArray( top.children ) && top.children.length > 1;
  if ( !isSubMenu ) return;

  if ( !openedMenus.value.includes( top.path ) )
  {
    openedMenus.value = [ ...openedMenus.value, top.path ];
  }

  // 等一帧再调：动态路由新增的菜单项可能还没注册到菜单实例里，
  // 此时 open() 取不到对应的 sub-menu 会直接抛错
  await nextTick();
  try
  {
    menuRef.value?.open( top.path );
  } catch ( err )
  {
    // 展开失败不影响路由跳转本身，菜单项仍然会正常高亮
    console.warn( "[菜单] 自动展开失败：", err );
  }
};

watch( () => route.path, syncOpenedMenus, { immediate: true } );

// 用户手动展开 / 收起时同步回本地状态，否则下次赋值会把用户的选择覆盖掉
const handleMenuOpen = ( index: string ) =>
{
  if ( openedMenus.value.includes( index ) ) return;
  openedMenus.value = [ ...openedMenus.value, index ];
};

const handleMenuClose = ( index: string ) =>
{
  openedMenus.value = openedMenus.value.filter( ( item ) => item !== index );
};
</script>

<style lang="scss" scoped>
.menu {
  height: 100vh;
  background-color: #fff;

  .el-scrollbar {
    height: calc(100vh - $nav-height);
    background-color: #fff(150, 134, 114);
    padding: 15px;

    h6 {
      margin: 15px 0 0 5px;
      color: $h6;
    }

    .el-menu {
      border-right: none;

      &.is-fold {
        font-size: 0px;
      }
    }
  }
}

.main-content {
  height: 100vh;

  .nav {
    height: $nav-height;
    background-color: #fff;
  }

  .container {
    height: calc(100vh - $nav-height);
    margin: $container-margin;
  }
}
</style>
