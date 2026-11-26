import { reactive } from 'vue';
import { AvatarSDK, type AvatarSession } from '@volcengine/avatar-web-sdk';
import { api } from './api';

export type AvatarStatus = 'idle' | 'connecting' | 'live' | 'error';

export const avatar = reactive({
  status: 'idle' as AvatarStatus,
  micOn: false,
  paused: false,
  message: '',
  configReady: false,
  configError: '',
});

let sdk: InstanceType<typeof AvatarSDK> | null = null;
let session: AvatarSession | null = null;

function cleanup(): void {
  sdk = null;
  session = null;
}

function fail(message: string): void {
  avatar.status = 'error';
  avatar.message = message;
  avatar.micOn = false;
  avatar.paused = false;
}

export async function connectAvatar(container: HTMLDivElement): Promise<void> {
  if (avatar.status === 'connecting' || avatar.status === 'live') return;
  avatar.status = 'connecting';
  avatar.message = '正在创建数字人会话…';
  avatar.paused = false;
  avatar.micOn = false;

  let started = false;
  let ended = false;
  let current: AvatarSession | null = null;
  let startupTimer: number | undefined;

  const finish = (error?: Error, fallback?: string): void => {
    if (!current || session !== current || ended) return;
    ended = true;
    if (startupTimer !== undefined) window.clearTimeout(startupTimer);
    cleanup();
    if (error) {
      console.error('[AvatarSDK] Session ended with error:', error);
      fail(error.message || fallback || '数字人会话异常结束');
    } else {
      console.warn('[AvatarSDK] Session ended:', fallback);
      avatar.status = 'idle';
      avatar.message = fallback || '会话已结束';
    }
  };

  try {
    const config = await api.volcConfig();
    avatar.configReady = true;
    avatar.configError = '';
    sdk = new AvatarSDK({
      appKey: config.appKey,
      secretKey: config.secretKey,
      environment: 'cn',
      logEnabled: true,
      logLevel: 'info',
    });
    const created = sdk.createSession({
      avatarImageUrl: config.avatarImageUrl,
      speaker: config.speaker,
      userPrompt: config.userPrompt,
      speechRate: 0,
      loudnessRate: 0,
      enableWebsearch: false,
      actionList: Array.isArray(config.actionList) ? config.actionList : [],
    });
    current = created;
    session = created;
    created.on('start', () => {
      if (session !== created || ended) return;
      started = true;
      if (startupTimer !== undefined) window.clearTimeout(startupTimer);
      console.info('[AvatarSDK] Session started; attaching the avatar video canvas.');
      try {
        created.setAvatarVideoCanvas(container, 'fit');
      } catch (error) {
        console.error('[AvatarSDK] Could not attach the avatar video canvas:', error);
        avatar.message = `会话已启动，但视频画面绑定失败：${(error as Error).message || '未知错误'}`;
      }
      avatar.status = 'live';
      avatar.message = '数字人已连接';
    });
    created.on('end', (error) => {
      finish(error, started ? '会话已结束，可以重新连接。' : '会话在启动事件前结束，请查看浏览器控制台。');
    });
    created.on('audioCaptureStart', () => {
      if (session !== created || ended) return;
      avatar.micOn = true;
    });
    created.on('audioCaptureStop', () => {
      if (session !== created || ended) return;
      avatar.micOn = false;
      avatar.paused = false;
    });
    created.on('audioCaptureFail', (error) => {
      if (session !== created || ended) return;
      avatar.micOn = false;
      avatar.message = error.message || '麦克风启动失败，请检查浏览器权限';
      console.error('[AvatarSDK] Audio capture failed:', error);
    });

    startupTimer = window.setTimeout(() => {
      if (session !== created || started || ended) return;
      const timeout = new Error('45 秒内没有收到数字人 start 事件，请查看浏览器控制台与网络请求。');
      finish(timeout, timeout.message);
      created.end().catch((error) => console.warn('[AvatarSDK] Cleanup after startup timeout failed:', error));
    }, 45_000);

    await created.start();
    if (session !== created || ended) return;
    if (!started) {
      avatar.message = '已发起连接，等待数字人视频流…';
    }
  } catch (error) {
    if (startupTimer !== undefined) window.clearTimeout(startupTimer);
    const currentSession = current;
    cleanup();
    avatar.configReady = true;
    if (currentSession) {
      currentSession.end().catch(() => {});
    }
    fail((error as Error).message || '数字人连接失败');
    console.error('[AvatarSDK] Session start failed:', error);
  }
}

export async function disconnectAvatar(): Promise<void> {
  const current = session;
  cleanup();
  if (!current) {
    avatar.status = 'idle';
    avatar.message = '';
    avatar.micOn = false;
    return;
  }
  try {
    await current.end();
  } catch (error) {
    console.warn('[AvatarSDK] End session failed:', error);
  }
  avatar.status = 'idle';
  avatar.message = '课堂已结束';
  avatar.micOn = false;
  avatar.paused = false;
}

export async function toggleMic(): Promise<void> {
  if (!session || avatar.status !== 'live') return;
  try {
    if (avatar.micOn) {
      await session.stopAudioCapture();
    } else {
      await session.startAudioCapture();
      avatar.paused = false;
    }
  } catch (error) {
    avatar.message = (error as Error).message || '麦克风操作失败';
    console.error('[AvatarSDK] Toggle mic failed:', error);
  }
}

export function setPaused(paused: boolean): void {
  avatar.paused = paused;
  if (paused && avatar.micOn && session) {
    session.stopAudioCapture().catch(() => {});
  }
}

export function probeConfig(): void {
  api
    .volcConfig()
    .then(() => {
      avatar.configReady = true;
      avatar.configError = '';
    })
    .catch((error) => {
      avatar.configReady = false;
      avatar.configError = (error as Error).message || '数字人配置缺失，请检查 .env';
    });
}

window.addEventListener('pagehide', () => {
  if (session) session.end().catch(() => {});
});
