<template>
  <div>
    <!-- 三级分类 -->
    <Category :flag="flag" />
    <!-- spu表格 -->
    <el-card v-show="spuFormFlag == 0" style="margin-top: 5px">
      <!-- 添加SPU按钮 -->
      <el-button
        type="primary"
        icon="Plus"
        style="margin-bottom: 15px"
        v-hasBtn="PERM.GOODS_SPU_WRITE"
        @click="addSpu"
        :disabled="getCategory.C3Id ? false : true"
      >
        添加SPU
      </el-button>
      <!-- 回收站按钮 -->
      <el-button
        type="warning"
        icon="Delete"
        style="margin-bottom: 15px"
        @click="openRecycleBin"
      >
        回收站
      </el-button>
      <el-table style="width: 100%" border :data="spuData">
        <el-table-column label="序号" width="130" type="index" />
        <el-table-column label="SPU名称" prop="spuName" width="380" />
        <el-table-column label="SPU描述" prop="description" width="380" />
        <el-table-column label="SPU操作">
          <template #default="{ row }">
            <el-button
              type="primary"
              icon="Plus"
              style="width: 40px; margin-left: 35px"
              v-hasBtn="PERM.GOODS_SKU_WRITE"
              @click="PlusSku(row)"
            ></el-button>
            <el-button
              type="warning"
              icon="Edit"
              style="width: 40px"
              v-hasBtn="PERM.GOODS_SPU_WRITE"
              @click="editSpu(row)"
            ></el-button>
            <el-button
              type="info"
              icon="Warning"
              style="width: 40px"
              @click="checkSkuInfo(row)"
            ></el-button>
            <el-button
              type="danger"
              icon="Delete"
              style="width: 40px"
              v-hasBtn="PERM.GOODS_SPU_WRITE"
              @click="deleteSpuData(row.id)"
            ></el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[3, 5, 7, 9]"
        background
        layout=" prev, pager, next, jumper, -> , sizes ,total"
        :total="totalPages"
        style="margin-top: 15px"
        @current-change="getSpuAll"
        @size-change="getSpuAll"
      />
    </el-card>
    <!-- spuForm添加卡片 -->
    <spuForm
      v-show="spuFormFlag == 1"
      @changeFlag="changeFlag"
      ref="getSpuAllData"
    />
    <!-- skuForm组件 -->
    <skuForm
      v-show="spuFormFlag == 2"
      ref="getSkuAllData"
      @changeFlag="changeFlag"
    />
    <el-dialog v-model="dialogFlag" title="查看sku信息" width="80%">
      <el-table :data="skuData" border>
        <el-table-column prop="skuName" label="SKU名称" />
        <el-table-column prop="price" label="价格" />
        <el-table-column prop="weight" label="重量" />
        <el-table-column label="SKU图片">
          <template #default="{ row }">
            <el-image
              :src="row.skuDefaultImg"
              fit="cover"
              style="width: 100px; height: 100px"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
    <!-- 回收站弹窗：展示已软删除的SPU，支持恢复 -->
    <el-dialog v-model="recycleBinVisible" title="SPU回收站" width="900">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      >
        已删除SPU将保留 30 天，超过 30 天后将被永久销毁且无法恢复。
      </el-alert>
      <el-table
        :data="deletedSpuList"
        border
        style="width: 100%"
        empty-text="回收站为空"
        v-loading="recycleLoading"
      >
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="spuName" label="SPU名称" min-width="180" />
        <el-table-column prop="description" label="SPU描述" min-width="180" />
        <el-table-column label="删除时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.deleteTime) }}
          </template>
        </el-table-column>
        <el-table-column label="剩余保留天数" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="remainDays(row.deleteTime) <= 7 ? 'danger' : 'info'">
              {{ remainDays(row.deleteTime) }} 天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :loading="restoringId === row.id"
              v-hasBtn="PERM.GOODS_SPU_WRITE"
              @click="restoreItem(row)"
              >恢复</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// 组件命名
