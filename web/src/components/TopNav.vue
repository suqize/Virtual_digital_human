<script setup lang="ts">
import { app, type TabKey } from '../store';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'workbench', label: '课堂工作台' },
  { key: 'evaluation', label: '课后评价' },
  { key: 'plan', label: '下节课方案' },
];
</script>

<template>
  <header class="top-nav no-print">
    <div class="brand"><span class="brand-logo">知</span><span>知之课堂</span></div>
    <nav class="nav-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="nav-tab"
        :class="{ active: app.tab === tab.key }"
        type="button"
        @click="app.tab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>
    <div class="nav-right">
      <span v-if="app.offline" class="offline-badge">离线演示模式</span>
    </div>
  </header>
</template>
