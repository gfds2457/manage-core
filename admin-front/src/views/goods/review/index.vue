<template>
  <el-card style="margin-top: 5px">
    <!-- 筛选：审核状态 + 关键词 -->
    <div style="margin-bottom: 15px">
      <el-radio-group v-model=" statusFilter " @change=" handleSearch ">
        <el-radio-button :value=" 0 ">待审核</el-radio-button>
        <el-radio-button :value=" 1 ">已通过</el-radio-button>
        <el-radio-button :value=" 2 ">已驳回</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
      <el-input v-model=" keyword " placeholder="搜索SKU名称或申请人" clearable style="width: 240px; margin-left: 12px"
        @keyup.enter=" handleSearch " />
      <el-button type="primary" icon="Search" style="margin-left: 8px" @click=" handleSearch ">
        搜索
      </el-button>
      <el-button icon="Refresh" @click=" handleReset ">重置</el-button>
    </div>
    <!-- 批量操作：只有待审核的单据可勾选 -->
    <el-button type="success" icon="Select" style="margin-bottom: 15px" :disabled=" checkedAudits.length === 0 "
      v-hasBtn="PERM.GOODS_REVIEW_AUDIT" @click=" batchApprove ">
      批量通过
    </el-button>
    <el-button type="danger" icon="CloseBold" style="margin-bottom: 15px" :disabled=" checkedAudits.length === 0 "
      v-hasBtn="PERM.GOODS_REVIEW_AUDIT" @click="openRejectDialog( null )">
      批量驳回
    </el-button>
    <el-table style="width: 100%" border :data=" auditList " row-key="id" empty-text="暂无审核记录" v-loading=" tableLoading "
      @selection-change=" handleSelectionChange ">
      <el-table-column type="selection" width="50" align="center" :selectable=" isPendingRow " />
      <el-table-column label="序号" width="70" type="index" align="center" />
      <el-table-column label="图片" width="90" align="center">
        <template #default=" { row } ">
          <el-image :src=" row.skuDefaultImg " fit="cover" style="width: 60px; height: 60px" />
        </template>
      </el-table-column>
      <el-table-column label="SKU名称" prop="skuName" min-width="220" />
      <el-table-column label="价格" prop="price" width="90" />
      <el-table-column label="重量" prop="weight" width="90" />
      <el-table-column label="申请操作" width="110" align="center">
        <template #default=" { row } ">
          <el-tag :type=" row.targetIsSale === 1 ? 'success' : 'warning' ">
            {{ row.targetIsSale === 1 ? "申请上架" : "申请下架" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请前状态" width="110" align="center">
        <template #default=" { row } ">
          <el-tag :type=" row.currentIsSale === 1 ? 'success' : 'info' ">
            {{ row.currentIsSale === 1 ? "上架中" : "已下架" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="审核状态" width="100" align="center">
        <template #default=" { row } ">
          <el-tag :type=" auditTagType( row.status ) ">
            {{ auditTagText( row.status ) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请信息" width="170">
        <template #default=" { row } ">
          <div>{{ row.applyUserName || "-" }}</div>
          <div style="color: #909399; font-size: 12px">
            {{ formatTime( row.applyTime ) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="审核留痕" width="220">
        <template #default=" { row } ">
          <div v-if=" row.status === 0 " style="color: #909399">待审核</div>
          <template v-else>
            <div>{{ row.auditUserName || "-" }} · {{ formatTime( row.auditTime ) }}</div>
            <div style="color: #909399; font-size: 12px">
              {{ row.auditRemark || "（无审核意见）" }}
            </div>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="170" align="center">
        <template #default=" { row } ">
          <template v-if=" row.status === 0 ">
            <el-button type="success" size="small" v-hasBtn="PERM.GOODS_REVIEW_AUDIT" @click="approveOne( row )">
              通过
            </el-button>
            <el-button type="danger" size="small" v-hasBtn="PERM.GOODS_REVIEW_AUDIT" @click="openRejectDialog( row )">
              驳回
            </el-button>
          </template>
          <span v-else style="color: #909399">已处理</span>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page=" currentPage " v-model:page-size=" pageSize " :page-sizes=" [ 5, 10, 20, 50 ] "
      background layout="prev, pager, next, jumper, ->, sizes, total" :total=" total " style="margin-top: 15px"
      @current-change=" handleCurrentChange " @size-change=" handleSizeChange " />
    <!-- 驳回理由：单条驳回与批量驳回共用 -->
    <el-dialog v-model=" rejectDialogVisible " :title=" rejectTarget ? '驳回审核申请' : '批量驳回审核申请' " width="500">
      <el-alert v-if=" rejectTarget " type="info" :closable=" false " show-icon style="margin-bottom: 12px">
        {{ rejectTarget.skuName }}
        （{{ rejectTarget.targetIsSale === 1 ? "申请上架" : "申请下架" }}）
      </el-alert>
      <el-alert v-else type="warning" :closable=" false " show-icon style="margin-bottom: 12px">
        将驳回已勾选的 {{ checkedAudits.length }} 条申请，商品的上下架状态保持不变。
      </el-alert>
      <el-form :model=" rejectForm " :rules=" rejectRules " ref="rejectFormRef">
        <el-form-item label="驳回理由" label-width="90px" prop="auditRemark">
          <el-input v-model=" rejectForm.auditRemark " type="textarea" :rows=" 4 " placeholder="请填写驳回理由，会展示给提交人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="rejectDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading=" submitting " @click=" confirmReject ">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, onBeforeMount } from "vue";
import type { FormInstance, FormItemRule } from "element-plus";
import { ElMessage } from "element-plus";
import type {
  AuditRecordInterface,
  AuditListResInterface,
  AuditOperateResInterface,
} from "./type";
import
  {
    getAuditList,
    approveAudit,
    rejectAudit,
    batchAudit,
  } from "@/API/audit/index";
import { formatTime } from "@/utils/format";
import { isSuccess, getMessage } from "@/composables/useRecycleBin";
import { PERM } from "@/utils/permission";
// 审核人由前端带上（mock 后端拿不到"当前是谁在操作"）
import useUser from "@/store/modules/user";
// 组件命名
defineOptions( {
  name: "goodsReview",
} );

// 数据
const userInfo = useUser();
// 当前筛选的审核状态：0 待审核 / 1 已通过 / 2 已驳回 / "all" 全部
const statusFilter = ref<number | string>( 0 );
// 关键词：匹配 SKU 名称与申请人
const keyword = ref( "" );
const currentPage = ref( 1 );
const pageSize = ref( 10 );
const total = ref( 0 );
// 审核单列表
const auditList = ref<AuditRecordInterface[]>( [] );
// 表格加载中
const tableLoading = ref( false );
// 已勾选的审核单
const checkedAudits = ref<AuditRecordInterface[]>( [] );
// 驳回弹窗
const rejectDialogVisible = ref( false );
// null 表示批量驳回
const rejectTarget = ref<AuditRecordInterface | null>( null );
const rejectFormRef = ref<FormInstance>();
const rejectForm = reactive( { auditRemark: "" } );
const rejectRules: FormItemRule[] = [
  { required: true, message: "请填写驳回理由", trigger: "blur" },
  { min: 2, message: "驳回理由至少 2 个字", trigger: "blur" },
];
// 审核操作提交中
const submitting = ref( false );

// 方法
// 获取审核列表
const getAuditAll = async () =>
{
  tableLoading.value = true;
  try
  {
    const res: AuditListResInterface = await getAuditList(
      currentPage.value,
      pageSize.value,
      statusFilter.value === "all" ? "" : statusFilter.value,
      keyword.value.trim(),
    );
    if ( res.code !== 200 )
    {
      console.error( "获取审核列表失败", res );
      return;
    }
    auditList.value = ( res.data.records as AuditRecordInterface[] ) ?? [];
    total.value = ( res.data.total as number ) ?? 0;
  } finally
  {
    tableLoading.value = false;
  }
};
// 搜索与筛选都要回到第一页
const handleSearch = () =>
{
  currentPage.value = 1;
  getAuditAll();
};
const handleReset = () =>
{
  statusFilter.value = 0;
  keyword.value = "";
  currentPage.value = 1;
  getAuditAll();
};
const handleCurrentChange = ( newPage: number ) =>
{
  currentPage.value = newPage;
  getAuditAll();
};
const handleSizeChange = ( newSize: number ) =>
{
  pageSize.value = newSize;
  currentPage.value = 1;
  getAuditAll();
};
const handleSelectionChange = ( rows: AuditRecordInterface[] ) =>
{
  checkedAudits.value = rows;
};
// 只有待审核的单据允许勾选，已处理的不参与批量操作
const isPendingRow = ( row: AuditRecordInterface ) => row.status === 0;

// 单条通过：通过后 SKU 的上下架状态才真正变更
const approveOne = async ( row: AuditRecordInterface ) =>
{
  submitting.value = true;
  try
  {
    const res: AuditOperateResInterface = await approveAudit( {
      auditId: row.id,
      auditUserName: userInfo.userName,
    } );
    if ( !isSuccess( res ) )
    {
      ElMessage.error( getMessage( res, "审核通过失败" ) );
      return;
    }
    ElMessage.success( "审核通过，商品状态已更新" );
    await getAuditAll();
  } finally
  {
    submitting.value = false;
  }
};

// 批量通过
const batchApprove = async () =>
{
  submitting.value = true;
  try
  {
    const res: AuditOperateResInterface = await batchAudit( {
      auditIds: checkedAudits.value.map( ( item ) => item.id ),
      action: "approve",
      auditUserName: userInfo.userName,
    } );
    if ( !isSuccess( res ) )
    {
      ElMessage.error( getMessage( res, "批量通过失败" ) );
      return;
    }
    ElMessage.success( "批量审核通过，商品状态已更新" );
    checkedAudits.value = [];
    await getAuditAll();
  } finally
  {
    submitting.value = false;
  }
};

// 打开驳回弹窗，row 为 null 时表示批量驳回
const openRejectDialog = ( row: AuditRecordInterface | null ) =>
{
  rejectTarget.value = row;
  rejectForm.auditRemark = "";
  rejectDialogVisible.value = true;
  // 清掉上一次留下的校验红字
  nextTick( () => rejectFormRef.value?.clearValidate() );
};

// 确认驳回
const confirmReject = async () =>
{
  const valid = await rejectFormRef.value?.validate().catch( () => false );
  if ( !valid ) return;
  submitting.value = true;
  try
  {
    const common = {
      auditUserName: userInfo.userName,
      auditRemark: rejectForm.auditRemark,
    };
    const res: AuditOperateResInterface = rejectTarget.value
      ? await rejectAudit( { auditId: rejectTarget.value.id, ...common } )
      : await batchAudit( {
        auditIds: checkedAudits.value.map( ( item ) => item.id ),
        action: "reject",
        ...common,
      } );
    if ( !isSuccess( res ) )
    {
      ElMessage.error( getMessage( res, "驳回失败" ) );
      return;
    }
    ElMessage.success( "已驳回，商品上下架状态保持不变" );
    rejectDialogVisible.value = false;
    checkedAudits.value = [];
    await getAuditAll();
  } finally
  {
    submitting.value = false;
  }
};

// 审核状态标签的样式与文案
const auditTagType = ( status: number ): "warning" | "success" | "danger" =>
{
  if ( status === 0 ) return "warning";
  if ( status === 1 ) return "success";
  return "danger";
};
const auditTagText = ( status: number ) =>
{
  if ( status === 0 ) return "待审核";
  if ( status === 1 ) return "已通过";
  return "已驳回";
};

// 页面挂载拉取审核列表（默认进待审核）
onBeforeMount( () =>
{
  getAuditAll();
} );
</script>

<style scoped></style>
