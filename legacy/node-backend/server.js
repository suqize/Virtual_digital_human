import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.resolve(ROOT, 'static', 'dist');
const DEFAULT_LLM_BASE_URL = 'https://linkapi.ai/v1';
const DEFAULT_LLM_MODEL = 'gpt-6-sol';
const MAX_REQUEST_BYTES = 32_000;

const SYSTEM_PROMPT = `你是一位耐心、清晰、鼓励学生思考的中文数学老师。请根据学生的问题讲清楚数学思路。

要求：用简体中文；按步骤推导并解释每一步；必要时先询问年级或题目条件；发现计算错误时温和纠正；答案适合数字人朗读，不使用 Markdown 标题、表格、LaTeX 或代码块，算式尽量写成自然口语；回复控制在 700 个汉字以内，结尾可邀请学生继续提问。`;

function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name] = match;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

loadLocalEnv();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function cleanError(value) {
  let message = String(value ?? '未知错误');
  for (const name of ['VOLC_SECRET_ACCESS_KEY', 'VOLC_ACCESS_KEY_ID', 'LINKAPI_API_KEY']) {
    const secret = process.env[name]?.trim();
    if (secret) message = message.split(secret).join('[已隐藏]');
  }
  return message.slice(0, 900);
}

function avatarConfig() {
  const appKey = process.env.VOLC_ACCESS_KEY_ID?.trim() ?? '';
  const secretKey = process.env.VOLC_SECRET_ACCESS_KEY?.trim() ?? '';
  const avatarImageUrl = process.env.VOLC_AVATAR_IMAGE_URL?.trim() ?? '';
  const missing = [];
  if (!appKey) missing.push('VOLC_ACCESS_KEY_ID');
  if (!secretKey) missing.push('VOLC_SECRET_ACCESS_KEY');
  if (!avatarImageUrl) missing.push('VOLC_AVATAR_IMAGE_URL');
  if (missing.length) throw new HttpError(503, `请先在 .env 配置：${missing.join(', ')}`);
  if (!avatarImageUrl.startsWith('https://')) {
    throw new HttpError(503, 'VOLC_AVATAR_IMAGE_URL 必须是可公网访问的 HTTPS 图片地址。');
  }

  return {
    appKey,
    secretKey,
    avatarImageUrl,
    speaker: process.env.VOLC_AVATAR_SPEAKER?.trim() || 'saturn_zh_female_aojiaonvyou_tob',
    userPrompt: process.env.VOLC_AVATAR_USER_PROMPT?.trim() || SYSTEM_PROMPT,
  };
}

function health() {
  const missing = [];
  if (!process.env.VOLC_ACCESS_KEY_ID?.trim()) missing.push('VOLC_ACCESS_KEY_ID');
  if (!process.env.VOLC_SECRET_ACCESS_KEY?.trim()) missing.push('VOLC_SECRET_ACCESS_KEY');
  const imageUrl = process.env.VOLC_AVATAR_IMAGE_URL?.trim() ?? '';
  if (!imageUrl) missing.push('VOLC_AVATAR_IMAGE_URL');

  return {
    ok: true,
    llmReady: Boolean(process.env.LINKAPI_API_KEY?.trim()),
    avatarReady: missing.length === 0 && imageUrl.startsWith('https://'),
    missingAvatarConfig: missing,
    model: process.env.LINKAPI_MODEL?.trim() || DEFAULT_LLM_MODEL,
    avatarProvider: 'volcengine',
  };
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new HttpError(413, '请求内容过长。');
    chunks.push(chunk);
  }
  if (size === 0) throw new HttpError(400, '请求内容为空。');
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object');
    return value;
  } catch {
    throw new HttpError(400, '请求不是有效 JSON。');
  }
}

