<template>
  <div class="dashboard">
    <Navbar />
    <div class="dashboard-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="请先连接MetaMask钱包以查看账户数据" />
      </div>

      <div v-else class="data-container">
        <el-card class="data-card" v-loading="loading">
          <template #header>
            <div class="card-header">
              <span>账户核心数据</span>
              <el-button 
                type="primary" 
                link
                @click="refreshData"
                :loading="loading"
              >
                刷新
              </el-button>
            </div>
          </template>

          <div class="data-grid">
            <div class="data-item">
              <div class="item-label">已抵押wBTC</div>
              <div class="item-value">{{ accountData.collateralWbtc }}</div>
              <div class="item-sub">约 ${{ accountData.totalCollateralUSD }}</div>
            </div>

            <div class="data-item">
              <div class="item-label">稳定币债务</div>
              <div class="item-value">{{ accountData.debtStable }}</div>
              <div class="item-sub">实时债务: ${{ accountData.totalDebtUSD }}</div>
            </div>

            <div class="data-item">
              <div class="item-label">最大可借额度</div>
              <div class="item-value" style="color: #67c23a;">{{ accountData.maxBorrowable }}</div>
              <div class="item-sub">单位: Stablecoin</div>
            </div>

            <div class="data-item">
              <div class="item-label">wBTC价格（稳定币）</div>
              <div class="item-value" style="color: #409eff;">
                {{ marketData.wbtcPrice }}
                <el-button 
                  type="primary" 
                  link
                  size="small" 
                  @click="triggerPriceUpdate"
                  :loading="loading"
                  style="margin-left: 8px;"
                >
                  刷新价格
                </el-button>
              </div>
              <div class="item-sub">
                最后更新：{{ formatTime(marketData.lastPriceUpdate) }}
              </div>
            </div>

            <div class="data-item">
              <div class="item-label">借款年利率(APY)</div>
              <div class="item-value">{{ marketData.borrowAPY }}%</div>
              <div class="item-sub">基于区块奖励计算</div>
            </div>
          </div>

          <HealthFactor :health-factor="accountData.healthFactor" />

          <div class="action-buttons">
            <el-button 
              type="primary" 
              @click="$router.push('/supply')"
            >
              抵押/提取wBTC
            </el-button>
            <el-button 
              type="success" 
              @click="$router.push('/borrow')"
            >
              借款/还款稳定币
            </el-button>
          </div>
        </el-card>

        <el-card class="chart-card">
          <template #header>
            <span>市场趋势</span>
          </template>
          <div class="chart-grid">
            <RateChart 
              type="rate" 
              title="借款年利率（APY）趋势"
              :base-value="Number(marketData.borrowAPY)"
              :contract-address="CONTRACT_ADDRESSES.LENDING_POOL" 
              :abi="LendingPoolABI"
            />
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useWalletStore } from '@/stores/walletStore'; 
import Navbar from '@/components/TopNavbar.vue';
import HealthFactor from '@/components/HealthFactor.vue';
import RateChart from '@/components/RateChart.vue';
import { CONTRACT_ADDRESSES } from '@/constants/addresses';
import LendingPoolArtifact from '@/constants/abis/LendingPool.json';

const LendingPoolABI = LendingPoolArtifact.output.abi;

const walletStore = useWalletStore();

// 状态映射
const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const marketData = computed(() => walletStore.marketData);

// 刷新数据
const refreshData = () => {
  walletStore.refreshAllData();
};

/**
 * 触发价格波动
 * 逻辑：调用合约 updatePrice() -> 等待 tx 完成 -> store 自动 refreshPriceFromOracle
 */
const triggerPriceUpdate = async () => {
  await walletStore.triggerPriceUpdate();
  // 价格变动后，健康因子同步更新
  await walletStore.refreshAccountDataFromLendingPool();
};

// 格式化价格更新时间
const formatTime = (timestamp) => {
  if (!timestamp || timestamp === 0) return '尚未更新';
  const d = new Date(timestamp);
  const Y = d.getFullYear();
  const M = (d.getMonth() + 1).toString().padStart(2, '0');
  const D = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
};

// 页面加载逻辑
onMounted(() => {
  if (walletStore.isConnected) {
    walletStore.refreshAllData();
  }
});
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f5f7fa;
}
.dashboard-content {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
.no-connect {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}
.data-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.data-card {
  padding: 16px;
  border-radius: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}
.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin: 24px 0;
}
.data-item {
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #efefef;
}
.item-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}
.item-value {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}
.item-sub {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
.action-buttons {
  display: flex;
  gap: 16px;
  margin-top: 24px;
}
.chart-card {
  margin-top: 24px;
  padding: 16px;
  border-radius: 8px;
}
.chart-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>