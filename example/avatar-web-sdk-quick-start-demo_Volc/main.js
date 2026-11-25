/**
 * Avatar Web SDK Quick Start Demo (VolcEngine)
 *
 * This example demonstrates the three core lifecycle operations of the SDK:
 *   1. Call    - Create and start a session
 *   2. Talk    - Toggle the microphone to talk with the avatar
 *   3. Hang up - End the session
 */

import { AvatarSDK } from "@volcengine/avatar-web-sdk";

const DEFAULT_SPEAKER = "saturn_zh_female_aojiaonvyou_tob";

const els = {
  container: document.getElementById("avatar-container"),
  status: document.getElementById("status"),
  btnCall: document.getElementById("btn-call"),
  btnTalk: document.getElementById("btn-talk"),
  btnHangup: document.getElementById("btn-hangup"),
  cfgAppKey: document.getElementById("cfg-appkey"),
  cfgSecretKey: document.getElementById("cfg-secretkey"),
  cfgAvatar: document.getElementById("cfg-avatar"),
  cfgSpeaker: document.getElementById("cfg-speaker"),
  log: document.getElementById("log"),
};

function log(message, ...args) {
  const timestamp = new Date().toLocaleTimeString();
  const payload = args.length ? ` ${JSON.stringify(args, null, 0)}` : "";
  const line = `[${timestamp}] ${message}${payload}`;
  els.log.textContent += `${line}\n`;
  els.log.scrollTop = els.log.scrollHeight;
  console.log(message, ...args);
}

function setStatus(text) {
  els.status.textContent = `Status: ${text}`;
}

function readConfig() {
  return {
    appKey: els.cfgAppKey.value.trim(),
    secretKey: els.cfgSecretKey.value.trim(),
    avatarImageUrl: els.cfgAvatar.value.trim(),
    speaker: els.cfgSpeaker.value.trim() || DEFAULT_SPEAKER,
  };
}

/**
 * Demo state machine:
 *   idle  →  calling  →  talking  →  idle
 * Buttons are only enabled when the matching action is available.
 */
const state = {
  sdk: null,
  session: null,
  isTalking: false,
};

function setButtons({ callEnabled, talkEnabled, hangupEnabled, talking }) {
  els.btnCall.disabled = !callEnabled;
  els.btnTalk.disabled = !talkEnabled;
  els.btnHangup.disabled = !hangupEnabled;
  els.btnTalk.textContent = talking ? "Stop talking" : "Talk";
  els.btnTalk.classList.toggle("active", talking);
}

/**
 * Call: create the SDK and session, then start the session.
 * The video canvas is attached once the 'start' event fires.
 */
async function handleCall() {
  const { appKey, secretKey, avatarImageUrl, speaker } = readConfig();

  if (!appKey || !secretKey) {
    log("Please provide appKey and secretKey first");
    setStatus("missing credentials");
    return;
  }

  if (!avatarImageUrl) {
    log("Please provide an avatarImageUrl so the avatar can be rendered");
    setStatus("missing avatar image URL");
    return;
  }

  try {
    setStatus("calling…");
    setButtons({ callEnabled: false, talkEnabled: false, hangupEnabled: false, talking: false });

    state.sdk = new AvatarSDK({
      appKey,
      secretKey,
      // Important: 
      // for BytePlus, environment must be "overseas"
      // For VolcEngine, environment must be "cn"
      environment: "cn",
      logLevel: "info",
    });

    const session = state.sdk.createSession({
      avatarImageUrl,
      speaker,
      userPrompt: "You are a helpful assistant",
    });

    session.on("start", () => {
      log("Session started");
      setStatus("in call");
      session.setAvatarVideoCanvas(els.container, "fit");
      setButtons({ callEnabled: false, talkEnabled: true, hangupEnabled: true, talking: false });
    });

    session.on("end", (error) => {
      if (error) {
        log("Session ended with error:", error.message);
        setStatus("session ended (error)");
      } else {
        log("Session ended");
        setStatus("hung up");
      }
      resetForIdle();
    });

    session.on("audioCaptureStart", () => {
      log("Audio capture started");
      state.isTalking = true;
      setButtons({ callEnabled: false, talkEnabled: true, hangupEnabled: true, talking: true });
    });

    session.on("audioCaptureStop", () => {
      log("Audio capture stopped");
      state.isTalking = false;
      setButtons({ callEnabled: false, talkEnabled: true, hangupEnabled: true, talking: false });
    });

    session.on("audioCaptureFail", (error) => {
      log("Audio capture failed:", error.message);
      state.isTalking = false;
      setButtons({ callEnabled: false, talkEnabled: true, hangupEnabled: true, talking: false });
    });

    state.session = session;
    await session.start();
  } catch (error) {
    log("Call failed:", error?.message || String(error));
    setStatus("call failed");
    resetForIdle();
  }
}

/**
 * Talk: toggle microphone capture on an active session.
 */
async function handleTalk() {
  if (!state.session) {
    log("No active session available for voice interaction");
    return;
  }

  try {
    if (state.isTalking) {
      setStatus("stopping voice…");
      await state.session.stopAudioCapture();
      setStatus("in call");
    } else {
      setStatus("starting voice…");
      await state.session.startAudioCapture();
    }
  } catch (error) {
    log("Voice interaction failed:", error?.message || String(error));
    setStatus("in call");
  }
}

/**
 * Hang up: end the active session.
 */
async function handleHangup() {
  if (!state.session) return;
  try {
    setStatus("hanging up…");
    setButtons({ callEnabled: false, talkEnabled: false, hangupEnabled: false, talking: false });
    await state.session.end();
  } catch (error) {
    log("Hang up failed:", error?.message || String(error));
    resetForIdle();
  }
}

function resetForIdle() {
  state.session = null;
  state.sdk = null;
  state.isTalking = false;
  setButtons({ callEnabled: true, talkEnabled: false, hangupEnabled: false, talking: false });
  if (!els.status.textContent.includes("failed")) {
    setStatus("idle");
  }
}

/**
 * Entry point: wire up button events and initialize the UI.
 */
function init() {
  setButtons({ callEnabled: true, talkEnabled: false, hangupEnabled: false, talking: false });
  setStatus("idle");
  log("Demo ready. Fill in appKey / secretKey / avatarImageUrl, then click Call.");

  els.btnCall.addEventListener("click", handleCall);
  els.btnTalk.addEventListener("click", handleTalk);
  els.btnHangup.addEventListener("click", handleHangup);
}

init();
