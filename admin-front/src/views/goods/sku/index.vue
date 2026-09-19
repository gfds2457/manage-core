<template>
  <div>
    <el-card style="margin-top: 5px">
      <!-- 回收站按钮 -->
      <el-button
        type="warning"
        icon="Delete"
        style="margin-bottom: 15px"
        @click="openRecycleBin"
      >
        回收站
      </el-button>
      <el-table
        style="width: 100%"
        border
        :data="skuData"
        ref="skuTable"
        :row-key="(row: SkuItemInterface) => row.id ?? ''"
      >
        <el-table-column label="序号" width="80" type="index" />
        <el-table-column label="名称" prop="skuName" />
        <el-table-column label="描述" prop="skuDesc" />
        <el-table-column label="图片">
          <template #default="{ row }">
            <el-image
              :src="row.skuDefaultImg"
              fit="cover"
              style="width: 80px; height: 80px"
            />
          </template>
        </el-table-column>
        <el-table-column label="重量" prop="weight" />
        <el-table-column label="价格" prop="price" />
        <!-- 上下架审核状态：审核中的商品按钮不可点，这里给出明确状态 -->
        <el-table-column label="审核状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.auditState"
              :type="auditTagType(row.auditState.status)"
            >
              {{ auditTagText(row.auditState.status) }}
            </el-tag>
            <el-tag v-else type="info">无</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" prop="action" fixed="right" width="300">
          <template #default="{ row }">
            <!-- 有待审核申请：箭头按钮变成"审核中"三个字并禁用 -->
            <el-button
              v-if="row.auditState && row.auditState.status === 0"
              type="info"
              disabled
              style="margin: 0 5px 0 10px"
              :title="pendingTip(row)"
            >
              审核中
            </el-button>
            <!-- 其余情况显示上下架箭头（1为上架，0为下架），点击提交审核申请；
                 最近被驳回过的在按钮上挂红点提示 -->
            <el-badge
              v-else
              :is-dot="row.auditState?.status === 2"
              style="margin: 0 5px 0 10px"
            >
              <el-button
                :type="row.isSale === 1 ? 'success' : 'warning'"
                :icon="row.isSale === 1 ? 'Top' : 'Bottom'"
                style="width: 40px"
                :title="saleTip(row)"
                v-hasBtn="PERM.GOODS_SKU_WRITE"
                @click="changeSkuSale(row)"
              ></el-button>
            </el-badge>
            <el-button
              type="danger"
              icon="Delete"
              style="width: 40px; margin-right: 5px"
              v-hasBtn="PERM.GOODS_SKU_WRITE"
              @click="deleteSkuData(row)"
            ></el-button>
            <el-button
              type="primary"
              icon="Edit"
              style="width: 40px; margin-right: 5px"
              title="编辑SKU信息"
              v-hasBtn="PERM.GOODS_SKU_WRITE"
              @click="openEdit(row)"
            ></el-button>
            <el-button
              type="info"
              icon="Warning"
              style="width: 40px"
              @click="showInfo(row)"
            ></el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="currentPage4"
        v-model:page-size="pageSize4"
        :page-sizes="[3, 6, 9, 12]"
        background
        layout="prev, pager, next, jumper, ->, sizes, total"
        :total="totalPages"
        style="margin-top: 15px"
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </el-card>
    <el-drawer v-model="drawerVisible" direction="rtl" size="40%">
      <template #header>
        <h4>查看商品详情</h4>
      </template>
      <template #default>
        <!-- 商品图片展示 -->
        <el-carousel
          :interval="4000"
          type="card"
          height="200px"
          style="margin: -10px 0 45px 0"
        >
          <el-carousel-item
            v-for="item in skuShowData.skuImageList"
            :key="item"
          >
            <img :src="item" alt="item" style="width: 100%; height: 100%" />
          </el-carousel-item>
        </el-carousel>
        <!-- 商品信息展示 -->
        <el-descriptions class="margin-top" title="商品信息" :column="1" border>
          <el-descriptions-item label="商品名称">{{
            skuShowData.skuName
          }}</el-descriptions-item>
          <el-descriptions-item label="商品描述">{{
            skuShowData.skuDesc
          }}</el-descriptions-item>
          <el-descriptions-item label="商品价格">{{
            skuShowData.price
          }}</el-descriptions-item>
          <el-descriptions-item label="销售属性">
            <el-tag
              type="primary"
              v-for="skuSaleAttr in skuShowData.skuSaleAttrValueList"
              :key="skuSaleAttr.saleAttrId"
              style="margin: 5px"
              >{{ skuSaleAttr.saleAttrValueName }}</el-tag
            >
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
    <!-- 编辑SKU弹窗：价格/重量沿用 el-input-number，从控件层挡掉负号与字母 -->
    <el-dialog v-model="editVisible" title="编辑SKU" width="520">
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="90px"
      >
        <el-form-item label="SKU名称" prop="skuName">
          <el-input v-model="editForm.skuName" placeholder="请输入SKU名称" />
        </el-form-item>
        <el-form-item label="价格(元)" prop="price">
          <el-input-number
            v-model="editPriceModel"
            :min="0"
            :precision="2"
            :step="0.01"
            controls-position="right"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="重量(g)" prop="weight">
          <el-input-number
            v-model="editWeightModel"
            :min="0"
            :precision="2"
            :step="0.01"
            controls-position="right"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="SKU描述" prop="skuDesc">
          <el-input
            v-model="editForm.skuDesc"
            type="textarea"
            :rows="3"
            placeholder="请输入SKU描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="saveEdit">
          确定
        </el-button>
      </template>
    </el-dialog>
    <!-- 回收站弹窗：展示已软删除的SKU，支持恢复 -->
    <el-dialog v-model="recycleBinVisible" title="SKU回收站" width="900">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      >
        已删除SKU将保留 30 天，超过 30 天后将被永久销毁且无法恢复。
      </el-alert>
      <el-table
        :data="deletedSkuList"
        border
        style="width: 100%"
        empty-text="回收站为空"
        v-loading="recycleLoading"
      >
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="skuName" label="SKU名称" min-width="200" />
        <el-table-column prop="price" label="价格" width="100" />
        <el-table-column prop="weight" label="重量" width="100" />
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
              v-hasBtn="PERM.GOODS_SKU_WRITE"
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
import type {
  SkuItemInterface,
  SkuAllResInterface,
  DeletedSkuItemInterface,
  SkuAuditStateResInterface,
  AuditRecordInterface,
} from "./type";
import { ref, computed, nextTick, onBeforeMount } from "vue";
import {
  getSkuList,
  getSkuDetail,
  deleteSku,
  getDeletedSkuList,
  restoreSku,
  submitSkuAudit,
  getSkuAuditState,
  updateSkuInfo,
} from "@/API/sku/index";
import type { SubmitAuditResInterface } from "@/API/sku/index";
import { ElButton, ElMessage } from "element-plus";
import type { FormInstance } from "element-plus";
import { PERM } from "@/utils/permission";
// 提交审核申请时要带上申请人
import useUser from "@/store/modules/user";
// 引入回收站通用逻辑
import { useRecycleBin } from "@/composables/useRecycleBin";
// 组件命名
defineOptions({
  name: "skuIndex",
});
// 数据
// 当前页码
const currentPage4 = ref(1);
// 每页条数
const pageSize4 = ref(6);
// 总条数
const totalPages = ref(10);
// sku列表数据
const skuData = ref<SkuItemInterface[]>([]);
// 控制sku信息抽屉展示
let drawerVisible = ref(false);
// sku信息抽屉展示数据
let skuShowData = ref();
// 每个SKU最近一条审核单，key 为 skuId。拉回来后合并到列表行上
const auditStateMap = ref<Record<number, AuditRecordInterface>>({});
// 当前登录用户：提交审核申请时需要带申请人
const userInfo = useUser();

