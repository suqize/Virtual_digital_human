<script setup lang="ts">
import type { DimensionInfo } from '../types';

defineProps<{ dimensions: DimensionInfo[] }>();
</script>

<template>
  <div>
    <div v-for="dim in dimensions" :key="dim.name" class="dim-row">
      <span class="dim-name">{{ dim.name }}</span>
      <div class="dim-bar">
        <i :class="{ pending: !dim.observed }" :style="{ width: `${dim.score}%` }"></i>
      </div>
      <span class="dim-score">{{ dim.score }}</span>
      <span class="tag" :class="dim.observed ? 'tag-blue' : 'tag-gray'">
        {{ dim.observed ? '已观测' : '待观测' }}
      </span>
    </div>
  </div>
</template>
