<template>
  <div class="rate-chart">
    <div class="chart-header">
      <span>{{ title }}</span>
      <el-select
        v-model="timeRange"
        size="small"
        @change="refreshChartData"
        style="width: 120px;"
      >
        <el-option label="1小时" value="1h"></el-option>
        <el-option label="24小时" value="24h"></el-option>
        <el-option label="7天" value="7d"></el-option>
      </el-select>
    </div>
    <!-- ECharts容器 -->
    <v-chart
      :options="chartOptions"
      autoresize
      class="chart-container"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { use } from 'echarts/core';
import VChart from 'vue-echarts';
// 引入ECharts组件
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 注册ECharts组件
use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer
]);

// 接收父组件传参
const props = defineProps({
  // 图表类型：rate（利率）/ price（价格）
  type: {
    type: String,
    required: true,
    validator: (val) => ['rate', 'price'].includes(val)
  },
  // 标题（可选）
  title: {
    type: String,
    default: ''
  },
  // 模拟数据的基础值（可选）
  baseValue: {
    type: Number,
    default: 0
  }
});

// 时间范围
const timeRange = ref('24h');

// 生成模拟数据（基于时间范围）
const generateMockData = () => {
  // 时间点数量
  let pointCount = 24; // 默认24小时
  if (timeRange.value === '1h') pointCount = 60; // 1小时=60分钟
  if (timeRange.value === '7d') pointCount = 7 * 24; // 7天=168小时

  const now = new Date();
  const xAxisData = []; // X轴：时间
  const seriesData = []; // Y轴：数值

  // 基础值（模拟波动）
  let base = props.baseValue || (props.type === 'rate' ? 6.8 : 50000);
  
  // 生成数据点
  for (let i = pointCount - 1; i >= 0; i--) {
    // 时间格式化
    const time = new Date(now - i * (timeRange.value === '1h' ? 60000 : 3600000));
    const timeStr = timeRange.value === '1h' 
      ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : time.toLocaleDateString() + ' ' + time.toLocaleTimeString([], { hour: '2-digit' });
    
    // 数值（带随机波动）
    const fluctuation = props.type === 'rate' 
      ? Math.random() * 0.5 - 0.25 // 利率波动±0.25%
      : Math.random() * 2000 - 1000; // 价格波动±1000
    
    const value = (base + fluctuation).toFixed(props.type === 'rate' ? 2 : 0);

    xAxisData.push(timeStr);
    seriesData.push(Number(value));
  }

  return { xAxisData, seriesData };
};

// 图表数据
const chartData = ref(generateMockData());

// 刷新图表数据
const refreshChartData = () => {
  chartData.value = generateMockData();
};

// 图表配置项
const chartOptions = computed(() => {
  const yAxisName = props.type === 'rate' ? '借款年利率（APY）%' : 'wBTC价格（稳定币）';
  const color = props.type === 'rate' ? '#409eff' : '#67c23a';

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const [data] = params;
        return `${data.axisValue}<br/>${yAxisName}：${data.value}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: chartData.value.xAxisData,
      axisLabel: {
        rotate: 30, // 旋转X轴标签，避免重叠
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      nameTextStyle: {
        color: color
      },
      axisLine: {
        lineStyle: {
          color: color
        }
      }
    },
    series: [
      {
        data: chartData.value.seriesData,
        type: 'line',
        smooth: true, // 平滑曲线
        color: color,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: color + '80' }, // 半透明
              { offset: 1, color: color + '10' }  // 更透明
            ]
          }
        },
        markLine: {
          silent: true,
          data: props.type === 'rate' 
            ? [{ yAxis: 6.0, label: { formatter: '基准利率' } }]
            : [{ yAxis: 50000, label: { formatter: '基准价格' } }]
        }
      }
    ],
    dataZoom: [
      {
        type: 'inside', // 内部缩放
        start: 0,
        end: 100
      },
      {
        type: 'slider', // 底部滑块
        start: 0,
        end: 100
      }
    ]
  };
});

// 初始化图表
onMounted(() => {
  refreshChartData();
});
</script>

<style scoped>
.rate-chart {
  width: 100%;
  height: 400px;
  margin: 16px 0;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.chart-container {
  width: 100%;
  height: calc(100% - 32px);
}
</style>