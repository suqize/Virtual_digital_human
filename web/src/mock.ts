import type { ClassroomState, CognitionPoint, DimensionInfo, Evaluation, Interaction, Plan } from './types';

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let mockElapsed = 0;
let mockSeq = 1;
let mockTickIndex = 0;
let mockPulse = 0;
let mockLastStrategyBucket = 0;
let mockLastPredictionBucket = 0;
let mockLastInteractionElapsed = Number.NEGATIVE_INFINITY;

const MOCK_ROUNDS: ClassroomState['round'][] = [
  {
    index: 1, total: 5,
    question: '你觉得 y=kx+b 里的 k 和 b 对图像各起什么作用？先说说你的猜想。',
    boardTitle: '猜想：k 与 b 的作用', formulas: ['y = kx + b', 'k：？ b：？'], lines: [[2, 1]], strategy: '读取图像',
  },
  {
    index: 2, total: 5,
    question: '比较 y=2x+1 和 y=2x+3 的图像，你观察到了什么？',
    boardTitle: '观察：两组一次函数', formulas: ['y = 2x + 1', 'y = 2x + 3'], lines: [[2, 1], [2, 3]], strategy: '读取图像',
  },
  {
    index: 3, total: 5,
    question: '把 x=0 和 x=1 分别代入两个式子，起始值和相邻两点的变化量各是多少？',
    boardTitle: '配点：代入求值', formulas: ['x=0 → (0,1) 与 (0,3)', 'x=1 → (1,3) 与 (1,5)', '变化量：都是 2'], lines: [[2, 1], [2, 3]], strategy: '配点诊断',
  },
  {
    index: 4, total: 5,
    question: '现在比较 y=-x+2 和 y=-x-1，独立用两个点或变化量说明理由。',
    boardTitle: '迁移：新函数组', formulas: ['y = -x + 2', 'y = -x - 1', '独立说明理由'], lines: [[-1, 2], [-1, -1]], strategy: '独立练习',
  },
  {
    index: 5, total: 5,
    question: '用自己的话说说：为什么 y=2x+1 和 y=2x+3 的图像是平行的？',
    boardTitle: '出口评价：口述推理', formulas: ['y = 2x + 1', 'y = 2x + 3', '变化量相同 → 平行'], lines: [[2, 1], [2, 3]], strategy: '双图对照',
  },
];

function secondsOf(value: string): number {
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
}

function mockPrediction(current: number, elapsed: number, tick: number, anchorAt = elapsed): CognitionPoint[] {
  const error = [-2, 2, -1, 1][tick % 4];
  const anchor = Math.max(0, Math.min(100, current + error));
  const target = Math.min(95, current + 8);
  const span = 25 * 60;
  return [
    { time: fmt(anchorAt), score: anchor },
    ...[5, 10, 15, 20, 25].map((minute) => {
      const offset = minute * 60;
      const progress = offset / span;
      return {
        time: fmt(elapsed + offset),
        score: Math.max(0, Math.min(100, Math.round(anchor + (target - anchor) * progress))),
      };
    }),
  ];
}

export function buildMockState(): ClassroomState {
  mockElapsed = 0;
  mockSeq = 1;
  mockTickIndex = 0;
  mockPulse = 0;
  mockLastStrategyBucket = 0;
  mockLastPredictionBucket = 0;
  mockLastInteractionElapsed = Number.NEGATIVE_INFINITY;
  const dimensions: DimensionInfo[] = [
    { name: '概念理解', score: 52, observed: false },
    { name: '图像解读', score: 58, observed: false },
    { name: '推理解释', score: 46, observed: false },
    { name: '迁移应用', score: 38, observed: false },
  ];
  const weights: Record<string, number> = { 概念理解: 0.25, 图像解读: 0.25, 推理解释: 0.3, 迁移应用: 0.2 };
  const score = Math.round(dimensions.reduce((sum, item) => sum + item.score * (weights[item.name] ?? 0), 0));
  const history: CognitionPoint[] = [{ time: '00:00', score }];
  const prediction = mockPrediction(score, 0, 0);
  return {
    course: { title: '八年级数学《一次函数的图像与性质》', student: '林同学', teacher: '周老师' },
    elapsedSeconds: 0,
    ended: false,
    round: { ...MOCK_ROUNDS[0] },
    interactions: [{ id: 1, role: 'teacher', time: '00:00', text: '课堂开始。你觉得 y=kx+b 里的 k 和 b 对图像各起什么作用？先说说你的猜想。' }],
    cognition: {
      score,
      predictedScore: prediction[prediction.length - 1].score,
      history,
      prediction,
      predictionHistory: [{ generatedAt: '00:00', points: prediction.map((point) => ({ ...point })) }],
      predictedEndLabel: '预计结束课堂时间 20:00',
      liveMetrics: { attention: 78, participation: 71, confidence: 64 },
      dimensions,
      observedCount: 0,
    },
    intervention: {
      status: '策略跟进中',
      from: '——',
      strategy: '读取图像',
      title: '直接观察图像位置关系',
      description: '引导学生观察图像并提出猜想；提交回答后，课堂记录会保留实际问答。',
      reason: '策略会结合学生提交的实际回答和当前关注维度调整。',
      metrics: { confidence: 76, intensity: 58, focusDimension: '推理解释' },
      records: [{ time: '00:00', strategy: '读取图像', note: '开场引导：先观察图像并说出初步猜想。' }],
    },
    evidence: [],
  };
}

