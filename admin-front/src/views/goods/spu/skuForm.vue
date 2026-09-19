<template>
  <div>
    <el-card style="margin-top: 5px">
      <el-form :inline=" false " label-width="80px" ref="skuFormRef" :model=" skuData " :rules=" rules ">
        <el-form-item label="SKU名称" prop="skuName">
          <el-input placeholder="SKU名称" v-model=" skuData.skuName " />
        </el-form-item>
        <!-- 价格/重量改用 el-input-number：min=0 从控件层就挡掉负号与字母，
             再叠加 form rules 拦住「留空」这种非法提交 -->
        <el-form-item label="价格(元)" prop="price">
          <el-input-number placeholder="价格(元)" v-model=" priceModel " :min=" 0 " :precision=" 2 " :step=" 0.01 "
            controls-position="right" style="width: 220px" />
        </el-form-item>
        <el-form-item label="重量(g)" prop="weight">
          <el-input-number placeholder="重量(g)" v-model=" weightModel " :min=" 0 " :precision=" 2 " :step=" 0.01 "
            controls-position="right" style="width: 220px" />
        </el-form-item>
        <el-form-item label="SKU描述">
          <el-input type="textarea" placeholder="SKU描述" :rows=" 3 " v-model=" skuData.skuDesc " />
        </el-form-item>
        <el-form-item label="平台属性">
          <div class="attr-row">
            <el-form style="display: flex; flex-wrap: wrap; width: 1230px">
              <el-form-item :label=" `${ item.saleAttrName }:` " v-for=" item in spuAttr " :key=" item.id "
                style="margin: 0 10px 15px 0px">
                <el-select placeholder="请选择" v-model=" item.attrIdAndValueIdList "
                  style="width: 250px; margin-right: 45px">
                  <el-option :label=" attr.saleAttrValueName " :value=" `${ item.id }:${ attr.id }` "
                    v-for=" attr in item.spuSaleAttrValueList " :key=" attr.id " />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </el-form-item>
        <el-form-item label="图片名称">
          <el-table style="width: 100%" border :data=" imgData " ref="imgTable"
            :row-key=" ( row: ImgResItemInterface ) => row.imgUrl ?? '' ">
            <el-table-column label="" width="50" type="selection" />
            <el-table-column label="图片" prop="image">
              <template #default=" { row, $index } ">
                <el-image :src=" row.imgUrl " fit="cover" style="width: 100px; height: 100px; cursor: pointer"
                  @click="openPreview( $index )" />
              </template>
            </el-table-column>
            <el-table-column label="名称" prop="imgName" />
            <el-table-column label="操作">
              <template #default=" { row } ">
                <el-button type="primary" style="margin-left: 30px" @click="getSkuImg( row )">设置默认</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
      <div style="margin-top: 20px; text-align: left">
        <el-button type="primary" @click=" saveSku ">保存</el-button>
        <el-button @click="emit( 'changeFlag', { flag: 0, params: '' } )">取消</el-button>
      </div>
    </el-card>
    <el-image-viewer v-if=" previewVisible " teleported :url-list=" allPreviewImg " :initial-index=" previewIndex "
      @close="previewVisible = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type {
  SpuResInterface,
  SpuAttrItemInterface,
  SpuRecordsInterface,
  ImgResItemInterface,
  GetSpuResInterface,
} from "./type";
import type { SkuDataInterface } from "@/API/spu/type";
import { getSpuAttr, getSpuImg, addSku } from "@/API/spu/index";
import { ElMessage } from "element-plus";
import type { FormInstance } from "element-plus";
import { getMessage } from "@/composables/useRecycleBin";
defineOptions( {
  name: "skuForm",
} );
// 数据
// 子组件通知父组件,给父组件传递数据
let emit = defineEmits( [ "changeFlag" ] );
// 所有spu属性数据
let spuAttr = ref<SpuAttrItemInterface[]>();
// 所有spu照片数据
let imgData = ref<ImgResItemInterface[]>();
// 收集的sku数据
const skuData = ref<SkuDataInterface>( {
  category3Id: null as number | null,
  spuId: null as number | null,
  tmId: null as number | null,
  skuName: "",
  price: null as number | null,
  weight: "",
  skuDesc: "",
  skuAttrValueList: [],
  skuDefaultImg: "",
} );
// 图片预览
const previewVisible = ref( false );
const previewIndex = ref( 0 );
// 获得el-table的ref
const imgTable = ref();
// 表单实例
const skuFormRef = ref<FormInstance>();
// 表单校验规则：价格与重量必须是非负数字，不允许留空
const rules = ref( {
  skuName: [ {
    required: true, trigger: "blur", validator: ( _rule: any, value: string, callback: any ) =>
    {
      if ( !value || value.trim() === "" )
      {
        callback( new Error( "请输入SKU名称" ) );
      }
      else
      {
        callback();
      }
    }
  } ],
  price: [ {
    required: true, trigger: "change", validator: ( _rule: any, value: number | null, callback: any ) =>
    {
      if ( value === null || value === undefined || Number.isNaN( value ) )
      {
        callback( new Error( "请输入价格" ) );
      }
      else if ( value < 0 )
      {
        callback( new Error( "价格不能为负数" ) );
      }
      else
      {
        callback();
      }
    }
  } ],
  weight: [ {
    required: true, trigger: "change", validator: ( _rule: any, value: number | null, callback: any ) =>
    {
      if ( value === null || value === undefined || Number.isNaN( value ) )
      {
        callback( new Error( "请输入重量" ) );
      }
      else if ( value < 0 )
      {
        callback( new Error( "重量不能为负数" ) );
      }
      else
      {
        callback();
      }
    }
  } ],
} );
// 价格：接口字段是 number | null，控件要的是 number | undefined，用 computed 做一层转换，
// 这样既不改接口类型，又能让 el-input-number 正常清空
const priceModel = computed( {
  get: () => ( skuData.value.price === null ? undefined : skuData.value.price ),
  set: ( val: number | undefined ) =>
  {
    skuData.value.price = val === undefined ? null : val;
  },
} );
// 重量：接口约定是字符串（如 "190.00"），控件按数字输入，同样在 computed 里双向转换
const weightModel = computed( {
  get: () =>
  {
    if ( skuData.value.weight === "" || skuData.value.weight === null )
    {
      return undefined;
    }
    const parsed = Number( skuData.value.weight );
    return Number.isNaN( parsed ) ? undefined : parsed;
  },
  set: ( val: number | undefined ) =>
  {
    skuData.value.weight = val === undefined || val === null ? "" : val.toFixed( 2 );
  },
} );

