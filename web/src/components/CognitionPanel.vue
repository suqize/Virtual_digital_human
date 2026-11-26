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
        :current-score="cognition.score"
        :predicted-score="cognition.predictedScore"
      />
      <p class="end-label">{{ cognition.predictedEndLabel }}</p>
      <DimensionBars :dimensions="cognition.dimensions" />
      <button class="panel-link" type="button" @click="showBasis = !showBasis">
        评估与预测依据（已观测 {{ cognition.observedCount }}/{{ cognition.dimensions.length }} 个维度）
      </button>
      <div v-if="showBasis" class="detail-box no-print">
        <p>评估依据：对课堂互动证据按 4 个认知维度逐项计分（关键词命中 + 回答结构），总分按 概念理解 25% / 图像解读 25% / 推理解释 30% / 迁移应用 20% 加权。</p>
        <p>预测依据：以当前分为起点，按已观测维度数量估计干预增益，外推至课后 5 分钟，虚线为策略预测。</p>
        <p v-if="evidence && evidence.length">
          最近证据：{{ evidence[evidence.length - 1].time }}「{{ evidence[evidence.length - 1].quote }}」（{{ evidence[evidence.length - 1].dimension }}，Δ{{ evidence[evidence.length - 1].delta }}）
        </p>
      </div>
    </div>
  </section>
</template>
