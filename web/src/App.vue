<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import TopNav from './components/TopNav.vue';
import WorkbenchView from './views/WorkbenchView.vue';
import EvaluationView from './views/EvaluationView.vue';
import PlanView from './views/PlanView.vue';
import { app, pollLiveState } from './store';

let pollTimer: number | undefined;
let polling = false;

onMounted(() => {
  pollTimer = window.setInterval(async () => {
    if (polling || app.busy || !app.state || app.state.ended) return;
    polling = true;
    try {
      await pollLiveState();
    } finally {
      polling = false;
    }
  }, 4000);
});

onBeforeUnmount(() => {
  if (pollTimer !== undefined) window.clearInterval(pollTimer);
});

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
