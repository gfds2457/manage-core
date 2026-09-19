// 常量路由
export const constantRoutes = [
  {
    name: "Home",
    path: "/",
    // 首页即工作台：布局仍是 views/home/index.vue（顶导 + 侧边菜单），主体内容由子路由渲染
    redirect: "/dashboard",
    children: [
      {
        name: "Dashboard",
        path: "dashboard",
        component: () => import("@/views/dashboard/index.vue"),
        meta: {
          // 只有一个子路由时，侧边菜单会折叠成这一项，标题用「工作台」
          title: "工作台",
          hide: true,
          icon: "HomeFilled",
        },
      },
    ],
    component: () => import("@/views/home/index.vue"),
    meta: {
      title: "首页",
      hide: false,
      icon: "HomeFilled",
    },
  },
  {
    name: "Knowledge",
    path: "/kb/manage",
    component: () => import("@/views/knowledge/index.vue"),
    meta: {
      title: "知识库管理",
      hide: false,
      icon: "Collection",
    },
  },
  {
    name: "login",
    path: "/login",
    component: () => import("@/components/section/login/page-index.vue"),
    meta: {
      hide: true,
    },
  },
  {
    name: "Screen",
    path: "/screen",
    component: () => import("@/views/data-screen/index.vue"),
    meta: {
      title: "数据大屏",
      hide: false,
      icon: "DataAnalysis",
    },
  },
  {
    name: "AiDialog",
    path: "/ai-dialog",
    redirect: "/ai-dialog/chat",
    component: () => import("@/views/home/index.vue"),
    meta: {
      title: "AI助手",
      hide: false,
      icon: "Help",
    },
    children: [
      {
        name: "Chat",
        path: "/ai-dialog/chat",
        component: () => import("@/views/ai-chat/index.vue"),
        meta: {
          title: "AI对话",
          hide: false,
          icon: "ChatLineRound",
        },
      },
    ],
  },
];
// 动态路由
export const asyncRoutes = [
  {
    name: "Permission",
    path: "/permission",
    redirect: "/permission/user",
    component: () => import("@/views/home/index.vue"),
    meta: {
      title: "权限管理",
      hide: false,
      icon: "Lock",
    },
    children: [
      {
        name: "User",
        path: "user",
        component: () => import("@/views/permission/user/index.vue"),
        meta: {
          title: "用户管理",
          hide: false,
          icon: "User",
          roles: ["超级管理员"],
        },
      },
      {
        name: "Role",
        path: "role",
        component: () => import("@/views/permission/role/index.vue"),
        meta: {
          title: "角色管理",
          hide: false,
          icon: "UserFilled",
          roles: ["超级管理员"],
        },
      },
      {
        name: "Menu",
        path: "menu",
        component: () => import("@/views/permission/menu/index.vue"),
        meta: {
          title: "菜单管理",
          hide: false,
          icon: "Menu",
          roles: ["超级管理员"],
        },
      },
    ],
  },
  {
    name: "Goods",
    path: "/goods",
    redirect: "/goods/brand",
    component: () => import("@/views/home/index.vue"),
    meta: {
      title: "商品管理",
      hide: false,
      icon: "GoodsFilled",
    },
    children: [
      {
        name: "Brand",
        path: "brand",
        component: () => import("@/views/goods/brand/index.vue"),
        meta: {
          title: "品牌管理",
          hide: false,
          icon: "Shop",
        },
      },
      {
        name: "Attr",
        path: "attr",
        component: () => import("@/views/goods/attr/index.vue"),
        meta: {
          title: "属性管理",
          hide: false,
          icon: "SetUp",
        },
      },
      {
        name: "Spu",
        path: "spu",
        component: () => import("@/views/goods/spu/index.vue"),
        meta: {
          title: "SPU管理",
          hide: false,
          icon: "Box",
        },
      },
      {
        name: "Sku",
        path: "sku",
        component: () => import("@/views/goods/sku/index.vue"),
        meta: {
          title: "SKU管理",
          hide: false,
          icon: "Grid",
        },
      },
      {
        name: "Review",
        path: "review",
        component: () => import("@/views/goods/review/index.vue"),
        meta: {
          title: "商品审核",
          hide: false,
          icon: "Checked",
          // 只有运营与超级管理员能进。
          // ⚠️ meta.roles 只能配在最底层的叶子路由上：to.meta 是父子链路合并的结果，
          // 配到父级（比如下面的 Goods）会让整个商品管理组对非运营角色一并消失
          roles: ["超级管理员", "运营"],
        },
      },
    ],
  },
];
// 任意路由, 未匹配到的路由时, 跳转到404页面
export const notFoundRoute = {
  name: "NotFound",
  path: "/:pathMatch(.*)*",
  component: () => import("@/components/section/404/page-index.vue"),
  meta: {
    hide: true,
  },
};
