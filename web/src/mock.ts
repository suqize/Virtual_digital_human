import type { ClassroomState, CognitionPoint, DimensionInfo, Evaluation, Interaction, Plan } from './types';

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildMockState(): ClassroomState {
  const dimensions: DimensionInfo[] = [
    { name: '概念理解', score: 52, observed: true },
    { name: '图像解读', score: 58, observed: true },
    { name: '推理解释', score: 46, observed: true },
    { name: '迁移应用', score: 38, observed: false },
  ];
  const history: CognitionPoint[] = [
    { time: '00:00', score: 38 },
    { time: '08:00', score: 42 },
    { time: '16:00', score: 44 },
    { time: '24:00', score: 44 },
    { time: '32:00', score: 45 },
    { time: '40:00', score: 46 },
    { time: '48:00', score: 46 },
    { time: '54:00', score: 46 },
  ];
  const prediction: CognitionPoint[] = [
    { time: '56:00', score: 49 },
    { time: '58:00', score: 52 },
    { time: '60:30', score: 56 },
    { time: '63:00', score: 60 },
  ];
  return {
    course: { title: '八年级数学《一次函数的图像与性质》', student: '林同学', teacher: '周老师' },
    elapsedSeconds: 54 * 60 + 18,
    ended: false,
    round: {
      index: 4,
      total: 5,
      question: '比较 y=-x+2 和 y=-x-1，独立用两个点或变化量说明理由。',
      boardTitle: '迁移：新函数组',
      formulas: ['y = -x + 2', 'y = -x - 1', '独立说明理由'],
      lines: [[-1, 2], [-1, -1]],
      strategy: '独立练习',
    },
    interactions: [
      { id: 1, role: 'student', time: '02:10', text: 'k 是斜率，b 是截距，我是这样理解的。', tag: '正常' },
      { id: 2, role: 'teacher', time: '02:15', text: '很好，你已经说出了两个参数的名称。再看图像：直线的陡峭程度和谁有关？' },
      { id: 3, role: 'student', time: '05:24', text: '是不是 b 越大，直线就越陡？', tag: '概念混淆' },
      { id: 4, role: 'teacher', time: '05:30', text: '先不下结论。我们把两条线画在同一坐标系里，再追问一步：陡峭程度由谁决定？' },
      { id: 5, role: 'student', time: '12:40', text: 'y=2x+1 经过 (0,1) 和 (1,3)；y=2x+3 经过 (0,3) 和 (1,5)。', tag: '正常' },
      { id: 6, role: 'teacher', time: '12:46', text: '两条线的变化量都是 2，起点不同。那么陡峭由谁决定，起点高度又由谁决定？' },
      { id: 7, role: 'student', time: '21:05', text: '斜率 k 决定陡峭，b 决定直线和 y 轴交在哪里。', tag: '独立解释' },
      { id: 8, role: 'teacher', time: '21:10', text: '区分得很清楚。现在比较 y=-x+2 和 y=-x-1，独立用两个点或变化量说明理由。' },
      { id: 9, role: 'student', time: '30:22', text: '变化量相同，都是 -1，所以两条线平行；y=-x+2 在 y=-x-1 上方 3 个单位。', tag: '独立解释' },
      { id: 10, role: 'teacher', time: '30:28', text: '用变化量说明平行，用起点说明位置，推理完整。最后一步：用自己的话说说为什么 y=2x+1 和 y=2x+3 平行？' },
    ],
    cognition: {
      score: 46,
      predictedScore: 60,
      history,
      prediction,
      predictedEndLabel: '预计结束课堂时间 58:00',
      dimensions,
      observedCount: 3,
    },
    intervention: {
      status: '已切换',
      from: '口头追问',
      strategy: '双图对照',
      title: '同一坐标系双图对照',
      description: '把 y=2x+1 和 y=2x+3 画在同一坐标系中，对照起始点与变化量，区分 k 与 b 的作用。',
      reason: '追问后仍把截距变化解释为倾斜程度变化，切换至双图对照区分 k 与 b 的作用。',
      records: [
        { time: '00:00', strategy: '读取图像', note: '开场引导：观察两条直线的位置关系，形成初步猜想。' },
        { time: '05:30', strategy: '口头追问', note: '证据 05:24：学生只给出“b 越大越陡”的结论，缺少依据，触发口头追问。' },
        { time: '12:46', strategy: '配点诊断', note: '追问后仍不能指向具体点与数值，切换为代入求值验证。' },
        { time: '18:00', strategy: '预测图像变化', note: '基于 y=2x+1 的数据预测 y=2x+3 的变化，再代入验证。' },
        { time: '27:00', strategy: '口头追问', note: '追问“变化量 2 说明什么”，推动学生说出完整理由。' },
        { time: '33:00', strategy: '双图对照', note: '追问后仍把截距变化解释为倾斜程度变化，切换至双图对照区分 k 与 b 的作用。' },
      ],
    },
    evidence: [
      { time: '02:10', dimension: '概念理解', quote: 'k 是斜率，b 是截距，我是这样理解的。', delta: 4, tag: '正常' },
      { time: '05:24', dimension: '推理解释', quote: '是不是 b 越大，直线就越陡？', delta: -2, tag: '概念混淆' },
      { time: '12:40', dimension: '图像解读', quote: 'y=2x+1 经过 (0,1) 和 (1,3)；y=2x+3 经过 (0,3) 和 (1,5)。', delta: 4, tag: '正常' },
      { time: '21:05', dimension: '概念理解', quote: '斜率 k 决定陡峭，b 决定直线和 y 轴交在哪里。', delta: 4, tag: '独立解释' },
      { time: '30:22', dimension: '推理解释', quote: '变化量相同，都是 -1，所以两条线平行；y=-x+2 在 y=-x-1 上方 3 个单位。', delta: 5, tag: '独立解释' },
    ],
  };
}