defineOptions({
  name: "spuIndex",
});
import { ElMessage } from "element-plus";
import { PERM } from "@/utils/permission";
import { ref, watch, onBeforeUnmount } from "vue";
// 引入spu相关api请求
import {
  getSpuReq,
  getSkuList,
  deleteSpu,
  getDeletedSpuList,
  restoreSpu,
} from "@/API/spu";
// 引入回收站通用逻辑
import { useRecycleBin } from "@/composables/useRecycleBin";
import type { GetSpuParamsInterface } from "@/API/spu/type";
// 引入三级分类数据仓库
import category from "@/store/modules/category";
// 引入spuForm子组件
import spuForm from "./spuForm.vue";
// 引入skuForm子组件、
import skuForm from "./skuForm.vue";
import type {
  SpuRecordsInterface,
  SpuResDataInterface,
  GetSpuResInterface,
  changeFlagInterface,
  SkuDataInterface,
  SpuResInterface,
  DeletedSpuItemInterface,
} from "./type";
const getCategory = category();
// 当前页数
let currentPage = ref<number>(1);
// 每页显示条目个数
let pageSize = ref(5);
// 三级分类禁用开关
let flag = ref(0);
// spu所有属性数据
let spuData = ref<SpuRecordsInterface[]>([]);
// 页码总和
let totalPages = ref(1);
// 各卡片显示开关，0为主表格显示 ，1为spuForm子组件显示，2为skuForm显示
let spuFormFlag = ref(0);
// skuForm子组件显示开关，0为关闭，1为显示
// 得到操纵子组件spuForm暴露元素的ref盒子
let getSpuAllData = ref();
// 得到操纵子组件skuForm暴露元素的ref盒子
let getSkuAllData = ref();
// sku所有数据
let skuData = ref<SkuDataInterface[]>([]);
// dialog显示开关
let dialogFlag = ref(false);
// 方法
// 封装获取spu全部属性请求
const getSpuAll = async () => {
  const params: GetSpuParamsInterface = {
    page: currentPage.value,
    query: {
      category3Id: getCategory.C3Id,
      tmId: "",
      pageSize: pageSize.value,
    },
  };
  // 执行到这行代码发送请求，但是还没请求完，返回一个等待状态的promise对象
  const res: GetSpuResInterface<SpuResDataInterface<SpuRecordsInterface>> =
    await getSpuReq(params);
  if (res.code == 200) {
    spuData.value = res.data.records;
    totalPages.value = res.data.total;
  }
};
// 当C3Id发生变化时发一次获取spu属性请求
watch(
  () => getCategory.C3Id,
  async (c3Id) => {
    if (!c3Id) return;
    getSpuAll();
  },
);
// 得到子组件emit传来的数据，子组件传来数据触发函数
const changeFlag = (data: changeFlagInterface) => {
  spuFormFlag.value = data.flag;
  // 得到update则渲染当前页
  // 得到add渲染第一页
  if (data.params == "add") {
    currentPage.value = 1;
  }
  getSpuAll();
};
// 添加属性按钮
const addSpu = () => {
  spuFormFlag.value = 1;
  getSpuAllData.value.addSpuAttr(getCategory.C3Id);
};
// 编辑按钮
const editSpu = (row: SpuRecordsInterface) => {
  spuFormFlag.value = 1;
  // 调用allSpu函数时，传入对应行数据
  getSpuAllData.value.allSpu(row);
};
// 添加sku加号按钮
const PlusSku = (row: SpuRecordsInterface) => {
  spuFormFlag.value = 2;
  // 调用sku组件方法发请求
  getSkuAllData.value.getSkuData(row);
};
// 查看sku全部数据按钮
const checkSkuInfo = async (row: SpuRecordsInterface) => {
  const res: SpuResInterface<SkuDataInterface[]> = await getSkuList(row.id);
  if (res.code == 200) {
    skuData.value = res.data!;
    dialogFlag.value = true;
  }
};
// 回收站：把通用的拉取列表、恢复、剩余天数计算等方法按需接入
const {
  recycleBinVisible,
  deletedList: deletedSpuList,
  recycleLoading,
  restoringId,
  isSuccess,
  getMessage,
  openRecycleBin,
  restoreItem,
  syncIfOpen,
  formatTime,
  remainDays,
} = useRecycleBin<DeletedSpuItemInterface>({
  fetchList: getDeletedSpuList,
  restore: (row) => restoreSpu(row.id),
  // spu的id为可选值，这里兜底成空串保证 key 唯一
  rowKey: (row) => row.id ?? "",
  onRestored: getSpuAll,
});
// 删除spu按钮（软删除，30天内可在回收站恢复）
const deleteSpuData = async (spuId: number | undefined) => {
  const res: SpuResInterface<null> = await deleteSpu(spuId);
  if (isSuccess(res)) {
    ElMessage.success("已移入回收站，30天内可恢复");
    getSpuAll();
    // 若回收站对话框已打开，同步刷新回收站数据
    syncIfOpen();
  } else {
    ElMessage.error(getMessage(res, "删除失败"));
  }
};
// 在组件卸载前清空三级分类数据，防止下次添加sku时,三级分类数据不变
onBeforeUnmount(() => {
  // 清空三级分类数据,防止下次添加sku时,三级分类数据不变
  getCategory.$reset();
});
</script>

<style scoped></style>
