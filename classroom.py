"""知之课堂 · 课堂数据闭环：互动采集 → 认知评分 → 教学干预 → 课后评价 → 下节课方案。"""

from __future__ import annotations

import threading
import time
from typing import Any

COURSE_TITLE = "八年级数学《一次函数的图像与性质》"
STUDENT_NAME = "林同学"
TEACHER_NAME = "周老师"

DIMENSIONS = ("概念理解", "图像解读", "推理解释", "迁移应用")
DIMENSION_WEIGHTS = {"概念理解": 0.25, "图像解读": 0.25, "推理解释": 0.3, "迁移应用": 0.2}

KEYWORDS: dict[str, tuple[str, ...]] = {
    "概念理解": ("斜率", "截距", "平行", "平移", "k", "b", "一次函数", "陡峭"),
    "图像解读": ("图像", "直线", "上方", "下方", "上升", "下降", "坐标", "起点", "经过", "陡"),
    "推理解释": ("因为", "所以", "由于", "先", "再", "代入", "比较", "变化量", "两个点", "理由", "说明"),
    "迁移应用": ("独立", "另一组", "换一组", "变化参数", "推广", "验证", "同样", "也", "其他"),
}

CONFUSION_MARKERS = ("b 越大越陡", "b越大越陡", "k 越大越陡", "k越大越陡", "b 决定陡", "b决定陡", "截距决定陡")

STRATEGY_META: dict[str, tuple[str, str]] = {
    "读取图像": ("直接观察图像位置关系", "引导学生先观察两条直线在图像中的位置关系，形成初步猜想，作为后续验证的起点。"),
    "口头追问": ("追问依据，逼出推理过程", "学生给出结论后追问“哪两个数值或哪两个点支持你的判断？”，推动其说出推理链条。"),
    "配点诊断": ("代入求值，用点验证", "将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。"),
    "预测图像变化": ("先预测，后验证", "基于已知函数组的数据预测新函数图像的变化，再代入验证，培养迁移意识。"),
    "双图对照": ("同一坐标系双图对照", "把 y=2x+1 和 y=2x+3 画在同一坐标系中，对照起始点与变化量，区分 k 与 b 的作用。"),
    "独立练习": ("撤去提示，独立完成", "撤去提示，让学生独立用两个点或变化量说明理由，观察方法能否迁移到新函数组。"),
}

ROUNDS: list[dict[str, Any]] = [
    {
        "question": "你觉得 y=kx+b 里的 k 和 b 对图像各起什么作用？先说说你的猜想。",
        "board_title": "猜想：k 与 b 的作用",
        "formulas": ["y = kx + b", "k：？ b：？"],
        "lines": [(2, 1)],
        "strategy": "读取图像",
    },
    {
        "question": "比较 y=2x+1 和 y=2x+3 的图像，你观察到了什么？",
        "board_title": "观察：两组一次函数",
        "formulas": ["y = 2x + 1", "y = 2x + 3"],
        "lines": [(2, 1), (2, 3)],
        "strategy": "读取图像",
    },
    {
        "question": "把 x=0 和 x=1 分别代入两个式子，起始值和相邻两点的变化量各是多少？",
        "board_title": "配点：代入求值",
        "formulas": ["x=0 → (0,1) 与 (0,3)", "x=1 → (1,3) 与 (1,5)", "变化量：都是 2"],
        "lines": [(2, 1), (2, 3)],
        "strategy": "配点诊断",
    },
    {
        "question": "现在比较 y=-x+2 和 y=-x-1，独立用两个点或变化量说明理由。",
        "board_title": "迁移：新函数组",
        "formulas": ["y = -x + 2", "y = -x - 1", "独立说明理由"],
        "lines": [(-1, 2), (-1, -1)],
        "strategy": "独立练习",
    },
    {
        "question": "用自己的话说说：为什么 y=2x+1 和 y=2x+3 的图像是平行的？",
        "board_title": "出口评价：口述推理",
        "formulas": ["y = 2x + 1", "y = 2x + 3", "变化量相同 → 平行"],
        "lines": [(2, 1), (2, 3)],
        "strategy": "双图对照",
    },
]

