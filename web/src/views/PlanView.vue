<script setup lang="ts">
import { onMounted } from 'vue';
import StatusTag from '../components/StatusTag.vue';
import { app, loadPlan, refreshState } from '../store';

onMounted(async () => {
  await refreshState();
  await loadPlan();
});

function printPage(): void {
  window.print();
}
</script>

<template>
  <div v-if="app.state">
    <div class="page-header no-print">
      <div class="page-header-left">
        <h2 class="page-title">下节课方案</h2>
        <span class="page-subtitle">{{ app.state.course.title }} · 基于本节课学情自动生成</span>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" @click="printPage">打印此页</button>
        <button class="btn btn-primary" type="button" @click="app.tab = 'evaluation'">查看评价</button>
      </div>
    </div>

    <div v-if="app.plan">
      <div class="plan-grid">
        <div class="column">
          <section class="card">
            <header class="card-head">
              <h3 class="card-title">下一节课的教学思路</h3>
            </header>
            <div class="card-body">
              <div class="goal-head">
                <span class="metric-label" style="width: auto">优先目标</span>
                <StatusTag :text="app.plan.goal.dimension" tone="blue" />
                <h4>{{ app.plan.goal.title }}</h4>
              </div>
              <p class="goal-desc"><b>目标说明：</b>{{ app.plan.goal.description }}</p>
              <p class="goal-approach"><b>教学思路：</b>{{ app.plan.goal.approach }}</p>
            </div>
          </section>

          <section class="card">
            <header class="card-head">
              <h3 class="card-title">20 分钟教学安排</h3>
              <span class="card-extra">时序课时拆解</span>
            </header>
            <div class="card-body">
              <ol class="timeline">
                <li v-for="segment in app.plan.segments" :key="segment.stage">
                  <span class="dot"></span>
                  <div class="tl-time">{{ segment.time }}</div>
                  <div class="tl-stage">{{ segment.stage }}</div>
                  <p class="tl-task">{{ segment.task }}</p>
                </li>
              </ol>
            </div>
          </section>
        </div>

        <div class="column">
          <section class="card">
            <header class="card-head">
              <h3 class="card-title">方案依据</h3>
              <span class="card-extra">溯源于上一节课记录</span>
            </header>
            <div class="card-body">
              <div class="basis-item">
                <span class="basis-label">证据时间戳</span>
                <span class="basis-value">本节课末次评分证据 {{ app.plan.basis.evidenceTime }}</span>
              </div>
              <div class="basis-item">
                <span class="basis-label">学生原话</span>
                <span class="basis-value basis-quote">“{{ app.plan.basis.quote }}”</span>
              </div>
              <div class="basis-item">
                <span class="basis-label">学情总结</span>
                <span class="basis-value">{{ app.plan.basis.summary }}</span>
              </div>
              <div class="basis-item">
                <span class="basis-label">当前认知分值</span>
                <span class="basis-value"><b>{{ app.plan.basis.dimension }}</b>当前估计为 {{ app.plan.basis.score }} / 100</span>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-head">
              <h3 class="card-title">根据现场回答调整</h3>
              <span class="card-extra">分支干预预案</span>
            </header>
            <div class="card-body">
              <div v-for="branch in app.plan.branches" :key="branch.label" class="branch-item">
                <div class="branch-head">
                  <StatusTag :text="branch.label" :tone="branch.tone" />
                  <span class="branch-label">{{ branch.label }}</span>
                </div>
                <p class="branch-action">{{ branch.action }}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div v-else class="notice-bar">下节课方案生成中，请稍候…</div>
  </div>
</template>
