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
      borrowAPY: '0',         // 借款APY
      supplyAPY: '0',         // 供应APY（来自LendingPool，getSupplyRatePerBlock）
      utilizationRate: '0',   // 使用率（直接来自LendingPool）
      lastPriceUpdate: 0,     // 价格最后更新时间（来自PriceOracle）
      collateralFactor: '0',    
      liquidationThreshold: '0', 
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

        // 初始化4个合约实例
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
      if (!window.ethereum || !this.contracts.lendingPool) return;
      
      const lendingPool = toRaw(this.contracts.lendingPool);

      lendingPool.removeAllListeners('Borrowed');
      lendingPool.removeAllListeners('Repaid');
      lendingPool.removeAllListeners('Deposited');
      lendingPool.removeAllListeners('Withdrawn');

      const handleUpdate = (user) => {
        if (user.toLowerCase() === this.address.toLowerCase()) {
          this.refreshAllData();
        }
      };

      lendingPool.on('Borrowed', handleUpdate);
      lendingPool.on('Repaid', handleUpdate);
      lendingPool.on('Deposited', handleUpdate);
      lendingPool.on('Withdrawn', handleUpdate);

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

    async refreshProtocolParams() {
      const { lendingPool } = this.contracts;
      try {
        // 调用合约接口：getUserAccount 之外的全局配置
        const cfRaw = await lendingPool.getCollateralFactor();
        const ltRaw = await lendingPool.getLiquidationThreshold();

        this.marketData.collateralFactor = fromWei(cfRaw, 18);
        this.marketData.liquidationThreshold = fromWei(ltRaw, 18);
      } catch (error) {
        console.error("获取协议参数失败，使用默认值:", error);
      }
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
          this.refreshRateFromLendingPool(),        // 从LendingPool获取利率
          this.refreshProtocolParams()
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
      const borrowAPY = calculateAPR(borrowRatePerBlock);

      // 2. 获取存款利率（每区块）并计算supplyAPY
      const supplyRatePerBlock = await lendingPool.getSupplyRatePerBlock();
      const supplyAPY = calculateAPY(supplyRatePerBlock); 

      // 3. 获取资金利用率（原始值）
      const utilizationRateRaw = await lendingPool.getUtilizationRate();
      // 格式化利用率（通常合约返回的是 1e18 精度的小数，需转成百分比）
      const utilizationRate = (parseFloat(fromWei(utilizationRateRaw)) * 100).toFixed(2);

      this.marketData = {
        ...this.marketData,
        borrowRatePerBlock: borrowRatePerBlock,
        borrowAPY: (borrowAPY/100).toFixed(2),
        supplyAPY: supplyAPY, 
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
        console.error('检查授权失败:', error);
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
        ElMessage.success('授权成功');
        return true;
      } catch (err) {
        console.error(err);
        ElMessage.error('授权失败');
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 借
    async borrowStable(amount) {
      this.loading = true;
      try {
        const { lendingPool } = this.contracts;
        const amountWei = ethers.parseUnits(amount, DECIMALS.STABLECOIN);
        const tx = await lendingPool.borrow(amountWei);
        await tx.wait();
        ElMessage.success('借款成功');
        await this.refreshAllData();
        return true;
      } catch (err) {
        console.error(err);
        ElMessage.error('借款失败');
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 还
    async repayStable(amount) {
      this.loading = true;
      try {
        const { lendingPool } = this.contracts;
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.STABLECOIN);
        const tx = await lendingPool.repay(amountWei);
        ElMessage.info('还款交易已提交...');
        await tx.wait();
        ElMessage.success('还款成功');
        await this.refreshAllData();
        return true;
      } catch (err) {
        console.error(err);
        ElMessage.error('还款失败');
        return false;
      } finally {
        this.loading = false;
      }
    },
    // 新增：授权 WBTC
    async approveWbtc(amount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.WBTC);
        const tx = await this.contracts.wbtc.approve(CONTRACT_ADDRESSES.LENDING_POOL, amountWei);
        ElMessage.info('正在等待授权确认...');
        await tx.wait();
        ElMessage.success('WBTC 授权成功');
        return true;
      } catch (error) {
        ElMessage.error('授权失败: ' + error.message);
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 修改/完善：抵押 WBTC
    async depositWbtc(amount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.WBTC);
        // 调用合约的 deposit 方法
        const tx = await this.contracts.lendingPool.deposit(amountWei);
        ElMessage.info('正在打包抵押交易...');
        await tx.wait();
        ElMessage.success('抵押成功！');
        await this.refreshAllData();
        return true;
      } catch (error) {
        console.error('抵押失败:', error);
        ElMessage.error('抵押失败: ' + (error.reason || error.message));
        return false;
      } finally {
        this.loading = false;
      }
    },

    // 新增：提取 WBTC
    async withdrawWbtc(amount) {
      this.loading = true;
      try {
        const amountWei = ethers.parseUnits(amount.toString(), DECIMALS.WBTC);
        // 调用合约的 withdraw 方法
        const tx = await this.contracts.lendingPool.withdraw(amountWei);
        ElMessage.info('正在打包提取交易...');
        await tx.wait();
        ElMessage.success('提取成功！');
        await this.refreshAllData();
        return true;
      } catch (error) {
        ElMessage.error('提取失败: ' + (error.reason || error.message));
        return false;
      } finally {
        this.loading = false;
      }
    }
  }
});