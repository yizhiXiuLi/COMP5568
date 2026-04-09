<template>
  <div class="rate-chart-container">
    <div class="chart-title" v-if="title">{{ title }}</div>
    <div class="chart-stats" v-if="type === 'rate'">
      <div class="stat-item">
        <span class="stat-label">Current Utilization Rate</span>
        <span class="stat-value">{{ formattedUtilization }}%</span>
      </div>
    </div>
    <div ref="chartRef" class="echarts-box"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import * as echarts from 'echarts';
import { BrowserProvider, Contract, formatUnits } from 'ethers';

const props = defineProps({
  type: { type: String, required: true },
  title: { type: String, default: '' },
  baseValue: { type: Number, default: 0 },
  contractAddress: { type: String, required: true },
  abi: { type: [Array, Object], required: true }
});

const chartRef = ref(null);
let chartInstance = null;

// 响应式数据
const currentUtilization = ref(0); 
const derivedTotalSupply = ref(0);
const derivedTotalDebt = ref(0);

const formattedUtilization = computed(() => (currentUtilization.value * 100).toFixed(2));

// ====== 目前是静态参数 ======
const KINK_POINT = 0.80;   // 假设部署时 i_kinkUtilization 是 0.8e18
const BASE_RATE = 0.00;    
const RATE_AT_KINK = 0.04; 
const MAX_RATE = 0.75;     

const generateKinkedCurveData = () => {
  const data = [];
  for (let i = 0; i <= 100; i++) {
    const u = i / 100; 
    let rate;
    if (u <= KINK_POINT) {
      rate = BASE_RATE + (u / KINK_POINT) * RATE_AT_KINK;
    } else {
      const excessU = u - KINK_POINT;
      const remainingU = 1.0 - KINK_POINT;
      rate = BASE_RATE + RATE_AT_KINK + (excessU / remainingU) * (MAX_RATE - RATE_AT_KINK);
    }
    data.push([u * 100, rate * 100]); 
  }
  return data;
};

// ====== 图表渲染逻辑 ======
const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  if (props.type === 'rate') renderRateModel();
};

const renderRateModel = () => {
  const curveData = generateKinkedCurveData();
  const currentU = currentUtilization.value * 100; 

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      padding: 12,
      textStyle: { color: '#333' },
      extraCssText: 'box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1); border-radius: 8px;',
      formatter: function (params) {
        const uTarget = params[0].value[0] / 100; // X轴当前的百分比
        const rate = params[0].value[1];          // Y轴的利率

        let html = `<div style="font-weight:600; margin-bottom:8px; font-size:14px;">
                      Utilization Rate: <span style="float:right">${(uTarget * 100).toFixed(2)}%</span>
                    </div>`;

        // 如果我们成功推导出了总盘子的大小，就算出达到该点需要的资金量
        if (derivedTotalSupply.value > 0) {
          const targetDebt = uTarget * derivedTotalSupply.value;
          const diff = derivedTotalDebt.value - targetDebt;

          if (Math.abs(diff) > 0.01) {
            const action = diff > 0 ? 'Repayment' : 'Borrow';
            const amount = new Intl.NumberFormat('en-US', { 
              style: 'currency', currency: 'USD' 
            }).format(Math.abs(diff));

            html += `<div style="font-size:12px; color:#666; margin-bottom:8px; line-height:1.4;">
                       ${action} amount to reach ${(uTarget * 100).toFixed(0)}% utilization:
                       <br/><span style="color:#1a1a1a; font-weight:600;">${amount}</span>
                     </div>`;
          }
        }

        html += `<div style="font-size:12px; color:#666; border-top: 1px solid #eee; padding-top: 8px;">
                   Borrow APR, variable: <span style="color:#b6509e; font-weight:600; float:right;">${rate.toFixed(2)}%</span>
                 </div>`;
        return html;
      }
    },
    grid: { left: '3%', right: '5%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'value', min: 0, max: 100,
      axisLabel: { formatter: '{value}%', color: '#999' },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%', color: '#999' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [{
      name: 'Borrow APR', type: 'line', showSymbol: false, data: curveData,
      lineStyle: { color: '#b6509e', width: 2 },
      markLine: {
        symbol: ['none', 'none'],
        label: { formatter: `Current\n${currentU.toFixed(2)}%`, position: 'start', color: '#409eff' },
        lineStyle: { type: 'dashed', color: '#409eff', width: 1.5 },
        data: [{ xAxis: currentU }]
      }
    }]
  };
  chartInstance.setOption(option);
};

// ====== 核心：链上数据读取与逆推 ======
const fetchOnChainData = async () => {
  if (props.type !== 'rate' || !window.ethereum) return;
  
  try {
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(props.contractAddress, props.abi, provider);

    // 1. 获取当前利用率
    const utilRateRaw = await contract.getUtilizationRate();
    const uVal = Number(formatUnits(utilRateRaw, 18));
    currentUtilization.value = uVal;

    // 2. 获取稳定币合约地址，并读取池子里的可用流动性
    const stablecoinAddress = await contract.getStablecoinAddress();
    const erc20Abi = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    const stableContract = new Contract(stablecoinAddress, erc20Abi, provider);
    
    const balanceRaw = await stableContract.balanceOf(props.contractAddress);
    const decimals = await stableContract.decimals();
    const availableLiquidity = Number(formatUnits(balanceRaw, decimals));

    // 3. 核心逆推算法
    if (uVal === 0) {
      derivedTotalSupply.value = availableLiquidity;
      derivedTotalDebt.value = 0;
    } else if (uVal < 1) {
      derivedTotalDebt.value = (uVal * availableLiquidity) / (1 - uVal);
      derivedTotalSupply.value = derivedTotalDebt.value + availableLiquidity;
    } else {
      // 极端情况：U >= 1 (流动性被借空)
      derivedTotalDebt.value = 0; // 无法单凭余额推导，前端可做容错处理
      derivedTotalSupply.value = 0;
    }
    
    renderRateModel();
  } catch (error) {
    console.error("Failed to fetch data:", error);
    currentUtilization.value = props.baseValue / 100 || 0;
    renderRateModel();
  }
};

onMounted(async () => {
  initChart();
  window.addEventListener('resize', () => chartInstance?.resize());
  await fetchOnChainData();
});

watch(() => props.baseValue, () => {
  if (props.type === 'rate') fetchOnChainData();
});
</script>

<style scoped>
.rate-chart-container { width: 100%; padding: 16px; background: #fff; border-radius: 8px; }
.chart-title { font-size: 14px; color: #333; margin-bottom: 8px; font-weight: 600; }
.chart-stats { display: flex; margin-bottom: 16px; }
.stat-item { display: flex; flex-direction: column; }
.stat-label { font-size: 12px; color: #666; }
.stat-value { font-size: 20px; font-weight: bold; color: #1a1a1a; }
.echarts-box { width: 100%; height: 300px; }
</style>