// 方法
// 获取sku列表全部数据
const getSkuAll = async () => {
  const res: SkuAllResInterface = await getSkuList(
    currentPage4.value,
    pageSize4.value,
  );
  if (res.code !== 200) {
    console.error("获取sku列表失败", res);
    return;
  }
  const records = (res.data.records as SkuItemInterface[]) ?? [];
  // 把审核状态合并到行上，模板直接用 row.auditState 决定按钮形态
  skuData.value = records.map((item) => ({
    ...item,
    auditState: auditStateMap.value[item.id] ?? null,
  }));
  totalPages.value = (res.data.total as number) ?? 0;
};
// 获取每个SKU最近一条审核单
const getAuditStateAll = async () => {
  const res: SkuAuditStateResInterface = await getSkuAuditState();
  if (res.code !== 200) {
    console.error("获取SKU审核状态失败", res);
    return;
  }
  auditStateMap.value = res.data ?? {};
};
// 提交审核后审核状态和列表都要刷新
const refreshAll = async () => {
  await getAuditStateAll();
  await getSkuAll();
};
// 分页器事件
const handleCurrentChange = (newPage: number) => {
  currentPage4.value = newPage;
  getSkuAll();
};
const handleSizeChange = (newSize: number) => {
  pageSize4.value = newSize;
  currentPage4.value = 1;
  getSkuAll();
};