# 初始演示数据（对齐设计图：5 次学生互动、认知分 46 量级、已切换至双图对照）
SEED_INTERACTIONS: list[tuple[str, str, str, str | None]] = [
    ("02:10", "student", "k 是斜率，b 是截距，我是这样理解的。", "正常"),
    ("02:15", "teacher", "很好，你已经说出了两个参数的名称。再看图像：直线的陡峭程度和谁有关？", None),
    ("05:24", "student", "是不是 b 越大，直线就越陡？", "概念混淆"),
    ("05:30", "teacher", "先不下结论。我们把两条线画在同一坐标系里，再追问一步：陡峭程度由谁决定？", None),
    ("12:40", "student", "y=2x+1 经过 (0,1) 和 (1,3)；y=2x+3 经过 (0,3) 和 (1,5)。", "正常"),
    ("12:46", "teacher", "两条线的变化量都是 2，起点不同。那么陡峭由谁决定，起点高度又由谁决定？", None),
    ("21:05", "student", "斜率 k 决定陡峭，b 决定直线和 y 轴交在哪里。", "独立解释"),
    ("21:10", "teacher", "区分得很清楚。现在比较 y=-x+2 和 y=-x-1，独立用两个点或变化量说明理由。", None),
    ("30:22", "student", "变化量相同，都是 -1，所以两条线平行；y=-x+2 在 y=-x-1 上方 3 个单位。", "独立解释"),
    ("30:28", "teacher", "用变化量说明平行，用起点说明位置，推理完整。最后一步：用自己的话说说为什么 y=2x+1 和 y=2x+3 平行？", None),
]

SEED_HISTORY: list[tuple[int, int]] = [(0, 38), (480, 42), (960, 44), (1440, 44), (1920, 45), (2400, 46), (2880, 46), (3240, 46)]

SEED_EVIDENCE: list[dict[str, Any]] = [
    {"time": "02:10", "dimension": "概念理解", "quote": "k 是斜率，b 是截距，我是这样理解的。", "delta": 4, "tag": "正常"},
    {"time": "05:24", "dimension": "推理解释", "quote": "是不是 b 越大，直线就越陡？", "delta": -2, "tag": "概念混淆"},
    {"time": "12:40", "dimension": "图像解读", "quote": "y=2x+1 经过 (0,1) 和 (1,3)；y=2x+3 经过 (0,3) 和 (1,5)。", "delta": 4, "tag": "正常"},
    {"time": "21:05", "dimension": "概念理解", "quote": "斜率 k 决定陡峭，b 决定直线和 y 轴交在哪里。", "delta": 4, "tag": "独立解释"},
    {"time": "30:22", "dimension": "推理解释", "quote": "变化量相同，都是 -1，所以两条线平行；y=-x+2 在 y=-x-1 上方 3 个单位。", "delta": 5, "tag": "独立解释"},
]

SEED_STRATEGY_RECORDS: list[dict[str, str]] = [
    {"time": "00:00", "strategy": "读取图像", "note": "开场引导：观察两条直线的位置关系，形成初步猜想。"},
    {"time": "05:30", "strategy": "口头追问", "note": "证据 05:24：学生只给出“b 越大越陡”的结论，缺少依据，触发口头追问。"},
    {"time": "12:46", "strategy": "配点诊断", "note": "追问后仍不能指向具体点与数值，切换为代入求值验证。"},
    {"time": "18:00", "strategy": "预测图像变化", "note": "基于 y=2x+1 的数据预测 y=2x+3 的变化，再代入验证。"},
    {"time": "27:00", "strategy": "口头追问", "note": "追问“变化量 2 说明什么”，推动学生说出完整理由。"},
    {"time": "33:00", "strategy": "双图对照", "note": "追问后仍把截距变化解释为倾斜程度变化，切换至双图对照区分 k 与 b 的作用。"},
]

SEED_DIMENSIONS: dict[str, dict[str, Any]] = {
    "概念理解": {"score": 52, "observed": True},
    "图像解读": {"score": 58, "observed": True},
    "推理解释": {"score": 46, "observed": True},
    "迁移应用": {"score": 38, "observed": False},
}

RESPONSES: dict[str, str] = {
    "正常": "这一步说得好。再往前走一步：哪两个点或哪一段变化量支持你的判断？",
    "概念混淆": "先不下结论。我们把两条线画在同一坐标系里对照：陡峭程度由谁决定，起点高度又由谁决定？",
    "只给结论": "结论先放在这里。请补上理由：哪两个数值或哪两个点支持你的判断？",
    "独立解释": "推理完整了：先比较变化量说明位置关系，再用起点说明上下关系，这正是我们要的方法。",
}

