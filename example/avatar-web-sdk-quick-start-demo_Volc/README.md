# Avatar Web SDK Quick Start Demo (VolcEngine)

This directory contains a minimal, runnable integration example that showcases
the three core lifecycle operations of the SDK:

- **Call** — Create and start an avatar session
- **Talk** — Toggle the microphone for voice interaction once the session is up
- **Hang up** — End the session

The core integration logic lives in a single file: `main.js`. The UI and styles
in `index.html` / `style.css` are intentionally simple so you can replace them
with your own pages.

This package is built for the VolcEngine distribution:

- SDK package: `@volcengine/avatar-web-sdk`
- RTC package: `@volcengine/rtc`
- Default `environment`: `"cn"`

## Prerequisites

- Node.js 18+
- `appKey` / `secretKey` from the VolcEngine console
- An HTTPS image URL for the avatar (16:9 or 4:3 recommended)
- Must run over HTTPS or `localhost` (browser WebRTC / microphone restriction)

## Install

From this directory run:

```bash
npm install
```

## Start

```bash
npm run dev
```

Open the local URL printed by Vite (defaults to `http://localhost:5173`) and
fill in the following fields on the page:

- `appKey`
- `secretKey`
- `avatarImageUrl`
- `speaker` (voice ID — use the sample voice from the console if unsure)

Click **Call** to start the session. Once the session is up, **Talk** becomes
available; click once to open the microphone and again to close it.
**Hang up** terminates the session.

## Integrating into your own project

Lift the key pieces from `main.js` into your project:

1. Create the `AvatarSDK` instance:
   ```js
   import { AvatarSDK } from "@volcengine/avatar-web-sdk";
   const sdk = new AvatarSDK({ appKey, secretKey, environment: "cn" });
   ```
2. Create a session with `sdk.createSession(config)` and subscribe to
   `start` / `end` / `audioCaptureStart` / ... events.
3. Call `session.start()`; inside the `start` event callback, call
   `session.setAvatarVideoCanvas(container, "fit")` to render the video.
4. Use `session.startAudioCapture()` / `session.stopAudioCapture()` to toggle
   the microphone.
5. Call `session.end()` to hang up.
