import { reactive } from 'vue';
import { api } from './api';
import { buildMockEvaluation, buildMockPlan, buildMockState, mockEnd, mockInteract, mockNextRound, mockTickState } from './mock';
import type { ClassroomState, Evaluation, Plan } from './types';

export type TabKey = 'workbench' | 'evaluation' | 'plan';

export const app = reactive({
  tab: 'workbench' as TabKey,
  offline: false,
  state: null as ClassroomState | null,
  evaluation: null as Evaluation | null,
  plan: null as Plan | null,
  busy: false,
  notice: '',
});

function applyState(state: ClassroomState): void {
  app.state = state;
}

export async function refreshState(): Promise<void> {
  if (app.offline) {
    app.state = app.state ?? buildMockState();
    return;
  }
  try {
    applyState(await api.classroomState());
    app.notice = '';
  } catch (error) {
    app.offline = true;
    app.state = app.state ?? buildMockState();
    app.notice = (error as Error).message || '无法连接后端，已切换到离线模式。';
  }
}

export async function pollLiveState(): Promise<void> {
  if (!app.state || app.state.ended || app.busy) return;
  if (app.offline) {
    applyState(mockTickState(app.state));
    return;
  }
  await refreshState();
}

export async function sendInteraction(text: string): Promise<void> {
  if (!text.trim() || app.busy) return;
  app.busy = true;
  try {
    if (app.offline) {
      applyState(mockInteract(app.state!, text));
    } else {
      applyState(await api.interact(text));
    }
    app.notice = '';
  } catch (error) {
    app.notice = (error as Error).message || '互动提交失败。';
  } finally {
    app.busy = false;
  }
}

export async function nextRound(): Promise<void> {
  if (app.busy) return;
  app.busy = true;
  try {
    if (app.offline) {
      applyState(mockNextRound(app.state!));
    } else {
      applyState(await api.nextRound());
    }
    app.notice = '';
  } catch (error) {
    app.notice = (error as Error).message || '切换环节失败。';
  } finally {
    app.busy = false;
  }
}

export async function endClass(): Promise<void> {
  if (app.busy) return;
  app.busy = true;
  try {
    if (app.offline) {
      applyState(mockEnd(app.state!));
    } else {
      applyState(await api.endClass());
    }
    app.notice = '';
    app.tab = 'evaluation';
    await loadEvaluation();
  } catch (error) {
    app.notice = (error as Error).message || '结束课堂失败。';
  } finally {
    app.busy = false;
  }
}

export async function loadEvaluation(): Promise<void> {
  if (app.offline) {
    app.evaluation = buildMockEvaluation(app.state ?? buildMockState());
    return;
  }
  try {
    app.evaluation = await api.evaluation();
  } catch {
    app.evaluation = null;
  }
}

export async function loadPlan(): Promise<void> {
  if (app.offline) {
    app.plan = buildMockPlan(app.state ?? buildMockState());
    return;
  }
  try {
    app.plan = await api.plan();
  } catch {
    app.plan = null;
  }
}
