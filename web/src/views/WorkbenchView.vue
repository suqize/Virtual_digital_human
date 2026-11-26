<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AvatarStage from '../components/AvatarStage.vue';
import CognitionPanel from '../components/CognitionPanel.vue';
import InteractionPanel from '../components/InteractionPanel.vue';
import InterventionPanel from '../components/InterventionPanel.vue';
import { disconnectAvatar } from '../avatar';
import { app, endClass, loadEvaluation, loadPlan, nextRound, refreshState } from '../store';

const interactionRef = ref<InstanceType<typeof InteractionPanel> | null>(null);

onMounted(async () => {
  await refreshState();
  void loadEvaluation();
  void loadPlan();
});

async function handleEnd(): Promise<void> {
  await endClass();
  await disconnectAvatar();
}

function handleFocusInteraction(): void {
  interactionRef.value?.focusInput();
}
</script>

<template>
  <div>
    <div class="page-header no-print">
      <div class="page-header-left">
        <h2 class="page-title">课堂工作台</h2>
        <span class="page-subtitle">
          {{ app.state?.course.title ?? '加载中…' }} · {{ app.state?.course.student ?? '' }} ·
          {{ !app.state ? '状态加载中' : app.state.ended ? '课堂已结束' : '课堂进行中' }}
        </span>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" :disabled="app.busy || !app.state" @click="handleFocusInteraction">学生互动</button>
        <button class="btn" type="button" :disabled="app.busy || !app.state || app.state.ended" @click="nextRound">下一环节</button>
        <button class="btn btn-danger" type="button" :disabled="app.busy || !app.state || app.state.ended" @click="handleEnd">结束课堂</button>
      </div>
    </div>

    <div v-if="app.notice" class="notice-bar no-print" :class="{ error: !app.offline }">{{ app.notice }}</div>

    <div v-if="!app.state" class="notice-bar">课堂状态加载中…</div>

    <div v-else class="workbench-grid">
      <div class="column">
        <AvatarStage :round="app.state.round" :teacher-name="app.state.course.teacher" />
        <InteractionPanel
          ref="interactionRef"
          :interactions="app.state.interactions"
          :student-name="app.state.course.student"
          :teacher-name="app.state.course.teacher"
        />
      </div>
      <div class="column">
        <CognitionPanel
          title="实时认知状态"
          :student="app.state.course.student"
          :cognition="app.state.cognition"
          :evidence="app.state.evidence"
        />
        <InterventionPanel :intervention="app.state.intervention" />
      </div>
    </div>
  </div>
</template>
