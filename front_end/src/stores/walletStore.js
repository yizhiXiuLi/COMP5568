import { defineStore } from 'pinia';
import { fromWei, calculateAPY } from '@/utils/format';
import { ElMessage } from 'element-plus';

// 模拟大数（替代ethers.BigNumber）
const mockBigNumber = (num, decimals = 18) => {
  return {
    _hex: '0x' + num.toString(16),
    toString: () => num.toString(),
    toNumber: () => num
  };
};

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    // 钱包状态
    address: null,
    provider: null,
    signer: null,
    isConnected: false,
    // 模拟合约实例（空对象，仅占位）
    contracts: {
      lendingPool: {},
      wbtc: {},
      stablecoin: {},
      priceOracle: {}
    },
    // 模拟账户数据
    accountData: {
      collateralWbtc: '0.5',    // 已抵押wBTC
      debtStable: '1000',       // 稳定币债务
      healthFactor: '1.8',      // 健康因子
      wbtcBalance: '1.2',       // 钱包wBTC余额
      stableBalance: '5000',    // 钱包稳定币余额
      maxBorrowable: '2000'     // 最大可借额度
    },
    // 模拟市场数据
    marketData: {
      wbtcPrice: '50000',       // wBTC价格（稳定币）
      wbtcPriceRaw: mockBigNumber(50000 * 10 ** 18),
      borrowRatePerBlock: '0.0000001',
      borrowAPY: '6.8',         // 借款APY
      lastPriceUpdate: Date.now() // 价格最后更新时间
    },
    // 加载状态
    loading: false
  }),

  actions: {
    // 模拟连接钱包（无需真实MetaMask）
    async connectWallet() {
      this.loading = true;
      try {
        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 模拟钱包地址
        this.address = '0x' + Math.random().toString(16).substr(2, 40);
        this.isConnected = true;
        ElMessage.success('钱包连接成功！（模拟）');
      } catch (error) {
        ElMessage.error('连接失败：' + error.message);
      } finally {
        this.loading = false;
      }
    },

    // 模拟断开钱包
    disconnectWallet() {
      this.$reset();
      ElMessage.info('钱包已断开（模拟）');
    },

    // 模拟刷新所有数据（随机生成合理范围的模拟数据）
    async refreshAllData() {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 随机更新数据（保持合理范围）
        this.accountData = {
          collateralWbtc: (Math.random() * 1 + 0.2).toFixed(4),    // 0.2-1.2 wBTC
          debtStable: (Math.random() * 2000 + 500).toFixed(0),     // 500-2500 稳定币
          healthFactor: (Math.random() * 1 + 1.0).toFixed(2),      // 1.0-2.0 健康因子
          wbtcBalance: (Math.random() * 2 + 0.5).toFixed(4),       // 0.5-2.5 wBTC
          stableBalance: (Math.random() * 5000 + 1000).toFixed(0), // 1000-6000 稳定币
          maxBorrowable: (Math.random() * 2000 + 1000).toFixed(0)  // 1000-3000 稳定币
        };

        // 随机更新价格（45000-55000）
        this.marketData.wbtcPrice = (Math.random() * 10000 + 45000).toFixed(0);
        this.marketData.wbtcPriceRaw = mockBigNumber(Number(this.marketData.wbtcPrice) * 10 ** 18);
        this.marketData.lastPriceUpdate = Date.now();

        ElMessage.success('数据刷新成功！（模拟）');
      } catch (error) {
        ElMessage.error('数据刷新失败（模拟）');
      } finally {
        this.loading = false;
      }
    },

    // 模拟检查授权（默认返回已授权）
    async checkAllowance(tokenType, amount) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return true; // 模拟已授权
    },

    // 模拟授权代币
    async approveToken(tokenType, amount) {
      if (!this.isConnected) return false;
      this.loading = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        ElMessage.success(`${tokenType}授权成功！（模拟）`);
        return true;
      } catch (error) {
        ElMessage.error('授权失败：' + error.message);
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 模拟抵押wBTC
    async depositWbtc(amount) {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 模拟抵押后更新数据
        this.accountData.collateralWbtc = (Number(this.accountData.collateralWbtc) + Number(amount)).toFixed(4);
        this.accountData.wbtcBalance = (Number(this.accountData.wbtcBalance) - Number(amount)).toFixed(4);
        ElMessage.success('抵押成功！（模拟）');
        return true;
      } catch (error) {
        ElMessage.error('抵押失败：' + error.message);
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 模拟提取wBTC
    async withdrawWbtc(amount) {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 模拟提取后更新数据
        this.accountData.collateralWbtc = (Number(this.accountData.collateralWbtc) - Number(amount)).toFixed(4);
        this.accountData.wbtcBalance = (Number(this.accountData.wbtcBalance) + Number(amount)).toFixed(4);
        ElMessage.success('提取成功！（模拟）');
        return true;
      } catch (error) {
        ElMessage.error('提取失败：' + error.message);
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 模拟借款稳定币
    async borrowStable(amount) {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 模拟借款后更新数据
        this.accountData.debtStable = (Number(this.accountData.debtStable) + Number(amount)).toFixed(0);
        this.accountData.stableBalance = (Number(this.accountData.stableBalance) + Number(amount)).toFixed(0);
        this.accountData.healthFactor = (Number(this.accountData.healthFactor) - 0.1).toFixed(2); // 健康因子下降
        ElMessage.success('借款成功！（模拟）');
        return true;
      } catch (error) {
        ElMessage.error('借款失败：' + error.message);
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 模拟还款稳定币
    async repayStable(amount) {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 模拟还款后更新数据
        this.accountData.debtStable = (Number(this.accountData.debtStable) - Number(amount)).toFixed(0);
        this.accountData.stableBalance = (Number(this.accountData.stableBalance) - Number(amount)).toFixed(0);
        this.accountData.healthFactor = (Number(this.accountData.healthFactor) + 0.1).toFixed(2); // 健康因子上升
        ElMessage.success('还款成功！（模拟）');
        return true;
      } catch (error) {
        ElMessage.error('还款失败：' + error.message);
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 模拟触发价格更新
    async triggerPriceUpdate() {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 随机更新价格（45000-55000）
        this.marketData.wbtcPrice = (Math.random() * 10000 + 45000).toFixed(0);
        this.marketData.wbtcPriceRaw = mockBigNumber(Number(this.marketData.wbtcPrice) * 10 ** 18);
        this.marketData.lastPriceUpdate = Date.now();
        ElMessage.success('wBTC价格已更新！（模拟）');
      } catch (error) {
        ElMessage.error('价格更新失败：' + error.message);
      } finally {
        this.loading = false;
      }
    }
  }
});