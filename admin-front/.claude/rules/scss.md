---
paths:
  - "src/**/*.scss"
  - "src/**/*.sass"
---
# SCSS 编写规范

## 1、变量
1. 颜色、字号、间距、圆角统一使用scss变量，不要写死魔法值。
```scss
// ✅推荐
$color-primary:#409eff;
$font‑size‑base:14px;
$gap‑sm:8px;
.color{
  color:$color‑primary;
}
2、嵌套规则

1. 嵌套层级最多3层，禁止无限嵌套。

2. 伪类、伪元素使用&:；不要无意义嵌套。
// ✅
.card{
  padding:16px;
  &:hover{
    box-shadow:0 2px 8px rgba(0,0,0,0.12);
  }
}

// ❌禁止
.a{
  .b{
    .c{
      .d{} //层级太深
    }
  }
}
3、mixin混入

1. 重复样式抽成@mixin，不要复制粘贴大段css。

2. mixin命名语义化。
@mixin flex‑center{
  display:flex;
  justify‑content:center;
  align‑items:center;
}
4、@import导入

1. scss局部文件以下划线_开头，导入时不要写下划线与后缀。
// _variables.scss
@import "./variables";
5、选择器

1. 尽量使用class，少用标签选择器、id选择器。

2. 命名使用 kebab‑case短横线命名：header‑title，禁止驼峰。

6、注释

• 复杂样式写注释；变量、mixin上方增加说明。

7、禁止

1. 禁止写!important，除非特殊兼容场景。

2. 不要写行内样式，不要直接覆盖第三方组件内部样式。

3. 尽量避免*全局通配。

输出要求

修改scss文件时：

1. 尽量复用已有变量、mixin，不要新增重复变量。

2. 改动后尽量不要产生冗余css。

3. 如果新增变量，放到对应variables文件。
直接保存为 `scss.md`，放到 `.claude/rules/` 文件夹即可。
yaml里paths已经配置，**src下所有scss/sass文件会触发这份规则生效**。
