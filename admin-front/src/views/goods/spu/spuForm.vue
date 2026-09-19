<template>
  <div>
    <el-card style="margin-top: 5px">
      <!-- 表单 -->
      <el-form label-width="100px" style="max-width: 1500px">
        <el-form-item label="SPU名称">
          <el-input placeholder="请你输入SPU名称" v-model=" spuRowData.spuName " />
        </el-form-item>
        <el-form-item label="SPU品牌">
          <el-select placeholder="请你选择品牌" v-model=" brandSelectValue ">
            <el-option :label=" item.tmName " :value=" item.tmName " v-for=" item in brandData " :key=" item.id " />
          </el-select>
        </el-form-item>
        <el-form-item label="SPU描述">
          <el-input type="textarea" v-model=" spuRowData.description " />
        </el-form-item>
        <!-- 图片上传 -->
        <el-form-item label="SPU照片">
          <el-upload :action="uploadUrl" list-type="picture-card" :on-preview=" handlePictureCardPreview "
            v-model:file-list=" fileList ">
            <el-icon>
              <Plus />
            </el-icon>
          </el-upload>
          <el-dialog v-model=" dialogVisible ">
            <!-- v-model组件通信，父子组件共用一个值 -->
            <img w-full alt="Preview Image" :src=" dialogImageUrl " style="width: 100%" />
          </el-dialog>
        </el-form-item>
        <el-form-item label="SPU销售属性">
          <div class="saleAtrr" style="display: flex">
            <!-- 选择框 -->
            <!-- v-model收集点到option的value值,不是所有option的value -->
            <!-- el-select 传递整个对象时，要加上 value-key="id"，让 Element Plus 用对象的 id 做唯一标识。 -->
            <el-select placeholder="请您选择" style="width: 280px; margin-right: 10px" v-model=" attrSelectValue "
              value-key="id">
              <!-- :value="item"把整个对象都给v-model -->
              <el-option :label=" item.saleAttrName " v-for=" item in fileterSaleAttr " :key=" item.id "
                :value=" item " />
            </el-select>
            <!-- 按钮 -->
            <el-button type="primary" icon="Plus" @click=" addSaleAttr "
              :disabled=" attrSelectValue ? false : true ">添加属性</el-button>
            <!-- 表格 -->
          </div>
          <!-- 商品属性表格 -->
          <el-table border style="width: 100%; margin-top: 10px" :data=" attrData ">
            <el-table-column label="序号" width="100" type="index" />
            <el-table-column label="销售属性名" prop="saleAttrName" width="180" />
            <el-table-column label="销售属性值" prop="Name" width="650">
              <template #default=" { row, $index } ">
                <!-- 只要是循环遍历逻辑，item永远指向当前点击的那条数据 -->
                <!-- @close="handleClose(item, row)"这里给的item是给的他自己 -->
                <el-tag v-for=" item in row.spuSaleAttrValueList " :key=" item.id ?? item.saleAttrValueName "
                  style="margin: 5px" closable :disable-transitions=" false " @close="handleClose( item, row )">
                  {{ item.saleAttrValueName }}
                </el-tag>
                <!-- activeInputRowIndex：你要编辑的输入框是第几行；$index：
                 要打开的input是第几行 -->
                <el-input v-if=" activeInputRowIndex === $index " v-model=" inputValue " v-focus class="w-20"
                  size="small" @keyup.enter="handleInputConfirm( row )" @blur="handleInputConfirm( row )"
                  style="width: 70px" />
                <el-button v-else class="button-new-tag" size="small" @click="showInput( $index )" icon="Plus"
                  type="primary">
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default=" { $index } ">
                <el-button type="danger" icon="Delete" style="width: 45px; margin-left: 20px"
                  @click="attrData.splice( $index, 1 )"></el-button>
              </template>
            </el-table-column>
          </el-table>
          <!-- 底部按钮 -->
          <div class="buttonBottom" style="margin-top: 10px">
            <el-button type="primary" @click=" save ">保存</el-button>
            <el-button @click="emit( 'changeFlag', { flag: 0, params: 'update' } )">取消</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// 定义组件名
