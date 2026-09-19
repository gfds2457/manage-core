# admin-front 页面架构与功能分析

> 范围：`src/views` 下所有页面 + `src/router/routes.ts` 路由配置
> 视角：高级前端架构师视角，按"功能 → 串联 → 问题 → 大白话"四层展开

---

## 一、整体地图（一图看懂）

```
admin-front
├── 常量路由 constantRoutes（任何人都能访问）
│   ├── /            → home/index.vue        首页外壳（左菜单+顶导航+内容区）
│   ├── /login       → components/login       登录页（不在 views 内）
│   ├── /screen      → data-screen/index.vue  数据大屏（独立全屏页）
│   └── /ai-dialog/chat → ai-chat/index.vue   AI 对话（套了 home 外壳）
│
└── 动态路由 asyncRoutes（登录后按权限注入）
    ├── /permission（权限管理）
    │   ├── /permission/user  → permission/user/index.vue   用户管理
    │   ├── /permission/role  → permission/role/index.vue   角色管理
    │   └── /permission/menu  → permission/menu/index.vue   菜单管理
    │
    └── /goods（商品管理）
        ├── /goods/brand → goods/brand/index.vue  品牌管理
        ├── /goods/attr  → goods/attr/index.vue   属性管理
        ├── /goods/spu   → goods/spu/index.vue    SPU 管理
        │   ├── spuForm.vue（新增/编辑 SPU）
        │   └── skuForm.vue（在 SPU 下新增 SKU）
        └── /goods/sku   → goods/sku/index.vue    SKU 管理
```

**核心设计**：`home/index.vue` 是个"外壳"，所有业务页都套在它里面（左菜单 + 顶导航 + `<router-view>`）。只有 `/login` 和 `/screen` 是独立全屏页。

---

## 二、各页面功能详解

### 1. home —— 全站外壳