function overallOf(state: ClassroomState): number {
  const weights: Record<string, number> = { '概念理解': 0.25, '图像解读': 0.25, '推理解释': 0.3, '迁移应用': 0.2 };
  const total = state.cognition.dimensions.reduce((sum, d) => sum + d.score * (weights[d.name] ?? 0.25), 0);
  return Math.round(total);
}

function tagOf(text: string): string {
  if (/b ?越大.{0,4}陡|k ?越大.{0,4}陡/.test(text)) return '概念混淆';
  const reasoning = ['因为', '所以', '变化量', '代入', '两个点', '理由'].filter((w) => text.includes(w)).length;
  if (reasoning >= 2 && text.length >= 30) return '独立解释';
  if (text.length <= 14 && reasoning === 0) return '只给结论';
  return '正常';
}

const RESPONSES: Record<string, string> = {
  正常: '这一步说得好。再往前走一步：哪两个点或哪一段变化量支持你的判断？',
  概念混淆: '先不下结论。我们把两条线画在同一坐标系里对照：陡峭程度由谁决定，起点高度又由谁决定？',
  只给结论: '结论先放在这里。请补上理由：哪两个数值或哪两个点支持你的判断？',
  独立解释: '推理完整了：先比较变化量说明位置关系，再用起点说明上下关系，这正是我们要的方法。',
};

const STRATEGY_INFO: Record<string, { title: string; description: string }> = {
  '双图对照': { title: '同一坐标系双图对照', description: '把两条直线画在同一坐标系中对照，区分 k 与 b 的作用。' },
  '口头追问': { title: '追问依据，补全推理', description: '学生给出结论后，追问哪些数值或点能支持判断。' },
  '独立练习': { title: '撤去提示，独立完成', description: '撤去提示，让学生独立用两个点或变化量说明理由。' },
  '配点诊断': { title: '代入求值，用点验证', description: '比较关键点的起始值与变化量，再对应回图像。' },
  '读取图像': { title: '直接观察图像位置关系', description: '引导学生观察图像并提出初步猜想。' },
};

function recordMockStrategy(state: ClassroomState, strategy: string, note: string, allowRepeat = false): void {
  if (state.intervention.strategy === strategy && !allowRepeat) return;
  const info = STRATEGY_INFO[strategy] ?? STRATEGY_INFO['读取图像'];
  state.intervention = {
    ...state.intervention,
    from: state.intervention.strategy,
    strategy,
    title: info.title,
    description: info.description,
    reason: note,
    records: [...state.intervention.records, { time: fmt(mockElapsed), strategy, note }],
  };
}

function pushInteraction(state: ClassroomState, role: 'student' | 'teacher', text: string, tag?: string): void {
  const item: Interaction = { id: ++mockSeq, role, time: fmt(mockElapsed), text };
  if (tag) item.tag = tag;
  state.interactions.push(item);
}

function archiveMockPrediction(state: ClassroomState, force = false, generatedAt = fmt(mockElapsed)): void {
  const bucket = Math.floor(mockElapsed / 60);
  if (!force && bucket <= mockLastPredictionBucket) return;
  const points = state.cognition.prediction.map((point) => ({ ...point }));
  const previous = state.cognition.predictionHistory.at(-1);
  if (!previous || JSON.stringify(previous.points) !== JSON.stringify(points)) {
    state.cognition.predictionHistory.push({ generatedAt, points });
  }
  mockLastPredictionBucket = bucket;
}