async function answerMathQuestion(req, res) {
  try {
    const data = await readJson(req);
    const question = typeof data.message === 'string' ? data.message.trim() : '';
    if (!question) throw new HttpError(400, '请填写一道数学问题。');
    if (question.length > 4000) throw new HttpError(400, '单条问题请控制在 4000 字以内。');

    const apiKey = process.env.LINKAPI_API_KEY?.trim();
    if (!apiKey) throw new HttpError(503, '尚未配置 LINKAPI_API_KEY，请在项目根目录 .env 设置模型 API Key。');
    const history = [];
    if (Array.isArray(data.history)) {
      for (const item of data.history.slice(-12)) {
        if (!item || !['user', 'assistant'].includes(item.role)) continue;
        if (typeof item.content === 'string' && item.content.trim()) {
          history.push({ role: item.role, content: item.content.trim().slice(0, 4000) });
        }
      }
    }
    history.push({ role: 'user', content: question });

    const baseUrl = (process.env.LINKAPI_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL).replace(/\/+$/, '');
    const model = process.env.LINKAPI_MODEL?.trim() || DEFAULT_LLM_MODEL;
    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      throw new HttpError(502, `暂时无法连接大模型接口：${cleanError(error.message)}`);
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new HttpError(502, `大模型接口返回 HTTP ${response.status}。${cleanError(raw.slice(0, 600))}`);
    }
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      throw new HttpError(502, '大模型接口返回内容不是有效 JSON。');
    }

    let content = result?.choices?.[0]?.message?.content;
    if (Array.isArray(content)) {
      content = content.map((part) => (part && typeof part === 'object' ? part.text ?? '' : '')).join('\n');
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new HttpError(502, '数学老师暂时没有生成回复，请稍后重试。');
    }
    json(res, 200, { answer: content.trim() });
  } catch (error) {
    json(res, error.status || 502, { error: cleanError(error.message) });
  }
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!existsSync(DIST_ROOT)) {
    json(res, 503, { error: '请先运行 npm run build，或通过 npm run dev 启动开发页面。' });
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    json(res, 400, { error: '请求路径格式不正确。' });
    return;
  }
  const relative = decodedPath.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(DIST_ROOT, relative);
  if (filePath !== DIST_ROOT && !filePath.startsWith(`${DIST_ROOT}${path.sep}`)) {
    json(res, 403, { error: 'Forbidden.' });
    return;
  }

  let target = filePath;
  if (!existsSync(target) || statSync(target).isDirectory()) target = path.join(DIST_ROOT, 'index.html');
  if (!existsSync(target)) {
    json(res, 404, { error: 'Not found.' });
    return;
  }
  const stat = statSync(target);
  res.writeHead(200, {
    'Content-Type': contentTypes[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': path.basename(target) === 'index.html' ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(target).pipe(res);
}

async function handle(req, res) {
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  } catch {
    json(res, 400, { error: '请求地址格式不正确。' });
    return;
  }
  const pathname = url.pathname;
  res.on('finish', () => {
    console.log(`${req.socket.remoteAddress || '-'} - ${req.method} ${pathname} ${res.statusCode}`);
  });

  if (pathname === '/api/health' && req.method === 'GET') {
    json(res, 200, health());
    return;
  }
  if (pathname === '/api/volc/config' && req.method === 'GET') {
    try {
      json(res, 200, avatarConfig());
    } catch (error) {
      json(res, error.status || 503, { error: cleanError(error.message) });
    }
    return;
  }
  if (pathname === '/api/teach' && req.method === 'POST') {
    await answerMathQuestion(req, res);
    return;
  }
  if (pathname.startsWith('/api/')) {
    json(res, 404, { error: 'Not found.' });
    return;
  }
  serveStatic(req, res, pathname);
}

const host = process.env.HOST?.trim() || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  throw new Error('AK/SK 直连模式仅允许绑定 localhost，避免将长期密钥提供给局域网或公网客户端。');
}
const port = Number.parseInt(process.env.PORT || '8000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是有效端口号。');

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!res.headersSent) json(res, 500, { error: cleanError(error.message) });
    else res.destroy();
  });
});

server.listen(port, host, () => {
  console.log(`知知老师数字人 Demo：http://${host}:${port}`);
  console.log('AK/SK 直连模式仅用于本机开发；按 Ctrl+C 停止服务。');
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
