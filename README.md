# 知知老师：火山引擎实时数字人 Demo

这是一个数学老师课堂 Demo。Python 3.12 后端负责读取本地配置、调用 LinkAPI `gpt-6-sol` 进行文字答疑，并提供数字人初始化配置；前端通过火山引擎 Avatar Web SDK 建立数字人会话、采集麦克风。Node.js 用于 Vite 前端开发和构建。

## 数字人认证方式

数字人连接参考 `example/avatar-web-sdk-quick-start-demo_Volc/main.js`，前端直接将 AK/SK 传给官方 SDK：

```js
const sdk = new AvatarSDK({
  appKey: accessKeyId,
  secretKey: secretAccessKey,
  environment: 'cn',
});
```

Python 从 `.env` 读取 `VOLC_ACCESS_KEY_ID` 和 `VOLC_SECRET_ACCESS_KEY`，由本地 `/api/volc/config` 接口提供给前端 SDK。项目不自行签发或传递 WSS Token，也不需要 `AVATAR_TENANT_ID`。课堂人设由 `VOLC_AVATAR_USER_PROMPT` 配置，留空时使用 [app.py](/D:/Project/Virtual_digital_human/app.py) 中的数学老师提示词。

**此 AK/SK 直连方式仅适用于本机 Demo。** SDK 在浏览器中运行，所以 AK/SK 会出现在本机浏览器开发者工具和网络请求中。Python 默认只绑定 `127.0.0.1`，不要将服务暴露到局域网或公网。LinkAPI 密钥由 Python 后端使用，不下发到浏览器。

## 配置

复制 `.env.example` 为项目根目录 `.env`，填写 LinkAPI 和火山引擎配置：

```dotenv
LINKAPI_BASE_URL=https://linkapi.ai/v1
LINKAPI_MODEL=gpt-6-sol
LINKAPI_API_KEY=你的LinkAPI密钥

VOLC_ACCESS_KEY_ID=你的火山引擎AccessKeyID
VOLC_SECRET_ACCESS_KEY=你的火山引擎SecretAccessKey
VOLC_AVATAR_IMAGE_URL=https://可公网访问的图片地址
VOLC_AVATAR_SPEAKER=saturn_zh_female_aojiaonvyou_tob
VOLC_AVATAR_USER_PROMPT=
```

`VOLC_AVATAR_IMAGE_URL` 必须是火山引擎数字人服务可访问的公网 HTTPS 图片地址。本地预览图在 `static/assets/volc-math-teacher-avatar.png`；要用作数字人形象时，请先将它上传到你控制的 TOS 桶或其他图片托管服务，再配置 HTTPS 直链。`.env` 已加入 `.gitignore`。

## 启动

Python 后端使用本机 Conda 的 `py312` 环境；Node.js 按项目环境使用 nvm 的 `v23.11.1`。Python 后端只使用标准库，不需要额外 pip 安装。

在第一个 PowerShell 窗口启动 Python API：

```powershell
conda run -n py312 python app.py
```

在第二个 PowerShell 窗口启动前端：

```powershell
nvm use 23.11.1
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。Vite 将 `/api` 请求代理到 Python 的 `http://127.0.0.1:8000`。也可以构建静态页面后只启动 Python 服务：

```powershell
npm run build
conda run -n py312 python app.py
```

生产构建后打开 <http://127.0.0.1:8000>。首次使用麦克风时请在浏览器授权；课堂连接、麦克风采集和结束对应官方 Quick Start 的 Call、Talk、Hang up 生命周期。

## 项目结构

- `app.py`：Python HTTP API、LinkAPI 数学答疑、配置读取和生产静态文件服务
- `main.py`：兼容 PyCharm 的 Python 启动入口
- `requirements.txt`：说明 Python 后端无需额外 pip 包
- `static/main.js`：页面交互和火山引擎 Avatar Web SDK 接入
- `static/index.html`：数学老师课堂页面
- `static/assets/volc-math-teacher-avatar.png`：数字人形象预览图
- `vite.config.js`：前端开发服务器和 Python API 代理
- `package.json`：Vite 开发与构建脚本、前端 SDK 依赖
- `.env.example`：本地配置模板
- `legacy/node-backend/`：此前的 Node HTTP 后端归档，不参与启动

## 官方资料

- [实时互动数字人 Web SDK 接口文档](https://docs.volcengine.com/docs/large-model-of-image-generation/real-time-interactive-digital-human-web-sdk-interface-documentation?lang=zh)
- [火山引擎 Avatar Web SDK Quick Start 示例](./example/avatar-web-sdk-quick-start-demo_Volc/README.md)
- [火山引擎 Web SDK npm 包](https://www.npmjs.com/package/@volcengine/avatar-web-sdk)
