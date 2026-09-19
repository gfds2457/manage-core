<template>
  <div class="attribute">
    <Category :flag=" flag "></Category>
    <el-card v-if=" flag == 0 " style="margin-top: 5px">
      <el-button type="primary" icon="Plus" class="addAttr" :disabled=" !getCategory.C3Id "
        v-hasBtn="PERM.GOODS_ATTR_WRITE" @click=" flagAdd ">
        添加属性
      </el-button>
      <!-- 回收站按钮 -->
      <el-button type="warning" icon="Delete" class="addAttr" @click=" openRecycleBin " style="margin-left: 10px">
        回收站
      </el-button>
      <el-table border style="width: 100%" :data=" getCategory.attrData ">
        <el-table-column label="序号" width="100" type="index" />
        <el-table-column label="属性名称" width="120" prop="attrName" />
        <el-table-column label="属性值名称" width="800">
          <template #default=" { row } ">
            <el-tag v-for=" ( item, index ) in row.attrValueList " :key=" index " type="primary" style="margin: 5px 10px">
              {{ item }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default=" { row } ">
            <el-button type="warning" icon="Edit" style="margin: 0 10px" v-hasBtn="PERM.GOODS_ATTR_WRITE"
              @click="flagEdit( row )" />
            <el-popconfirm title="您确定要删除吗？哭哭" @confirm="deleteArr( row )">
              <template #reference>
                <el-button type="danger" icon="Delete" v-hasBtn="PERM.GOODS_ATTR_WRITE" />
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if=" flag == 1 " style="margin-top: 5px">
      <el-form :inline=" true ">
        <el-form-item label="属性名称">
          <el-input v-focus v-model=" attrData.attrName " placeholder="请输入您的属性值" />
        </el-form-item>
      </el-form>

      <el-button type="primary" icon="Plus" class="addAttr" style="width: 120px" :disabled=" !attrData.attrName.trim() "
        @click=" addAttrValue ">
        添加属性值
      </el-button>
      <el-button style="margin: 0 10px 15px 10px; height: 33px" @click=" cancel ">
        取消
      </el-button>

      <el-table style="width: 100%" border row-key="id" :data=" attrData.attrValueList ">
        <el-table-column label="序号" width="100" type="index" />
        <el-table-column label="属性值" width="510">
          <template #default=" { row } ">
            <el-input v-if=" row.editFlag === 0 " v-focus v-model=" row.attrValue " placeholder="请输入属性值名称"
              @blur="inputBlur( row )" />
            <div v-else class="attr-value-text" @click="inputClick( row )">
              {{ row.attrValue }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default=" { row, $index } ">
            <el-popconfirm title="您确定要删除吗?" @confirm="attrData.attrValueList.splice( $index, 1 )">
              <template #reference>
                <el-button type="danger" icon="Delete" style="margin: 0 30px" />
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-button style="margin-top: 10px" :disabled=" attrData.attrValueList.length < 1 "
        v-hasBtn="PERM.GOODS_ATTR_WRITE" @click=" save ">
        保存
      </el-button>
      <el-button type="primary" style="margin-top: 10px" @click=" cancel ">
        取消
      </el-button>
    </el-card>

    <!-- 回收站弹窗：展示已软删除的商品属性，支持恢复 -->
    <el-dialog v-model=" recycleBinVisible " title="商品属性回收站" width="900">
      <el-alert type="warning" :closable=" false " show-icon style="margin-bottom: 12px">
        已删除商品属性将保留 30 天，超过 30 天后将被永久销毁且无法恢复。
      </el-alert>
      <el-table :data=" deletedArrList " border style="width: 100%" empty-text="回收站为空" v-loading=" recycleLoading ">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="attrName" label="属性名称" width="140" />
        <el-table-column label="属性值名称" min-width="240">
          <template #default=" { row } ">
            <el-tag v-for=" ( item, index ) in row.attrValueList " :key=" index " type="primary" style="margin: 5px 10px">
              {{ typeof item === "string" ? item : item.attrValue }}
            </el-tag>
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
            <el-button type="primary" size="small" :loading=" restoringId === row.attrId "
              v-hasBtn="PERM.GOODS_ATTR_WRITE" @click="restoreItem( row )">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import
  {
    watch,
    ref,
    reactive,
    nextTick,
    onBeforeUnmount,
    type Directive,
  } from "vue";
import type { addArrInterface } from "@/API/category/type";
import category from "@/store/modules/category";
import
  {
    addUpdateReq,
    deleteReq,
    getDeletedArrList,
    restoreArr,
  } from "@/API/category";
import type {
  updateAttrInterface,
  attrItemInterface,
  newAttrInterface,
  deleteResInterface,
  DeletedAttrItemInterface,
} from "./type";
import { ElMessage } from "element-plus";
import { PERM } from "@/utils/permission";
// 引入回收站通用逻辑
import { useRecycleBin } from "@/composables/useRecycleBin";

/** 挂载后自动聚焦（适用于 el-table 内的 el-input） */
const vFocus: Directive = {
  mounted ( el: HTMLElement )
  {
    nextTick( () =>
    {
      el.querySelector<HTMLInputElement>( "input" )?.focus();
    } );
  },
};
// 卡片切换开关
let flag = ref( 0 );

let attrData = reactive<addArrInterface>( {
  attrId: "",
  attrName: "",
  attrValueList: [],
} );

const getCategory = category();

// 获取全部商品属性
const getArr = () =>
{
  getCategory.getArr( getCategory.C3Id );
};

watch(
  () => getCategory.C3Id,
  () =>
  {
    getArr();
  },
);

const resetForm = () =>
{
  Object.assign( attrData, {
    attrId: "",
    attrName: "",
    attrValueList: [],
  } );
};

const flagAdd = () =>
{
  resetForm();
  flag.value = 1;
};
// 编辑按钮
const flagEdit = ( row: addArrInterface ) =>
{
  flag.value = 1;
  if ( !row ) return;
  // 将深拷贝结果合并到响应式对象中，避免重新声明同名变量
  Object.assign( attrData, {
    attrId: row.attrId,
    attrName: row.attrName,
    // 字符串数组 → 编辑表格需要的对象数组
    attrValueList: row.attrValueList.map( ( item, index ) =>
    {
      const value = typeof item === "string" ? item : item.attrValue;
      return {
        id: Date.now() + index,
        attrValue: value,
        editFlag: 1, // 1=展示文字，0=输入框
      } as attrItemInterface;
    } ),
  } );
};

const addAttrValue = () =>
{
  attrData.attrValueList.push( {
    attrValue: "",
    editFlag: 0,
  } );
};

const save = async () =>
{
  const newAttrList = (
    attrData.attrValueList as Array<{ attrValue: string }>
  ).map( ( ele ) => ele.attrValue );
  let data = {
    attrId: attrData.attrId,
    attrName: attrData.attrName,
    attrValueList: newAttrList,
  };
  const res: updateAttrInterface = await addUpdateReq( data );

  if ( res.code === 200 )
  {
    getArr();
    ElMessage.success( "添加商品属性成功" );
    resetForm();
    flag.value = 0;
  } else
  {
    ElMessage.error( getMessage( res, "添加商品属性失败" ) );
  }
};

const cancel = () =>
{
  resetForm();
  flag.value = 0;
};

const inputBlur = ( row: attrItemInterface ) =>
{
  if ( row.attrValue.trim() === "" )
  {
    ElMessage.error( "表单值不能为空" );
    return;
  }

  const repeat = attrData.attrValueList.find( ( item ) =>
  {
    if ( item !== row )
    {
      return ( item as attrItemInterface ).attrValue === row.attrValue;
    }
  } );

  if ( repeat )
  {
    ElMessage.error( "表单值不能重复" );
    return;
  }

  row.editFlag = 1;
};

/** 点击文字切回编辑态，v-focus 会在 input 挂载后自动聚焦 */
const inputClick = ( row: attrItemInterface ) =>
{
  row.editFlag = 0;
};
// 回收站：把通用的拉取列表、恢复、剩余天数计算等方法按需接入
const {
  recycleBinVisible,
  deletedList: deletedArrList,
  recycleLoading,
  restoringId,
  isSuccess,
  getMessage,
  openRecycleBin,
  restoreItem,
  syncIfOpen,
  formatTime,
  remainDays,
} = useRecycleBin<DeletedAttrItemInterface>( {
  fetchList: getDeletedArrList,
  restore: ( row ) => restoreArr( row.attrId ),
  // 商品属性的唯一标识是 attrId，这里覆盖默认的 id 取值
  rowKey: ( row ) => row.attrId ?? "",
  onRestored: getArr,
} );
// 删除商品属性（软删除，30天内可在回收站恢复）
const deleteArr = async ( row: newAttrInterface ) =>
{
  let res: deleteResInterface = await deleteReq( row.attrId );
  if ( isSuccess( res ) )
  {
    ElMessage.success( "已移入回收站，30天内可恢复" );
    getArr();
    // 若回收站对话框已打开，同步刷新回收站数据
    syncIfOpen();
  } else
  {
    ElMessage.error( getMessage( res, "删除失败" ) );
  }
};
// 页面卸载前把相应pinia仓库数据清空，这样切换路由回来页面就会全新
onBeforeUnmount( () =>
{
  category().$reset();
} );
</script>

<style lang="scss" scoped>
.addAttr {
  margin-left: 1px;
  margin-bottom: 15px;
}

.attr-value-text {
  min-height: 32px;
  line-height: 32px;
  cursor: pointer;
}
</style>

<style lang="scss" scoped>
.addAttr {
  margin-left: 1px;
  margin-bottom: 15px;
}
</style>