export function mockInteract(state: ClassroomState, text: string): ClassroomState {
  archiveMockPrediction(state, true, fmt(state.elapsedSeconds));
  mockLastInteractionElapsed = mockElapsed;
  const tag = tagOf(text);
  pushInteraction(state, 'student', text, tag);
  state.elapsedSeconds = mockElapsed;
  const deltas: Record<string, number> = { '概念理解': 1, '图像解读': 1, '推理解释': tag === '概念混淆' ? -3 : 2, '迁移应用': 1 };
  state.cognition.dimensions = state.cognition.dimensions.map((d) => ({
    ...d,
    score: Math.max(5, Math.min(95, d.score + (deltas[d.name] ?? 0))),
    observed: d.observed || d.name === (tag === '概念混淆' ? '推理解释' : text.includes('图像') || text.includes('坐标') ? '图像解读' : '概念理解'),
  }));
  state.cognition.observedCount = state.cognition.dimensions.filter((d) => d.observed).length;
  const score = overallOf(state);
  state.cognition.score = score;
  appendMockHistory(state, score);
  state.cognition.prediction = mockPrediction(score, mockElapsed, mockTickIndex);
  state.cognition.predictedScore = state.cognition.prediction[state.cognition.prediction.length - 1].score;
  state.cognition.liveMetrics.confidence = Math.min(98, state.cognition.liveMetrics.confidence + 2);
  state.cognition.liveMetrics.participation = Math.min(98, state.cognition.liveMetrics.participation + 1);
  const evidenceDimension = tag === '概念混淆' ? '推理解释' : text.includes('图像') || text.includes('坐标') ? '图像解读' : '概念理解';
  state.evidence.push({ time: fmt(mockElapsed), dimension: evidenceDimension, quote: text, delta: 2, tag });
  if (tag === '概念混淆') recordMockStrategy(state, '双图对照', '学生的回答暴露概念混淆，切换至双图对照。');
  else if (tag === '只给结论') recordMockStrategy(state, '口头追问', '学生只给出结论，继续追问依据。');
  else if (tag === '独立解释') recordMockStrategy(state, '独立练习', '学生给出完整解释，进入独立练习检验迁移。');
  state.intervention.status = '刚根据互动调整';
  state.intervention.metrics.confidence = Math.min(96, state.intervention.metrics.confidence + 3);
  state.intervention.metrics.intensity = Math.min(90, state.intervention.metrics.intensity + (tag === '概念混淆' ? 8 : 3));
  state.intervention.metrics.focusDimension = evidenceDimension;
  pushInteraction(state, 'teacher', RESPONSES[tag]);
  return { ...state };
}

function appendMockHistory(state: ClassroomState, score: number): void {
  const point = { time: fmt(mockElapsed), score };
  if (state.cognition.history.at(-1)?.time === point.time) state.cognition.history[state.cognition.history.length - 1] = point;
  else state.cognition.history.push(point);
}

