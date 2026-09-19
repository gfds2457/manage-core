<template>
  <div>
    <el-card>
      <el-form>
        <el-form-item label="一级分类">
          <el-select
            v-model="getCategory.C1Id"
            @change="getC2"
            :disabled="fatherData.flag == 0 ? false : true"
          >
            <!-- 选中哪个option就会自动把对应的value赋值给getCategory.C1Id -->
            <!-- v-model可以实现对应数据在页面上和在仓库中的改动都响应式生效 -->
            <!-- v-model根据拿到的value来渲染自己 -->
            <el-option
              v-for="item in getCategory.C1Arr"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="二级分类">
          <el-select
            v-model="getCategory.C2Id"
            @change="getC3"
            :disabled="fatherData.flag == 0 ? false : true"
          >
            <el-option
              v-for="item in getCategory.C2Arr"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="三级分类">
          <el-select
            v-model="getCategory.C3Id"
            :disabled="fatherData.flag == 0 ? false : true"
          >
            <el-option
              v-for="item in getCategory.C3Arr"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import category from "@/store/modules/category";
// 接收父组件传来的数据
const fatherData = defineProps(["flag"]);
// 引入categorie仓库数据
const getCategory = category();
// 封装一级商品信息请求
const getC1 = () => {
  getCategory.getC1();
};
// 封装二级商品信息请求
const getC2 = () => {
  // 在二级分类赋值之前先清空相关输入框
  getCategory.C2Id = "";
  getCategory.C3Id = "";
  getCategory.C3Arr = [];
  getCategory.getC2(getCategory.C1Id);
};
// 获取三级商品信息请求
const getC3 = () => {
  // 请求前先清空输入框
  getCategory.C3Id = "";
  getCategory.C3Arr = [];
  getCategory.getC3(getCategory.C2Id);
};
// 页面挂载时发出一级商品信息请求
onMounted(() => {
  getC1();
});
</script>

<style lang="scss" scoped>
.el-form {
  display: flex;
  .el-form-item {
    flex: 1;
    margin: 5px 15px;
  }
  .el-form-item:nth-child(3) {
    margin-right: 130px;
  }
}
</style>
