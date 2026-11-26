<script setup lang="ts">
import { watch } from 'vue';
import TopNav from './components/TopNav.vue';
import WorkbenchView from './views/WorkbenchView.vue';
import EvaluationView from './views/EvaluationView.vue';
import PlanView from './views/PlanView.vue';
import { app } from './store';

watch(
  () => app.tab,
  (tab) => {
    document.title =
      tab === 'workbench'
        ? '知之课堂 · 课堂工作台'
        : tab === 'evaluation'
          ? '知之课堂 · 课后评价'
          : '知之课堂 · 下节课方案';
  },
);
</script>

<template>
  <div class="app">
    <TopNav />
    <main class="app-main">
      <WorkbenchView v-if="app.tab === 'workbench'" />
      <EvaluationView v-else-if="app.tab === 'evaluation'" />
      <PlanView v-else />
    </main>
  </div>
</template>
