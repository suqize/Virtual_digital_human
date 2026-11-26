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
LIVE_UPDATE_SECONDS = 6
STRATEGY_UPDATE_SECONDS = 60

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

INITIAL_DIMENSIONS: dict[str, dict[str, Any]] = {
    "概念理解": {"score": 52, "observed": False},
    "图像解读": {"score": 58, "observed": False},
    "推理解释": {"score": 46, "observed": False},
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

FOCUS_STRATEGY = {
    "概念理解": "双图对照",
    "图像解读": "配点诊断",
    "推理解释": "口头追问",
    "迁移应用": "独立练习",
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
        self._start_at: float | None = None
        self._ended = False
        self._round_index = 0
        self._dimensions = {name: dict(info) for name, info in INITIAL_DIMENSIONS.items()}
        self._interactions = [
            {"id": 1, "role": "teacher", "time": "00:00", "text": f"课堂开始。{ROUNDS[0]['question']}"}
        ]
        self._history = [{"time": "00:00", "score": self._overall()}]
        self._evidence = []
        self._strategy_records = [
            {"time": "00:00", "strategy": ROUNDS[0]["strategy"], "note": "开场引导：先观察图像并说出初步猜想。"}
        ]
        self._message_seq = len(self._interactions)
        self._last_live_bucket = 0
        self._live_tick = 0
        self._last_strategy_bucket = 0
        self._last_prediction_bucket = -1
        self._last_interaction_elapsed: int | None = None
        self._cognition_metrics = {"attention": 78, "participation": 71, "confidence": 64}
        self._intervention_metrics = {"confidence": 76, "intensity": 58, "focusDimension": "推理解释"}
        self._prediction_history: list[dict[str, Any]] = []
        self._prediction_current: list[dict[str, Any]] = []
        self._prediction_generated_at = 0
        self._refresh_prediction()
        self._archive_prediction(force=True)

    # ---------- 基础计算 ----------

    def _start_class(self) -> None:
        if self._start_at is None and not self._ended:
            self._start_at = time.time()

    def _elapsed(self) -> int:
        return int(time.time() - self._start_at) if self._start_at is not None else 0

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
        return self._elapsed() + remaining_rounds * 4 * 60 + 4 * 60

    def _prediction(self) -> list[dict[str, Any]]:
        current = self._overall()
        elapsed = self._elapsed()
        end_at = self._predicted_end()
        horizon = end_at + 5 * 60
        predicted = min(95, current + 6 + self._observed_count() * 2)
        forecast_errors = (-2, 2, -1, 1)
        anchor = max(0, min(100, current + forecast_errors[self._live_tick % len(forecast_errors)]))
        span = max(60, horizon - elapsed)
        anchor_time = parse_mmss(self._history[-1]["time"]) if self._history else elapsed
        points: list[dict[str, Any]] = [{"time": fmt_mmss(anchor_time), "score": anchor}]
        for offset in (span // 4, span // 2, int(span * 0.75), span):
            frac = offset / span
            points.append({
                "time": fmt_mmss(elapsed + offset),
                "score": max(0, min(100, int(anchor + (predicted - anchor) * frac + 0.5))),
            })
        return points

    def _append_history_point(self) -> None:
        point = {"time": fmt_mmss(self._elapsed()), "score": self._overall()}
        if self._history and self._history[-1]["time"] == point["time"]:
            self._history[-1] = point
        else:
            self._history.append(point)

    def _refresh_prediction(self) -> None:
        self._prediction_current = self._prediction()
        self._prediction_generated_at = self._elapsed()

    def _archive_prediction(self, force: bool = False) -> None:
        elapsed = self._elapsed()
        bucket = elapsed // 60
        if not force and bucket <= self._last_prediction_bucket:
            return
        points = [dict(point) for point in self._prediction_current]
        generated_at = fmt_mmss(self._prediction_generated_at)
        if not self._prediction_history or self._prediction_history[-1]["points"] != points:
            self._prediction_history.append({"generatedAt": generated_at, "points": points})
        self._last_prediction_bucket = bucket

    def _record_strategy(self, strategy: str, note: str, allow_repeat: bool = False) -> None:
        if strategy == self._current_strategy() and not allow_repeat:
            return
        self._strategy_records.append({
            "time": fmt_mmss(self._elapsed()),
            "strategy": strategy,
            "note": note,
        })

    def _advance_live_demo(self) -> None:
        if self._ended:
            return
        elapsed = self._elapsed()
        bucket = elapsed // LIVE_UPDATE_SECONDS
        if bucket <= self._last_live_bucket:
            return

        self._archive_prediction()
        self._last_live_bucket = bucket
        self._live_tick += 1
        tick = self._live_tick

        dimension = DIMENSIONS[(tick - 1) % len(DIMENSIONS)]
        score_deltas = (1, 1, 0, -1, 2, -1, 1, 0)
        info = self._dimensions[dimension]
        info["score"] = max(5, min(95, info["score"] + score_deltas[(tick - 1) % len(score_deltas)]))

        metric_deltas = {
            "attention": (2, -1, 1, -2, 1, 0),
            "participation": (-1, 2, 0, 1, -2, 1),
            "confidence": (1, 0, 2, -1, -2, 1),
        }
        for name, changes in metric_deltas.items():
            self._cognition_metrics[name] = max(35, min(98, self._cognition_metrics[name] + changes[(tick - 1) % len(changes)]))

        self._intervention_metrics["confidence"] = max(
            55, min(96, self._intervention_metrics["confidence"] + (2, -1, 1, 0, -2, 1)[(tick - 1) % 6])
        )
        self._intervention_metrics["intensity"] = max(
            35, min(90, self._intervention_metrics["intensity"] + (1, 1, -1, 2, -2, 0)[(tick - 1) % 6])
        )
        self._intervention_metrics["focusDimension"] = min(
            self._dimensions, key=lambda name: self._dimensions[name]["score"]
        )
        self._append_history_point()
        strategy_bucket = elapsed // STRATEGY_UPDATE_SECONDS
        if strategy_bucket > self._last_strategy_bucket:
            self._last_strategy_bucket = strategy_bucket
            focus = self._intervention_metrics["focusDimension"]
            strategy = FOCUS_STRATEGY[focus]
            action = "调整为" if strategy != self._current_strategy() else "继续采用"
            self._record_strategy(
                strategy,
                f"根据当前课堂关注维度“{focus}”，{action}“{strategy}”。",
                allow_repeat=True,
            )
        self._refresh_prediction()

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
        dimension = max(DIMENSIONS, key=lambda name: abs(deltas[name])) if any(deltas.values()) else "概念理解"
        self._dimensions[dimension]["observed"] = True
        self._evidence.append({
            "time": fmt_mmss(self._elapsed()),
            "dimension": dimension,
            "quote": text,
            "delta": sum(deltas.values()),
            "tag": tag,
        })
        self._append_history_point()

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
        self._record_strategy(target, note_map.get(target, f"依据学生回答切换至{title}。"))

    # ---------- 对外操作 ----------

    def interact(self, text: str, teacher_reply: str | None = None) -> dict[str, Any]:
        text = (text or "").strip()
        if not text:
            raise ValueError("请先输入学生回答。")
        if len(text) > 800:
            raise ValueError("单条回复请控制在 800 字以内。")
        with self._lock:
            self._start_class()
            if self._ended:
                raise ValueError("课堂已结束，请重新开始课堂。")
            self._advance_live_demo()
            self._refresh_prediction()
            self._archive_prediction(force=True)
            self._last_interaction_elapsed = self._elapsed()
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
                "text": (teacher_reply or "").strip() or RESPONSES[tag],
            })
            self._message_seq += 1
            return self._snapshot()

    def next_round(self) -> dict[str, Any]:
        with self._lock:
            self._start_class()
            if self._ended:
                raise ValueError("课堂已结束，请重新开始课堂。")
            if self._round_index >= len(ROUNDS) - 1:
                self._interactions.append({
                    "id": self._message_seq + 1,
                    "role": "teacher",
                    "time": fmt_mmss(self._elapsed()),
                    "text": "已进入本节课最后环节，请学生完整口述推理；完成后可点击“结束课堂”生成课后评价。",
                })
                self._message_seq += 1
                return self._snapshot()
            self._advance_live_demo()
            self._refresh_prediction()
            self._archive_prediction(force=True)
            self._round_index += 1
            rnd = ROUNDS[self._round_index]
            self._interactions.append({
                "id": self._message_seq + 1,
                "role": "teacher",
                "time": fmt_mmss(self._elapsed()),
                "text": f"进入下一环节（{rnd['strategy']}）：{rnd['question']}",
            })
            self._message_seq += 1
            self._append_history_point()
            self._record_strategy(rnd["strategy"], f"进入“{rnd['board_title']}”环节，采用“{rnd['strategy']}”。", allow_repeat=True)
            return self._snapshot()

    def end_class(self) -> dict[str, Any]:
        with self._lock:
            if not self._ended:
                self._start_class()
                self._advance_live_demo()
                self._refresh_prediction()
                self._ended = True
                self._append_history_point()
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
        self._start_class()
        self._advance_live_demo()
        rnd = ROUNDS[self._round_index]
        if not self._ended:
            self._refresh_prediction()
            self._archive_prediction()
        prediction = self._prediction_current
        last_record = self._strategy_records[-1]
        previous = self._strategy_records[-2] if len(self._strategy_records) >= 2 else None
        title, description = STRATEGY_META[last_record["strategy"]]
        if self._ended:
            intervention_status = "课堂已结束"
        elif self._last_interaction_elapsed is not None and self._elapsed() - self._last_interaction_elapsed < 18:
            intervention_status = "刚根据互动调整"
        else:
            intervention_status = "策略跟进中"
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
                "predictionHistory": [
                    {"generatedAt": item["generatedAt"], "points": [dict(point) for point in item["points"]]}
                    for item in self._prediction_history
                ],
                "predictedEndLabel": f"预计结束课堂时间 {fmt_mmss(self._predicted_end())}",
                "liveMetrics": dict(self._cognition_metrics),
                "dimensions": [
                    {"name": name, "score": info["score"], "observed": info["observed"]}
                    for name, info in self._dimensions.items()
                ],
                "observedCount": self._observed_count(),
            },
            "intervention": {
                "status": intervention_status,
                "from": previous["strategy"] if previous else "——",
                "strategy": last_record["strategy"],
                "title": title,
                "description": description,
                "reason": last_record["note"],
                "metrics": dict(self._intervention_metrics),
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
            latest_evidence = next((item for item in reversed(self._evidence) if item["dimension"] == name), None)
            if not info["observed"]:
                status = "待收集证据"
                quote = "尚未采集到该维度的学生回答。"
                conclusion = f"当前评分为 {score} 分，尚未采集该维度的学生回答。"
            elif score >= 60:
                status = "已有基础"
                quote = latest_evidence["quote"] if latest_evidence else "已采集到互动证据。"
                conclusion = f"基于最近一次回答，该维度当前评分为 {score} 分。"
            elif score >= 45:
                status = "仍需巩固"
                quote = latest_evidence["quote"] if latest_evidence else "已采集到互动证据。"
                conclusion = f"基于最近一次回答，该维度当前评分为 {score} 分，建议继续通过追问和练习巩固。"
            else:
                status = "需要进一步支持"
                quote = latest_evidence["quote"] if latest_evidence else "已采集到互动证据。"
                conclusion = f"基于最近一次回答，该维度当前评分为 {score} 分，建议提供分步提示后再练习。"
            rows.append({
                "name": name,
                "score": score,
                "status": status,
                "quote": quote,
                "conclusion": conclusion,
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
            observed = [row for row in reviews if row["status"] != "待收集证据"] or reviews
            strongest = max(observed, key=lambda row: row["score"])
            weakest = min(observed, key=lambda row: row["score"])
            summary = (
                f"本节课围绕“用两个点或变化量说明一次函数图像关系”展开，共使用 "
                f"{'、'.join(row['strategy'] for row in rows)} 等 {sum(row['triggers'] for row in rows)} 次教学干预。"
                f"认知分由 {self._history[0]['score']} 提升至 {self._history[-1]['score']}："
                + "、".join(f"“{row['strategy']}”{row['status']}（{row['before']}→{row['after']}）" for row in rows[:3])
                + "。评价依据以课堂记录中的互动证据为准。"
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
            observed = [row for row in reviews if row["status"] != "待收集证据"] or reviews
            weakest = min(observed, key=lambda row: row["score"])
            basis_evidence = next(
                (item for item in reversed(self._evidence) if item["dimension"] == weakest["name"]),
                self._evidence[-1] if self._evidence else {
                    "time": "00:00",
                    "quote": "尚无学生回答；本方案暂按课堂初始情境生成。",
                },
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