// 页面挂载：先拿审核状态，再拉列表（列表会把审核状态合并到行上）
onBeforeMount(async () => {
  await refreshAll();
});
// 显示sku信息抽屉
const showInfo = async (row: SkuItemInterface) => {
  drawerVisible.value = true;
  const res: SkuAllResInterface = await getSkuDetail(row.id);
  if (res.code !== 200) {
    console.error("获取sku详情失败", res);
    return;
  }
  skuShowData.value = res.data;
};
// 回收站：把通用的拉取列表、恢复、剩余天数计算等方法按需接入
const {
  recycleBinVisible,
  deletedList: deletedSkuList,
  recycleLoading,
  restoringId,
  isSuccess,
  getMessage,
  openRecycleBin,
  restoreItem,
  syncIfOpen,
  formatTime,
  remainDays,
} = useRecycleBin<DeletedSkuItemInterface>({
  fetchList: getDeletedSkuList,
  restore: (row) => restoreSku(row.id),
  onRestored: getSkuAll,
});
// 编辑SKU：弹窗显隐、提交中状态、表单实例与表单数据
const editVisible = ref(false);
const editSaving = ref(false);
const editFormRef = ref<FormInstance>();
const editForm = ref<{
  id: number;
  skuName: string;
  price: number | null;
  weight: string;
  skuDesc: string;
}>({
  id: 0,
  skuName: "",
  price: null,
  weight: "",
  skuDesc: "",
});
// 价格与重量都要求非负：控件层用 min=0 挡输入，规则层再拦住留空
const editRules = {
  skuName: [
    {
      required: true,
      trigger: "blur",
      validator: (_rule: unknown, value: string, callback: (e?: Error) => void) =>
      {
        if (!value || value.trim() === "") callback(new Error("请输入SKU名称"));
        else callback();
      },
    },
  ],
  price: [
    {
      required: true,
      trigger: "change",
      validator: (
        _rule: unknown,
        value: number | null,
        callback: (e?: Error) => void,
      ) =>
      {
        if (value === null || value === undefined || Number.isNaN(value))
          callback(new Error("请输入价格"));
        else if (value < 0) callback(new Error("价格不能为负数"));
        else callback();
      },
    },
  ],
  weight: [
    {
      required: true,
      trigger: "change",
      validator: (
        _rule: unknown,
        value: string,
        callback: (e?: Error) => void,
      ) =>
      {
        const num = Number(value);
        if (value === "" || value === null || Number.isNaN(num))
          callback(new Error("请输入重量"));
        else if (num < 0) callback(new Error("重量不能为负数"));
        else callback();
      },
    },
  ],
};
// 接口里 price 是 number | null、weight 是字符串，控件要的是 number | undefined，
// 用 computed 做一层双向转换，避免改动接口类型
const editPriceModel = computed({
  get: () => (editForm.value.price === null ? undefined : editForm.value.price),
  set: (val: number | undefined) =>
  {
    editForm.value.price = val === undefined ? null : val;
  },
});
const editWeightModel = computed({
  get: () =>
  {
    if (!editForm.value.weight) return undefined;
    const num = Number(editForm.value.weight);
    return Number.isNaN(num) ? undefined : num;
  },
  set: (val: number | undefined) =>
  {
    editForm.value.weight =
      val === undefined || val === null ? "" : val.toFixed(2);
  },
});
// 打开编辑弹窗：把当前行数据填进表单，并清掉上一次遗留的校验红字
const openEdit = (row: SkuItemInterface) =>
{
  editForm.value = {
    id: row.id,
    skuName: row.skuName ?? "",
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    weight: row.weight === null || row.weight === undefined ? "" : String(row.weight),
    skuDesc: row.skuDesc ?? "",
  };
  editVisible.value = true;
  nextTick(() =>
  {
    editFormRef.value?.clearValidate();
  });
};
// 保存编辑：校验通过后按 id 就地修改
const saveEdit = async () =>
{
  const valid = await editFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  editSaving.value = true;
  try
  {
    const res: SubmitAuditResInterface = await updateSkuInfo({
      id: editForm.value.id,
      skuName: editForm.value.skuName.trim(),
      price: editForm.value.price ?? 0,
      weight: editForm.value.weight,
      skuDesc: editForm.value.skuDesc,
    });
    if (!isSuccess(res))
    {
      ElMessage.error(getMessage(res, "修改失败"));
      return;
    }
    ElMessage.success("修改成功");
    editVisible.value = false;
    await getSkuAll();
  } finally
  {
    editSaving.value = false;
  }
};
// 提交SKU上下架审核申请。
// 不再直接改上下架状态：要等运营/超级管理员在商品审核页通过后才真正生效
const changeSkuSale = async (row: SkuItemInterface) => {
  const targetIsSale = row.isSale === 1 ? 0 : 1;
  const res: SubmitAuditResInterface = await submitSkuAudit({
    skuId: row.id,
    targetIsSale,
    applyUserName: userInfo.userName,
  });
  if (!isSuccess(res)) {
    ElMessage.error(getMessage(res, "提交审核失败"));
    return;
  }
  ElMessage.success("提交成功，等待审核");
  await refreshAll();
};
// 待审核时按钮的悬停提示，说清这次申请的是上架还是下架
const pendingTip = (row: SkuItemInterface) =>
  row.auditState?.targetIsSale === 1
    ? "已提交上架申请，等待审核"
    : "已提交下架申请，等待审核";
