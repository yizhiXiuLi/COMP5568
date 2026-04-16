<template>
  <div class="liquidation">
    <Navbar />
    <div class="liquidation-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="Please connect your wallet first" />
      </div>

      <div v-else class="operation-container">
        <el-card class="operation-card">
          <template #header>
            <span>Liquidation (cUSD -> seize wBTC)</span>
          </template>

          <el-alert
            title="Only positions with health factor < 1 can be liquidated"
            type="warning"
            :closable="false"
            style="margin-bottom: 16px"
          />

          <div class="balance-info">
            <div class="balance-item">
              <span>Your cUSD Balance: </span>
              <strong>{{ accountData.stableBalance }}</strong>
            </div>
          </div>

          <el-form label-width="140px" class="operation-form">
            <el-form-item label="Target User Address">
              <el-input
                v-model="targetAddress"
                placeholder="0x..."
                @blur="refreshTargetHealth"
              />
              <div class="input-tip" v-if="targetAddress && !isTargetAddressValid">
                Invalid address format.
              </div>
            </el-form-item>

            <el-form-item label="Target Health Factor">
              <el-tag :type="targetHfTagType">{{ targetHealthFactorDisplay }}</el-tag>
            </el-form-item>

            <el-form-item label="Repay cUSD Amount">
              <el-input v-model="repayAmount" type="number" placeholder="Enter repay amount" min="0">
                <template #append>
                  <el-button @click="setMaxRepay">Max</el-button>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item>
              <el-button
                :type="actionButtonText === 'Approve cUSD' ? 'warning' : 'danger'"
                @click="handleLiquidation"
                :loading="loading"
                :disabled="!canSubmit"
              >
                {{ actionButtonText }}
              </el-button>
            </el-form-item>
          </el-form>

          <el-button
            type="text"
            @click="$router.push('/')"
            style="margin-top: 24px"
          >
            Back to Dashboard
          </el-button>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ethers } from 'ethers';
import { useWalletStore } from '@/stores/walletStore';
import Navbar from '@/components/TopNavbar.vue';

const walletStore = useWalletStore();

const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);

const targetAddress = ref('');
const repayAmount = ref('');
const actionButtonText = ref('Liquidate');
const targetHealthFactor = ref('N/A');

const isTargetAddressValid = computed(() => ethers.isAddress(targetAddress.value || ''));

const targetHealthFactorDisplay = computed(() => targetHealthFactor.value);

const targetHfTagType = computed(() => {
  if (targetHealthFactor.value === 'N/A') return 'info';
  if (targetHealthFactor.value === '∞') return 'success';

  const hf = parseFloat(targetHealthFactor.value);
  if (Number.isNaN(hf)) return 'info';
  if (hf < 1) return 'danger';
  if (hf < 1.2) return 'warning';
  return 'success';
});

const canSubmit = computed(() => {
  return isTargetAddressValid.value && Number(repayAmount.value) > 0;
});

const setMaxRepay = () => {
  repayAmount.value = accountData.value.stableBalance || '';
};

const refreshTargetHealth = async () => {
  if (!isConnected.value || !isTargetAddressValid.value) {
    targetHealthFactor.value = 'N/A';
    return;
  }
  targetHealthFactor.value = await walletStore.getHealthFactorByAddress(targetAddress.value);
};

const checkRepayApproval = async () => {
  if (!repayAmount.value || Number(repayAmount.value) <= 0) {
    actionButtonText.value = 'Liquidate';
    return;
  }

  const approved = await walletStore.checkAllowance('STABLECOIN', repayAmount.value);
  actionButtonText.value = approved ? 'Liquidate' : 'Approve cUSD';
};

const handleLiquidation = async () => {
  if (!canSubmit.value) return;

  if (actionButtonText.value === 'Approve cUSD') {
    const approved = await walletStore.approveStablecoin(repayAmount.value);
    if (!approved) return;
  }

  const success = await walletStore.liquidatePosition(targetAddress.value, repayAmount.value);
  if (success) {
    await refreshTargetHealth();
    repayAmount.value = '';
    actionButtonText.value = 'Liquidate';
  }
};

watch(repayAmount, () => {
  if (isConnected.value) checkRepayApproval();
});

watch(targetAddress, () => {
  targetHealthFactor.value = 'N/A';
});

onMounted(() => {
  if (isConnected.value) {
    walletStore.refreshAllData();
  }
});
</script>

<style scoped>
.liquidation {
  min-height: 100vh;
  background: #f5f7fa;
}

.liquidation-content {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.no-connect {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}

.operation-card {
  padding: 24px;
}

.balance-info {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
}

.balance-item {
  font-size: 14px;
  color: #666;
}

.input-tip {
  margin-top: 6px;
  color: #f56c6c;
  font-size: 12px;
}
</style>
