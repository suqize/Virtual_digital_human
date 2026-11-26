<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import avatarPreview from '../assets/teacher-avatar.png';
import { avatar, connectAvatar, disconnectAvatar, probeConfig, setPaused, toggleMic } from '../avatar';
import { app } from '../store';
import type { RoundInfo } from '../types';

const props = defineProps<{ round: RoundInfo; teacherName: string }>();

const stageRef = ref<HTMLElement>();
const videoRef = ref<HTMLDivElement>();
const boardOn = ref(true);
const now = ref(Date.now());
const fetchedAt = ref(Date.now());
const elapsedBase = ref(0);
const isFullscreen = ref(false);
const micOnBeforePause = ref(false);

let timer: number | undefined;

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const elapsedLabel = computed(() => {
  const base = app.state ? elapsedBase.value : 0;
  const tick = Math.max(0, Math.floor((now.value - fetchedAt.value) / 1000));
  return fmt(base + (app.state && !app.state.ended ? tick : 0));
});

function syncTimer(): void {
  if (app.state) {
    elapsedBase.value = app.state.elapsedSeconds;
    fetchedAt.value = Date.now();
  }
}

watch(
  () => app.state?.elapsedSeconds,
  syncTimer,
);

onMounted(() => {
  syncTimer();
  probeConfig();
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
  document.addEventListener('fullscreenchange', onFullscreenChange);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
});

function onFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === stageRef.value;
}

async function toggleFullscreen(): Promise<void> {
  if (!stageRef.value) return;
  if (document.fullscreenElement === stageRef.value) {
    await document.exitFullscreen().catch(() => {});
  } else {
    await stageRef.value.requestFullscreen().catch(() => {});
  }
}

async function handleConnect(): Promise<void> {
  if (!videoRef.value) return;
  await connectAvatar(videoRef.value);
}

async function handleDisconnect(): Promise<void> {
  await disconnectAvatar();
}

async function togglePause(): Promise<void> {
  if (avatar.status !== 'live') return;
  if (avatar.paused) {
    avatar.paused = false;
    if (micOnBeforePause.value) {
      await toggleMic();
    }
  } else {
    micOnBeforePause.value = avatar.micOn;
    setPaused(true);
  }
}

async function handleMic(): Promise<void> {
  if (avatar.paused) return;
  await toggleMic();
}

function linePoints(k: number, b: number): [number, number][] {
  const f = (x: number) => k * x + b;
  const xMin = -5;
  const xMax = 5;
  const yMin = -5.6;
  const yMax = 5.6;
  let a = xMin;
  let z = xMax;
  if (k > 0) {
    if (f(a) > yMax) a = (yMax - b) / k;
    if (f(z) < yMin) z = (yMin - b) / k;
  } else if (k < 0) {
    if (f(a) < yMin) a = (yMin - b) / k;
    if (f(z) > yMax) z = (yMax - b) / k;
  } else if (b > yMax || b < yMin) {
    return [];
  }
  if (z <= a) return [];
  const toPx = (x: number, y: number): [number, number] => [120 + x * 20, 120 - y * 20];
  return [toPx(a, f(a)), toPx(z, f(z))];
}

const LINE_COLORS = ['#ffd666', '#7dd3fc', '#f9a8d4'];
const plottedLines = computed(() =>
  props.round.lines.map(([k, b], index) => ({
    color: LINE_COLORS[index % LINE_COLORS.length],
    points: linePoints(k, b),
  })),
);
</script>

