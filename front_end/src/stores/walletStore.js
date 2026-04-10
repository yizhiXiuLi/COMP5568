import { defineStore } from 'pinia';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, DECIMALS } from '@/constants/addresses';
import { ElMessage } from 'element-plus';
import LENDING_POOL_ABI from '@/constants/abis/LendingPool.json';
import WBTC_ABI from '@/constants/abis/WBTCToken.json';
import STABLECOIN_ABI from '@/constants/abis/Stablecoin.json';
import PRICE_ORACLE_ABI from '@/constants/abis/PriceOracle.json';
import { fromWei, calculateAPY } from '@/utils/format';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    // 钱包状态
    address: null,
    provider: null,
    signer: null,
    isConnected: false,
    // 4个合约实例
    contracts: {
      lendingPool: null,
      wbtc: null,
      stablecoin: null,
      priceOracle: null 
    },
    // 账户核心数据
    accountData: {
      collateralWbtc: '0',    // 已抵押wBTC（来自LendingPool）
      debtStable: '0',        // 稳定币债务（来自LendingPool）
      healthFactor: '0',      // 健康因子（来自LendingPool）
      wbtcBalance: '0',       // 钱包wBTC余额（直接来自WBTCToken）
      stableBalance: '0',     // 钱包稳定币余额（直接来自Stablecoin）
      maxBorrowable: '0'      // 最大可借额度（来自LendingPool）
    },
    // 市场数据（从PriceOracle直接获取价格）
    marketData: {
      wbtcPrice: '0',         // wBTC价格（直接来自PriceOracle）
      wbtcPriceRaw: 0,        // 原始大数（用于计算）
      borrowRatePerBlock: '0',// 每区块借款利率（来自LendingPool）
      borrowAPY: '0',         // 借款APY
      supplyAPY: '0',         // 供应APY（来自LendingPool，getSupplyRatePerBlock）
      utilizationRate: '0',   // 使用率（直接来自LendingPool）
      lastPriceUpdate: 0      // 价格最后更新时间（来自PriceOracle）
    },
    // 加载状态
    loading: false
  }),

  actions: {
    // 连接钱包并初始化4个合约实例
    async connectWallet() {
      if (!window.ethereum) {
        ElMessage.error('请安装MetaMask钱包！');
        return;
      }

      this.loading = true;
      try {
        // 初始化Provider和Signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        // 初始化4个合约实例（直接交互，核心修正）
        const contracts = {
          lendingPool: new ethers.Contract(CONTRACT_ADDRESSES.LENDING_POOL, LENDING_POOL_ABI.output.abi, signer),
          wbtc: new ethers.Contract(CONTRACT_ADDRESSES.WBTC, WBTC_ABI.output.abi, signer),
          stablecoin: new ethers.Contract(CONTRACT_ADDRESSES.STABLECOIN, STABLECOIN_ABI.output.abi, signer),
          priceOracle: new ethers.Contract(CONTRACT_ADDRESSES.PRICE_ORACLE, PRICE_ORACLE_ABI.output.abi, signer)
        };

        // 更新状态
        this.address = address;
        this.provider = provider;
        this.signer = signer;
        this.contracts = contracts;
        this.isConnected = true;

        this.setupEventListeners();

        // 拉取所有数据
        await this.refreshAllData();
        ElMessage.success('钱包连接成功！');
      } catch (error) {
        console.error('连接钱包失败:', error);
        ElMessage.error('连接失败：' + error.message);
      } finally {
        this.loading = false;
      }
    },

    // 监听逻辑
    async setupEventListeners() {
      if (!window.ethereum) return;

      // 移除旧的监听防止重复绑定
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');

      // 监听账号切换
      window.ethereum.on('accountsChanged', async(accounts) => {
        if (accounts.length === 0) {
          this.disconnectWallet(); // 用户在 MetaMask 中断开
        } else {
          // 账号切换后需重新获取 signer 和 合约实例，否则无法发起交易
          const provider = new ethers.BrowserProvider(window.ethereum);
          this.signer = await provider.getSigner();
          // 重新初始化合约以绑定新的 Signer
          this.contracts = {
            lendingPool: new ethers.Contract(CONTRACT_ADDRESSES.LENDING_POOL, LENDING_POOL_ABI.output.abi, this.signer),
            wbtc: new ethers.Contract(CONTRACT_ADDRESSES.WBTC, WBTC_ABI.output.abi, this.signer),
            stablecoin: new ethers.Contract(CONTRACT_ADDRESSES.STABLECOIN, STABLECOIN_ABI.output.abi, this.signer),
            priceOracle: new ethers.Contract(CONTRACT_ADDRESSES.PRICE_ORACLE, PRICE_ORACLE_ABI.output.abi, this.signer)
          };
          await this.refreshAllData();
          ElMessage.info('已切换账号');
        }
      });

      // 监听链切换
      window.ethereum.on('chainChanged', () => {
        window.location.reload(); // 链切换建议直接刷新页面以重置所有状态
      });
    },

    // 断开钱包
    disconnectWallet() {
      this.address = null;
      this.isConnected = false;
      this.signer = null;
      this.contracts = {
        lendingPool: null,
        wbtc: null,
        stablecoin: null,
        priceOracle: null
      };
      // 清空账户余额数据
      this.accountData = {
        collateralWbtc: '0',
        debtStable: '0',
        healthFactor: '0',
        wbtcBalance: '0',
        stableBalance: '0',
        maxBorrowable: '0'
      };
      ElMessage.warning('钱包已断开连接');
    },

    // 刷新所有数据
    async refreshAllData() {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await Promise.all([
          this.refreshAccountDataFromLendingPool(), // 从LendingPool获取借贷数据
          this.refreshTokenBalancesFromERC20(),     // 直接从ERC20获取余额
          this.refreshPriceFromOracle(),            // 直接从PriceOracle获取价格
          this.refreshRateFromLendingPool()         // 从LendingPool获取利率
        ]);
      } catch (error) {
        console.error('刷新数据失败:', error);
        ElMessage.error('数据刷新失败');
      } finally {
        this.loading = false;
      }
    },

    // 1. 从LendingPool获取账户借贷数据（独立调用）
    async refreshAccountDataFromLendingPool() {
      const { lendingPool } = this.contracts;
      // 获取账户抵押/债务
      const [collateralWbtc, debtStable] = await lendingPool.getUserAccount(this.address);
      // 获取健康因子
      const healthFactorRaw = await lendingPool.getHealthFactor(this.address);
      // 获取最大可借额度
      const maxBorrowable = await lendingPool.getMaxBorrowable(this.address);

      // 获取折算成 USD 的价值（规范 4.2 节）
      const collateralValue = await lendingPool.getCollateralValue(this.address);
      const debtValue = await lendingPool.getDebtValue(this.address);

      // 处理健康因子：如果数值过大，视为无穷大
      let hf = fromWei(healthFactorRaw, 18);
      if (parseFloat(hf) > 1000000) hf = "∞";

      this.accountData = {
        ...this.accountData,
        collateralWbtc: fromWei(collateralWbtc, DECIMALS.WBTC),
        debtStable: fromWei(debtStable, DECIMALS.STABLECOIN),
        healthFactor: hf,
        maxBorrowable: fromWei(maxBorrowable, DECIMALS.STABLECOIN),
        totalCollateralUSD: fromWei(collateralValue, 18),
        totalDebtUSD: fromWei(debtValue, 18)
      };
    },

    // 2. 直接从ERC20合约获取代币余额（核心修正：独立调用WBTCToken/Stablecoin）
    async refreshTokenBalancesFromERC20() {
      const { wbtc, stablecoin } = this.contracts;
      // 直接调用WBTCToken的balanceOf（而非通过LendingPool）
      const wbtcBalance = await wbtc.balanceOf(this.address);
      // 直接调用Stablecoin的balanceOf（而非通过LendingPool）
      const stableBalance = await stablecoin.balanceOf(this.address);

      this.accountData.wbtcBalance = fromWei(wbtcBalance, DECIMALS.WBTC);
      this.accountData.stableBalance = fromWei(stableBalance, DECIMALS.STABLECOIN);
    },

    // 3. 直接从PriceOracle获取wBTC价格（新增：独立调用预言机）
    async refreshPriceFromOracle() {
      const { priceOracle } = this.contracts;
      // 直接调用PriceOracle的getWbtcPrice
      const wbtcPriceRaw = await priceOracle.getWbtcPrice();
      // 获取价格最后更新时间（考虑删除）
      // const lastUpdated = await priceOracle.getLastUpdated();

      this.marketData = {
        ...this.marketData,
        wbtcPrice: fromWei(wbtcPriceRaw, DECIMALS.STABLECOIN),
        wbtcPriceRaw: wbtcPriceRaw,
        // 使用本地当前时间
        lastPriceUpdate: Date.now() 
      };
    },

    // 4. 从LendingPool获取利率数据
    async refreshRateFromLendingPool() {
      const { lendingPool } = this.contracts;
      // 1. 获取借款利率（原有逻辑）
      const borrowRatePerBlock = await lendingPool.getBorrowRatePerBlock();
      const borrowAPY = calculateAPY(borrowRatePerBlock);

      // 2. 获取存款利率（每区块）并计算supplyAPY
      const supplyRatePerBlock = await lendingPool.getSupplyRatePerBlock();
      const supplyAPY = calculateAPY(supplyRatePerBlock); // 复用calculateAPY方法

      // 3. 获取资金利用率（原始值）
      const utilizationRateRaw = await lendingPool.getUtilizationRate();
      // 格式化利用率（通常合约返回的是 1e18 精度的小数，需转成百分比）
      const utilizationRate = (parseFloat(fromWei(utilizationRateRaw)) * 100).toFixed(2);

      this.marketData = {
        ...this.marketData,
        borrowRatePerBlock: fromWei(borrowRatePerBlock),
        borrowAPY,
        supplyAPY: supplyAPY, // 赋值存款APY
        utilizationRate: utilizationRate // 赋值资金利用率（百分比）
      };
    },

    // 触发PriceOracle的价格波动（交互预言机）
    async triggerPriceUpdate() {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        const { priceOracle } = this.contracts;
        const tx = await priceOracle.updatePrice();
        ElMessage.info('触发价格波动中...');
        await tx.wait();
        // 刷新最新价格
        await this.refreshPriceFromOracle();
        ElMessage.success('wBTC价格已更新！');
      } catch (error) {
        console.error('更新价格失败:', error);
        ElMessage.error('价格更新失败：' + error.message);
      } finally {
        this.loading = false;
      }
    },
  }
});