/**
 * 权限码常量表。后端鉴权与前端按钮显隐共用同一套码，这里是后端的定义处。
 *
 * 命名沿用项目已有的三段式「资源:动作」，动作收口为 write / audit 两种：
 *   - 同一资源下的增删改统一归到一个 write 码，不再细分 add/update/delete。
 *     细分会让角色矩阵迅速膨胀，而业务上「能改品牌的人」必然也能新增品牌，
 *     拆开只会制造两套含义重叠的码。
 *   - audit 单独成码：审核是独立岗位职责，运营有、产品没有，不能混进 write。
 *
 * ⚠️ 本表必须与前端 admin-front/src/utils/permission.ts 的 PERM 逐字一致。
 * 前端 v-hasBtn 用这些码控制按钮显隐、后端矩阵用它们判准入，两边对不上就会出现
 * 「按钮看得见但一点就 403」或「按钮被隐藏但接口照样能调」这类难查的问题。
 */
export const PERM = {
  GOODS_BRAND_WRITE: "goods:brand:write",
  GOODS_ATTR_WRITE: "goods:attr:write",
  GOODS_SPU_WRITE: "goods:spu:write",
  GOODS_SKU_WRITE: "goods:sku:write",
  GOODS_REVIEW_AUDIT: "goods:review:audit",
  PERMISSION_USER_WRITE: "permission:user:write",
  PERMISSION_ROLE_WRITE: "permission:role:write",
  PERMISSION_MENU_WRITE: "permission:menu:write",
} as const;

export type PermissionCode = ( typeof PERM )[ keyof typeof PERM ];

/** 通配权限码：持有它即拥有一切。超级管理员专用 */
export const WILDCARD = "*";
