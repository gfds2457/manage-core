<template>
  <div>
    <div class="brandList">
      <!-- 外层卡片 -->
      <el-card style="min-width: 480px">
        <!-- 头部 -->
        <template #header>
          <div class="card-header">
            <el-button type="primary" icon="Plus" @click=" addBrand "
              v-hasBtn="PERM.GOODS_BRAND_WRITE">添加品牌</el-button>
            <el-button type="warning" icon="Delete" @click=" openRecycleBin ">回收站</el-button>
          </div>
        </template>
        <!-- 表格 -->
        <el-table :data=" grandList " border style="width: 100%">
          <el-table-column type="index" label="序号" width="90" align="center" />
          <el-table-column prop="tmName" label="品牌名称" width="350" />
          <el-table-column label="品牌LOGO" width="350">
            <template #default=" { row } ">
              <img :src=" row.logoUrl " alt="" style="width: 100px; height: 100px" />
            </template>
          </el-table-column>
          <el-table-column label="品牌操作">
            <template #default=" { row } ">
              <el-button type="warning" icon="Edit" v-hasBtn="PERM.GOODS_BRAND_WRITE"
                @click="editBrand( row )"></el-button>
              <el-popconfirm title="您确定要删除吗?" @confirm="deleteBrand( row.id )">
                <template #reference>
                  <el-button type="danger" icon="Delete" v-hasBtn="PERM.GOODS_BRAND_WRITE"></el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
        <!-- 分页 -->
        <div class="demo-pagination-block">
          <!-- <div class="demonstration">Jump to</div> -->
          <el-pagination v-model:current-page=" currentPage " v-model:page-size=" pageSize " background
            layout="prev, pager, next, jumper, -> , sizes , total" :total=" totalPage "
            :page-sizes=" [ 3, 5, 7, 9 ] " />
        </div>
        <!-- 底部 -->
        <template #footer></template>
      </el-card>
    </div>
    <div class="dialog">
      <!-- 弹窗每次打开都是重新渲染 -->
      <el-dialog v-model=" dialogVisible " :title=" form.id ? '修改品牌' : '添加品牌' " width="500"
        :before-close=" handleClose ">
        <!-- :model放一个数据仓库,集成v-model里的数据 -->
        <el-form :model=" form " :rules=" rules " ref="formRef">
          <el-form-item label="品牌名称" label-width="100px" prop="tmName">
            <el-input v-model=" form.tmName " autocomplete="off" placeholder="请输入品牌名称" />
          </el-form-item>
          <el-form-item label="品牌LOGO" label-width="100px" prop="logoUrl">
            <el-upload class="avatar-uploader" :action="uploadUrl" :show-file-list=" false "
              :on-success=" handleAvatarSuccess " :before-upload=" beforeAvatarUpload ">
              <img v-if=" form.logoUrl " :src=" form.logoUrl " class="avatar" />
              <el-icon v-else class="avatar-uploader-icon">
                <Plus />
              </el-icon>
            </el-upload>
          </el-form-item>
        </el-form>
        <!-- 底部按钮 -->
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click=" confirm "> 确定 </el-button>
          </div>
        </template>
      </el-dialog>
      <!-- 回收站弹窗：展示已软删除的品牌，支持恢复 -->
      <el-dialog v-model=" recycleBinVisible " title="品牌回收站" width="900">
        <el-alert type="warning" :closable=" false " show-icon style="margin-bottom: 12px">
          已删除品牌将保留 30 天，超过 30 天后将被永久销毁且无法恢复。
        </el-alert>
        <el-table :data=" deletedBrandList " border style="width: 100%" empty-text="回收站为空" v-loading=" recycleLoading ">
          <el-table-column type="index" label="序号" width="70" align="center" />
          <el-table-column prop="tmName" label="品牌名称" min-width="180" />
          <el-table-column label="品牌LOGO" width="120">
            <template #default=" { row } ">
              <img :src=" row.logoUrl " alt="" style="width: 60px; height: 60px" />
            </template>
          </el-table-column>
          <el-table-column label="删除时间" width="180">
            <template #default=" { row } ">
              {{ formatTime( row.deleteTime ) }}
            </template>
          </el-table-column>
          <el-table-column label="剩余保留天数" width="130" align="center">
            <template #default=" { row } ">
              <el-tag :type=" remainDays( row.deleteTime ) <= 7 ? 'danger' : 'info' ">
                {{ remainDays( row.deleteTime ) }} 天
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default=" { row } ">
              <el-button type="primary" size="small" :loading=" restoringId === row.id "
                v-hasBtn="PERM.GOODS_BRAND_WRITE" @click=" restoreItem( row )">恢复</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import { getBrandList, reqAddUpdateBrand, reqDeleteBrand, reqGetDeletedBrandList, reqRestoreBrand } from "@/API/product";