export function mockTickState(state: ClassroomState): ClassroomState {
  if (state.ended) return state;
  mockElapsed = Math.max(mockElapsed, state.elapsedSeconds) + 4;
  if (Math.floor(mockElapsed / 60) > mockLastPredictionBucket) {
    archiveMockPrediction(state, true, fmt(state.elapsedSeconds));
  }
  state.elapsedSeconds = mockElapsed;
  mockPulse += 1;
  const bucket = Math.floor(mockElapsed / 8);
  if (bucket > mockTickIndex) {
    mockTickIndex = bucket;
    const dimensions = state.cognition.dimensions;
    const target = dimensions[(mockTickIndex - 1) % dimensions.length];
    const deltas = [1, 1, 0, -1, 2, -1, 1, 0];
    target.score = Math.max(5, Math.min(95, target.score + deltas[(mockTickIndex - 1) % deltas.length]));
    state.cognition.score = overallOf(state);
    appendMockHistory(state, state.cognition.score);
  }
  const pulseDeltas = {
    attention: [2, -1, 1, -2, 1, 0],
    participation: [-1, 2, 0, 1, -2, 1],
    confidence: [1, 0, 2, -1, -2, 1],
  };
  for (const name of Object.keys(pulseDeltas) as Array<keyof typeof pulseDeltas>) {
    const changes = pulseDeltas[name];
    state.cognition.liveMetrics[name] = Math.max(35, Math.min(98, state.cognition.liveMetrics[name] + changes[(mockPulse - 1) % changes.length]));
  }
  state.intervention.metrics.confidence = Math.max(55, Math.min(96, state.intervention.metrics.confidence + [2, -1, 1, 0, -2, 1][(mockPulse - 1) % 6]));
  state.intervention.metrics.intensity = Math.max(35, Math.min(90, state.intervention.metrics.intensity + [1, 1, -1, 2, -2, 0][(mockPulse - 1) % 6]));
  state.intervention.metrics.focusDimension = [...state.cognition.dimensions].sort((a, b) => a.score - b.score)[0].name;
  const strategyBucket = Math.floor(mockElapsed / 60);
  if (strategyBucket > mockLastStrategyBucket) {
    mockLastStrategyBucket = strategyBucket;
    const focus = state.intervention.metrics.focusDimension;
    const strategyByFocus: Record<string, string> = {
      概念理解: '双图对照',
      图像解读: '配点诊断',
      推理解释: '口头追问',
      迁移应用: '独立练习',
    };
    const strategy = strategyByFocus[focus] ?? '口头追问';
    const action = strategy !== state.intervention.strategy ? '调整为' : '继续采用';
    recordMockStrategy(state, strategy, `根据当前课堂关注维度“${focus}”，${action}“${strategy}”。`, true);
  }
  state.intervention.status = mockElapsed - mockLastInteractionElapsed < 18 ? '刚根据互动调整' : '策略跟进中';
  const lastHistoryTime = state.cognition.history[state.cognition.history.length - 1]?.time;
  state.cognition.prediction = mockPrediction(
    state.cognition.score,
    mockElapsed,
    mockTickIndex,
    lastHistoryTime ? secondsOf(lastHistoryTime) : mockElapsed,
  );
  state.cognition.predictedScore = state.cognition.prediction[state.cognition.prediction.length - 1].score;
  const roundsLeft = Math.max(0, state.round.total - state.round.index);
  state.cognition.predictedEndLabel = `预计结束课堂时间 ${fmt(mockElapsed + (roundsLeft * 4 + 4) * 60)}`;
  return { ...state };
}

export function mockNextRound(state: ClassroomState): ClassroomState {
  if (state.round.index >= state.round.total) {
    pushInteraction(state, 'teacher', '已进入本节课最后环节，请学生完整口述推理；完成后可点击“结束课堂”生成课后评价。');
    return { ...state };
  }
  const next = state.round.index + 1;
  const nextRound = MOCK_ROUNDS[next - 1];
  archiveMockPrediction(state, true, fmt(mockElapsed));
  pushInteraction(state, 'teacher', `进入下一环节（${nextRound.strategy}）：${nextRound.question}`);
  state.round = { ...nextRound };
  recordMockStrategy(state, nextRound.strategy, `进入“${nextRound.boardTitle}”环节，采用“${nextRound.strategy}”。`, true);
  state.elapsedSeconds = mockElapsed;
  appendMockHistory(state, state.cognition.score);
  state.cognition.prediction = mockPrediction(state.cognition.score, mockElapsed, mockTickIndex);
  state.cognition.predictedScore = state.cognition.prediction[state.cognition.prediction.length - 1].score;
  return { ...state };
}

export function mockEnd(state: ClassroomState): ClassroomState {
  state.ended = true;
  state.elapsedSeconds = mockElapsed;
  appendMockHistory(state, state.cognition.score);
  state.intervention.status = '课堂已结束';
  state.cognition.predictedEndLabel = `课堂已结束（${fmt(mockElapsed)}）`;
  return { ...state };
}

