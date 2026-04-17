<template>
  <div class="dashboard">
    <Navbar />
    <div class="dashboard-content">
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="Please connect wallet to view account data" />
      </div>

      <div v-else class="data-container">
        <el-card class="data-card" v-loading="loading">
          <template #header>
            <div class="card-header">
              <span>Account Core Data</span>
              <el-button 
                type="primary" 
                link
                @click="refreshData"
                :loading="loading"
              >
                Refresh
              </el-button>
            </div>
          </template>

          <div class="data-grid">
            <div class="data-item">
              <div class="item-label">Collateral wBTC</div>
              <div class="item-value">{{ accountData.collateralWbtc }}</div>
              <div class="item-sub">about {{ accountData.totalCollateralUSD }} cUSD</div>
            </div>

            <div class="data-item">
              <div class="item-label">cUSD Debt</div>
              <div class="item-value">{{ accountData.debtStable }}</div>
              <div class="item-sub">Total Debt: ${{ accountData.totalDebtUSD }}</div>
            </div>

            <div class="data-item">
              <div class="item-label">Max Borrow Limit</div>
              <div class="item-value" style="color: #67c23a;">{{ accountData.maxBorrowable }}</div>
              <div class="item-sub">Unit: cUSD</div>
            </div>

            <div class="data-item">
              <div class="item-label">wBTC Price (cUSD)</div>
              <div class="item-value" style="color: #409eff;">
                {{ marketData.wbtcPrice }}
              </div>
              <div class="item-sub">
                Last Update: {{ formatTime(marketData.lastPriceUpdate) }}
              </div>
            </div>

            <div class="data-item">
              <div class="item-label">Borrow APR</div>
              <div class="item-value">{{ marketData.borrowAPR }}%</div>
            </div>

            <div class="data-item">
              <div class="item-label">Supply APY</div>
              <div class="item-value" style="color: #00b42a;">{{ marketData.supplyAPY }}%</div>
            </div>

            <div class="data-item">
              <div class="item-label">Protocol Utilization Rate</div>
              <div class="item-value" style="color: #ff7d00;">{{ marketData.utilizationRate }}%</div>
            </div>
            <div class="data-item">
              <div class="item-label">Current Max LTV</div>
              <div class="item-value">
                {{ (parseFloat(marketData.collateralFactor) * 100).toFixed(0) }}%
              </div>
              <div class="item-sub">
                Liquidation Threshold: {{ (parseFloat(marketData.liquidationThreshold) * 100).toFixed(0) }}%
              </div>
            </div>
            <div class="data-item">
              <div class="item-label" style="color: #f56c6c; font-weight: bold;">Estimated Liquidation Price (cUSD)</div>
              <div class="item-value" style="color: #f56c6c;">
                {{ liquidationPrice }}
              </div>
              <div class="item-sub">
                Liquidation triggered if wBTC drops to this price
              </div>
            </div>
          </div>

          <HealthFactor :health-factor="accountData.healthFactor" />

          <div class="action-buttons">
            <el-button 
              type="primary" 
              @click="$router.push('/supply')"
            >
              Deposit / Withdraw wBTC
            </el-button>
            
            <el-button 
              type="success" 
              @click="$router.push('/borrow')"
            >
              Borrow / Repay cUSD
            </el-button>

            <el-button 
              type="warning" 
              @click="$router.push('/liquidation')"
            >
              Liquidation
            </el-button>
          </div>
        </el-card>

        <el-card class="chart-card">
          <template #header>
            <span>Interest rate model</span>
          </template>
          <div class="chart-grid">
            <RateChart 
              type="rate" 
              title="Borrow APR Trend"
              :base-value="Number(marketData.borrowAPR)"
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

const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const marketData = computed(() => walletStore.marketData);
const liquidationPrice = computed(() => {
  const collateral = parseFloat(accountData.value.collateralWbtc);
  const debtUSD = parseFloat(accountData.value.totalDebtUSD);
  
  // 从 marketData 动态获取清算阈值
  const threshold = parseFloat(marketData.value.liquidationThreshold) || 0.8;

  if (!collateral || collateral <= 0 || !debtUSD || debtUSD <= 0) {
    return "No Liquidation Risk"; 
  }

  // 计算公式：清算价格 = 债务 / (抵押数量 * 清算阈值)
  const price = debtUSD / (collateral * threshold);
  
  return price.toLocaleString(undefined, { 
    minimumFractionDigits: 4, 
    maximumFractionDigits: 4 
  });
});

const refreshData = () => {
  walletStore.refreshAllData();
};

const formatTime = (timestamp) => {
  if (!timestamp || timestamp === 0) return 'Not Updated';
  const d = new Date(timestamp);
  const Y = d.getFullYear();
  const M = (d.getMonth() + 1).toString().padStart(2, '0');
  const D = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
};

onMounted(() => {
  if (walletStore.isConnected) {
    walletStore.refreshAllData();
  }
  window.testStore = walletStore;
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