<script setup lang="ts">
import { onMounted, ref } from 'vue';
import CognitionPanel from '../components/CognitionPanel.vue';
import StatusTag from '../components/StatusTag.vue';
import { toneOf } from '../tones';
import { app, loadEvaluation, refreshState } from '../store';

const expanded = ref<Record<string, boolean>>({});

onMounted(async () => {
  await refreshState();
  await loadEvaluation();
});

function toggleRow(strategy: string): void {
  expanded.value = { ...expanded.value, [strategy]: !expanded.value[strategy] };
}

function printPage(): void {
  window.print();
}
</script>

<template>
  <div v-if="app.state">
    <div class="page-header no-print">
      <div class="page-header-left">
        <h2 class="page-title">课后评价</h2>
        <span class="page-subtitle">{{ app.state.course.title }} · {{ app.state.course.student }} · 课后自动汇总生成</span>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" @click="printPage">打印此页</button>
        <button class="btn btn-primary" type="button" @click="app.tab = 'plan'">查看下节课方案</button>
      </div>
    </div>

    <div v-if="app.evaluation">
      <div class="summary-row">
        <div class="metric-block">
          <div class="metric-label">课堂时长</div>
          <div class="metric-value">{{ app.evaluation.duration }}</div>
        </div>
        <div class="metric-block">
          <div class="metric-label">学生互动</div>
          <div class="metric-value">{{ app.evaluation.interactionCount }}<small>次</small></div>
        </div>
        <div class="metric-block">
          <div class="metric-label">已评分证据</div>
          <div class="metric-value">{{ app.evaluation.evidenceCount }}<small>条</small></div>
        </div>
      </div>

      <div class="evaluation-grid">
        <div class="column">
          <section class="card">
            <header class="card-head">
              <h3 class="card-title">教学干预效果复盘</h3>
              <span class="card-extra">按目标维度对照</span>
            </header>
            <div class="card-body">
              <p class="review-summary">{{ app.evaluation.review.summary }}</p>
              <table class="effect-table">
                <thead>
                  <tr>
                    <th>干预名称</th>
                    <th>触发次数</th>
                    <th>分数变化</th>
                    <th>状态</th>
                    <th class="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="row in app.evaluation.review.rows" :key="row.strategy">
                    <tr>
                      <td><span class="effect-name">{{ row.strategy }}</span></td>
                      <td>{{ row.triggers }} 次</td>
                      <td class="score-change">
                        {{ row.before }} → {{ row.after }}
                        <span class="delta" :class="row.delta > 0 ? 'delta-up' : 'delta-flat'">
                          {{ row.delta > 0 ? `+${row.delta}` : row.delta }}
                        </span>
                      </td>
                      <td><StatusTag :text="row.status" :tone="toneOf(row.status)" /></td>
                      <td class="no-print">
                        <button class="expand-btn" :class="{ open: expanded[row.strategy] }" type="button" @click="toggleRow(row.strategy)">
                          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z" /></svg>
                        </button>
                      </td>
                    </tr>
                    <tr v-if="expanded[row.strategy]" class="no-print">
                      <td colspan="5"><div class="effect-detail">{{ row.detail }}</div></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </section>

          <section class="card">
            <header class="card-head">
              <h3 class="card-title">本节课认知评价</h3>
              <span class="card-extra">学生原话 / 系统观测结论</span>
            </header>
            <div class="card-body">
              <div v-for="dim in app.evaluation.dimensions" :key="dim.name" class="dim-review">
                <div class="dim-review-head">
                  <h4>{{ dim.name }}</h4>
                  <StatusTag :text="dim.status" :tone="toneOf(dim.status)" />
                  <span class="dim-score">{{ dim.score }}</span>
                </div>
                <blockquote class="quote-box">
                  <span class="q-tag">学生课堂原话 / 典型作答</span>
                  {{ dim.quote }}
                </blockquote>
                <p class="review-line"><b>系统观测结论：</b>{{ dim.conclusion }}</p>
                <p class="review-line"><b>后续采集建议：</b>{{ dim.suggestion }}</p>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-head">
              <h3 class="card-title">给{{ app.state.course.student }}的评语</h3>
            </header>
            <div class="card-body">
              <p class="comment-box">{{ app.evaluation.comment }}</p>
            </div>
          </section>
        </div>

        <div class="column">
          <CognitionPanel
            title="认知状态概览"
            :student="app.state.course.student"
            :cognition="app.state.cognition"
            :evidence="app.state.evidence"
          />
          <section class="card">
            <header class="card-head">
              <h3 class="card-title">衔接下节课</h3>
            </header>
            <div class="card-body">
              <h4 class="next-goal-title">
                <StatusTag :text="app.evaluation.nextGoal.dimension" tone="blue" />
                {{ app.evaluation.nextGoal.title }}
              </h4>
              <p class="next-goal-desc">{{ app.evaluation.nextGoal.description }}</p>
              <button class="btn btn-primary no-print" type="button" @click="app.tab = 'plan'">打开完整教学方案</button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div v-else class="notice-bar">课后评价数据生成中，请稍候…</div>
  </div>
</template>