let mockElapsed = 54 * 60 + 18;
let mockSeq = 10;

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

function pushInteraction(state: ClassroomState, role: 'student' | 'teacher', text: string, tag?: string): void {
  mockElapsed += 45;
  const item: Interaction = { id: ++mockSeq, role, time: fmt(mockElapsed), text };
  if (tag) item.tag = tag;
  state.interactions.push(item);
}

export function mockInteract(state: ClassroomState, text: string): ClassroomState {
  mockElapsed += 10;
  const tag = tagOf(text);
  pushInteraction(state, 'student', text, tag);
  const deltas: Record<string, number> = { '概念理解': 1, '图像解读': 1, '推理解释': tag === '概念混淆' ? -3 : 2, '迁移应用': 1 };
  state.cognition.dimensions = state.cognition.dimensions.map((d) => ({
    ...d,
    score: Math.max(5, Math.min(95, d.score + (deltas[d.name] ?? 0))),
    observed: d.observed || tag !== '只给结论',
  }));
  const score = overallOf(state);
  state.cognition.score = score;
  state.cognition.history = [...state.cognition.history, { time: fmt(mockElapsed), score }];
  state.cognition.prediction = state.cognition.prediction.map((p, i) => ({
    ...p,
    score: Math.min(95, p.score + (i >= state.cognition.prediction.length - 2 ? 1 : 0)),
  }));
  state.cognition.predictedScore = state.cognition.prediction[state.cognition.prediction.length - 1].score;
  state.evidence.push({ time: fmt(mockElapsed), dimension: tag === '概念混淆' ? '推理解释' : '推理解释', quote: text, delta: 2, tag });
  if (tag === '概念混淆' && state.intervention.strategy !== '双图对照') {
    state.intervention = { ...state.intervention, from: state.intervention.strategy, strategy: '双图对照', title: '同一坐标系双图对照', description: '把两条直线画在同一坐标系中对照，区分 k 与 b 的作用。', reason: '学生再次混淆 b 的变化与陡峭程度，切换至双图对照。', records: [...state.intervention.records, { time: fmt(mockElapsed), strategy: '双图对照', note: '学生再次混淆 b 的变化与陡峭程度，切换至双图对照。' }] };
  } else if (tag === '只给结论' && state.intervention.strategy !== '口头追问') {
    state.intervention = { ...state.intervention, from: state.intervention.strategy, strategy: '口头追问', title: '追问依据，逼出推理过程', description: '学生给出结论后追问“哪两个数值或哪两个点支持你的判断？”。', reason: '学生只给出结论、缺少依据，触发口头追问。', records: [...state.intervention.records, { time: fmt(mockElapsed), strategy: '口头追问', note: '学生只给出结论、缺少依据，触发口头追问。' }] };
  }
  pushInteraction(state, 'teacher', RESPONSES[tag]);
  return { ...state };
}

export function mockNextRound(state: ClassroomState): ClassroomState {
  mockElapsed += 8 * 60;
  if (state.round.index >= state.round.total) {
    pushInteraction(state, 'teacher', '已进入本节课最后环节，请学生完整口述推理；完成后可点击“结束课堂”生成课后评价。');
    return { ...state };
  }
  const next = state.round.index + 1;
  pushInteraction(state, 'teacher', `进入下一环节：${state.round.question}`);
  state.round = { ...state.round, index: next };
  state.cognition.history = [...state.cognition.history, { time: fmt(mockElapsed), score: state.cognition.score }];
  return { ...state };
}

export function mockEnd(state: ClassroomState): ClassroomState {
  state.ended = true;
  state.cognition.prediction = [];
  state.cognition.predictedEndLabel = `课堂已结束（${fmt(mockElapsed)}）`;
  return { ...state };
}

