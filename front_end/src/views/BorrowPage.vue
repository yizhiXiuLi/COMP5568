<template>
  <div class="borrow">
    <Navbar />
    <div class="borrow-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="请先连接钱包以进行操作" />
      </div>

      <div v-else class="operation-container">
        <el-card class="operation-card">
          <template #header>
            <span>借款/还款稳定币</span>
          </template>

          <!-- 余额信息 -->
          <div class="balance-info">
            <div class="balance-item">
              <span>稳定币债务：</span>
              <strong>{{ accountData.debtStable }}</strong>
            </div>
            <div class="balance-item">
              <span>最大可借额度：</span>
              <strong>{{ accountData.maxBorrowable }}</strong>
            </div>
            <div class="balance-item">
              <span>借款年利率：</span>
              <strong>{{ marketData.borrowAPY }}%</strong>
            </div>
          </div>

          <!-- 借款操作 -->
          <el-divider content-position="left">借款稳定币</el-divider>
          <el-form label-width="100px" class="operation-form">
            <el-form-item label="借款数量">
              <el-input
                v-model="borrowAmount"
                placeholder="请输入稳定币数量"
                type="number"
                step="1"
                min="0"
                :class="{ 'input-danger': !isHfSafe(estimatedHf) }"
                @input="calculateEstimatedHf"
              />
              <!-- 额度快捷选择器 -->
              <div class="amount-selector">
                <el-button type="text" @click="setBorrowAmount('25%')">25%</el-button>
                <el-button type="text" @click="setBorrowAmount('50%')">50%</el-button>
                <el-button type="text" @click="setBorrowAmount('75%')">75%</el-button>
                <el-button type="text" @click="setBorrowAmount('100%')">Max</el-button>
              </div>
            </el-form-item>
            
            <!-- 实时健康因子预览 -->
            <el-form-item label="预估健康因子">
              <HealthFactor 
                :health-factor="accountData.healthFactor"
                :estimated-hf="estimatedHf"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button 
                type="success" 
                @click="borrowStable"
                :loading="loading"
                :disabled="!borrowAmount || Number(borrowAmount) <= 0 || !validateBorrowInput(borrowAmount)"
              >
                借款稳定币
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 还款操作 -->
          <el-divider content-position="left">还款稳定币</el-divider>
          <el-form label-width="100px" class="operation-form">
            <el-form-item label="还款数量">
              <el-input
                v-model="repayAmount"
                placeholder="请输入稳定币数量"
                type="number"
                step="1"
                min="0"
              />
              <el-button 
                type="text" 
                @click="repayAmount = accountData.debtStable"
                style="margin-top: 8px;"
              >
                全额还款
              </el-button>
            </el-form-item>
            <el-form-item>
              <el-button 
                type="info" 
                @click="repayStable"
                :loading="loading"
                :disabled="!repayAmount || Number(repayAmount) <= 0 || Number(repayAmount) > Number(accountData.debtStable)"
              >
                {{ repayButtonText }}
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 返回按钮 -->
          <el-button 
            type="text" 
            @click="router.push('/')"
            style="margin-top: 24px;"
          >
            返回首页
          </el-button>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWalletStore } from '@/stores/walletStore';
import Navbar from '@/components/TopNavbar.vue';
import HealthFactor from '@/components/HealthFactor.vue';
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ethers } from 'ethers';
// 导入时保持原名，局部函数改名以避免冲突
import { validateBorrowAmount, estimateHealthFactor, isHfSafe } from '@/utils/validators';
import { COLLATERAL_FACTOR } from '@/constants/addresses';

const router = useRouter();
const walletStore = useWalletStore();
const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const marketData = computed(() => walletStore.marketData);

// 操作金额
const borrowAmount = ref('');
const repayAmount = ref('');

// 还款按钮文案
const repayButtonText = ref('还款稳定币');

// 预估健康因子
const estimatedHf = ref(accountData.value.healthFactor);

// 核心修正：健康因子计算基于 PriceOracle 的实时价格
const calculateEstimatedHf = () => {
  if (!borrowAmount.value || Number(borrowAmount.value) <= 0) {
    estimatedHf.value = accountData.value.healthFactor;
    return;
  }

  const wbtcPrice = Number(marketData.value.wbtcPrice);
  const currentCollateral = Number(accountData.value.collateralWbtc) * wbtcPrice;
  const currentDebt = Number(accountData.value.debtStable);
  const borrowAmountNum = Number(borrowAmount.value);

  estimatedHf.value = estimateHealthFactor(
    currentCollateral,
    currentDebt,
    borrowAmountNum,
    COLLATERAL_FACTOR
  ).toFixed(4);
};

// 设置借款金额（25%/50%/75%/Max）
const setBorrowAmount = (percentage) => {
  const max = Number(accountData.value.maxBorrowable);
  let amount;
  switch (percentage) {
    case '25%': amount = (max * 0.25).toFixed(0); break;
    case '50%': amount = (max * 0.5).toFixed(0); break;
    case '75%': amount = (max * 0.75).toFixed(0); break;
    case '100%': amount = max.toFixed(0); break;
    default: amount = '0';
  }
  borrowAmount.value = amount;
  calculateEstimatedHf();
};

// 修复：重命名局部函数避免与导入冲突，并修正逻辑
const validateBorrowInput = (amount) => {
  const maxBorrowable = ethers.parseUnits(accountData.value.maxBorrowable, 18);
  // 调用导入的验证工具函数
  return validateBorrowAmount(amount, maxBorrowable);
};

// 借款稳定币
const borrowStable = async () => {
  const success = await walletStore.borrowStable(borrowAmount.value);
  if (success) {
    borrowAmount.value = '';
    router.push('/');
  }
};

// 还款稳定币
const repayStable = async () => {
  const success = await walletStore.repayStable(repayAmount.value);
  if (success) {
    repayAmount.value = '';
    router.push('/');
  }
};

// 检查稳定币授权状态
const checkStableApproval = async () => {
  if (!repayAmount.value || Number(repayAmount.value) <= 0) return;
  const isApproved = await walletStore.checkAllowance('STABLECOIN', repayAmount.value);
  repayButtonText.value = isApproved ? '还款稳定币' : '授权稳定币';
};

// 修复：修正 watch 监听写法
watch(repayAmount, () => {
  if (isConnected.value) {
    checkStableApproval();
  }
});

// 页面加载时刷新数据
onMounted(() => {
  if (isConnected.value) {
    walletStore.refreshAllData();
  } else {
    ElMessage.warning('请先连接钱包');
    router.push('/');
  }
});
</script>

<style scoped>
.borrow {
  min-height: 100vh;
  background: #f5f7fa;
}
.borrow-content {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}
.no-connect {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}
.operation-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.operation-card {
  padding: 24px;
}
.balance-info {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}
.balance-item {
  font-size: 14px;
  color: #666;
}
.operation-form {
  margin-bottom: 24px;
}
.amount-selector {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.input-danger {
  border-color: #f56c6c;
}
</style>