<script setup lang="ts">
import { ref } from 'vue';
import type { Intervention } from '../types';

defineProps<{ intervention: Intervention }>();

const showRecords = ref(false);
</script>

<template>
  <section class="card">
    <header class="card-head">
      <h3 class="card-title">实时教学干预</h3>
      <span class="tag tag-blue">{{ intervention.status }}</span>
    </header>
    <div class="card-body">
      <p v-if="intervention.from !== '——'" class="intervention-from">触发来源：由『<b>{{ intervention.from }}</b>』切换至</p>
      <p v-else class="intervention-from">课堂开场策略</p>
      <h4 class="intervention-title">{{ intervention.strategy }}</h4>
      <p class="intervention-desc">{{ intervention.description }}</p>
      <div class="live-value-grid intervention-live-values">
        <div class="live-value"><span>策略置信度</span><b>{{ intervention.metrics.confidence }}%</b></div>
        <div class="live-value"><span>干预强度</span><b>{{ intervention.metrics.intensity }}%</b></div>
        <div class="live-value"><span>当前关注维度</span><b>{{ intervention.metrics.focusDimension }}</b></div>
      </div>
      <p class="intervention-reason"><b>决策依据：</b>{{ intervention.reason }}</p>
      <button class="panel-link" type="button" @click="showRecords = !showRecords">
        策略记录（{{ intervention.records.length }} 条）
      </button>
      <ol v-if="showRecords" class="record-list no-print">
        <li v-for="record in intervention.records" :key="record.time + record.strategy" class="record-item">
          <span class="record-time">{{ record.time }}</span>
          <span class="record-flow">
            <b>{{ record.strategy }}</b>
            <span class="record-note">{{ record.note }}</span>
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
