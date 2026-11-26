"""知之课堂：课堂工作台 / 课后评价 / 下节课方案 + 火山引擎实时数字人（课堂情境可配置）。"""

from __future__ import annotations

import json
import mimetypes
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import unquote, urlsplit

from classroom import classroom


ROOT = Path(__file__).resolve().parent
WEB_DIST = ROOT / "static" / "dist"
DEFAULT_LLM_BASE_URL = "https://linkapi.ai/v1"
DEFAULT_LLM_MODEL = "gpt-6-sol"
MAX_REQUEST_BYTES = 32_000

DEFAULT_CLASSROOM_SCENARIO = "数学"

ALLOWED_AVATAR_ACTIONS = (
    "聆听（不说话） - 自然呼吸",
    "聆听（不说话） - 开心",
    "聆听（不说话） - 惊讶",
    "复位 - 复位",
)

QUICK_QUESTIONS = {
    "数学": ["怎么解一元一次方程？", "为什么三角形内角和是180°？", "讲讲分数通分"],
    "历史": ["讲讲唐朝的繁荣与开放", "用时间轴梳理近代化探索", "中考常考的史实对比有哪些？"],
    "语文": ["怎么写好一篇记叙文？", "讲讲古诗词赏析方法", "文言文怎么快速读懂？"],
    "英语": ["怎么记住不规则动词？", "讲讲定语从句的用法", "如何提高英语阅读速度？"],
    "物理": ["讲讲牛顿第一定律", "怎么分析物体的受力？", "电学实验常考哪些点？"],
    "化学": ["讲讲质量守恒定律", "怎么配平化学方程式？", "常见气体的实验室制法"],
}

DEFAULT_QUICK_QUESTIONS = ["帮我讲解一个知识点", "给我出一道练习题", "总结今天学习的重点"]

def load_local_env() -> None:
    """读取项目 .env，操作系统中已设置的变量优先。"""
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip("\"'")
        if name and name not in os.environ:
            os.environ[name] = value


def get_classroom_scenario() -> str:
    load_local_env()
    return os.getenv("CLASSROOM_SCENARIO", "").strip() or DEFAULT_CLASSROOM_SCENARIO


def get_quick_questions(scenario: str) -> list[str]:
    if scenario in QUICK_QUESTIONS:
        return list(QUICK_QUESTIONS[scenario])
    for subject, questions in QUICK_QUESTIONS.items():
        if subject in scenario:
            return list(questions)
    return list(DEFAULT_QUICK_QUESTIONS)


def build_teacher_prompt(scenario: str) -> str:
    return (
        f"你是一位耐心、清晰、鼓励学生思考的中文{scenario}老师。请根据学生的问题讲清楚思路和要点。\n\n"
        "要求：用简体中文；按步骤讲解并解释每一步；必要时先询问年级或学习基础；发现错误时温和纠正；"
        "答案适合数字人朗读，不使用 Markdown 标题、表格、LaTeX 或代码块，专业内容尽量写成自然口语；"
        "回复控制在 700 个汉字以内，结尾可邀请学生继续提问。"
    )


def get_volc_avatar_actions() -> list[str]:
    raw = os.getenv("VOLC_AVATAR_ACTIONS", "").strip()
    if not raw:
        return list(ALLOWED_AVATAR_ACTIONS)
    actions: list[str] = []
    for part in re.split(r"[,，;；|]+", raw):
        action = part.strip()
        if not action:
            continue
        if action not in ALLOWED_AVATAR_ACTIONS:
            raise RuntimeError(
                f"VOLC_AVATAR_ACTIONS 包含不支持的动作「{action}」。"
                f"目前仅支持：{'、'.join(ALLOWED_AVATAR_ACTIONS)}"
            )
        if action not in actions:
            actions.append(action)
    return actions or list(ALLOWED_AVATAR_ACTIONS)


