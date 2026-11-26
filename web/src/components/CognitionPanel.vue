<script setup lang="ts">
import { ref } from 'vue';
import CognitionChart from './CognitionChart.vue';
import DimensionBars from './DimensionBars.vue';
import type { Cognition, Evidence } from '../types';

defineProps<{
  title: string;
  student: string;
  cognition: Cognition;
  evidence?: Evidence[];
}>();

const showBasis = ref(false);
</script>

<template>
  <section class="card">
    <header class="card-head">
      <h3 class="card-title">{{ title }}</h3>
      <span class="card-extra">{{ student }}</span>
    </header>
    <div class="card-body">
      <CognitionChart
        :history="cognition.history"
        :prediction="cognition.prediction"
        :prediction-history="cognition.predictionHistory"
        :current-score="cognition.score"
        :predicted-score="cognition.predictedScore"
      />
      <p class="end-label">{{ cognition.predictedEndLabel }}</p>
      <div class="live-value-grid cognition-live-values">
        <div class="live-value"><span>专注度</span><b>{{ cognition.liveMetrics.attention }}%</b></div>
        <div class="live-value"><span>参与度</span><b>{{ cognition.liveMetrics.participation }}%</b></div>
        <div class="live-value"><span>回答信心</span><b>{{ cognition.liveMetrics.confidence }}%</b></div>
      </div>
      <DimensionBars :dimensions="cognition.dimensions" />
      <button class="panel-link" type="button" @click="showBasis = !showBasis">
        评估与预测依据（已观测 {{ cognition.observedCount }}/{{ cognition.dimensions.length }} 个维度）
      </button>
      <div v-if="showBasis" class="detail-box no-print">
        <p>认知趋势随课堂进程更新，学生提交的回答会作为课堂互动证据记录。</p>
        <p>虚线显示策略预测，较早生成的预测值会继续保留在这条线上。</p>
        <p v-if="evidence && evidence.length">
          最近证据：{{ evidence[evidence.length - 1].time }}「{{ evidence[evidence.length - 1].quote }}」（{{ evidence[evidence.length - 1].dimension }}，Δ{{ evidence[evidence.length - 1].delta }}）
        </p>
      </div>
    </div>
  </section>
</template>
