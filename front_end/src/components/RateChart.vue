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

// ==========================================
// 核心参数转换逻辑（解决 36135% 问题的关键）
// ==========================================

// 1. 定义时间常数 (以太坊主网一年约 2,628,000 个区块)
const BLOCKS_PER_YEAR = 2628000; 

// 2. 后端给的原始参数 (精度 1e18)
const RAW_BASE_RATE = 1e14;   // baseBorrowRatePerBlock
const RAW_SLOPE1 = 1e15;      // slope1PerBlock
const RAW_SLOPE2 = 5e15;      // slope2PerBlock
const RAW_KINK = 0.8e18;      // kinkUtilization

// 3. 转换为前端小数格式 (强行除以 10000 修正后端的数学错误)
const FIX_FACTOR = 10000;
const baseRateDec = (RAW_BASE_RATE / FIX_FACTOR) / 1e18;
const slope1Dec = (RAW_SLOPE1 / FIX_FACTOR) / 1e18;
const slope2Dec = (RAW_SLOPE2 / FIX_FACTOR) / 1e18;
const KINK_POINT = RAW_KINK / 1e18; // Kink 0.8 是对的，不需要除

// 4. 计算年化 APR (小数形式)
const BASE_APR = baseRateDec * BLOCKS_PER_YEAR; // 0.2628 (即 26.28%)
// 第一段总增长：当利用率从 0 爬升到 Kink 时增加的年化利率
const SLOPE1_ANNUAL = slope1Dec * BLOCKS_PER_YEAR; 
// 第二段总增长：当利用率从 Kink 爬升到 100% 时增加的年化利率
const SLOPE2_ANNUAL = slope2Dec * BLOCKS_PER_YEAR;

// 生成曲线数据函数
const generateKinkedCurveData = () => {
  const data = [];
  for (let i = 0; i <= 100; i++) {
    const u = i / 100;
    let rate;
    if (u <= KINK_POINT) {
      // 基础利率 + (当前位移占比 * 第一段年化总幅)
      rate = BASE_APR + (u / KINK_POINT) * SLOPE1_ANNUAL;
    } else {
      // 基础利率 + 第一段全额 + (超出部分的占比 * 第二段年化总幅)
      const excessU = u - KINK_POINT;
      const remainingU = 1.0 - KINK_POINT;
      rate = BASE_APR + SLOPE1_ANNUAL + (excessU / remainingU) * SLOPE2_ANNUAL;
    }
    // 存入 ECharts：[利用率%, 利率%]
    data.push([u * 100, rate * 100]); 
  }
  return data;
};

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  if (props.type === 'rate') renderRateModel();
};

const renderRateModel = () => {
  const curveData = generateKinkedCurveData();
  const currentU = currentUtilization.value * 100; 
  const kinkU = KINK_POINT * 100; 

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      padding: 12,
      formatter: function (params) {
        const uTarget = params[0].value[0] / 100;
        const rate = params[0].value[1];

        let html = `<div style="font-weight:600; margin-bottom:8px; font-size:14px;">
                      Utilization Rate: <span style="float:right">${(uTarget * 100).toFixed(2)}%</span>
                    </div>`;

        if (derivedTotalSupply.value > 0) {
          const targetDebt = uTarget * derivedTotalSupply.value;
          const diff = derivedTotalDebt.value - targetDebt;
          if (Math.abs(diff) > 0.01) {
            const action = diff > 0 ? 'Repayment' : 'Borrow';
            const amount = new Intl.NumberFormat('en-US', { 
              style: 'currency', currency: 'USD' 
            }).format(Math.abs(diff));
            html += `<div style="font-size:12px; color:#666; margin-bottom:8px; line-height:1.4;">
                       ${action} to reach ${(uTarget * 100).toFixed(0)}%: <b>${amount}</b>
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
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%', color: '#999' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [{
      name: 'Borrow APR',
      type: 'line',
      showSymbol: false,
      data: curveData,
      lineStyle: { color: '#b6509e', width: 2 },
      markLine: {
        symbol: ['none', 'none'],
        data: [
          { 
            xAxis: currentU, 
            lineStyle: { color: '#409eff', type: 'dashed' }, 
            label: { formatter: 'Current', position: 'end' } 
          },
          { 
            xAxis: kinkU, 
            lineStyle: { color: '#ff9900', type: 'dotted' }, 
            label: { formatter: 'Optimal', position: 'end' } 
          },
        ]
      }
    }]
  };
  chartInstance.setOption(option);
};

const fetchOnChainData = async () => {
  if (props.type !== 'rate' || !window.ethereum) return;
  
  try {
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(props.contractAddress, props.abi, provider);

    const utilRateRaw = await contract.getUtilizationRate();
    currentUtilization.value = Number(formatUnits(utilRateRaw, 18));

    const stablecoinAddress = await contract.getStablecoinAddress();
    const erc20Abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const stableContract = new Contract(stablecoinAddress, erc20Abi, provider);
    
    const [balanceRaw, decimals] = await Promise.all([
      stableContract.balanceOf(props.contractAddress),
      stableContract.decimals()
    ]);
    
    const availableLiquidity = Number(formatUnits(balanceRaw, decimals));
    const uVal = currentUtilization.value;

    if (uVal > 0 && uVal < 1) {
      derivedTotalDebt.value = (uVal * availableLiquidity) / (1 - uVal);
      derivedTotalSupply.value = derivedTotalDebt.value + availableLiquidity;
    } else {
      derivedTotalSupply.value = availableLiquidity;
      derivedTotalDebt.value = 0;
    }
    
    renderRateModel();
  } catch (error) {
    console.error("Fetch error:", error);
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
.rate-chart-container { width: 100%; padding: 16px; background: #fff; border-radius: 8px; border: 1px solid #f0f0f0; }
.chart-title { font-size: 14px; color: #333; margin-bottom: 12px; font-weight: 600; }
.chart-stats { display: flex; margin-bottom: 16px; }
.stat-item { display: flex; flex-direction: column; }
.stat-label { font-size: 12px; color: #666; margin-bottom: 4px; }
.stat-value { font-size: 20px; font-weight: bold; color: #1a1a1a; }
.echarts-box { width: 100%; height: 320px; }
</style>