def _clean_error(value: object) -> str:
    message = str(value)
    for name in (
        "VOLC_ACCESS_KEY_ID",
        "VOLC_SECRET_ACCESS_KEY",
        "LINKAPI_API_KEY",
    ):
        secret = os.getenv(name, "")
        if secret:
            message = message.replace(secret, "[已隐藏]")
    return message[:900]


def get_volc_avatar_config() -> dict[str, object]:
    load_local_env()
    access_key_id = os.getenv("VOLC_ACCESS_KEY_ID", "").strip()
    secret_access_key = os.getenv("VOLC_SECRET_ACCESS_KEY", "").strip()
    image_url = os.getenv("VOLC_AVATAR_IMAGE_URL", "").strip()
    missing = [
        name
        for name, value in (
            ("VOLC_ACCESS_KEY_ID", access_key_id),
            ("VOLC_SECRET_ACCESS_KEY", secret_access_key),
            ("VOLC_AVATAR_IMAGE_URL", image_url),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("请先在 .env 配置火山引擎数字人参数：" + ", ".join(missing))
    if not image_url.startswith("https://"):
        raise RuntimeError("VOLC_AVATAR_IMAGE_URL 必须是可公开访问的 HTTPS 图片地址。")
    scenario = get_classroom_scenario()
    return {
        "appKey": access_key_id,
        "secretKey": secret_access_key,
        "avatarImageUrl": image_url,
        "speaker": os.getenv("VOLC_AVATAR_SPEAKER", "saturn_zh_female_aojiaonvyou_tob").strip(),
        "userPrompt": os.getenv("VOLC_AVATAR_USER_PROMPT", "").strip() or build_teacher_prompt(scenario),
        "actionList": get_volc_avatar_actions(),
        "classroomScenario": scenario,
    }

def call_model(history: list[dict[str, str]]) -> str:
    load_local_env()
    api_key = os.getenv("LINKAPI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("尚未配置 LINKAPI_API_KEY，请在项目根目录 .env 设置模型 API Key。")
    base_url = os.getenv("LINKAPI_BASE_URL", DEFAULT_LLM_BASE_URL).rstrip("/")
    model = os.getenv("LINKAPI_MODEL", DEFAULT_LLM_MODEL)
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": build_teacher_prompt(get_classroom_scenario())}, *history],
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:600]
        except OSError:
            detail = ""
        raise RuntimeError(f"大模型接口返回 HTTP {exc.code}。{_clean_error(detail)}") from None
    except (URLError, TimeoutError, OSError) as exc:
        raise RuntimeError("暂时无法连接大模型接口：" + _clean_error(exc)) from None
    except json.JSONDecodeError:
        raise RuntimeError("大模型接口返回内容不是有效 JSON。") from None

    try:
        content = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("接口响应缺少 choices[0].message.content。") from None
    if isinstance(content, list):
        content = "\n".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("老师暂时没有生成回复，请稍后重试。")
    return content.strip()


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        raise ValueError("请求格式不正确。") from None
    if length <= 0 or length > MAX_REQUEST_BYTES:
        raise ValueError("请求内容为空或过长。")
    try:
        value = json.loads(handler.rfile.read(length).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("请求不是有效 JSON。") from None
    if not isinstance(value, dict):
        raise ValueError("请求格式不正确。")
    return value


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "ClassroomAvatarDemo/3.1"

    def _serve_frontend(self) -> None:
        dist_root = WEB_DIST.resolve()
        relative_path = unquote(urlsplit(self.path).path).lstrip("/") or "index.html"
        target = (dist_root / relative_path).resolve()
        if not target.is_relative_to(dist_root):
            self.send_error(403, "Forbidden")
            return
        try:
            content = target.read_bytes()
        except OSError:
            if relative_path == "index.html":
                self.send_error(503, "请先运行 npm run build，或在开发模式打开 http://localhost:5173")
            else:
                self.send_error(404, "Not found")
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store" if target.name == "index.html" else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler interface
        if self.path == "/api/volc/config":
            try:
                config = get_volc_avatar_config()
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=503)
                return
            self._send_json(config)
            return
        if self.path == "/api/classroom/state":
            self._send_json(classroom.snapshot())
            return
        if self.path == "/api/evaluation":
            self._send_json(classroom.evaluation())
            return
        if self.path == "/api/plan":
            self._send_json(classroom.plan())
            return
        if self.path == "/api/health":
            load_local_env()
            names = (
                "VOLC_ACCESS_KEY_ID",
                "VOLC_SECRET_ACCESS_KEY",
                "VOLC_AVATAR_IMAGE_URL",
            )
            missing = [name for name in names if not os.getenv(name, "").strip()]
            image_url = os.getenv("VOLC_AVATAR_IMAGE_URL", "").strip()
            if image_url and not image_url.startswith("https://"):
                missing.append("VOLC_AVATAR_IMAGE_URL（需要 HTTPS）")
            scenario = get_classroom_scenario()
            try:
                action_list = get_volc_avatar_actions()
                action_error = None
            except RuntimeError as exc:
                action_list = []
                action_error = str(exc)
            self._send_json(
                {
                    "ok": True,
                    "llmReady": bool(os.getenv("LINKAPI_API_KEY", "").strip()),
                    "avatarReady": not missing,
                    "missingAvatarConfig": missing,
                    "model": os.getenv("LINKAPI_MODEL", DEFAULT_LLM_MODEL),
                    "avatarProvider": "volcengine",
                    "classroomScenario": scenario,
                    "quickQuestions": get_quick_questions(scenario),
                    "actionList": action_list,
                    "actionError": action_error,
                }
            )
            return
        self._serve_frontend()

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler interface
        if self.path == "/api/teach":
            self._teach()
            return
        if self.path == "/api/classroom/interact":
            self._classroom_action(lambda: self._classroom_interact())
            return
        if self.path == "/api/classroom/next-round":
            self._classroom_action(classroom.next_round)
            return
        if self.path == "/api/classroom/end":
            self._classroom_action(classroom.end_class)
            return
        if self.path == "/api/classroom/reset":
            self._classroom_action(classroom.reset)
            return
        self.send_error(404, "Not found")

    def _classroom_action(self, action: Callable[[], dict]) -> None:
        try:
            self._send_json(action())
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=500)

    def _classroom_interact(self) -> dict:
        data = _read_json(self)
        return classroom.interact(str(data.get("text", "")))

    def _teach(self) -> None:
        try:
            data = _read_json(self)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        question = data.get("message")
        if not isinstance(question, str) or not question.strip():
            self._send_json({"error": "请填写你要咨询的问题。"}, status=400)
            return
        question = question.strip()
        if len(question) > 4000:
            self._send_json({"error": "单条问题请控制在 4000 字以内。"}, status=400)
            return

        history: list[dict[str, str]] = []
        raw_history = data.get("history", [])
        if isinstance(raw_history, list):
            for item in raw_history[-12:]:
                if isinstance(item, dict) and item.get("role") in ("user", "assistant"):
                    content = item.get("content")
                    if isinstance(content, str) and content.strip():
                        history.append({"role": item["role"], "content": content.strip()[:4000]})
        history.append({"role": "user", "content": question})
        try:
            answer = call_model(history)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=502)
            return

        self._send_json({"answer": answer})

    def _send_json(self, value: dict, status: int = 200) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")


def main() -> None:
    load_local_env()
    host = os.getenv("HOST", "127.0.0.1")
    if host not in ("127.0.0.1", "localhost"):
        raise SystemExit("AK/SK 直连模式仅允许绑定 localhost，请勿将服务暴露给局域网或公网客户端。")
    try:
        port = int(os.getenv("PORT", "8000"))
    except ValueError:
        raise SystemExit("PORT 必须是数字。") from None
    if not 1 <= port <= 65535:
        raise SystemExit("PORT 必须在 1 到 65535 之间。")
    server = ThreadingHTTPServer((host, port), DemoHandler)
    print(f"知之课堂 Demo：http://{host}:{port}")
    print("按 Ctrl+C 停止服务；请在浏览器结束数字人会话以释放资源。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止数字人实例…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
