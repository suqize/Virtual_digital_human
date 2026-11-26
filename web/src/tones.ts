import type { TagTone } from './types';

export function toneOf(text: string): TagTone {
  if (/观测到改善|独立解释|已有基础|正常/.test(text) && !/有限/.test(text)) return 'green';
  if (/只给结论|已切换|常规/.test(text)) return 'blue';
  if (/改善有限|出现混淆|概念混淆|仍需巩固|需要进一步支持|预警/.test(text)) return 'orange';
  return 'gray';
}
