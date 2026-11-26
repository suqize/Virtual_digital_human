<script setup lang="ts">
import * as echarts from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CognitionPoint } from '../types';

const props = defineProps<{
  history: CognitionPoint[];
  prediction: CognitionPoint[];
  currentScore: number;
  predictedScore: number;
}>();

const el = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

function toSeconds(value: string): number {
  const [m, s] = value.split(':').map(Number);
  return m * 60 + s;
}

function render(): void {
  if (!chart) return;
  const axisMap = new Map<string, number>();
  for (const point of [...props.history, ...props.prediction]) {
    axisMap.set(point.time, toSeconds(point.time));
  }
  const axis = [...axisMap.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  const historyData = axis.map((label) => {
    const point = props.history.find((p) => p.time === label);
    return point ? point.score : null;
  });
  let predictionData = axis.map((label) => {
    const point = props.prediction.find((p) => p.time === label);
    return point ? point.score : null;
  });
  if (props.history.length > 0 && predictionData.some((v) => v !== null)) {
    const lastTime = props.history[props.history.length - 1].time;
    const index = axis.indexOf(lastTime);
    if (index >= 0 && predictionData[index] === null) {
      predictionData = [...predictionData];
      predictionData[index] = props.history[props.history.length - 1].score;
    }
  }
  const lastHistory = props.history[props.history.length - 1];
  const lastPrediction = props.prediction[props.prediction.length - 1];
  chart.setOption(
    {
      grid: { left: 36, right: 42, top: 30, bottom: 26 },
      legend: {
        data: ['历史记录', '策略预测'],
        top: 0,
        right: 0,
        itemWidth: 16,
        itemHeight: 2,
        textStyle: { fontSize: 11, color: '#8a919f' },
      },
      tooltip: { trigger: 'axis', valueFormatter: (value: number | string) => `${value} 分` },
      xAxis: {
        type: 'category',
        data: axis,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#dfe3ea' } },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: '#9aa3b2', interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: '#eef1f5' } },
        axisLabel: { fontSize: 10, color: '#9aa3b2' },
      },
      series: [
        {
          name: '历史记录',
          type: 'line',
          data: historyData,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2, color: '#1677ff' },
          itemStyle: { color: '#1677ff' },
          markPoint: lastHistory
            ? {
                symbol: 'pin',
                symbolSize: 42,
                itemStyle: { color: '#1677ff' },
                label: { fontSize: 10, color: '#fff', formatter: `当前\n${props.currentScore}` },
                data: [{ coord: [lastHistory.time, lastHistory.score] }],
              }
            : undefined,
        },
        {
          name: '策略预测',
          type: 'line',
          data: predictionData,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2, type: 'dashed', color: '#fa8c16' },
          itemStyle: { color: '#fa8c16' },
          markPoint: lastPrediction
            ? {
                symbol: 'pin',
                symbolSize: 42,
                itemStyle: { color: '#fa8c16' },
                label: { fontSize: 10, color: '#fff', formatter: `预测\n${props.predictedScore}` },
                data: [{ coord: [lastPrediction.time, lastPrediction.score] }],
              }
            : undefined,
        },
      ],
    },
    true,
  );
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  render();
  resizeObserver = new ResizeObserver(() => chart?.resize());
  resizeObserver.observe(el.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = null;
});

watch(() => [props.history, props.prediction], render, { deep: true });
</script>

<template>
  <div ref="el" class="cognition-chart"></div>
</template>
