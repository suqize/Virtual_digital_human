import type { AvatarConfig, ClassroomState, Evaluation, HealthInfo, Plan } from './types';

interface ApiError {
  error?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as ApiError & T;
  if (!response.ok) {
    throw new Error(data.error || `请求失败（${response.status}）`);
  }
  return data;
}

function post(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const api = {
  health: (): Promise<HealthInfo> => request<HealthInfo>('/api/health'),
  volcConfig: (): Promise<AvatarConfig> => request<AvatarConfig>('/api/volc/config'),
  classroomState: (): Promise<ClassroomState> => request<ClassroomState>('/api/classroom/state'),
  interact: (text: string): Promise<ClassroomState> => request<ClassroomState>('/api/classroom/interact', post({ text })),
  nextRound: (): Promise<ClassroomState> => request<ClassroomState>('/api/classroom/next-round', post({})),
  endClass: (): Promise<ClassroomState> => request<ClassroomState>('/api/classroom/end', post({})),
  resetClass: (): Promise<ClassroomState> => request<ClassroomState>('/api/classroom/reset', post({})),
  evaluation: (): Promise<Evaluation> => request<Evaluation>('/api/evaluation'),
  plan: (): Promise<Plan> => request<Plan>('/api/plan'),
};