export function buildMockEvaluation(state: ClassroomState): Evaluation {
  return {
    duration: fmt(state.elapsedSeconds + 13),
    interactionCount: state.interactions.filter((i) => i.role === 'student').length,
    evidenceCount: state.evidence.length,
    review: {
      summary:
        '本节课围绕“用两个点或变化量说明一次函数图像关系”展开，共使用读取图像、口头追问、配点诊断、预测图像变化、双图对照等 6 次教学干预。认知分由 38 提升至 46：“读取图像”改善有限（38→41）、“口头追问”观测到改善（41→46）、“配点诊断”改善有限（43→44）。学生已能区分 k 与 b 的作用，推理链条完整性仍是主要缺口。',
      rows: [
        { strategy: '读取图像', triggers: 1, before: 38, after: 41, delta: 3, status: '改善有限', detail: '引导学生先观察两条直线在图像中的位置关系，形成初步猜想，作为后续验证的起点。' },
        { strategy: '口头追问', triggers: 2, before: 41, after: 46, delta: 5, status: '观测到改善', detail: '学生给出结论后追问“哪两个数值或哪两个点支持你的判断？”，推动其说出推理链条。' },
        { strategy: '配点诊断', triggers: 1, before: 43, after: 44, delta: 1, status: '改善有限', detail: '将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。' },
        { strategy: '预测图像变化', triggers: 1, before: 44, after: 44, delta: 0, status: '证据不足', detail: '基于已知函数组的数据预测新函数图像的变化，再代入验证，培养迁移意识。' },
        { strategy: '双图对照', triggers: 1, before: 45, after: 46, delta: 1, status: '改善有限', detail: '把 y=2x+1 和 y=2x+3 画在同一坐标系中，对照起始点与变化量，区分 k 与 b 的作用。' },
      ],
    },
    dimensions: [
      { name: '概念理解', score: 52, status: '仍需巩固', quote: '斜率 k 决定陡峭，b 决定直线和 y 轴交在哪里。', conclusion: '能说清 k 与 b 的作用，但前期曾把截距变化理解为倾斜程度变化，追问与双图对照后可独立区分。', suggestion: '下节课用 2–3 组不同参数的函数再验证一次。' },
      { name: '图像解读', score: 58, status: '仍需巩固', quote: 'y=2x+1 经过 (0,1) 和 (1,3)；y=2x+3 经过 (0,3) 和 (1,5)。', conclusion: '能从图像读出关键点坐标，比较两条直线的位置与距离，读图证据较充分。', suggestion: '可加入带负斜率的函数组继续巩固。' },
      { name: '推理解释', score: 46, status: '仍需巩固', quote: '是不是 b 越大，直线就越陡？', conclusion: '推理链条不完整：追问后仍把截距变化解释为倾斜程度变化，需补“两个点或变化量”的说明步骤。', suggestion: '下节课优先目标：先判断、再用两个点或变化量说明理由。' },
      { name: '迁移应用', score: 38, status: '待收集证据', quote: '本节课尚未出现独立迁移作答，暂无线索。', conclusion: '本节课未采集到独立迁移证据，需要下节课独立练习环节重点观测。', suggestion: '安排独立练习并口述推理，采集迁移证据。' },
    ],
    comment:
      '林同学本节课的优点是图像解读（58 分）：能从图像读出关键点坐标，比较两条直线的位置与距离。需要注意的是推理解释（46 分）：推理链条不完整，追问后仍把截距变化解释为倾斜程度变化。下节课将围绕“用变化量解释图像差异”展开，希望你先给出判断，再用两个点或变化量把理由说完整。继续加油！',
    nextGoal: {
      dimension: '推理解释',
      title: '用变化量解释图像差异',
      description: '本节课遗留缺口：推理链条不完整，追问后仍把截距变化解释为倾斜程度变化。下节课核心任务：在一组新函数上给出正确判断，并以两个点或变化量解释原因，重点巩固推理解释。',
    },
  };
}

export function buildMockPlan(): Plan {
  return {
    goal: {
      dimension: '推理解释',
      title: '用变化量解释图像差异',
      description: '在一组新函数上给出正确判断，并以两个点或变化量解释原因。',
      approach: '从本节课的回答出发，先用一道新题确认学生的起点，再根据解释的完整性决定是否提供提示。',
    },
    segments: [
      { time: '00–03 分钟', stage: '起点诊断', task: '比较 y=2x+1 和 y=2x+3，先说结论，再说明为什么平行。' },
      { time: '03–09 分钟', stage: '引导探究', task: '将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。' },
      { time: '09–16 分钟', stage: '独立练习', task: '撤去提示，独立练习；比较 y=-x+2 和 y=-x-1，独立用两个点或变化量写出理由。' },
      { time: '16–20 分钟', stage: '出口评价', task: '请学生独立作答并口述推理。达成标准：在一组新函数上给出正确判断，并以两个点或变化量解释原因。' },
    ],
    basis: {
      evidenceTime: '05:24',
      quote: '是不是 b 越大，直线就越陡？',
      summary: '追问后仍把截距变化解释为倾斜程度变化',
      dimension: '推理解释',
      score: 46,
    },
    branches: [
      { tone: 'green', label: '独立解释', action: '跳过示范，直接进入独立练习，并换一组参数检验迁移。' },
      { tone: 'blue', label: '只给结论', action: '保留原题，追问“哪两个数值或哪两个点支持你的判断？”' },
      { tone: 'yellow', label: '出现混淆', action: '回到分步示范。将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。' },
    ],
  };
}
