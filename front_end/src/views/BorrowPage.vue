<template>
  <div class="borrow">
    <Navbar />
    <div class="borrow-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="请先连接钱包" />
      </div>

      <div v-else class="operation-container">
        <el-card class="operation-card">
          <template #header>
            <span>借款 / 还款稳定币</span>
          </template>

          <div class="balance-info">
            <div class="balance-item">
              <span>稳定币债务：</span>
              <strong>{{ accountData.debtStable }}</strong>
            </div>
            <div class="balance-item">
              <span>最大可借：</span>
              <strong>{{ accountData.maxBorrowable }}</strong>
            </div>
            <div class="balance-item">
              <span>借款APY：</span>
              <strong>{{ marketData.borrowAPY }}%</strong>
            </div>
          </div>

          <el-divider left>借款稳定币</el-divider>
          <el-form label-width="100px">
            <el-form-item label="借款数量">
              <el-input
                v-model="borrowAmount"
                type="number"
                @input="calculateEstimatedHf"
                :class="{ 'input-danger': !isHfSafe(estimatedHf) }"
              />
              <div class="amount-selector">
                <el-button link @click="setBorrowAmount('25%')">25%</el-button>
                <el-button link @click="setBorrowAmount('50%')">50%</el-button>
                <el-button link @click="setBorrowAmount('75%')">75%</el-button>
                <el-button link @click="setBorrowAmount('100%')">Max</el-button>
              </div>
            </el-form-item>

            <el-form-item label="预估健康因子">
              <HealthFactor :health-factor="accountData.healthFactor" :estimated-hf="estimatedHf" />
            </el-form-item>

            <el-form-item>
              <el-button type="success" @click="borrowStable" :loading="loading" :disabled="!borrowAmount">
                借款稳定币
              </el-button>
            </el-form-item>
          </el-form>

          <el-divider left>还款稳定币</el-divider>
          <el-form label-width="100px">
            <el-form-item label="还款数量">
              <el-input v-model="repayAmount" type="number" placeholder="输入金额">
                <template #append>
                  <el-button @click="setMaxRepay">最大</el-button>
                </template>
              </el-input>
              <div class="input-tip">当前可用余额: {{ accountData.stableBalance }}</div>
            </el-form-item>

            <el-form-item>
              <el-button 
                :type="repayButtonText === '授权稳定币' ? 'warning' : 'primary'" 
                @click="handleRepay" 
                :loading="loading" 
                :disabled="!repayAmount || parseFloat(repayAmount) <= 0"
              >
                {{ repayButtonText }}
              </el-button>
            </el-form-item>
          </el-form>
          <el-button 
            type="text" 
            @click="$router.push('/')"
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
import { isHfSafe, estimateHealthFactor } from '@/utils/validators';
import { COLLATERAL_FACTOR } from '@/constants/addresses';

const walletStore = useWalletStore();

const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const marketData = computed(() => walletStore.marketData);

const borrowAmount = ref('');
const repayAmount = ref('');
const repayButtonText = ref('还款稳定币');
const estimatedHf = ref(accountData.value.healthFactor);

watch(() => accountData.value.healthFactor, (newVal) => {
  // 逻辑：如果用户还没开始输入借款金额，说明还在初始化阶段
  // 此时我们需要让“预估健康因子”等于“当前实际健康因子”
  if (!borrowAmount.value || borrowAmount.value === '') {
    estimatedHf.value = newVal;
  }
}, { immediate: true }); // immediate 确保刷新页面链接钱包后立即执行一次

const calculateEstimatedHf = () => {
  // 直接使用 store 中已经由合约算好的 USD 价值，避免前端计算价格偏差
  const collateralUSD = accountData.value.totalCollateralUSD;
  const debtUSD = accountData.value.totalDebtUSD;
  const inputAmount = borrowAmount.value;

  const hf = estimateHealthFactor(collateralUSD, debtUSD, inputAmount, COLLATERAL_FACTOR);
  estimatedHf.value = hf === Infinity ? '∞' : hf.toFixed(2);
};

const setMaxRepay = () => {
  const debt = parseFloat(accountData.value.debtStable);
  const balance = parseFloat(accountData.value.stableBalance);
  // 取债务和余额的最小值，防止用户输入超过余额的还款额
  repayAmount.value = Math.min(debt, balance).toString();
};

// 监听债务变化，若债务为0则重置输入框
watch(() => accountData.value.debtStable, (newVal) => {
  if (parseFloat(newVal) <= 0) {
    repayAmount.value = '';
  }
});

const setBorrowAmount = (p) => {
  const max = Number(accountData.value.maxBorrowable);
  const map = { '25%': 0.25, '50%': 0.5, '75%': 0.75, '100%': 1 };
  borrowAmount.value = (max * map[p]).toFixed(0);
  calculateEstimatedHf();
};

const borrowStable = async () => {
  await walletStore.borrowStable(borrowAmount.value);
  borrowAmount.value = '';
};

const checkApproval = async () => {
  if (!repayAmount.value || repayAmount.value === '') {
    repayButtonText.value = '还款稳定币';
    return;
  }
  const ok = await walletStore.checkAllowance(repayAmount.value);
  repayButtonText.value = ok ? '还款稳定币' : '授权稳定币';
};

const handleRepay = async () => {
  if (repayButtonText.value === '授权稳定币') {
    await walletStore.approveStablecoin(repayAmount.value);
  }
  await walletStore.repayStable(repayAmount.value);
  repayAmount.value = '';
};

watch(repayAmount, checkApproval);
onMounted(() => {
  if (isConnected.value) walletStore.refreshAllData();
});
</script>

<style scoped>
.borrow { min-height: 100vh; background: #f5f7fa; }
.borrow-content { padding: 24px; max-width: 800px; margin: 0 auto; }
.no-connect { display: flex; justify-content: center; padding: 60px 0; }
.operation-card { padding: 24px; }
.balance-info { display: flex; gap: 24px; margin-bottom: 20px; }
.amount-selector { display: flex; gap: 8px; margin-top: 8px; }
.input-danger { border-color: #f56c6c; }
</style>