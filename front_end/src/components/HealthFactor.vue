<template>
  <div class="health-factor">
    <div class="hf-label">健康因子 (HF)</div>
    <div class="hf-value">{{ healthFactor }}</div>
    <el-progress
      :percentage="hfPercentage"
      :status="hfStatus"
      :stroke-width="16"
      class="hf-progress"
    />
    <div v-if="!isSafe" class="hf-warning">
      ⚠️ 健康因子低于1.1，有清算风险！
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue';
import { isHfSafe } from '@/utils/validators';

const props = defineProps({
  healthFactor: {
    type: String,
    required: true
  },
  // 预估健康因子（可选，用于借款页实时预览）
  estimatedHf: {
    type: String,
    default: null
  }
});

// 显示的健康因子（优先用预估值）
const displayHf = computed(() => {
  return props.estimatedHf || props.healthFactor;
});

// 健康因子百分比（相对1.1的比例）
const hfPercentage = computed(() => {
  const hf = Number(displayHf.value);
  const percentage = (hf / 1.1) * 100;
  return Math.min(Math.max(percentage, 0), 100);
});

// 健康因子状态
const hfStatus = computed(() => {
  const hf = Number(displayHf.value);
  if (hf >= 1.5) return 'success';
  if (hf >= 1.1) return 'normal';
  if (hf >= 1.0) return 'warning';
  return 'exception';
});

// 是否安全
const isSafe = computed(() => {
  return isHfSafe(Number(displayHf.value));
});
</script>

<style scoped>
.health-factor {
  width: 100%;
  padding: 16px;
}
.hf-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}
.hf-value {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 12px;
}
.hf-progress {
  margin-bottom: 8px;
}
.hf-warning {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 8px;
}
</style>