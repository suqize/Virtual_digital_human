<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import StatusTag from './StatusTag.vue';
import { app, sendInteraction } from '../store';
import type { Interaction } from '../types';

const props = defineProps<{ interactions: Interaction[]; studentName: string; teacherName: string }>();

const listRef = ref<HTMLElement>();
const inputRef = ref<HTMLInputElement>();
const draft = ref('');

function focusInput(): void {
  inputRef.value?.focus();
}

defineExpose({ focusInput });

watch(
  () => props.interactions.length,
  async () => {
    await nextTick();
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
  },
  { immediate: true },
);

async function submit(): Promise<void> {
  const text = draft.value.trim();
  if (!text || app.busy || !props.interactions) return;
  draft.value = '';
  await sendInteraction(text);
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <h3 class="card-title">课堂互动记录</h3>
      <span class="card-extra">
        {{ interactions.filter((item) => item.role === 'student').length }} 次实际学生互动
      </span>
    </header>
    <div class="card-body">
      <p class="interaction-record-note">记录本堂课实际提交的学生回答，以及老师基于回答生成的回复。</p>
      <div ref="listRef" class="chat-list">
        <div v-for="item in interactions" :key="item.id" class="msg" :class="item.role === 'student' ? 'msg-student' : 'msg-teacher'">
          <span class="msg-avatar">{{ item.role === 'student' ? '林' : '周' }}</span>
          <div class="msg-body">
            <div class="msg-meta">
              <span class="msg-name">{{ item.role === 'student' ? studentName : `数字人 - ${teacherName}` }}</span>
              <span>{{ item.time }}</span>
              <StatusTag v-if="item.tag" :text="item.tag" :tone="item.tag === '概念混淆' ? 'orange' : item.tag === '只给结论' ? 'blue' : item.tag === '独立解释' ? 'green' : 'gray'" />
            </div>
            <div class="msg-text">{{ item.text }}</div>
          </div>
        </div>
      </div>
      <div class="chat-composer no-print">
        <input
          ref="inputRef"
          v-model="draft"
          type="text"
          maxlength="800"
          :placeholder="app.state?.ended ? '课堂已结束' : '以学生身份回答或提问...'"
          :disabled="app.state?.ended || app.busy"
          @keyup.enter="submit"
        />
        <button class="btn btn-primary" type="button" :disabled="app.state?.ended || app.busy || !draft.trim()" @click="submit">
          {{ app.busy ? '计算中…' : '互动' }}
        </button>
      </div>
    </div>
  </section>
</template>