TAG_STRATEGY: dict[str, str] = {
    "概念混淆": "双图对照",
    "只给结论": "口头追问",
    "独立解释": "独立练习",
}


def fmt_mmss(total_seconds: int) -> str:
    total = max(0, int(total_seconds))
    minutes, seconds = divmod(total, 60)
    return f"{minutes:02d}:{seconds:02d}"


def parse_mmss(value: str) -> int:
    minutes, seconds = value.split(":")
    return int(minutes) * 60 + int(seconds)


class ClassroomService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._reset()

    def _reset(self) -> None:
        self._start_at = time.time() - (54 * 60 + 18)
        self._ended = False
        self._round_index = 3
        self._dimensions = {name: dict(info) for name, info in SEED_DIMENSIONS.items()}
        self._interactions = [
            {
                "id": index + 1,
                "role": role,
                "time": clock,
                "text": text,
                **({"tag": tag} if tag else {}),
            }
            for index, (clock, role, text, tag) in enumerate(SEED_INTERACTIONS)
        ]
        self._history = [{"time": fmt_mmss(sec), "score": score} for sec, score in SEED_HISTORY]
        self._evidence = [dict(item) for item in SEED_EVIDENCE]
        self._strategy_records = [dict(item) for item in SEED_STRATEGY_RECORDS]
        self._message_seq = len(self._interactions)

    # ---------- 基础计算 ----------

    def _elapsed(self) -> int:
        return int(time.time() - self._start_at)

    def _overall(self) -> int:
        total = sum(
            self._dimensions[name]["score"] * DIMENSION_WEIGHTS[name] for name in DIMENSIONS
        )
        return int(total + 0.5)

    def _observed_count(self) -> int:
        return sum(1 for info in self._dimensions.values() if info["observed"])

    def _predicted_end(self) -> int:
        if self._ended:
            return self._elapsed()
        remaining_rounds = len(ROUNDS) - 1 - self._round_index
        return self._elapsed() + remaining_rounds * 8 * 60 + 4 * 60

    def _prediction(self) -> list[dict[str, Any]]:
        current = self._overall()
        end_at = self._predicted_end()
        horizon = end_at + 5 * 60
        predicted = min(95, current + 6 + self._observed_count() * 2)
        points: list[dict[str, Any]] = []
        span = max(60, horizon - self._elapsed())
        for offset in (span // 4, span // 2, int(span * 0.75), span):
            frac = offset / span
            points.append({
                "time": fmt_mmss(self._elapsed() + offset),
                "score": int(current + (predicted - current) * frac + 0.5),
            })
        return points

    def _current_strategy(self) -> str:
        return self._strategy_records[-1]["strategy"]

    # ---------- 评分与策略 ----------

    def _score_message(self, text: str) -> tuple[dict[str, int], str]:
        deltas: dict[str, int] = {name: 0 for name in DIMENSIONS}
        for name, words in KEYWORDS.items():
            hits = sum(1 for word in words if word in text)
            deltas[name] = min(6, hits * 2)
        confused = any(marker in text for marker in CONFUSION_MARKERS)
        reasoning_hits = sum(1 for word in KEYWORDS["推理解释"] if word in text)
        if confused:
            deltas["推理解释"] = -4
            tag = "概念混淆"
        elif reasoning_hits >= 2 and len(text) >= 30:
            tag = "独立解释"
        elif len(text) <= 14 and reasoning_hits == 0:
            tag = "只给结论"
        else:
            tag = "正常"
        return deltas, tag

    def _apply_score(self, text: str, tag: str) -> None:
        deltas, _ = self._score_message(text)
        for name in DIMENSIONS:
            info = self._dimensions[name]
            info["score"] = max(5, min(95, info["score"] + deltas[name]))
            if deltas[name] != 0:
                info["observed"] = True
        self._evidence.append({
            "time": fmt_mmss(self._elapsed()),
            "dimension": max(DIMENSIONS, key=lambda name: abs(deltas[name])) if any(deltas.values()) else "推理解释",
            "quote": text,
            "delta": sum(deltas.values()),
            "tag": tag,
        })
        self._history.append({"time": fmt_mmss(self._elapsed()), "score": self._overall()})

    def _maybe_switch_strategy(self, tag: str) -> None:
        target = TAG_STRATEGY.get(tag)
        if not target or target == self._current_strategy():
            return
        title, _ = STRATEGY_META[target]
        note_map = {
            "双图对照": "学生再次把 b 的变化与陡峭程度混淆，切换至双图对照，区分 k 与 b 的作用。",
            "口头追问": "学生只给出结论、缺少依据，触发口头追问，逼出推理过程。",
            "独立练习": "学生能独立给出完整解释，撤去提示进入独立练习，检验迁移。",
        }
        self._strategy_records.append({
            "time": fmt_mmss(self._elapsed()),
            "strategy": target,
            "note": note_map.get(target, f"依据学生回答切换至{title}。"),
        })

    # ---------- 对外操作 ----------

    def interact(self, text: str) -> dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("请先输入学生回答。")
        if len(text) > 800:
            raise ValueError("单条回复请控制在 800 字以内。")
        with self._lock:
            if self._ended:
                raise ValueError("课堂已结束，如需继续演示请点击“重新演示”。")
            _, tag = self._score_message(text)
            self._interactions.append({
                "id": self._message_seq + 1,
                "role": "student",
                "time": fmt_mmss(self._elapsed()),
                "text": text,
                "tag": tag,
            })
            self._message_seq += 1
            self._apply_score(text, tag)
            self._maybe_switch_strategy(tag)
            self._interactions.append({
                "id": self._message_seq + 1,
                "role": "teacher",
                "time": fmt_mmss(self._elapsed()),
                "text": RESPONSES[tag],
            })
            self._message_seq += 1
            return self._snapshot()

    def next_round(self) -> dict[str, Any]:
        with self._lock:
            if self._ended:
                raise ValueError("课堂已结束，如需继续演示请点击“重新演示”。")
            if self._round_index >= len(ROUNDS) - 1:
                self._interactions.append({
                    "id": self._message_seq + 1,
                    "role": "teacher",
                    "time": fmt_mmss(self._elapsed()),
                    "text": "已进入本节课最后环节，请学生完整口述推理；完成后可点击“结束课堂”生成课后评价。",
                })
                self._message_seq += 1
                return self._snapshot()
            self._round_index += 1
            rnd = ROUNDS[self._round_index]
            self._interactions.append({
                "id": self._message_seq + 1,
                "role": "teacher",
                "time": fmt_mmss(self._elapsed()),
                "text": f"进入下一环节（{rnd['strategy']}）：{rnd['question']}",
            })
            self._message_seq += 1
            self._history.append({"time": fmt_mmss(self._elapsed()), "score": self._overall()})
            return self._snapshot()

    def end_class(self) -> dict[str, Any]:
        with self._lock:
            if not self._ended:
                self._ended = True
                self._history.append({"time": fmt_mmss(self._elapsed()), "score": self._overall()})
            return self._snapshot()

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._reset()
            return self._snapshot()

    # ---------- 状态输出 ----------

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return self._snapshot()

    def _snapshot(self) -> dict[str, Any]:
        rnd = ROUNDS[self._round_index]
        prediction = [] if self._ended else self._prediction()
        last_record = self._strategy_records[-1]
        previous = self._strategy_records[-2] if len(self._strategy_records) >= 2 else None
        title, description = STRATEGY_META[last_record["strategy"]]
        return {
            "course": {"title": COURSE_TITLE, "student": STUDENT_NAME, "teacher": TEACHER_NAME},
            "elapsedSeconds": self._elapsed(),
            "ended": self._ended,
            "round": {
                "index": self._round_index + 1,
                "total": len(ROUNDS),
                "question": rnd["question"],
                "boardTitle": rnd["board_title"],
                "formulas": list(rnd["formulas"]),
                "lines": [list(pair) for pair in rnd["lines"]],
                "strategy": rnd["strategy"],
            },
            "interactions": [dict(item) for item in self._interactions],
            "cognition": {
                "score": self._overall(),
                "predictedScore": prediction[-1]["score"] if prediction else self._overall(),
                "history": [dict(item) for item in self._history],
                "prediction": prediction,
                "predictedEndLabel": f"预计结束课堂时间 {fmt_mmss(self._predicted_end())}",
                "dimensions": [
                    {"name": name, "score": info["score"], "observed": info["observed"]}
                    for name, info in self._dimensions.items()
                ],
                "observedCount": self._observed_count(),
            },
            "intervention": {
                "status": "已切换",
                "from": previous["strategy"] if previous else "——",
                "strategy": last_record["strategy"],
                "title": title,
                "description": description,
                "reason": last_record["note"],
                "records": [dict(item) for item in self._strategy_records],
            },
            "evidence": [dict(item) for item in self._evidence],
        }

    # ---------- 课后评价 ----------

    def _strategy_score_at(self, record_index: int) -> int:
        records = self._strategy_records
        before_time = parse_mmss(records[record_index]["time"])
        after_index = record_index + 1
        if after_index < len(records):
            after_time = parse_mmss(records[after_index]["time"])
        else:
            after_time = self._elapsed()
        before = self._score_at(before_time)
        after = self._score_at(after_time)
        return before, after

    def _score_at(self, seconds: int) -> int:
        points = [(parse_mmss(item["time"]), item["score"]) for item in self._history]
        if not points:
            return self._overall()
        if seconds <= points[0][0]:
            return points[0][1]
        for (t0, s0), (t1, s1) in zip(points, points[1:]):
            if seconds <= t1:
                if t1 == t0:
                    return s1
                return int(s0 + (s1 - s0) * (seconds - t0) / (t1 - t0) + 0.5)
        return points[-1][1]

    def _dimension_review(self) -> list[dict[str, Any]]:
        quotes = {
            "概念理解": "斜率 k 决定陡峭，b 决定直线和 y 轴交在哪里。",
            "图像解读": "y=2x+1 经过 (0,1) 和 (1,3)；y=2x+3 经过 (0,3) 和 (1,5)。",
            "推理解释": "是不是 b 越大，直线就越陡？",
            "迁移应用": "本节课尚未出现独立迁移作答，暂无线索。",
        }
        conclusions = {
            "概念理解": "能说清 k 与 b 的作用，但前期曾把截距变化理解为倾斜程度变化，追问与双图对照后可独立区分。",
            "图像解读": "能从图像读出关键点坐标，比较两条直线的位置与距离，读图证据较充分。",
            "推理解释": "推理链条不完整：追问后仍把截距变化解释为倾斜程度变化，需补“两个点或变化量”的说明步骤。",
            "迁移应用": "本节课未采集到独立迁移证据，需要下节课独立练习环节重点观测。",
        }
        suggestions = {
            "概念理解": "下节课用 2–3 组不同参数的函数再验证一次。",
            "图像解读": "可加入带负斜率的函数组继续巩固。",
            "推理解释": "下节课优先目标：先判断、再用两个点或变化量说明理由。",
            "迁移应用": "安排独立练习并口述推理，采集迁移证据。",
        }
        rows: list[dict[str, Any]] = []
        for name in DIMENSIONS:
            info = self._dimensions[name]
            score = info["score"]
            if not info["observed"]:
                status = "待收集证据"
            elif score >= 60:
                status = "已有基础"
            elif score >= 45:
                status = "仍需巩固"
            else:
                status = "需要进一步支持"
            rows.append({
                "name": name,
                "score": score,
                "status": status,
                "quote": quotes[name],
                "conclusion": conclusions[name],
                "suggestion": suggestions[name],
            })
        return rows

    def evaluation(self) -> dict[str, Any]:
        with self._lock:
            rows: list[dict[str, Any]] = []
            seen: dict[str, dict[str, Any]] = {}
            for index, record in enumerate(self._strategy_records):
                name = record["strategy"]
                before, after = self._strategy_score_at(index)
                entry = seen.setdefault(name, {"strategy": name, "triggers": 0, "before": before, "after": after})
                entry["triggers"] += 1
                entry["before"] = min(entry["before"], before)
                entry["after"] = max(entry["after"], after)
            for name in ("读取图像", "口头追问", "配点诊断", "预测图像变化", "双图对照", "独立练习"):
                if name in seen:
                    rows.append(seen[name])
            for row in rows:
                delta = row["after"] - row["before"]
                row["delta"] = delta
                if delta >= 4:
                    row["status"] = "观测到改善"
                elif delta >= 1:
                    row["status"] = "改善有限"
                else:
                    row["status"] = "证据不足"
                row["detail"] = STRATEGY_META[row["strategy"]][1]

            reviews = self._dimension_review()
            observed = [row for row in reviews if row["status"] != "待收集证据"]
            strongest = max(observed, key=lambda row: row["score"])
            weakest = min(observed, key=lambda row: row["score"])
            summary = (
                f"本节课围绕“用两个点或变化量说明一次函数图像关系”展开，共使用 "
                f"{'、'.join(row['strategy'] for row in rows)} 等 {sum(row['triggers'] for row in rows)} 次教学干预。"
                f"认知分由 {self._history[0]['score']} 提升至 {self._history[-1]['score']}："
                + "、".join(f"“{row['strategy']}”{row['status']}（{row['before']}→{row['after']}）" for row in rows[:3])
                + "。学生已能区分 k 与 b 的作用，推理链条完整性仍是主要缺口。"
            )
            comment = (
                f"林同学本节课的优点是{strongest['name']}（{strongest['score']} 分）：{strongest['conclusion'].split('，')[0]}。"
                f"需要注意的是{weakest['name']}（{weakest['score']} 分）：{weakest['conclusion']}。"
                f"下节课将围绕“{GOAL_TITLES[weakest['name']]}”展开，希望你先给出判断，再用两个点或变化量把理由说完整。继续加油！"
            )
            goal_name = weakest["name"]
            return {
                "duration": fmt_mmss(self._elapsed()),
                "interactionCount": sum(1 for item in self._interactions if item["role"] == "student"),
                "evidenceCount": len(self._evidence),
                "review": {"summary": summary, "rows": rows},
                "dimensions": reviews,
                "comment": comment,
                "nextGoal": {
                    "dimension": goal_name,
                    "title": GOAL_TITLES[goal_name],
                    "description": (
                        f"本节课遗留缺口：{weakest['conclusion']} 下节课核心任务：在一组新函数上给出正确判断，"
                        f"并以两个点或变化量解释原因，重点巩固{goal_name}。"
                    ),
                },
            }

    def plan(self) -> dict[str, Any]:
        with self._lock:
            reviews = self._dimension_review()
            observed = [row for row in reviews if row["status"] != "待收集证据"]
            weakest = min(observed, key=lambda row: row["score"])
            basis_evidence = next(
                (item for item in reversed(self._evidence) if item["dimension"] == weakest["name"]),
                self._evidence[-1],
            )
            return {
                "goal": {
                    "dimension": weakest["name"],
                    "title": GOAL_TITLES[weakest["name"]],
                    "description": "在一组新函数上给出正确判断，并以两个点或变化量解释原因。",
                    "approach": "从本节课的回答出发，先用一道新题确认学生的起点，再根据解释的完整性决定是否提供提示。",
                },
                "segments": [
                    {"time": "00–03 分钟", "stage": "起点诊断", "task": "比较 y=2x+1 和 y=2x+3，先说结论，再说明为什么平行。"},
                    {"time": "03–09 分钟", "stage": "引导探究", "task": "将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。"},
                    {"time": "09–16 分钟", "stage": "独立练习", "task": "撤去提示，独立练习；比较 y=-x+2 和 y=-x-1，独立用两个点或变化量写出理由。"},
                    {"time": "16–20 分钟", "stage": "出口评价", "task": "请学生独立作答并口述推理。达成标准：在一组新函数上给出正确判断，并以两个点或变化量解释原因。"},
                ],
                "basis": {
                    "evidenceTime": basis_evidence["time"],
                    "quote": basis_evidence["quote"],
                    "summary": weakest["conclusion"],
                    "dimension": weakest["name"],
                    "score": weakest["score"],
                },
                "branches": [
                    {"tone": "green", "label": "独立解释", "action": "跳过示范，直接进入独立练习，并换一组参数检验迁移。"},
                    {"tone": "blue", "label": "只给结论", "action": "保留原题，追问“哪两个数值或哪两个点支持你的判断？”"},
                    {"tone": "yellow", "label": "出现混淆", "action": "回到分步示范。将 x=0 和 x=1 代入两式，比较起始值与相邻两点的变化量，再把数字对应回图像。"},
                ],
            }


GOAL_TITLES: dict[str, str] = {
    "概念理解": "区分斜率与截距的含义",
    "图像解读": "用起点和变化量描述图像位置",
    "推理解释": "用变化量解释图像差异",
    "迁移应用": "在新函数组上独立迁移方法",
}

classroom = ClassroomService()