<template>
  <section class="card">
    <header class="card-head">
      <h3 class="card-title">数字人课堂</h3>
      <div class="card-extra no-print">
        <button class="btn btn-sm" :class="{ active: boardOn }" type="button" @click="boardOn = !boardOn">同步板书</button>
      </div>
    </header>

    <div class="stage-info">
      <span class="teacher-chip"><span class="avatar-dot">师</span>数字人 - {{ teacherName }}</span>
      <span class="class-timer">{{ elapsedLabel }}</span>
    </div>

    <div ref="stageRef" class="stage-shell">
      <div ref="videoRef" class="stage-video"></div>

      <div v-if="boardOn" class="stage-board">
        <div class="board-title">{{ round.boardTitle }}</div>
        <div v-for="formula in round.formulas" :key="formula" class="board-formula">{{ formula }}</div>
        <svg class="board-plot" viewBox="0 0 240 240" aria-label="函数图像">
          <line x1="120" y1="8" x2="120" y2="232" stroke="#5f7f6c" stroke-width="1.5" />
          <line x1="8" y1="120" x2="232" y2="120" stroke="#5f7f6c" stroke-width="1.5" />
          <polygon points="120,8 116,16 124,16" fill="#5f7f6c" />
          <polygon points="232,120 224,116 224,124" fill="#5f7f6c" />
          <g v-for="(line, index) in plottedLines" :key="index">
            <line
              v-if="line.points.length === 2"
              :x1="line.points[0][0]"
              :y1="line.points[0][1]"
              :x2="line.points[1][0]"
              :y2="line.points[1][1]"
              :stroke="line.color"
              stroke-width="2.5"
            />
          </g>
        </svg>
      </div>

      <div v-if="avatar.status !== 'live'" class="stage-idle">
        <img :src="avatarPreview" alt="数字人形象预览" />
        <div class="idle-title">数字人课堂尚未连接</div>
        <div class="idle-copy">
          <template v-if="app.offline">当前为离线演示模式，数字人视频流不连接；文字互动与数据闭环仍可演示。</template>
          <template v-else-if="avatar.configError">{{ avatar.configError }}</template>
          <template v-else>连接后，周老师将通过火山引擎实时数字人开始授课；课堂底部展示当前提问。</template>
        </div>
        <button
          v-if="!app.offline"
          class="btn btn-primary"
          type="button"
          :disabled="avatar.status === 'connecting' || app.state?.ended"
          @click="handleConnect"
        >
          {{ avatar.status === 'connecting' ? '正在连接…' : '连接老师' }}
        </button>
      </div>

      <div v-if="avatar.paused" class="stage-paused">已暂停</div>

      <div class="stage-overlay-bottom">
        <span class="lecture-status">课堂讲解：{{ round.strategy }} · 环节 {{ round.index }}/{{ round.total }}</span>
        <div class="current-question"><span class="q-label">当前提问</span>{{ round.question }}</div>
      </div>
    </div>

    <div class="stage-controls no-print">
      <div class="stage-controls-left">
        <button class="ctrl" type="button" title="暂停 / 继续（暂停时同时关闭麦克风）" :disabled="avatar.status !== 'live'" @click="togglePause">
          <svg v-if="avatar.paused" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5-9-5.5z" /></svg>
          <svg v-else viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" /></svg>
        </button>
        <button class="ctrl" type="button" title="实时推流，不支持切帧" disabled>
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5v11l6.5-5.5L2 2.5zM11 2.5h3v11h-3z" /></svg>
        </button>
        <button class="ctrl" type="button" :title="isFullscreen ? '退出全屏' : '全屏播放'" @click="toggleFullscreen">
          <svg v-if="!isFullscreen" viewBox="0 0 16 16" fill="currentColor"><path d="M2 6V2h4v2H4v2H2zm12 0V2h-4v2h2v2h2zM2 14v-4h2v2h2v2H2zm12 0h-4v-2h2v-2h2v4z" /></svg>
          <svg v-else viewBox="0 0 16 16" fill="currentColor"><path d="M6 2v4H2V4h2V2h2zm4 0h2v2h2v2h-4V2zM2 10h4v4H4v-2H2v-2zm12 0v2h-2v2h-2v-4h4z" /></svg>
        </button>
      </div>
      <div class="stage-controls-right">
        <span class="live-chip" :class="{ on: avatar.status === 'live' }">
          <i class="live-dot"></i>{{ avatar.status === 'live' ? '直播中' : avatar.status === 'connecting' ? '连接中…' : '未连接' }}
        </span>
        <button class="btn btn-sm" type="button" :disabled="avatar.status !== 'live' || avatar.paused" @click="handleMic">
          {{ avatar.micOn ? '静音麦克风' : '开启麦克风' }}
        </button>
        <button
          v-if="avatar.status === 'live'"
          class="btn btn-sm btn-danger"
          type="button"
          @click="handleDisconnect"
        >
          断开
        </button>
      </div>
    </div>
  </section>
</template>
