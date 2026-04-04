import { defineStore } from 'pinia';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, DECIMALS } from '@/constants/addresses';
import { ElMessage } from 'element-plus';
// import LENDING_POOL_ABI from '@/constants/abis/LendingPool.json';
// import WBTC_ABI from '@/constants/abis/WBTC.json';
// import STABLECOIN_ABI from '@/constants/abis/Stablecoin.json';
// import PRICE_ORACLE_ABI from '@/constants/abis/PriceOracle.json';
import { fromWei, calculateAPY } from '@/utils/format';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    // 钱包状态
    address: null,
    provider: null,
    signer: null,
    isConnected: false,
    // 4个合约实例（核心修正：新增PriceOracle）
    contracts: {
      lendingPool: null,
      wbtc: null,
      stablecoin: null,
      priceOracle: null // 新增PriceOracle合约实例
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
    // 市场数据（核心修正：从PriceOracle直接获取价格）
    marketData: {
      wbtcPrice: '0',         // wBTC价格（直接来自PriceOracle）
      wbtcPriceRaw: 0,        // 原始大数（用于计算）
      borrowRatePerBlock: '0',// 每区块借款利率（来自LendingPool）
      borrowAPY: '0',         // 借款APY
      lastPriceUpdate: 0      // 价格最后更新时间（来自PriceOracle）
    },
    // 加载状态
    loading: false
  }),

  actions: {
    // 连接钱包并初始化4个合约实例（核心修正）
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
          // lendingPool: new ethers.Contract(CONTRACT_ADDRESSES.LENDING_POOL, LENDING_POOL_ABI, signer),
          // wbtc: new ethers.Contract(CONTRACT_ADDRESSES.WBTC, WBTC_ABI, signer),
          // stablecoin: new ethers.Contract(CONTRACT_ADDRESSES.STABLECOIN, STABLECOIN_ABI, signer),
          // priceOracle: new ethers.Contract(CONTRACT_ADDRESSES.PRICE_ORACLE, PRICE_ORACLE_ABI, signer)
        };

        // 更新状态
        this.address = address;
        this.provider = provider;
        this.signer = signer;
        this.contracts = contracts;
        this.isConnected = true;

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

    // 刷新所有数据（核心修正：拆分4个合约的独立调用）
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
      const healthFactor = await lendingPool.getHealthFactor(this.address);
      // 获取最大可借额度
      const maxBorrowable = await lendingPool.getMaxBorrowable(this.address);

      this.accountData = {
        ...this.accountData,
        collateralWbtc: fromWei(collateralWbtc, DECIMALS.WBTC),
        debtStable: fromWei(debtStable, DECIMALS.STABLECOIN),
        healthFactor: fromWei(healthFactor, DECIMALS.STABLECOIN),
        maxBorrowable: fromWei(maxBorrowable, DECIMALS.STABLECOIN)
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
      // 获取价格最后更新时间
      const lastUpdated = await priceOracle.getLastUpdated();

      this.marketData = {
        ...this.marketData,
        wbtcPrice: fromWei(wbtcPriceRaw, DECIMALS.STABLECOIN), // 价格单位：稳定币
        wbtcPriceRaw: wbtcPriceRaw, // 保存原始大数用于计算
        lastPriceUpdate: Number(lastUpdated) * 1000 // 转为时间戳
      };
    },

    // 4. 从LendingPool获取利率数据
    async refreshRateFromLendingPool() {
      const { lendingPool } = this.contracts;
      // 直接调用LendingPool的getBorrowRatePerBlock
      const borrowRatePerBlock = await lendingPool.getBorrowRatePerBlock();
      // 计算APY
      const borrowAPY = calculateAPY(borrowRatePerBlock);

      this.marketData = {
        ...this.marketData,
        borrowRatePerBlock: fromWei(borrowRatePerBlock),
        borrowAPY
      };
    },

    // 触发PriceOracle的价格波动（新增：交互预言机）
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

    // 其他方法（connectWallet/disconnectWallet/checkAllowance/approveToken/depositWbtc等）
    // 【无核心修改】，仅确保所有ERC20操作直接调用WBTCToken/Stablecoin合约
    // ...（保留原有逻辑，此处省略）
  }
});