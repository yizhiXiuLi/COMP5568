<template>
  <div class="health-factor-container">
    <div class="hf-header">
      <span class="label">Health Factor</span>
      <span class="value" :class="hfClass">{{ displayHf }}</span>
    </div>

    <el-progress
      :percentage="hfPercentage"
      :color="hfColor"
      :stroke-width="12"
      :show-text="false"
      class="hf-progress"
    />

    <div class="hf-footer">
      <div v-if="displayHf !== '∞' && Number(displayHf) < 1.0" class="warning-text">
        <el-icon><WarningFilled /></el-icon> Assets at risk of liquidation!
      </div>
      <div v-else-if="estimatedHf" class="preview-text">
        (Estimated after operation)
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { WarningFilled } from '@element-plus/icons-vue';

const props = defineProps({
  healthFactor: {
    type: String,
    required: true
  },
  // borrow/supply 时传入的实时计算值
  estimatedHf: {
    type: [String, Number],
    default: null
  }
});

// 最终显示的数值
const displayHf = computed(() => {
  if (props.estimatedHf !== null) return props.estimatedHf;
  return props.healthFactor;
});

// 计算进度条百分比 (以 1.0 为清算线，3.0 为安全线上限)
const hfPercentage = computed(() => {
  if (displayHf.value === '∞') return 100;
  const val = parseFloat(displayHf.value);
  if (isNaN(val)) return 0;
  
  // 将 0-3.0 映射到 0-100%
  const percentage = (val / 3.0) * 100;
  return Math.min(Math.max(percentage, 5), 100); // 最小给5%展示度
});


const hfClass = computed(() => {
  if (displayHf.value === '∞') return 'text-success';
  const val = parseFloat(displayHf.value);
  if (val >= 1.5) return 'text-success';
  if (val >= 1.0) return 'text-warning';
  return 'text-danger';
});

const hfColor = computed(() => {
  if (displayHf.value === '∞') return '#67C23A';
  const val = parseFloat(displayHf.value);
  if (val >= 1.5) return '#67C23A'; // 绿色
  if (val >= 1.0) return '#E6A23C'; // 橙色
  return '#F56C6C'; // 红色
});
</script>

<style scoped>
.health-factor-container {
  width: 100%;
  padding: 10px 0;
}

.hf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.label {
  font-size: 14px;
  color: #909399;
}

.value {
  font-size: 18px;
  font-weight: bold;
}

.hf-progress {
  margin: 5px 0;
}

.hf-footer {
  height: 20px;
  font-size: 12px;
  margin-top: 4px;
}

.text-success { color: #67C23A; }
.text-warning { color: #E6A23C; }
.text-danger { color: #F56C6C; }

.warning-text {
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-text {
  color: #409eff;
  font-style: italic;
}
</style>