import { onMounted, nextTick } from "vue";
import type { BrandItemInterface, addDeleteResponse, DeletedBrandItemInterface } from "./type";
import { ElMessageBox, ElMessage } from "element-plus";
import { PERM } from "@/utils/permission";
// 回收站通用逻辑：与 attr / spu / sku 三个页面复用同一套实现
import { useRecycleBin } from "@/composables/useRecycleBin";
import type { UploadProps } from "element-plus";
import type { dataType } from "@/API/product/type";
import type { FormItemRule } from "element-plus";
// 上传接口直连独立 mock 后端（跨域），地址统一从环境变量读取
const uploadUrl =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api") +
  "/product/upload";
let currentPage = ref<number>( 1 );
let pageSize = ref<number>( 5 );
let totalPage = ref<number>();
let grandList = ref<BrandItemInterface[]>( [] );
// 控制对话框的开关
let dialogVisible = ref( false );
// 拿到表单数据
let form = reactive( {
  id: 0,
  tmName: "",
  logoUrl: "",
} );
const formRef = ref();
// 品牌名称校验规则
const validateTmName = (
  _rule: FormItemRule,
  value: string,
  callback: ( err?: Error ) => void,
) =>
{
  // callback约定传入一个Error对象则视为校验未通过
  if ( value.length < 2 )
  {
    callback( new Error( "品牌名称不能少于2个字" ) );
  } else
  {
    callback();
  }
};
// 图片文件校验规则
const validateLogoUrl = (
  _rule: FormItemRule,
  value: string,
  callback: ( err?: Error ) => void,
) =>
{
  if ( value )
  {
    callback();
  } else
  {
    callback( new Error( "必须提交图片文件" ) );
  }
};
// 制定表单规则
const rules = {
  tmName: [
    {
      required: true,
      // message: "请输入两位以上字数"//,输入框为空时才弹出这句话
      trigger: "change",
      validator: validateTmName,
    },
  ],
  // 验证是否有提交文件
  // 1.对整个表单进行验证，确保图片文件会触发校验函数
  // 2.
  logoUrl: [
    {
      required: true,
      validator: validateLogoUrl,
    },
  ],
};
//确认关闭弹窗的弹窗
const handleClose = ( done: () => void ) =>
{
  ElMessageBox.confirm( "求你别离开我" )
    .then( () =>
    {
      done();
    } )
    .catch( () =>
    {
      // catch error
    } );
};
// 封装获取并渲染全部品牌函数
// 1.页面一挂载就发出请求，得到品牌数据
// 2.渲染表格
const brand = async () =>
{
  let pageNum = currentPage.value;
  let res = await getBrandList( pageNum, pageSize.value );
  // 把请求到的结果渲染到页面
  grandList.value = res.data.records;
  totalPage.value = res.data.total;
};
onMounted( () =>
{
  brand();
} );
// 当前页码发生变化则再次发送请求
watch( [ currentPage, pageSize ], () =>
{
  brand();
} );
// 回收站：接入通用 composable，不再自己写一套拉取/恢复/剩余天数计算。
// 之前 brand 单独实现了一遍，和 attr / spu / sku 的通用逻辑重复，改一处要改两遍
const {
  recycleBinVisible,
  deletedList: deletedBrandList,
  recycleLoading,
  restoringId,
  isSuccess,
  getMessage,
  openRecycleBin,
  restoreItem,
  syncIfOpen,
  formatTime,
  remainDays,
} = useRecycleBin<DeletedBrandItemInterface>( {
  fetchList: reqGetDeletedBrandList,
  restore: ( row ) => reqRestoreBrand( row.id ),
  onRestored: brand,
  restoreSuccessTip: "恢复成功",
} );
// 图片上传前判断图片是否符合规范
// UploadProps["beforeUpload"]为在UploadProps类型规则对象中取出beforeUpload规则
const beforeAvatarUpload: UploadProps[ "beforeUpload" ] = ( rawFile ) =>
{
  // rawFile为当前上传文件信息对象
  if ( rawFile.type !== "image/jpeg" )
  {
    ElMessage.error( "文件必须为jpeg格式" );
    return false;
  } else if ( rawFile.size / 1024 / 1024 > 4 )
  {
    ElMessage.error( "文件大小不能超过4MB" );
    return false;
  }
  return true;
};
// 图片上传成功后拿到上传图片地址
const handleAvatarSuccess: UploadProps[ "onSuccess" ] = ( response ) =>
{
  form.logoUrl = response.data;
  formRef.value.clearValidate( "logoUrl" );
};
//添加品牌功能
// 1.收集数据
// 2.发送请求
const addBrand = () =>
{
  dialogVisible.value = true;
  // 打开前先清空表单
  form.logoUrl = "";
  form.tmName = "";
  // 打开前先清空错误提示信息
  nextTick( () =>
  {
    formRef.value.clearValidate( "logoUrl" );
    formRef.value.clearValidate( "tmName" );
  } );
};
// 编辑品牌功能
const editBrand = ( row: dataType ) =>
{
  dialogVisible.value = true;
  // 打开前把对应这一行数据渲染到表单中
  form.id = Number( row.id );
  form.logoUrl = row.logoUrl;
  form.tmName = row.tmName;
  // 打开前先清空错误提示信息
  nextTick( () =>
  {
    formRef.value.clearValidate( "logoUrl" );
    formRef.value.clearValidate( "tmName" );
  } );
};
//删除品牌功能（软删除，30天内可在回收站恢复）
const deleteBrand = async ( id: number ) =>
{
  const res: addDeleteResponse = await reqDeleteBrand( id );
  if ( isSuccess( res ) )
  {
    ElMessage.success( "已移入回收站，30天内可恢复" );
    brand();
    if ( pageSize.value < 1 )
    {
      currentPage.value -= 1;
    }
    // 若回收站对话框已打开，同步刷新回收站数据
    syncIfOpen();
  } else
  {
    ElMessage.error( getMessage( res, "删除失败" ) );
  }
};
// 表单确认按钮
const confirm = async () =>
{
  // 在请求前先验证表单
  let result = await formRef.value.validate();
  if ( result == false )
  {
    return;
  }
  // 发送添加品牌请求
  const res: addDeleteResponse = await reqAddUpdateBrand( form );
  if ( res.code == 200 )
  {
    ElMessage.success( form.id ? "修改成功" : "上传成功" );
    brand();
    dialogVisible.value = false;
  } else
  {
    ElMessage.error( getMessage( res, form.id ? "修改失败" : "上传失败" ) );
  }
};
</script>

<style lang="scss" scoped>
.el-card {
  height: calc(100vh - $card-margin-bottom - $nav-height);

  .el-button--warning {
    margin-left: 10px;
    margin-right: 5px;
  }

  .el-pagination {
    margin-top: 10px;
  }
}
</style>
<style>
.el-dialog__title {
  font-size: 16px;
  font-weight: 500;
}

.avatar-uploader .el-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.el-icon.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  text-align: center;
}
</style>