// 可提交时按钮的悬停提示，被驳回过的优先显示驳回理由
const saleTip = (row: SkuItemInterface) => {
  if (row.auditState?.status === 2) {
    return `上次审核被驳回：${row.auditState.auditRemark}`;
  }
  return row.isSale === 1 ? "申请下架" : "申请上架";
};
// 审核状态标签的样式与文案
const auditTagType = (status: number): "warning" | "success" | "danger" => {
  if (status === 0) return "warning";
  if (status === 1) return "success";
  return "danger";
};
const auditTagText = (status: number) => {
  if (status === 0) return "待审核";
  if (status === 1) return "已通过";
  return "已驳回";
};

// 删除已有Sku接口（软删除，30天内可在回收站恢复）
const deleteSkuData = async (row: SkuItemInterface) => {
  const res = await deleteSku(row.id);
  if (isSuccess(res)) {
    ElMessage.success("已移入回收站，30天内可恢复");
    getSkuAll();
    // 若回收站对话框已打开，同步刷新回收站数据
    syncIfOpen();
  } else {
    ElMessage.error(getMessage(res, "删除失败"));
  }
};
</script>

<style scoped></style>
<style scoped>
.el-carousel__item h3 {
  display: flex;
  color: #475669;
  opacity: 0.75;
  line-height: 300px;
  margin: 0;
}

.el-carousel__item:nth-child(2n) {
  background-color: #99a9bf;
}

.el-carousel__item:nth-child(2n + 1) {
  background-color: #d3dce6;
}
</style>
