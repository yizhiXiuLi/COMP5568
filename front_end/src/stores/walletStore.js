import { defineStore } from 'pinia';
import { ethers } from 'ethers';
import { toRaw, markRaw } from 'vue';
import { CONTRACT_ADDRESSES, DECIMALS } from '@/constants/addresses';
import { ElMessage } from 'element-plus';
import LENDING_POOL_ABI from '@/constants/abis/LendingPool.json';
import WBTC_ABI from '@/constants/abis/WBTCToken.json';
import STABLECOIN_ABI from '@/constants/abis/Stablecoin.json';
import PRICE_ORACLE_ABI from '@/constants/abis/PriceOracle.json';
import { fromWei, calculateAPY, calculateAPR } from '@/utils/format';

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
      maxBorrowable: '0',     // 最大可借额度（来自LendingPool）
      totalCollateralUSD: '0',
      totalDebtUSD: '0'
    },
    // 市场数据（从PriceOracle直接获取价格）
    marketData: {
      wbtcPrice: '0',         // wBTC价格（直接来自PriceOracle）
      wbtcPriceRaw: 0,        // 原始大数（用于计算）
      borrowRatePerBlock: '0',// 每区块借款利率（来自LendingPool）
      borrowAPR: '0',         // 借款APY
      supplyAPY: '0',         // 供应APY（来自LendingPool，getSupplyRatePerBlock）
      utilizationRate: '0',   // 使用率（直接来自LendingPool）
      lastPriceUpdate: 0,     // 价格最后更新时间（来自PriceOracle）
      collateralFactor: '0',    
      liquidationThreshold: '0', 
    },
    loading: false
  }),

  actions: {
    // 连接钱包并初始化4个合约实例
    async connectWallet() {
      if (!window.ethereum) {
        ElMessage.error('Please install MetaMask first.');
        return;
      }

      this.loading = true;
      try {
        // 初始化Provider和Signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

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

        await this.refreshAllData();
        ElMessage.success('Wallet connected successfully');
      } catch (error) {
        console.error('Failed to connect wallet: ', error);
        ElMessage.error('Connection failed: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    // 监听逻辑
    async setupEventListeners() {
      if (!window.ethereum || !this.contracts.lendingPool) return;
      
      const lendingPool = toRaw(this.contracts.lendingPool);
      const priceOracle = toRaw(this.contracts.priceOracle);

      lendingPool.removeAllListeners('Borrowed');
      lendingPool.removeAllListeners('Repaid');
      lendingPool.removeAllListeners('Deposited');
      lendingPool.removeAllListeners('Withdrawn');
      priceOracle.removeAllListeners('PriceUpdated');

      const handleUpdate = (user) => {
        if (user.toLowerCase() === this.address.toLowerCase()) {
          this.refreshAllData();
        }
      };

      lendingPool.on('Borrowed', handleUpdate);
      lendingPool.on('Repaid', handleUpdate);
      lendingPool.on('Deposited', handleUpdate);
      lendingPool.on('Withdrawn', handleUpdate);
      priceOracle.on('PriceUpdated', () => {
        this.refreshAllData();
      });

      // 监听账号切换
      window.ethereum.on('accountsChanged', async(accounts) => {
        if (accounts.length === 0) {
          this.disconnectWallet(); // 用户在 MetaMask 中断开
        } else {
          // 账号切换后需重新获取 signer 和 合约实例
          const provider = new ethers.BrowserProvider(window.ethereum);
          this.signer = await provider.getSigner();
          this.contracts = {
            lendingPool: new ethers.Contract(CONTRACT_ADDRESSES.LENDING_POOL, LENDING_POOL_ABI.output.abi, this.signer),
            wbtc: new ethers.Contract(CONTRACT_ADDRESSES.WBTC, WBTC_ABI.output.abi, this.signer),
            stablecoin: new ethers.Contract(CONTRACT_ADDRESSES.STABLECOIN, STABLECOIN_ABI.output.abi, this.signer),
            priceOracle: new ethers.Contract(CONTRACT_ADDRESSES.PRICE_ORACLE, PRICE_ORACLE_ABI.output.abi, this.signer)
          };
          await this.refreshAllData();
          ElMessage.info('Switched Wallet');
        }
      });

      // 监听链切换
      window.ethereum.on('chainChanged', () => {
        window.location.reload(); 
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
      ElMessage.warning('Wallet disconnected');
    },

    async refreshProtocolParams() {
      const { lendingPool } = this.contracts;
      try {
        const cfRaw = await lendingPool.getCollateralFactor();
        const ltRaw = await lendingPool.getLiquidationThreshold();

        this.marketData.collateralFactor = fromWei(cfRaw, 18);
        this.marketData.liquidationThreshold = fromWei(ltRaw, 18);
      } catch (error) {
        console.error(error);
      }
    },
    
    // 刷新所有数据
    async refreshAllData() {
      if (!this.isConnected) return;
      this.loading = true;
      try {
        await Promise.all([
          this.refreshAccountDataFromLendingPool(), // LendingPool 借贷数据
          this.refreshTokenBalancesFromERC20(),     // ERC20 余额
          this.refreshPriceFromOracle(),            // PriceOracle 价格
          this.refreshRateFromLendingPool(),        // LendingPool 利率
          this.refreshProtocolParams()
        ]);
      } catch (error) {
        console.error(error);
        ElMessage.error('Failed to refresh data');
      } finally {
        this.loading = false;
      }
    },

    // 1. 从LendingPool获取账户借贷数据
    async refreshAccountDataFromLendingPool() {
      const { lendingPool } = this.contracts;
      // 账户抵押/债务
      const [collateralWbtc, debtStable] = await lendingPool.getUserAccount(this.address);
      // 最大可借额度
      const maxBorrowable = await lendingPool.getMaxBorrowable(this.address);

      // 获取折算成 USD 的价值（规范 4.2 节）
      const collateralValue = await lendingPool.getCollateralValue(this.address);
      const debtValue = await lendingPool.getDebtValue(this.address);
      const liquidationThresholdRaw = await lendingPool.getLiquidationThreshold();

      // 健康因子直接用本次刷新拿到的抵押/债务数据重新计算，避免旧视图值滞后
      const collateralUsd = parseFloat(fromWei(collateralValue, 18));
      const debtUsd = parseFloat(fromWei(debtValue, 18));
      const liquidationThreshold = parseFloat(fromWei(liquidationThresholdRaw, 18)) || 0;

      let hf = '0';
      if (debtUsd <= 0) {
        hf = '∞';
      } else if (collateralUsd > 0 && liquidationThreshold > 0) {
        hf = ((collateralUsd * liquidationThreshold) / debtUsd).toFixed(4);
      }

      // 处理健康因子：如果数值过大，视为无穷大
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

    // ERC20
    async refreshTokenBalancesFromERC20() {
      const { wbtc, stablecoin } = this.contracts;
      const wbtcBalance = await wbtc.balanceOf(this.address);
      const stableBalance = await stablecoin.balanceOf(this.address);

      this.accountData.wbtcBalance = fromWei(wbtcBalance, DECIMALS.WBTC);
      this.accountData.stableBalance = fromWei(stableBalance, DECIMALS.STABLECOIN);
    },

    // wBTC
    async refreshPriceFromOracle() {
      const { priceOracle } = this.contracts;
      const wbtcPriceRaw = await priceOracle.getWbtcPrice();

      this.marketData = {
        ...this.marketData,
        wbtcPrice: fromWei(wbtcPriceRaw, DECIMALS.STABLECOIN),
        wbtcPriceRaw: wbtcPriceRaw,
        lastPriceUpdate: Date.now() 
      };
    },

    // 从LendingPool获取利率数据
    async refreshRateFromLendingPool() {
      const { lendingPool } = this.contracts;
      const borrowRatePerBlock = await lendingPool.getBorrowRatePerBlock();
      const borrowAPR = calculateAPR(borrowRatePerBlock);
      const supplyRatePerBlock = await lendingPool.getSupplyRatePerBlock();
      const supplyAPY = calculateAPY(supplyRatePerBlock); 
      const utilizationRateRaw = await lendingPool.getUtilizationRate();
      const utilizationRate = (parseFloat(fromWei(utilizationRateRaw)) * 100).toFixed(2);

      this.marketData = {
        ...this.marketData,
        borrowRatePerBlock: borrowRatePerBlock,
        borrowAPR: (borrowAPR/100).toFixed(2),
        supplyAPY: (supplyAPY/100).toFixed(2), 
        utilizationRate: utilizationRate 
      };
    },

    // 检查Stablecoin授权
    async checkAllowance(tokenSymbol, amount) {
      if (!this.isConnected || !this.address || !this.contracts.lendingPool) return false;
      if (!amount || isNaN(parseFloat(amount))) return false;
      try { 
        const tokenContract = tokenSymbol === 'WBTC' ? this.contracts.wbtc : this.contracts.stablecoin;
        if (!tokenContract) return false;
        const decimals = tokenSymbol === 'WBTC' ? DECIMALS.WBTC : DECIMALS.STABLECOIN;
        
        const amountWei = ethers.parseUnits(amount.toString(), decimals);
        const allowance = await tokenContract.allowance(this.address, CONTRACT_ADDRESSES.LENDING_POOL);
        
        return allowance >= amountWei;
      } catch (error) {
        console.error(error);
        return false;
      }
    },

    // 授权Stablecoin
    async approveStablecoin(amount) {
      this.loading = true;
      try {
        const { stablecoin } = this.contracts;
        const amountWei = ethers.parseUnits(amount, DECIMALS.STABLECOIN);
        const tx = await stablecoin.approve(CONTRACT_ADDRESSES.LENDING_POOL, amountWei);
        await tx.wait();
        ElMessage.success('Authorization Succeeded');
        return true;
      } catch (err) {
        console.error(err);
        ElMessage.error('Authorization Failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    // borrow
    async borrowStable(amount) {
      this.loading = true;
      try {
        const { lendingPool } = this.contracts;
        const amountWei = ethers.parseUnits(amount, DECIMALS.STABLECOIN);
        const tx = await lendingPool.borrow(amountWei);
        await tx.wait();
        ElMessage.success('cUSD Borrow Successful');
        await this.refreshAllData();
        return true;
      } catch (err) {
        console.error(err);
        ElMessage.error('cUSD Borrow Failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    // repay
    async repayStable(amount) {
      this.loading = true;
      try {
        const { lendingPool } = this.contracts;
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.STABLECOIN);
        const tx = await lendingPool.repay(amountWei);
        ElMessage.info('Repay Transaction Submitted...');
        await tx.wait();
        ElMessage.success('cUSD Repay Successful');
        await this.refreshAllData();
        return true;
      } catch (err) {
        console.error(err);
        ElMessage.error('cUSD Repay Failed');
        return false;
      } finally {
        this.loading = false;
      }
    },
    // approval wBTC
    async approveWbtc(amount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.WBTC);
        const tx = await this.contracts.wbtc.approve(CONTRACT_ADDRESSES.LENDING_POOL, amountWei);
        ElMessage.info('Waiting for approval confirmation...');
        await tx.wait();
        ElMessage.success('wBTC Approval Successful');
        return true;
      } catch (error) {
        ElMessage.error('wBTC Approval Failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    // deposit wBTC
    async depositWbtc(amount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.WBTC);
        const tx = await this.contracts.lendingPool.deposit(amountWei);
        ElMessage.info('Processing deposit transaction...');
        await tx.wait();
        ElMessage.success('wBTC Deposit Successful');
        await this.refreshAllData();
        return true;
      } catch (error) {
        console.error('Deposit Failed:', error);
        ElMessage.error('wBTC Deposit Failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    // withdraw wBTC
    async withdrawWbtc(amount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.WBTC);
        const tx = await this.contracts.lendingPool.withdraw(amountWei);
        ElMessage.info('Processing withdrawal transaction...');
        await tx.wait();
        ElMessage.success('wBTC Withdrawal Successful');
        await this.refreshAllData();
        return true;
      } catch (error) {
        ElMessage.error('wBTC Withdrawal Failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    async getHealthFactorByAddress(userAddress) {
      if (!this.contracts.lendingPool) return '0';
      try {
        const hfRaw = await this.contracts.lendingPool.getHealthFactor(userAddress);
        let hf = fromWei(hfRaw, 18);
        if (parseFloat(hf) > 1000000) hf = '∞';
        return hf;
      } catch (error) {
        console.error('Failed to fetch target health factor:', error);
        return '0';
      }
    },

    async liquidatePosition(userAddress, repayAmount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(repayAmount.toString(), DECIMALS.STABLECOIN);
        const tx = await this.contracts.lendingPool.liquidate(userAddress, amountWei);
        ElMessage.info('Processing liquidation transaction...');
        await tx.wait();
        ElMessage.success('Liquidation Successful');
        await this.refreshAllData();
        return true;
      } catch (error) {
        console.error('Liquidation failed:', error);
        ElMessage.error('Liquidation Failed');
        return false;
      } finally {
        this.loading = false;
      }
    }
  }
});