import { AvatarSDK } from '@volcengine/avatar-web-sdk';

const $ = (id) => document.getElementById(id);
const messages = $('messages');
const input = $('question');
const sendButton = $('send-button');
const startButton = $('start-button');
const stopButton = $('stop-button');
const micButton = $('mic-button');
const history = [];

let avatarSDK = null;
let session = null;
let connecting = false;
let active = false;
let busy = false;
let micActive = false;
let llmReady = false;

function addMessage(role, text, isError = false) {
  const item = document.createElement('article');
  item.className = `message ${role}`;
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = role === 'user' ? '你' : '知知老师 · 数学老师';
  const bubble = document.createElement('div');
  bubble.className = `bubble${isError ? ' error-bubble' : ''}`;
  bubble.textContent = text;
  item.append(label, bubble);
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

function setStatus(kind, text) {
  $('status-dot').className = `dot${kind === 'on' ? ' on' : kind === 'error' ? ' error' : ''}`;
  $('status-label').textContent = text;
}

function updateSessionControls() {
  startButton.disabled = active || connecting;
  startButton.textContent = connecting ? '正在连接…' : active ? '老师已连接' : '连接老师';
  stopButton.disabled = !active;
  micButton.disabled = !active;
  micButton.textContent = micActive ? '静音麦克风' : '开启麦克风';
  sendButton.disabled = !llmReady || busy;
  sendButton.textContent = busy ? '老师正在讲解…' : llmReady ? '发送文字问题 ↑' : '大模型未配置 ↑';
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

async function checkHealth() {
  try {
    const data = await getJson('/api/health');
    llmReady = Boolean(data.llmReady);
    if (!data.avatarReady) {
      setStatus('error', '待填写火山引擎配置');
      $('placeholder-copy').textContent = `缺少配置：${data.missingAvatarConfig.join('、')}。请完善项目 .env。`;
    } else if (!data.llmReady) {
      setStatus('error', '待填写大模型 API Key');
    } else {
      setStatus('', `可连接 · ${data.model}`);
    }
    updateSessionControls();
  } catch (_) {
    setStatus('error', 'Python 服务未连接');
  }
}

async function startClass() {
  if (active || connecting) return;
  connecting = true;
  active = false;
  updateSessionControls();
  setStatus('', '正在创建火山引擎数字人会话…');
  let currentSession = null;
  let started = false;
  let ended = false;
  let startupTimer = null;

  const finishSession = (error, fallbackMessage) => {
    if (!currentSession || session !== currentSession || ended) return;
    ended = true;
    window.clearTimeout(startupTimer);
    connecting = false;
    active = false;
    micActive = false;
    session = null;
    avatarSDK = null;
    updateSessionControls();
    $('live-label').textContent = '未连接';
    $('placeholder').hidden = false;
    const detail = error?.message || fallbackMessage;
    $('placeholder-copy').textContent = detail;
    $('stage-message').textContent = started ? '数字人会话已结束' : '数字人视频流尚未启动';
    setStatus(error || !started ? 'error' : '', error ? '数字人会话异常结束' : started ? '课堂已结束' : '数字人未能启动');
    if (error) console.error('[AvatarSDK] Session ended with error:', error);
    else console.warn('[AvatarSDK] Session ended without an error payload:', fallbackMessage);
  };

  try {
    const config = await getJson('/api/volc/config');
    if (!connecting) return;
    avatarSDK = new AvatarSDK({
      appKey: config.appKey,
      secretKey: config.secretKey,
      environment: 'cn',
      logEnabled: true,
      logLevel: 'info',
    });

    currentSession = avatarSDK.createSession({
      avatarImageUrl: config.avatarImageUrl,
      speaker: config.speaker,
      userPrompt: config.userPrompt,
      speechRate: 0,
      loudnessRate: 0,
      enableWebsearch: false,
    });
    session = currentSession;
    currentSession.on('start', () => {
      if (session !== currentSession || ended) return;
      started = true;
      console.info('[AvatarSDK] Session started; attaching the avatar video canvas.');
      window.clearTimeout(startupTimer);
      connecting = false;
      active = true;
      micActive = false;
      try {
        currentSession.setAvatarVideoCanvas($('avatar-video'), 'fit');
      } catch (error) {
        console.error('[AvatarSDK] Could not attach the avatar video canvas:', error);
        $('stage-message').textContent = `会话已启动，但视频画面绑定失败：${error.message || '未知错误'}`;
      }
      $('placeholder').hidden = true;
      $('live-label').textContent = '直播中';
      if (!$('stage-message').textContent.startsWith('会话已启动，但视频画面绑定失败')) {
        $('stage-message').textContent = '知知老师已连接，请点击“开启麦克风”后提问';
      }
      setStatus('on', '老师已接通，请开启麦克风');
      updateSessionControls();
      input.focus();
    });
    currentSession.on('end', (error) => {
      const fallback = started
        ? '会话已结束，可以重新连接老师。'
        : '会话在 SDK 发出 start 事件前结束，未收到具体错误原因。请打开浏览器开发者工具查看 Console 和 Network 中的连接错误。';
      finishSession(error, fallback);
    });
    currentSession.on('audioCaptureStart', () => {
      if (session !== currentSession || ended) return;
      micActive = true;
      updateSessionControls();
    });
    currentSession.on('audioCaptureStop', () => {
      if (session !== currentSession || ended) return;
      micActive = false;
      updateSessionControls();
    });
    currentSession.on('audioCaptureFail', (error) => {
      if (session !== currentSession || ended) return;
      micActive = false;
      updateSessionControls();
      setStatus('error', '麦克风启动失败');
      $('stage-message').textContent = error.message || '请检查浏览器麦克风权限';
    });

    startupTimer = window.setTimeout(() => {
      if (session !== currentSession || started || ended) return;
      const timeout = new Error('45 秒内没有收到数字人 start 事件。请查看浏览器开发者工具 Console 和 Network 中的 WebSocket/WebRTC 连接信息。');
      finishSession(timeout, timeout.message);
      currentSession.end().catch((error) => console.warn('[AvatarSDK] Cleanup after startup timeout failed:', error));
    }, 45_000);

    await currentSession.start();
    if (session !== currentSession || ended) return;
    if (!started) {
      setStatus('', '已发起连接，等待数字人视频流…');
      $('stage-message').textContent = '已发起会话，等待 SDK 启动事件…';
    }
  } catch (error) {
    window.clearTimeout(startupTimer);
    if (currentSession && session !== currentSession) return;
    if (currentSession) session = null;
    if (currentSession) try { await currentSession.end(); } catch (_) {}
    connecting = false;
    active = false;
    micActive = false;
    avatarSDK = null;
    updateSessionControls();
    $('placeholder').hidden = false;
    $('placeholder-copy').textContent = error.message;
    setStatus('error', '数字人连接失败');
    $('stage-message').textContent = '数字人会话未启动';
    updateSessionControls();
    console.error('[AvatarSDK] Session start failed:', error);
  }
}

async function stopClass() {
  stopButton.disabled = true;
  try {
    if (session) await session.end();
    session = null;
    connecting = false;
    active = false;
    micActive = false;
    updateSessionControls();
    $('placeholder').hidden = false;
    $('live-label').textContent = '未连接';
    $('stage-message').textContent = '课堂画面将在连接后显示';
    startButton.disabled = false;
    startButton.textContent = '重新连接老师';
    setStatus('', '课堂已结束');
  } catch (error) {
    addMessage('assistant', error.message, true);
    stopButton.disabled = false;
    setStatus('error', '关闭数字人会话失败');
  }
}

async function teach(text) {
  if (busy || !text.trim()) return;
  const question = text.trim();
  addMessage('user', question);
  input.value = '';
  busy = true;
  sendButton.disabled = true;
  sendButton.textContent = '老师正在讲解…';
  $('stage-message').textContent = '知知老师正在整理思路…';
  const resumeMic = active && micActive;
  try {
    if (resumeMic) await session.stopAudioCapture();
    const result = await getJson('/api/teach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, history: history.slice(-12) }),
    });
    history.push({ role: 'user', content: question }, { role: 'assistant', content: result.answer });
    addMessage('assistant', result.answer);
    $('stage-message').textContent = active ? 'LinkAPI 文字答案已生成；数字人语音课堂仍可继续' : 'LinkAPI 文字答案已生成';
  } catch (error) {
    addMessage('assistant', error.message, true);
    $('stage-message').textContent = '这次讲解没有成功，请重试';
  } finally {
    if (resumeMic && active && session) {
      try { await session.startAudioCapture(); } catch (error) {
        setStatus('error', '麦克风恢复失败');
        $('stage-message').textContent = error.message || '请重新开启麦克风';
      }
    }
    busy = false;
    updateSessionControls();
    input.focus();
  }
}

$('teach-form').addEventListener('submit', (event) => {
  event.preventDefault();
  teach(input.value);
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    $('teach-form').requestSubmit();
  }
});
document.querySelectorAll('.quick button').forEach((button) => {
  button.addEventListener('click', () => teach(button.textContent));
});
startButton.addEventListener('click', startClass);
stopButton.addEventListener('click', stopClass);
micButton.addEventListener('click', async () => {
  if (!session || !active) return;
  micButton.disabled = true;
  try {
    if (micActive) await session.stopAudioCapture();
    else await session.startAudioCapture();
  } catch (error) {
    addMessage('assistant', error.message || '麦克风操作失败', true);
    setStatus('error', '麦克风操作失败');
  } finally {
    micButton.disabled = !active;
  }
});
window.addEventListener('pagehide', () => {
  if (session) session.end().catch(() => {});
});

checkHealth();
