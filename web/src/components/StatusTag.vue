<script setup lang="ts">
import { toneOf } from '../tones';
import type { TagTone } from '../types';

defineProps<{ text: string; tone?: TagTone }>();
</script>

<template>
  <span class="tag" :class="`tag-${tone ?? toneOf(text)}`">{{ text }}</span>
</template>
