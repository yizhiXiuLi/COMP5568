<template>
  <div class="supply">
    <Navbar />
    <div class="supply-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="请先连接钱包以进行操作" />
      </div>

      <div v-else class="operation-container">
        <el-card class="operation-card">
          <template #header>
            <span>抵押/提取 wBTC</span>
          </template>

          <!-- 余额信息 -->
          <div class="balance-info">
            <div class="balance-item">
              <span>钱包 wBTC 余额：</span>
              <strong>{{ accountData.wbtcBalance }}</strong>
            </div>
            <div class="balance-item">
              <span>已抵押 wBTC：</span>
              <strong>{{ accountData.collateralWbtc }}</strong>
            </div>
          </div>

          <!-- 抵押操作 -->
          <el-divider content-position="left">抵押 wBTC</el-divider>
          <el-form label-width="100px" class="operation-form">
            <el-form-item label="抵押数量">
              <el-input
                v-model="depositAmount"
                placeholder="请输入 wBTC 数量"
                type="number"
                step="0.0001"
                min="0"
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                @click="depositWbtc"
                :loading="loading"
                :disabled="!depositAmount || Number(depositAmount) <= 0"
              >
                {{ depositButtonText }}
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 提取操作 -->
          <el-divider content-position="left">提取 wBTC</el-divider>
          <el-form label-width="100px" class="operation-form">
            <el-form-item label="提取数量">
              <el-input
                v-model="withdrawAmount"
                placeholder="请输入 wBTC 数量"
                type="number"
                step="0.0001"
                min="0"
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="warning" 
                @click="withdrawWbtc"
                :loading="loading"
                :disabled="!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > Number(accountData.collateralWbtc)"
              >
                提取 wBTC
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 返回按钮 -->
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
import { computed, ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';

const walletStore = useWalletStore();
const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const router = useRouter();

// 操作金额
const depositAmount = ref('');
const withdrawAmount = ref('');

// 抵押按钮文案（根据授权状态动态变化）
const depositButtonText = ref('抵押 wBTC');

// 检查 wBTC 授权状态
const checkWbtcApproval = async () => {
  if (!depositAmount.value || Number(depositAmount.value) <= 0) return;
  const isApproved = await walletStore.checkAllowance('WBTC', depositAmount.value);
  depositButtonText.value = isApproved ? '抵押 wBTC' : '授权 wBTC';
};

// 监听抵押金额变化，实时检查授权
watch(depositAmount, () => {
  if (isConnected.value) {
    checkWbtcApproval();
  }
});

// 抵押 wBTC
const depositWbtc = async () => {
  const success = await walletStore.depositWbtc(depositAmount.value);
  if (success) {
    depositAmount.value = '';
  }
};

// 提取 wBTC
const withdrawWbtc = async () => {
  const success = await walletStore.withdrawWbtc(withdrawAmount.value);
  if (success) {
    withdrawAmount.value = '';
  }
};

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