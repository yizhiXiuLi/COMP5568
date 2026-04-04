<template>
  <nav class="navbar">
    <div class="navbar-left">
      <h1 class="logo">DeFi借贷平台</h1>
    </div>
    <div class="navbar-middle">
      <div v-if="isConnected" class="balance-info">
        <span>wBTC: {{ accountData.wbtcBalance }}</span>
        <span class="divider">|</span>
        <span>稳定币: {{ accountData.stableBalance }}</span>
      </div>
    </div>
    <div class="navbar-right">
      <el-button 
        v-if="!isConnected" 
        type="primary" 
        @click="connectWallet"
        :loading="loading"
      >
        连接MetaMask
      </el-button>
      <div v-else class="connected-wallet">
        <span class="address">{{ shortAddress }}</span>
        <el-button 
          type="text" 
          @click="disconnectWallet"
          style="color: #f56c6c;"
        >
          断开
        </el-button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useWalletStore } from '@/stores/walletStore';
import { computed } from 'vue';

const walletStore = useWalletStore();
const isConnected = computed(() => walletStore.isConnected);
const loading = computed(() => walletStore.loading);
const accountData = computed(() => walletStore.accountData);
const address = computed(() => walletStore.address);

// 截断钱包地址
const shortAddress = computed(() => {
  if (!address.value) return '';
  return address.value.slice(0, 6) + '...' + address.value.slice(-4);
});

// 连接钱包
const connectWallet = () => {
  walletStore.connectWallet();
};

// 断开钱包
const disconnectWallet = () => {
  walletStore.disconnectWallet();
};
</script>

<style scoped>
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.logo {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
  margin: 0;
}
.balance-info {
  display: flex;
  gap: 12px;
  color: #666;
}
.divider {
  color: #ddd;
}
.connected-wallet {
  display: flex;
  align-items: center;
  gap: 12px;
}
.address {
  font-size: 14px;
  color: #333;
}
</style>