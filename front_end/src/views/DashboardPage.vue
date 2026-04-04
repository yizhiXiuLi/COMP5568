<template>
  <div class="dashboard">
    <Navbar />
    <div class="dashboard-content">
      <!-- 未连接钱包 -->
      <div v-if="!isConnected" class="no-connect">
        <el-empty description="请先连接MetaMask钱包以查看账户数据" />
      </div>

      <!-- 已连接钱包 -->
      <div v-else class="data-container">
        <el-card class="data-card">
          <template #header>
            <div class="card-header">
              <span>账户核心数据</span>
              <el-button 
                type="text" 
                @click="refreshData"
                :loading="loading"
              >
                刷新
              </el-button>
            </div>
          </template>

          <div class="data-grid">
            <!-- 已抵押wBTC -->
            <div class="data-item">
              <div class="item-label">已抵押wBTC</div>
              <div class="item-value">{{ accountData.collateralWbtc }}</div>
            </div>
            <!-- 稳定币债务 -->
            <div class="data-item">
              <div class="item-label">稳定币债务</div>
              <div class="item-value">{{ accountData.debtStable }}</div>
            </div>
            <!-- 最大可借额度 -->
            <div class="data-item">
              <div class="item-label">最大可借额度</div>
              <div class="item-value">{{ accountData.maxBorrowable }}</div>
            </div>
            <!-- wBTC价格（新增：来自PriceOracle） -->
            <div class="data-item">
              <div class="item-label">wBTC价格（稳定币）</div>
              <div class="item-value" style="color: #409eff;">
                {{ marketData.wbtcPrice }}
                <el-button 
                  type="text" 
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
            <!-- 借款APY -->
            <div class="data-item">
              <div class="item-label">借款年利率(APY)</div>
              <div class="item-value">{{ marketData.borrowAPY }}%</div>
            </div>
          </div>

          <!-- 健康因子组件 -->
          <HealthFactor :health-factor="accountData.healthFactor" />

          <!-- 操作按钮 -->
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
            <!-- 利率图表 -->
            <RateChart 
              type="rate" 
              title="借款年利率（APY）趋势"
              :base-value="Number(marketData.borrowAPY)"
            />
            <!-- 价格图表 -->
            <RateChart 
              type="price" 
              title="wBTC价格波动"
              :base-value="Number(marketData.wbtcPrice)"
            />
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWalletStore } from '@/stores/walletStore';
import Navbar from '@/components/TopNavbar.vue';
import HealthFactor from '@/components/HealthFactor.vue';
import { computed, onMounted } from 'vue';
import RateChart from '@/components/RateChart.vue';

const walletStore = useWalletStore();
const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const marketData = computed(() => walletStore.marketData);

// 刷新数据
const refreshData = () => {
  walletStore.refreshAllData();
};

// 触发价格波动
const triggerPriceUpdate = () => {
  walletStore.triggerPriceUpdate();
};

// 格式化价格更新时间
const formatTime = (timestamp) => {
  if (!timestamp) return '未知';
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

// 页面加载时刷新数据
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
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
}
.chart-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>