<!-- <template>
  <div class="price-chart-container">
    <div class="chart-title" v-if="title">{{ title }}</div>
    <div class="chart-stats">
      <div class="stat-item">
        <span class="stat-label">Current wBTC Price</span>
        <span class="stat-value">${{ formattedPrice }}</span>
      </div>
    </div>
    <div ref="chartRef" class="echarts-box"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import * as echarts from 'echarts';
import { BrowserProvider, Contract, formatUnits } from 'ethers';

const props = defineProps({
  title: { type: String, default: 'wBTC Price Trend' },
  contractAddress: { type: String, required: true },
  abi: { type: [Array, Object], required: true }
});

const chartRef = ref(null);
let chartInstance = null;

const priceHistory = ref([]);
const timeHistory = ref([]);
const currentPrice = ref(0);
const formattedPrice = computed(() => currentPrice.value.toFixed(2));

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
};

const renderChart = () => {
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: 'Time: {b}<br/>Price: ${c}'
    },
    grid: { left: '3%', right: '5%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: timeHistory.value,
      axisLabel: { color: '#888' },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '${value}', color: '#888' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [
      {
        name: 'wBTC Price',
        type: 'line',
        smooth: true,
        data: priceHistory.value,
        lineStyle: { color: '#1890ff', width: 2 },
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#1890ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24,144,255,0.15)' },
            { offset: 1, color: 'rgba(24,144,255,0)' }
          ])
        }
      }
    ]
  };
  chartInstance.setOption(option);
};

const fetchPrice = async () => {
  if (!window.ethereum) return;
  try {
    const provider = new BrowserProvider(window.ethereum);
    const oracle = new Contract(props.contractAddress, props.abi, provider);

    const priceRaw = await oracle.getWbtcPrice();
    const priceNum = Number(formatUnits(priceRaw, 18));

    currentPrice.value = priceNum;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    timeHistory.value.push(timeStr);
    priceHistory.value.push(priceNum);

    if (priceHistory.value.length > 20) {
      priceHistory.value.shift();
      timeHistory.value.shift();
    }

    renderChart();
  } catch (err) {
    console.error('Fetch wBTC price error:', err);
  }
};

onMounted(() => {
  initChart();
  fetchPrice();
  setInterval(fetchPrice, 5000);
  window.addEventListener('resize', () => chartInstance?.resize());
});
</script>

<style scoped>
.price-chart-container {
  width: 100%;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}
.chart-title {
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
  font-weight: 600;
}
.chart-stats {
  margin-bottom: 16px;
}
.stat-item {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 12px;
  color: #666;
}
.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #1a1a1a;
}
.echarts-box {
  width: 100%;
  height: 300px;
}
</style> -->