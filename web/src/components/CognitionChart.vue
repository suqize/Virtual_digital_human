<script setup lang="ts">
import * as echarts from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CognitionPoint, PredictionRun } from '../types';

const props = defineProps<{
  history: CognitionPoint[];
  prediction: CognitionPoint[];
  predictionHistory: PredictionRun[];
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
  const lastHistory = props.history[props.history.length - 1];
  const currentTime = lastHistory?.time ?? '00:00';
  const currentSeconds = toSeconds(currentTime);
  const predictionByTime = new Map<string, CognitionPoint>();
  for (const run of props.predictionHistory) {
    const generatedAt = toSeconds(run.generatedAt);
    const runAnchor = run.points[0];
    if (runAnchor && generatedAt <= currentSeconds && !predictionByTime.has(run.generatedAt)) {
      predictionByTime.set(run.generatedAt, { time: run.generatedAt, score: runAnchor.score });
    }
    for (const point of run.points) {
      const pointTime = toSeconds(point.time);
      if (generatedAt <= pointTime && pointTime <= currentSeconds && !predictionByTime.has(point.time)) {
        predictionByTime.set(point.time, point);
      }
    }
  }
  const currentAnchor = props.prediction[0];
  if (currentAnchor) {
    predictionByTime.set(currentTime, { time: currentTime, score: currentAnchor.score });
  }
  for (const point of props.prediction.slice(1)) {
    if (toSeconds(point.time) > currentSeconds) predictionByTime.set(point.time, point);
  }
  const strategyPrediction = [...predictionByTime.values()].sort((a, b) => toSeconds(a.time) - toSeconds(b.time));

  const axisMap = new Map<string, number>();
  for (const point of [...props.history, ...strategyPrediction]) {
    axisMap.set(point.time, toSeconds(point.time));
  }
  const axis = [...axisMap.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  const historyData = axis.map((label) => {
    const point = props.history.find((p) => p.time === label);
    return point ? point.score : null;
  });
  const predictionData = axis.map((label) => {
    const point = strategyPrediction.find((p) => p.time === label);
    return point ? point.score : null;
  });
  const lastPrediction = strategyPrediction[strategyPrediction.length - 1];
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
          symbol: 'none',
          lineStyle: { width: 2, type: 'solid', color: '#1677ff' },
          itemStyle: { color: '#1677ff' },
          z: 3,
          markPoint: lastHistory
            ? {
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#1677ff' },
                label: { fontSize: 10, color: '#1677ff', position: 'top', formatter: `${props.currentScore}` },
                data: [{ coord: [lastHistory.time, lastHistory.score] }],
              }
            : undefined,
        },
        {
          name: '策略预测',
          type: 'line',
          data: predictionData,
          connectNulls: true,
          symbol: 'none',
          lineStyle: { width: 2, type: 'dashed', color: '#fa8c16' },
          itemStyle: { color: '#fa8c16' },
          z: 4,
          markPoint: lastPrediction
            ? {
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#fa8c16' },
                label: { fontSize: 10, color: '#fa8c16', position: 'top', formatter: `${props.predictedScore}` },
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

watch(() => [props.history, props.prediction, props.predictionHistory], render, { deep: true });
</script>

<template>
  <div ref="el" class="cognition-chart"></div>
</template>