export function buildMockEvaluation(state: ClassroomState): Evaluation {
  const interactions = state.interactions.filter((item) => item.role === 'student');
  const score = state.cognition.score;
  const latestEvidence = state.evidence.at(-1);
  const strategyCounts = new Map<string, number>();
  for (const record of state.intervention.records) {
    strategyCounts.set(record.strategy, (strategyCounts.get(record.strategy) ?? 0) + 1);
  }
  const dimensions = state.cognition.dimensions.map((dimension) => {
    const evidence = [...state.evidence].reverse().find((item) => item.dimension === dimension.name);
    return {
      name: dimension.name,
      score: dimension.score,
      status: evidence ? '已采集证据' : '待收集证据',
      quote: evidence?.quote ?? '本堂课尚无该维度的实际作答证据。',
      conclusion: evidence
        ? `已记录一条实际作答（${evidence.tag}），当前维度评分为 ${dimension.score} 分。`
        : `暂未采集到该维度的实际作答，当前评分为 ${dimension.score} 分。`,
      suggestion: `后续课堂继续围绕“${dimension.name}”采集学生实际作答，再判断是否需要调整教学。`,
    };
  });
  const weakest = [...state.cognition.dimensions].sort((a, b) => a.score - b.score)[0];
  const dimensionTitles: Record<string, string> = {
    概念理解: '巩固核心概念',
    图像解读: '加强图像解读',
    推理解释: '补全推理过程',
    迁移应用: '练习知识迁移',
  };
  return {
    duration: fmt(state.elapsedSeconds),
    interactionCount: interactions.length,
    evidenceCount: state.evidence.length,
    review: {
      summary: `本堂课记录了 ${interactions.length} 次学生互动和 ${state.evidence.length} 条回答证据。当前认知分为 ${score} 分；策略效果需结合课堂回答持续观察。`,
      rows: [...strategyCounts.entries()].map(([strategy, triggers]) => {
        const record = [...state.intervention.records].reverse().find((item) => item.strategy === strategy);
        return {
          strategy,
          triggers,
          before: score,
          after: score,
          delta: 0,
          status: '效果待验证',
          detail: `${record?.note ?? '课堂策略记录'} 策略效果需结合后续课堂回答持续观察。`,
        };
      }),
    },
    dimensions,
    comment: latestEvidence
      ? `本堂课记录了 ${interactions.length} 次实际互动。最近一次作答聚焦“${latestEvidence.dimension}”：${latestEvidence.quote}。建议继续结合课堂实际回答观察学习变化。`
      : '本堂课尚未收到学生实际作答，因此没有可引用的课堂原话。',
    nextGoal: {
      dimension: weakest.name,
      title: dimensionTitles[weakest.name] ?? '继续采集学习证据',
      description: latestEvidence
        ? `基于最近的实际回答继续观察“${weakest.name}”，在新题中采集证据后再调整教学安排。`
        : `当前还没有学生实际作答，下一节课先通过一道诊断题采集“${weakest.name}”的学习证据。`,
    },
  };
}

export function buildMockPlan(state: ClassroomState): Plan {
  const latestEvidence = state.evidence.at(-1);
  const weakest = [...state.cognition.dimensions].sort((a, b) => a.score - b.score)[0];
  const dimensionTitles: Record<string, string> = {
    概念理解: '巩固核心概念',
    图像解读: '加强图像解读',
    推理解释: '补全推理过程',
    迁移应用: '练习知识迁移',
  };
  return {
    goal: {
      dimension: weakest.name,
      title: dimensionTitles[weakest.name] ?? '继续采集学习证据',
      description: latestEvidence
        ? `围绕“${weakest.name}”设计一道新题，结合学生最近的实际回答继续采集证据。`
        : `当前还没有学生实际作答；先用一道诊断题了解“${weakest.name}”的起点。`,
      approach: '先采集学生的真实回答，再根据回答中的依据和推理过程调整提示。',
    },
    segments: [
      { time: '00–03 分钟', stage: '起点诊断', task: '比较 y=2x+1 和 y=2x+3，先说结论，再说明为什么平行。' },
      { time: '03–09 分钟', stage: '引导探究', task: '将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。' },
      { time: '09–16 分钟', stage: '独立练习', task: '撤去提示，独立练习；比较 y=-x+2 和 y=-x-1，独立用两个点或变化量写出理由。' },
      { time: '16–20 分钟', stage: '出口评价', task: '请学生独立作答并口述推理。达成标准：在一组新函数上给出正确判断，并以两个点或变化量解释原因。' },
    ],
    basis: {
      evidenceTime: latestEvidence?.time ?? '暂无',
      quote: latestEvidence?.quote ?? '当前课堂尚无学生实际作答；待互动后再生成基于回答的方案。',
      summary: latestEvidence
        ? `最近的实际回答记录在“${latestEvidence.dimension}”，标签为“${latestEvidence.tag}”。`
        : '暂无实际回答证据；课堂分值会随课堂进程更新。',
      dimension: latestEvidence?.dimension ?? weakest.name,
      score: state.cognition.dimensions.find((item) => item.name === (latestEvidence?.dimension ?? weakest.name))?.score ?? weakest.score,
    },
    branches: [
      { tone: 'green', label: '独立解释', action: '跳过示范，直接进入独立练习，并换一组参数检验迁移。' },
      { tone: 'blue', label: '只给结论', action: '保留原题，追问“哪两个数值或哪两个点支持你的判断？”' },
      { tone: 'yellow', label: '出现混淆', action: '回到分步示范。将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。' },
    ],
  };
}
