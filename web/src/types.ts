export interface ClassInfo {
  title: string;
  student: string;
  teacher: string;
}

export interface RoundInfo {
  index: number;
  total: number;
  question: string;
  boardTitle: string;
  formulas: string[];
  lines: [number, number][];
  strategy: string;
}

export interface Interaction {
  id: number;
  role: 'student' | 'teacher';
  time: string;
  text: string;
  tag?: string;
}

export interface CognitionPoint {
  time: string;
  score: number;
}

export interface DimensionInfo {
  name: string;
  score: number;
  observed: boolean;
}

export interface Cognition {
  score: number;
  predictedScore: number;
  history: CognitionPoint[];
  prediction: CognitionPoint[];
  predictedEndLabel: string;
  dimensions: DimensionInfo[];
  observedCount: number;
}

export interface InterventionRecord {
  time: string;
  strategy: string;
  note: string;
}

export interface Intervention {
  status: string;
  from: string;
  strategy: string;
  title: string;
  description: string;
  reason: string;
  records: InterventionRecord[];
}

export interface Evidence {
  time: string;
  dimension: string;
  quote: string;
  delta: number;
  tag: string;
}

export interface ClassroomState {
  course: ClassInfo;
  elapsedSeconds: number;
  ended: boolean;
  round: RoundInfo;
  interactions: Interaction[];
  cognition: Cognition;
  intervention: Intervention;
  evidence: Evidence[];
}

export interface StrategyEffectRow {
  strategy: string;
  triggers: number;
  before: number;
  after: number;
  delta: number;
  status: string;
  detail: string;
}

export interface Evaluation {
  duration: string;
  interactionCount: number;
  evidenceCount: number;
  review: { summary: string; rows: StrategyEffectRow[] };
  dimensions: DimensionReview[];
  comment: string;
  nextGoal: { dimension: string; title: string; description: string };
}

export interface DimensionReview {
  name: string;
  score: number;
  status: string;
  quote: string;
  conclusion: string;
  suggestion: string;
}

export interface PlanSegment {
  time: string;
  stage: string;
  task: string;
}

export interface BranchStrategy {
  tone: 'green' | 'blue' | 'yellow';
  label: string;
  action: string;
}

export interface Plan {
  goal: { dimension: string; title: string; description: string; approach: string };
  segments: PlanSegment[];
  basis: { evidenceTime: string; quote: string; summary: string; dimension: string; score: number };
  branches: BranchStrategy[];
}

export interface AvatarConfig {
  appKey: string;
  secretKey: string;
  avatarImageUrl: string;
  speaker: string;
  userPrompt: string;
  actionList: string[];
  classroomScenario: string;
}

export interface HealthInfo {
  ok: boolean;
  llmReady: boolean;
  avatarReady: boolean;
  missingAvatarConfig: string[];
  model: string;
  avatarProvider: string;
  classroomScenario: string;
  quickQuestions: string[];
  actionList: string[];
  actionError: string | null;
}

export type TagTone = 'green' | 'blue' | 'orange' | 'yellow' | 'gray' | 'red';