defineOptions( {
  name: "spuForm",
} );
import { ref, computed, nextTick, onUnmounted, type Directive } from "vue";
import type {
  SpuRecordsInterface,
  SpuResInterface,
  BrandResItemInterface,
  ImgResItemInterface,
  SpuAttrItemInterface,
  spuAttrValueListInterface,
  ImgListInterface,
  GetSpuResInterface,
} from "./type";
import { getSpuBrand, getSpuImg, getSpuAttr, addUpdateSpu } from "@/API/spu";
import { ElMessage, type UploadProps } from "element-plus";
import { getMessage } from "@/composables/useRecycleBin";
// 上传接口直连独立 mock 后端（跨域），地址统一从环境变量读取
const uploadUrl =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api") +
  "/product/upload";
// tag输入框值存储
const inputValue = ref( "" );
// 当前正在编辑的属性值行索引
const activeInputRowIndex = ref<number | null>( null );
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
// 点击修改按钮收集到的对应行数据
let spuRowData = ref<SpuRecordsInterface>( {} );
// select选择框数据
let attrSelectValue = ref<SpuAttrItemInterface | null>( null );
// 所有品牌数据
let brandData = ref<BrandResItemInterface[] | undefined>( [] );
// select中的品牌数据（选中后存的是品牌名字符串，初始对象仅为占位）
let brandSelectValue = ref<string | { id: number }>( {
  id: 0,
} );
// 品牌图片数据
let imgData = ref<ImgResItemInterface[] | undefined>( [] );
// 销售属性数据
let attrData = ref<SpuAttrItemInterface[]>( [] );
// 缓存已保存的销售属性，避免关闭后重新打开时丢失新增值。
//
// 用 Map 而不是普通对象：普通对象的整数键会按数值升序排在最前，
// 「删掉再写回」并不能把键挪到末尾，做不了「最近使用」淘汰；Map 的插入顺序对所有键都成立。
// 另外这里故意不用 ref：缓存只在加载/保存时读写，不参与渲染，
// 包成响应式只会白白让每个属性值数组都变成 Proxy。
// 组件在父页面里是 v-show 常驻的，所以必须设上限，否则编辑过的 SPU 越多内存涨得越大
const ATTR_CACHE_LIMIT = 20;
const attrCache = new Map<number, SpuAttrItemInterface[]>();
/** 写缓存并按 LRU 淘汰最久未用的 SPU */
const setAttrCache = ( spuId: number, data: SpuAttrItemInterface[] ) =>
{
  // 先删再写，把该 spuId 挪到插入顺序末尾（即最近使用）
  attrCache.delete( spuId );
  attrCache.set( spuId, data );
  while ( attrCache.size > ATTR_CACHE_LIMIT )
  {
    const oldest = attrCache.keys().next().value;
    if ( oldest === undefined ) break;
    attrCache.delete( oldest );
  }
};
/** 读缓存，同时把命中的 spuId 标记为最近使用 */
const getAttrCache = ( spuId: number ) =>
{
  const hit = attrCache.get( spuId );
  if ( hit !== undefined )
  {
    setAttrCache( spuId, hit );
  }
  return hit;
};
// 组件真正卸载（切换路由）时释放缓存，避免离开商品页后这些属性数据还被引用着
onUnmounted( () =>
{
  attrCache.clear();
} );
// 控制图片预览框开关
let dialogVisible = ref<boolean>( false );
// 用于屏蔽旧请求对当前状态的覆盖
let requestVersion = 0;
// 所有销售属性名
const saleAttrNameList: SpuAttrItemInterface[] = [
  { id: 1, saleAttrName: "机身颜色", spuSaleAttrValueList: [] },
  { id: 2, saleAttrName: "运行内存", spuSaleAttrValueList: [] },
  { id: 3, saleAttrName: "机身存储", spuSaleAttrValueList: [] },
  { id: 4, saleAttrName: "苹果配色", spuSaleAttrValueList: [] },
  { id: 5, saleAttrName: "网络版本", spuSaleAttrValueList: [] },
  { id: 6, saleAttrName: "存储容量", spuSaleAttrValueList: [] },
  { id: 7, saleAttrName: "后盖材质", spuSaleAttrValueList: [] },
  { id: 8, saleAttrName: "屏幕规格", spuSaleAttrValueList: [] },
  { id: 9, saleAttrName: "镜头规格", spuSaleAttrValueList: [] },
  { id: 10, saleAttrName: "鸿蒙版本", spuSaleAttrValueList: [] },
  { id: 11, saleAttrName: "人像滤镜", spuSaleAttrValueList: [] },
  { id: 12, saleAttrName: "充电功率", spuSaleAttrValueList: [] },
  { id: 13, saleAttrName: "处理器版本", spuSaleAttrValueList: [] },
  { id: 14, saleAttrName: "影像套装", spuSaleAttrValueList: [] },
  { id: 15, saleAttrName: "质保年限", spuSaleAttrValueList: [] },
  { id: 16, saleAttrName: "套餐版本", spuSaleAttrValueList: [] },
];
// 收集过滤出的销售属性名
// 1.根据所有属性过滤出缺少的属性
// 2.select渲染
let fileterSaleAttr = computed( () =>
{
  return saleAttrNameList.filter( ( item ) =>
  {
    return attrData.value.every(
      ( ele ) => item.saleAttrName !== ele.saleAttrName,
    );
  } );
} );
// 给父组件传输数据
const emit = defineEmits( [ "changeFlag" ] );
// 存储图片列表中图片
let fileList = ref();
// 存储图片对话框中图片
let dialogImageUrl = ref();
// 整个表单数据整合
// 方法
// 删除属性值标签
const handleClose = (
  // 点击x要删除的那条tag
  tag: spuAttrValueListInterface,
  // row为当前行数据
  row: SpuAttrItemInterface,
) =>
{
  // 把点了X的tag筛选出去
  row.spuSaleAttrValueList = row.spuSaleAttrValueList.filter(
    ( item ) => item !== tag,
  );
};
// 切换属性值tag为输入框，v-focus 会在 input 挂载后自动聚焦
const showInput = ( index: number ) =>
{
  // 用户点击输入框时，把该行对应的index赋值给他，这样就只有对应的输入框可以显示
  activeInputRowIndex.value = index;
  inputValue.value = "";
};
// 将添加属性值保存
const handleInputConfirm = ( row: SpuAttrItemInterface ) =>
{
  const value = inputValue.value.trim();
  // 属性值非空判断
  if ( !value )
  {
    ElMessage.error( "属性值内容不能为空" );
    return;
  }
  // 属性值非重复判断
  const repeat = row.spuSaleAttrValueList.find( ( ele ) =>
  {
    return value == ele.saleAttrValueName;
  } );
  if ( repeat )
  {
    ElMessage.error( "属性值内容不能重复" );
    return;
  }
  row.spuSaleAttrValueList.push( {
    saleAttrValueName: value,
    id: row.spuSaleAttrValueList.length + 1,
  } );
  activeInputRowIndex.value = null;
  inputValue.value = "";
};
const cloneAttrList = ( list: SpuAttrItemInterface[] ) =>
{
  return list.map( ( item ) => ( {
    ...item,
    spuSaleAttrValueList: [ ...( item.spuSaleAttrValueList || [] ) ],
  } ) );
};
// 发送卡片所有相关数据请求
const allSpu = async ( spuData: SpuRecordsInterface ) =>
{
  const currentVersion = ++requestVersion;
  spuRowData.value = spuData;
  attrSelectValue.value = null;
  activeInputRowIndex.value = null;
  inputValue.value = "";
  const cachedAttr = spuData.id ? getAttrCache( spuData.id ) : undefined;
  if ( cachedAttr )
  {
    attrData.value = cloneAttrList( cachedAttr );
  } else
  {
    attrData.value = [];
  }
  // 获取全部品牌请求
  let brandRes: SpuResInterface<BrandResItemInterface[]> = await getSpuBrand();
  if ( brandRes.code == 200 )
  {
    brandData.value = brandRes.data;
  }
  // 获取品牌图片
  let imgRes: SpuResInterface<ImgResItemInterface[]> = await getSpuImg(
    spuData.id,
  );
  if ( currentVersion !== requestVersion ) return;
  if ( imgRes.code == 200 )
  {
    imgData.value = imgRes.data;
    // 遍历添加key值，让图片列表能够读取对应key渲染
    fileList.value = imgData.value?.map( ( item ) =>
    {
      return {
        name: item.imgName,
        url: item.imgUrl,
      };
    } );
  }
  // 获取对应销售属性接口
  let spuAttr: SpuResInterface<SpuAttrItemInterface[]> = await getSpuAttr(
    spuData.id,
  );
  if ( currentVersion !== requestVersion ) return;
  if ( spuAttr.code == 200 && spuAttr.data )
  {
    const serverAttrList = cloneAttrList( spuAttr.data );
    const cachedList = spuData.id ? getAttrCache( spuData.id ) : undefined;
    if ( cachedList )
    {
      const cacheMap = new Map(
        cachedList.map( ( item ) => [ item.saleAttrName, item ] ),
      );
      attrData.value = serverAttrList.map( ( item ) =>
      {
        const cachedItem = cacheMap.get( item.saleAttrName );
        if ( cachedItem )
        {
          return {
            ...item,
            ...cachedItem,
            spuSaleAttrValueList: cachedItem.spuSaleAttrValueList?.length
              ? [ ...cachedItem.spuSaleAttrValueList ]
              : item.spuSaleAttrValueList,
          };
        }
        return item;
      } );
    } else
    {
      attrData.value = serverAttrList;
    }
  }
};
// 图片列表中预览按钮
const handlePictureCardPreview: UploadProps[ "onPreview" ] = ( uploadFile ) =>
{
  dialogImageUrl.value = uploadFile.url;
  dialogVisible.value = true;
};
// 添加商品属性按钮
const addSaleAttr = () =>
{
  if ( attrSelectValue.value )
  {
    attrData.value.push( attrSelectValue.value );
    attrSelectValue.value = null;
  }
};
// 保存并提交按钮
const save = async () =>
{
  // 1.整理数据
  // 修改图片文件存储名
  let spuImageList = fileList.value.map( ( file: ImgListInterface ) =>
  {
    return {
      imgName: file.name,
      imgUrl: ( file.response && file.response.data ) || file.url,
    };
  } );
  spuRowData.value.spuImageList = spuImageList;
  const saveAttrData = attrData.value.map( ( item ) => ( {
    ...item,
    spuSaleAttrValueList: [ ...( item.spuSaleAttrValueList || [] ) ],
  } ) );
  spuRowData.value.spuSaleAttrList = saveAttrData;
  if ( spuRowData.value.id )
  {
    setAttrCache( spuRowData.value.id, saveAttrData );
  }
  // 2.发送请求
  let res: GetSpuResInterface<null> = await addUpdateSpu( spuRowData.value );
  // 3.跳转到父组件，让父组件重新渲染一遍数据
  if ( res.code == 200 )
  {
    ElMessage.success( spuRowData.value.id ? "修改成功" : "添加成功" );
    emit( "changeFlag", {
      flag: 0,
      params: spuRowData.value.id ? "update" : "add",
    } );
  } else
  {
    ElMessage.error( getMessage( res, spuRowData.value.id ? "修改失败" : "添加失败" ) );
  }
};
// 添加属性按钮
const addSpuAttr = async ( category3Id: number ) =>
{
  // 每次进入新增模式时，使用全新的空对象，避免继承上一次编辑残留的属性
  spuRowData.value = {
    category3Id,
    description: "",
    id: undefined,
    spuImageList: [],
    spuName: "",
    spuSaleAttrList: [],
    tmId: null,
  };
  spuRowData.value.spuSaleAttrList = [];
  attrSelectValue.value = null;
  activeInputRowIndex.value = null;
  inputValue.value = "";
  imgData.value = [];
  fileList.value = [];
  attrData.value = [];
  brandSelectValue.value = { id: 0 };
  // 获取全部品牌请求
  let brandRes: SpuResInterface<BrandResItemInterface[]> = await getSpuBrand();
  if ( brandRes.code == 200 )
  {
    brandData.value = brandRes.data;
  }
};
// 将该组件中元素暴露给父组件
defineExpose( { allSpu, addSpuAttr } );
</script>

<style lang="scss" scoped></style>