// 方法
// 定义一个完整图片数组
const allPreviewImg = computed( () =>
{
  return imgData.value?.map( ( item ) => item.imgUrl ).filter( Boolean ) ?? [];
} );
// 点击图片预览效果
const openPreview = ( index: number ) =>
{
  previewIndex.value = index;
  previewVisible.value = true;
};
// 得到sku数据
const getSkuData = async ( spuData: SpuRecordsInterface ) =>
{
  // 父组件用 v-show 控制卡片，组件不会卸载，上次填过的内容会留在表单里。
  // 这里是「给某个SPU新增SKU」，每次打开都应当是干净的空表单，
  // 否则上一条SKU的价格/重量会被当成新数据提交，上一次的校验红字也会残留
  skuData.value.category3Id = spuData.category3Id!;
  skuData.value.spuId = spuData.id!;
  skuData.value.tmId = spuData.tmId!;
  skuData.value.skuName = "";
  skuData.value.price = null;
  skuData.value.weight = "";
  skuData.value.skuDesc = "";
  skuData.value.skuDefaultImg = "";
  skuData.value.skuAttrValueList = [];
  skuFormRef.value?.clearValidate();
  // 发送获取全部属性请求
  let result: SpuResInterface<SpuAttrItemInterface[]> = await getSpuAttr(
    spuData.id,
  );
  if ( result.code == 200 )
  {
    spuAttr.value = result.data;
  }
  // 获取品牌图片
  let imgRes: SpuResInterface<ImgResItemInterface[]> = await getSpuImg(
    spuData.id,
  );
  if ( imgRes.code == 200 )
  {
    imgData.value = imgRes.data;
  }
};
// 点击设置默认图片
const getSkuImg = ( imgItem: ImgResItemInterface ) =>
{
  //让所有的图片都不选中
  imgData.value?.forEach( ( item ) =>
  {
    imgTable.value.toggleRowSelection( item, false );
  } );
  // 让当前点击的图片选中
  imgTable.value.toggleRowSelection( imgItem, true );
  // imgUrl为当前点击的图片地址
  skuData.value.skuDefaultImg = imgItem.imgUrl;
};
// 保存sku数据
const saveSku = async () =>
{
  // 提交前先校验：名称必填、价格与重量必须是非负数字
  const valid = await skuFormRef.value?.validate().catch( () => false );
  if ( !valid ) return;
  // 整理产品属性数据
  let skuAttrValueList = spuAttr.value?.reduce(
    ( prev, next ) =>
    {
      // next为初始值后的每一个值,prev为上一个return值
      if ( next.attrIdAndValueIdList )
      {
        let [ attrId, valueId ] = next.attrIdAndValueIdList.split( ":" );
        prev.push( { attrId, valueId } );
      }
      return prev;
    },
    [] as Array<{ attrId: string | number; valueId: string | number }>,
  );
  if ( skuAttrValueList )
  {
    skuData.value.skuAttrValueList = skuAttrValueList;
  }
  // 发送请求
  let res: GetSpuResInterface<null> = await addSku( skuData.value );
  if ( res.code == 200 )
  {
    ElMessage.success( "添加成功" );
    emit( "changeFlag", { flag: 0, params: "" } );
  } else
  {
    ElMessage.error( getMessage( res, "添加失败" ) );
  }
};
// 将子组件元素暴露给父组件,让父组件控制
defineExpose( { getSkuData } );
</script>

<style lang="scss" scoped>
.attr-row {
  margin-bottom: 10px;
}
</style>