| 子组件 | 文件                                                                                | 作用                                                               |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| logo   | [page-logo.vue](file:///d:/manageCode/admin-front/src/views/home/logo/page-logo.vue) | 左上角 LOGO，折叠时隐藏                                            |
| menu   | [menu.vue](file:///d:/manageCode/admin-front/src/views/home/menu/menu.vue)           | 左侧菜单，递归渲染路由树                                           |
| nav    | [nav/index.vue](file:///d:/manageCode/admin-front/src/views/home/nav/index.vue)      | 顶部导航：折叠按钮、面包屑、刷新、全屏、暗黑模式、主题色、退出登录 |
| main   | [main/index.vue](file:///d:/manageCode/admin-front/src/views/home/main/index.vue)    | 内容区`<router-view>`，带淡入动画                                |

**nav 的关键功能**：

- **刷新**：通过 pinia 的 `flag` 控制 main 组件卸载→重挂（`nextTick` 切换）
- **暗黑模式**：`document.documentElement.className = 'dark'`
- **主题色**：写 `--el-color-primary` CSS 变量 + 存 localStorage
- **退出登录**：清 user store → 跳 `/login?redirect=当前路径`

**menu 的递归逻辑**：

- 没子节点 → `el-menu-item`
- 只有 1 个子节点 → 直接渲染那个子节点（扁平化）
- 多个子节点 → `el-sub-menu` + 递归调用自己
- `meta.hide=true` 的不显示（但子节点仍渲染，用于 `/ai-dialog` 这类父级隐藏的情况）

---

### 2. data-screen —— 数据大屏（独立全屏）

[index.vue](file:///d:/manageCode/admin-front/src/views/data-screen/index.vue) 是个 1920×1080 的固定画布，通过 `transform: scale()` 自适应屏幕。

| 子组件     | 作用                                    |
| ---------- | --------------------------------------- |
| tourist    | 实时游客数（水球图 echarts-liquidfill） |
| girls-boys | 男女比例                                |
| age        | 年龄分布                                |
| map        | 中国地图（echarts + china.json）        |
| trend      | 趋势图                                  |
| scenic     | 景点数据                                |
| year       | 年份数据                                |
| reserve    | 预约数据                                |

**特点**：所有数据基本是**写死的假数据**（如 tourist 里 "2159088" 是硬编码），主要做视觉展示。

---

### 3. 商品管理（核心业务，4 个页面互相联动）

#### 3.1 brand 品牌管理 [index.vue](file:///d:/manageCode/admin-front/src/views/goods/brand/index.vue)

- 列表 + 分页 + 添加/编辑弹窗
- LOGO 上传（el-upload，地址从 `VITE_API_BASE_URL` 拼接）
- 表单校验：品牌名 ≥2 字、必须传图
- **回收站**：软删除 30 天可恢复（自己实现，未用通用 composable）
- 删除时间、剩余天数、恢复按钮

#### 3.2 attr 属性管理 [index.vue](file:///d:/manageCode/admin-front/src/views/goods/attr/index.vue)

- 依赖**三级分类**（`Category` 组件 + `category` store）
- 列表展示属性名 + 属性值（tag 形式）
- 添加/编辑用**卡片切换**（`flag==0` 列表 / `flag==1` 表单）
- 属性值编辑：点击文字变输入框，`v-focus` 自动聚焦
- 空值校验、重复校验
- **回收站**：用了通用 `useRecycleBin` composable

#### 3.3 spu SPU 管理 [index.vue](file:///d:/manageCode/admin-front/src/views/goods/spu/index.vue)

这是商品管理最复杂的页面，通过 `spuFormFlag` 切换三张卡片：

- `0` → SPU 列表
- `1` → [spuForm.vue](file:///d:/manageCode/admin-front/src/views/goods/spu/spuForm.vue)（新增/编辑 SPU）
- `2` → [skuForm.vue](file:///d:/manageCode/admin-front/src/views/goods/spu/skuForm.vue)（在 SPU 下加 SKU）

**spuForm 的功能**：

- SPU 名称、品牌选择、描述
- 图片上传（picture-card 模式，多图）
- 销售属性管理：从 16 个预定义属性里选，添加属性值（tag + 输入框切换）
- 属性值空值/重复校验
- 编辑时有 `attrCache` 缓存 + `requestVersion` 防抖（防止快速切换导致旧请求覆盖新状态）

**skuForm 的功能**：

- SKU 名称、价格、重量、描述
- 平台属性多选
- 图片表格选默认图
- 保存时把 `attrId:valueId` 字符串拆成对象

#### 3.4 sku SKU 管理 [index.vue](file:///d:/manageCode/admin-front/src/views/goods/sku/index.vue)

- 列表 + 分页
- 上下架切换（`isSale` 1/0）
- 查看详情（抽屉 + 走马灯图片 + descriptions）
- **回收站**（通用 composable）
- 编辑按钮**没接功能**（空按钮）

---

### 4. 权限管理（RBAC 三件套）

#### 4.1 user 用户管理 [index.vue](file:///d:/manageCode/admin-front/src/views/permission/user/index.vue)

- 列表 + 搜索 + 分页 + 批量删除
- 添加/编辑用户（抽屉，用户名 3-10、昵称 2-10、密码 6-12 校验）
- **分配角色**：复选框组（全选/半选/取消三态）
- 编辑自己 → 自动登出重新登录

#### 4.2 role 角色管理 [index.vue](file:///d:/manageCode/admin-front/src/views/permission/role/index.vue)

- 列表 + 搜索 + 分页
- 添加/编辑角色（弹窗）
- **分配权限**：`el-tree-v2` 树形权限，递归 `filterCheckedKeys` 找出已选叶子节点

#### 4.3 menu 菜单管理 [index.vue](file:///d:/manageCode/admin-front/src/views/permission/menu/index.vue)

- 树形表格（`row-key="id"`）
- 添加菜单/权限（type=1 菜单，type=2 权限）
- 编辑/删除对 type=1 禁用（只能改权限，不能改菜单）

---

### 5. AI 对话 ai-chat [index.vue](file:///d:/manageCode/admin-front/src/views/ai-chat/index.vue)

最复杂的单页面（1071 行），仿 ChatGPT 界面。

| 功能          | 说明                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| 模型切换      | qwen3.7-plus / qwen-image-3.0                                                                                |
| 历史对话      | [chatHistory.vue](file:///d:/manageCode/admin-front/src/views/ai-chat/chatHistory.vue) 抽屉，点击加载某条历史 |
| 流式对话      | `fetchChatStream` SSE 长连接，边收边渲染                                                                   |
| 图片上传      | `uploadImg` 先传图拿 base64，再随消息发送                                                                  |
| Markdown 渲染 | `@crazydos/vue-markdown` + remark-gfm + rehype-highlight                                                   |
| 思考中提示    | `thinkDialog` 控制加载态                                                                                   |
| 品牌卡片      | [brandCard.vue](file:///d:/manageCode/admin-front/src/views/ai-chat/brandCard.vue)（占位，没真正实现）        |
| 用户特点      | `getUserFeature` 取用户画像注入对话                                                                        |

**消息流**：用户输入 → 创建对话拿 `chatId` → SSE 流式接收 → 区分文字/图片/工具卡片三种返回 → 长连接关闭后取标题。

---

## 三、页面串联关系（数据怎么流）

### 串 1：登录 → 菜单 → 业务页

```
/login 输入 admin/123456
  → user store 存 token + 用户信息
  → route store 根据 token 拉动态路由 asyncRoutes
  → home/index.vue 的 menu 递归渲染路由
  → 点击菜单项 → router.push → main 区显示对应业务页
```

### 串 2：商品管理四级联动

```
三级分类 Category 组件（category store 存 C1Id/C2Id/C3Id）
  ↓ C3Id 变化
attr 页面 watch C3Id → 拉属性列表
spu 页面 watch C3Id → 拉 SPU 列表（按分类过滤）
  ↓ 点击"加号"在某 SPU 下加 SKU
skuForm.vue 接收 spuData → 拉 SPU 属性 + 图片 → 选默认图 → 保存 SKU
  ↓ SKU 出现在
sku 列表页（独立管理上下架、回收站）
```

**关键点**：attr 和 spu 都依赖 `category` store 的 C3Id，**离开页面时必须 `$reset` 清空**（onBeforeUnmount），否则下次进来 C3Id 还是旧的。

### 串 3：权限 RBAC 闭环

```
menu 页 → 维护菜单/权限树（type=1 菜单，type=2 权限）
role 页 → el-tree-v2 给角色勾选权限（updatePermission）
user 页 → checkbox 给用户分配角色（reUpdateUserRole）
  ↓ 最终决定
登录时 route store 根据 user.role 过滤 asyncRoutes → 决定菜单显示哪些
  ↓ 按钮级
v-hasBtn="'goods:brand:add'" 指令按权限字符串控制按钮显隐
```

### 串 4：回收站通用逻辑

`useRecycleBin` composable 被 attr / spu / sku 三个页面复用，brand 自己写了一套（**没复用**，是个不一致点）。

提供：`openRecycleBin` / `restoreItem` / `formatTime` / `remainDays` / `syncIfOpen` 等。

---

## 四、问题清单（按严重程度）

### 🔴 严重问题

1. **AI 对话用户 ID 写死 "001"**
   [ai-chat/index.vue](file:///d:/manageCode/admin-front/src/views/ai-chat/index.vue) 里 `createChat("001")`、`getTitle("001", ...)`、`getUserFeature("001")` 全是硬编码，多用户场景下所有人共用一个对话历史。
2. **SKU 编辑按钮是空的**
   [sku/index.vue](file:///d:/manageCode/admin-front/src/views/goods/sku/index.vue) 的编辑按钮（type="primary" icon="Edit"）没绑 `@click`，点不动。
3. **SKU 价格/重量无数值校验**
   [skuForm.vue](file:///d:/manageCode/admin-front/src/views/goods/spu/skuForm.vue) 的 price/weight 用 `el-input` 直接 v-model，能填负数、字母（违反 `request.md` 第 5 条"价格、库存不能填写负数"）。
4. **data-screen 全是假数据**
   tourist 的"2159088"、可预约总量"999999"都是写死的，没接任何接口。

### 🟡 一致性/架构问题

5. **brand 没用 useRecycleBin composable**
   [brand/index.vue](file:///d:/manageCode/admin-front/src/views/goods/brand/index.vue) 自己写了 `fetchDeletedBrandList` / `restoreBrand` / `formatTime` / `remainDays`，跟 attr/spu/sku 的通用逻辑重复，后续维护要改两处。
6. **spuForm 的 attrCache 内存泄漏**
   [spuForm.vue](file:///d:/manageCode/admin-front/src/views/goods/spu/spuForm.vue) 的 `attrCache` 按 SPU id 缓存，组件不卸载就一直累积，长期编辑多个 SPU 会内存增长。
7. **nav 的 color 初始化时机**
   [nav/index.vue](file:///d:/manageCode/admin-front/src/views/home/nav/index.vue) 只在 `onMounted` 读 localStorage 颜色，但 `changeColor` 写的是 `--el-color-primary`，刷新后暗黑模式 className 丢失（只存了颜色没存主题）。
8. **menu 编辑逻辑有坑**
   [menu/index.vue](file:///d:/manageCode/admin-front/src/views/permission/menu/index.vue) 的 `addMenu` 用 `row.pid` 当新节点的父 id，但 `editMenu` 直接 `Object.assign(menuForm, row)`，会把 `pid` 也带进去，保存时可能错乱。

### 🟢 小问题

9. **role 页面分页器有语法残留**
   [role/index.vue](file:///d:/manageCode/admin-front/src/views/permission/role/index.vue) 的 `el-pagination` 上有 `pageSize4 "` 这样的乱码（多余的引号和字符）。
10. **role 重置按钮没接功能**
    [role/index.vue](file:///d:/manageCode/admin-front/src/views/permission/role/index.vue) 的"重置"按钮（`<el-button ">重置</el-button>`）连 `@click` 都没绑，还有多余的 `"` 引号。
11. **user 页面的 refresh 函数引用了 mainData().flag**
    [user/index.vue](file:///d:/manageCode/admin-front/src/views/permission/user/index.vue) 的 `refreshFlag = mainData().flag` 是值类型赋值，改 `refreshFlag` 不会影响 store，刷新功能实际无效。
12. **brandCard 是空壳**
    [brandCard.vue](file:///d:/manageCode/admin-front/src/views/ai-chat/brandCard.vue) 只有一句"我是一个华为卡牌"和一个空 select 函数，AI 返回 tool 消息时渲染它没实际意义。
13. **chatHistory 的新建对话按钮没绑事件**
    [chatHistory.vue](file:///d:/manageCode/admin-front/src/views/ai-chat/chatHistory.vue) 底部"新建对话"按钮无 `@click`。
14. **大量 console.log 拾遗**
    几乎每个页面都有 `console.log(res)`、`console.log(row)` 调试日志，上线前应清理。
15. **nav 里 `import 'element-plus/.../dark/css-vars.css'`**
    在组件内 import 全局样式，按需引入场景下应放到入口 main.ts。
