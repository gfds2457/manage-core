<template>
  <div class="brand-card">
    <div class="brand-card-head">
      <span class="brand-card-eyebrow">手机品牌卡片</span>
      <span class="brand-card-tag">{{ cardName || "未知卡片" }}</span>
    </div>

    <div class="brand-card-body" v-loading="loading">
      <img v-if="brand?.logoUrl" :src="brand.logoUrl" class="brand-logo" alt="" />
      <div v-else class="brand-logo brand-logo--empty">
        {{ ( brand?.tmName || phoneName || "?" ).slice( 0, 1 ) }}
      </div>
      <div class="brand-meta">
        <h4 class="brand-name">{{ brand?.tmName || phoneName || "未指定品牌" }}</h4>
        <p class="brand-desc">{{ descText }}</p>
      </div>
    </div>

    <button class="btn" :disabled="!phoneName" @click="select">
      看看 {{ phoneName || "该品牌" }} 的在售商品
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { PropType } from "vue";
import { getBrandList } from "@/API/product";
import type { BrandItemInterface } from "@/views/goods/brand/type";

defineOptions( {
  name: "BrandCard",
} );

/** 后端 frontList 里唯一的卡片工具名，见 admin-ai-backend/src/utils/toolList.js */
const PHONE_BRAND_CARD = "phoneBrand_card";

const props = defineProps( {
  // 工具卡片名称：后端把 tool_calls 里命中 frontList 的调用作为卡片推给前端
  cardName: { type: String, default: "" },
  // 模型为该工具生成的参数，phoneBrand_card 带 { phone: "华为" }
  cardArgs: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ( {} ),
  },
} );

const $emit = defineEmits( [ "select" ] );

// 品牌库列表：卡片展示的 LOGO 与正式品牌名都从品牌管理接口取真实数据
const brandList = ref<BrandItemInterface[]>( [] );
const loading = ref( false );

// 模型给的品牌名，可能是「华为」「小米」这类中文名
const phoneName = computed( () =>
{
  const phone = props.cardArgs?.phone;
  return typeof phone === "string" ? phone.trim() : "";
} );

// 按名称匹配品牌库记录：
// 优先精确命中，退化成互相包含，兼容「华为」与「HUAWEI」这类写法差异
const brand = computed<BrandItemInterface | null>( () =>
{
  const name = phoneName.value;
  if ( !name ) return null;
  const lower = name.toLowerCase();
  const exact = brandList.value.find(
    ( item ) => ( item.tmName ?? "" ).toLowerCase() === lower,
  );
  if ( exact ) return exact;
  return (
    brandList.value.find( ( item ) =>
    {
      const tmName = ( item.tmName ?? "" ).toLowerCase();
      return tmName.includes( lower ) || lower.includes( tmName );
    } ) ?? null
  );
} );

// 卡片下方的说明文案，把「加载中 / 命中 / 未命中」三种状态说清楚
const descText = computed( () =>
{
  if ( !phoneName.value ) return "模型这次没有给出品牌名";
  if ( loading.value ) return "正在读取品牌库…";
  if ( brand.value ) return `来自品牌管理库 · 品牌 id ${ brand.value.id }`;
  return "品牌管理库里暂时没有这个品牌";
} );

// 拉取品牌库。卡片是只读展示 + 一个跳转动作，
// 读不到就降级成「只显示模型给的品牌名」，不让异常冒到控制台
const loadBrands = async () =>
{
  if ( props.cardName !== PHONE_BRAND_CARD ) return;
  loading.value = true;
  try
  {
    const res: any = await getBrandList( 1, 100 );
    const records = res?.data?.records;
    brandList.value = Array.isArray( records ) ? records : [];
  } catch ( err )
  {
    console.warn( "[brandCard] 品牌库读取失败:", err );
    brandList.value = [];
  } finally
  {
    loading.value = false;
  }
};

// phoneName 一到就能拉数据（immediate），换一张卡片时也会重新拉
watch( phoneName, () =>
{
  void loadBrands();
}, { immediate: true } );

// 选择：把后续问题填进输入框交给用户确认，不替用户直接发起模型调用
const select = () =>
{
  if ( !phoneName.value ) return;
  $emit( "select", `请介绍一下 ${ phoneName.value } 品牌目前在售的商品` );
};
</script>

<style lang="scss" scoped>
/* 与问答页同一套配色：浅底卡片 + 细描边 + 深靛蓝主色 */
$ink: #1f2937;
$muted: #9ca3af;
$line: #eceef2;
$accent: #26307a;
$accent-soft: rgba(38, 48, 122, 0.08);

.brand-card {
  display: inline-block;
  max-width: 420px;
  padding: 14px 16px;
  border: 1px solid $line;
  border-radius: 10px;
  background: #fff;
}

.brand-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.brand-card-eyebrow {
  font-size: 13px;
  font-weight: 600;
  color: $ink;
}

.brand-card-tag {
  font-size: 11px;
  color: $accent;
  background: $accent-soft;
  border-radius: 4px;
  padding: 2px 6px;
}

.brand-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid $line;
  background: #fff;
  flex-shrink: 0;

  &--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    color: $accent;
    background: $accent-soft;
    border-color: transparent;
  }
}

.brand-meta {
  min-width: 0;
}

.brand-name {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: $ink;
}

.brand-desc {
  margin: 0;
  font-size: 12px;
  color: $muted;
}

.btn {
  width: 100%;
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: #fff;
  background: $accent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.88;
  }

  &:disabled {
    color: $muted;
    background: $line;
    cursor: not-allowed;
  }
}
</style>
