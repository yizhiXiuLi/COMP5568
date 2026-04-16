<template>
  <div class="supply">
    <Navbar />
    <div class="supply-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="Please connect your wallet first" />
      </div>

      <div v-else class="operation-container">
        <el-card class="operation-card">
          <template #header>
            <span>Deposit / Withdraw wBTC</span>
          </template>

          <!-- 余额信息 -->
          <div class="balance-info">
            <div class="balance-item">
              <span>Wallet wBTC Balance: </span>
              <strong>{{ accountData.wbtcBalance }}</strong>
            </div>
            <div class="balance-item">
              <span>Collateral wBTC: </span>
              <strong>{{ accountData.collateralWbtc }}</strong>
            </div>
          </div>

          <!-- 抵押操作 -->
          <el-divider content-position="left">Deposit wBTC</el-divider>
          <el-form label-width="100px" class="operation-form">
            <el-form-item label="Deposit Amount">
              <el-input
                v-model="depositAmount"
                placeholder="Enter wBTC amount"
                type="number"
                step="0.0001"
                min="0"
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                @click="handleDepositClick"
                :loading="loading"
                :disabled="!depositAmount || Number(depositAmount) <= 0"
              >
                {{ depositButtonText }}
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 提取操作 -->
          <el-divider content-position="left">Withdraw wBTC</el-divider>
          <el-form label-width="100px" class="operation-form">
            <el-form-item label="Withdraw Amount">
              <el-input
                v-model="withdrawAmount"
                placeholder="Enter wBTC amount"
                type="number"
                step="0.0001"
                min="0"
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="warning" 
                @click="handleWithdraw"
                :loading="loading"
                :disabled="!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > Number(accountData.collateralWbtc)"
              >
                Withdraw wBTC
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 返回按钮 -->
          <el-button 
            type="text" 
            @click="$router.push('/')"
            style="margin-top: 24px;"
          >
            Back to Dashboard
          </el-button>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWalletStore } from '@/stores/walletStore';
import Navbar from '@/components/TopNavbar.vue';
import { computed, ref, onMounted, watch } from 'vue';

const walletStore = useWalletStore();
const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);

// 操作金额
const depositAmount = ref('');
const withdrawAmount = ref('');
const isWbtcApproved = ref(true);

// 抵押按钮文案（根据授权状态动态变化）
const depositButtonText = computed(() => {
  if (loading.value) return 'Processing...';
  return isWbtcApproved.value ? 'Deposit wBTC' : 'Approve wBTC';
});

// 检查 wBTC 授权状态
const checkWbtcApproval = async () => {
  if (!depositAmount.value || Number(depositAmount.value) <= 0) {
    isWbtcApproved.value = true;
    return;
  }
  // 调用 store 里的通用检查方法
  isWbtcApproved.value = await walletStore.checkAllowance('WBTC', depositAmount.value);
};

// 监听抵押金额变化，实时检查授权
watch(depositAmount, () => {
  if (isConnected.value) checkWbtcApproval();
});

// 处理抵押点击（包含授权逻辑）
const handleDepositClick = async () => {
  if (!isWbtcApproved.value) {
    // 如果没授权，先走授权流程
    const success = await walletStore.approveWbtc(depositAmount.value);
    if (success) await checkWbtcApproval(); // 授权成功后刷新状态
  } else {
    // 已经授权，直接抵押
    const success = await walletStore.depositWbtc(depositAmount.value);
    if (success) depositAmount.value = '';
  }
};

// 提取逻辑
const handleWithdraw = async () => {
  const success = await walletStore.withdrawWbtc(withdrawAmount.value);
  if (success) withdrawAmount.value = '';
};

onMounted(() => {
  if (isConnected.value) walletStore.refreshAllData();
});
</script>

<style scoped>
.supply {
  min-height: 100vh;
  background: #f5f7fa;
}
.supply-content {
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
</style>