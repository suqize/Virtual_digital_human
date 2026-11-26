# 知之课堂：火山引擎实时数字人课堂工作台

依据 `docs/code_artifact.md` 实现的课堂数字人 Demo。Vue 3 + TypeScript 前端提供【课堂工作台】【课后评价】【下节课方案】三个核心页面，Python 3.12 后端负责数字人配置下发与课堂数据闭环（互动采集 → 认知评分 → 教学干预 → 课后评价 → 下节课方案）。数字人对接沿用火山引擎 Avatar Web SDK 的 AK/SK 直连方案，未改动底层对接模式。

## 页面结构

- **课堂工作台**：左侧（约 70%）为「数字人课堂」+「课堂互动记录」两张卡片，右侧（约 30%）为「实时认知状态」（ECharts 走势折线图 + 四维认知进度条）+「实时教学干预」。数字人课堂模块内嵌现有 SDK 对接：连接老师、麦克风开关、全屏，以及按设计图新增的课堂计时、同步板书（黑板绿背景 + 函数图像 SVG）、讲解状态条与当前提问高亮、暂停/切帧/全屏控制栏。
- **课后评价**：顶部汇总行（课堂时长 / 学生互动 / 已评分证据）+ 左侧「教学干预效果复盘」「本节课认知评价」「给林同学的评语」+ 右侧「认知状态概览」「衔接下节课」。支持一键打印。
- **下节课方案**：左侧「下一节课的教学思路」「20 分钟教学安排」（时间轴）+ 右侧「方案依据」「根据现场回答调整」（分支干预预案）。支持一键打印。

**数据闭环**：数字人课堂抛出提问 → 学生在「课堂互动记录」提交回复 → 后端按维度关键词评分、刷新认知走势与进度条 → 规则匹配切换「实时教学干预」策略（概念混淆 → 双图对照、只给结论 → 口头追问、独立解释 → 独立练习）。页面顶部「结束课堂 / 学生互动 / 模拟下一轮」触发对应流转。若后端不可连接，页面自动降级为本地离线演示（顶部右侧显示「离线演示模式」），文字互动与数据闭环仍可演示。

## 数字人认证方式

前端直接将 AK/SK 传给官方 SDK（对接逻辑见 `web/src/avatar.ts`）：

```ts
const sdk = new AvatarSDK({
  appKey: accessKeyId,
  secretKey: secretAccessKey,
  environment: 'cn',
});
```

Python 从 `.env` 读取 `VOLC_ACCESS_KEY_ID` 和 `VOLC_SECRET_ACCESS_KEY`，由本地 `/api/volc/config` 接口提供给前端 SDK。项目不自行签发或传递 WSS Token。课堂人设由 `VOLC_AVATAR_USER_PROMPT` 完整覆盖；留空时由 `CLASSROOM_SCENARIO` 在 [app.py](/D:/Project/Virtual_digital_human/app.py) 中自动生成对应学科的老师提示词。数字人循环动作列表由 `VOLC_AVATAR_ACTIONS` 配置（逗号分隔），目前仅支持 `聆听（不说话） - 自然呼吸`、`聆听（不说话） - 开心`、`聆听（不说话） - 惊讶`、`复位 - 复位` 四个动作，留空则全部启用。

**此 AK/SK 直连方式仅适用于本机 Demo。** SDK 在浏览器中运行，所以 AK/SK 会出现在本机浏览器开发者工具和网络请求中。Python 默认只绑定 `127.0.0.1`，不要将服务暴露到局域网或公网。

## 配置

复制 `.env.example` 为项目根目录 `.env`，填写 LinkAPI 和火山引擎配置：

```dotenv
CLASSROOM_SCENARIO=数学

LINKAPI_BASE_URL=https://linkapi.ai/v1
LINKAPI_MODEL=gpt-6-sol
LINKAPI_API_KEY=你的LinkAPI密钥

VOLC_ACCESS_KEY_ID=你的火山引擎AccessKeyID
VOLC_SECRET_ACCESS_KEY=你的火山引擎SecretAccessKey
VOLC_AVATAR_IMAGE_URL=https://可公网访问的图片地址
VOLC_AVATAR_SPEAKER=saturn_zh_female_aojiaonvyou_tob
VOLC_AVATAR_ACTIONS=聆听（不说话） - 自然呼吸,聆听（不说话） - 开心,聆听（不说话） - 惊讶,复位 - 复位
VOLC_AVATAR_USER_PROMPT=
```

`VOLC_AVATAR_IMAGE_URL` 必须是火山引擎数字人服务可访问的公网 HTTPS 图片地址。本地预览图在 `web/src/assets/teacher-avatar.png`；要用作数字人形象时，请先将它上传到你控制的 TOS 桶或其他图片托管服务，再配置 HTTPS 直链。`.env` 已加入 `.gitignore`。

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
npm run typecheck
npm run build
conda run -n py312 python app.py
```

生产构建后打开 <http://127.0.0.1:8000>。首次使用麦克风时请在浏览器授权；课堂连接、麦克风采集和结束对应官方 Quick Start 的 Call、Talk、Hang up 生命周期。

## 后端接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/classroom/state` | 课堂工作台完整状态（环节、互动、认知、干预、证据） |
| `POST /api/classroom/interact` | 学生提交回复，触发认知评分与策略切换 |
| `POST /api/classroom/next-round` | 模拟下一轮，推进教学环节 |
| `POST /api/classroom/end` | 结束课堂，固化最终数据 |
| `POST /api/classroom/reset` | 重新演示，重置为种子状态 |
| `GET /api/evaluation` | 课后评价报告（干预复盘 / 维度评价 / 评语 / 下节课目标） |
| `GET /api/plan` | 下节课方案（教学目标 / 20 分钟安排 / 方案依据 / 分支预案） |
| `GET /api/volc/config` | 数字人 SDK 初始化配置（AK/SK、形象、音色、动作列表） |
| `GET /api/health` | 配置就绪检查 |
| `POST /api/teach` | 保留的原 LinkAPI 文字答疑接口 |

## 项目结构

- `app.py`：Python HTTP API、课堂闭环路由、数字人配置下发和生产静态文件服务
- `classroom.py`：课堂数据闭环（种子数据、认知评分、干预策略、评价与方案生成）
- `main.py`：兼容 PyCharm 的 Python 启动入口
- `web/`：Vue 3 + TypeScript 前端源码（`main.ts`、`tsconfig.json`）
- `web/src/views/`：课堂工作台 / 课后评价 / 下节课方案三个页面
- `web/src/components/`：数字人课堂、互动记录、认知状态、教学干预等卡片组件
- `web/src/avatar.ts`：火山引擎 Avatar Web SDK 会话管理（对接逻辑不变）
- `web/src/mock.ts`：离线演示模式本地模拟数据
- `web/src/assets/teacher-avatar.png`：数字人形象预览图
- `vite.config.js`：Vite 开发服务器、Python API 代理、构建输出到 `static/dist`
- `package.json`：Vite 开发与构建脚本、Vue/ECharts/SDK 依赖
- `.env.example`：本地配置模板
- `legacy/node-backend/`：此前的 Node HTTP 后端归档，不参与启动

## 音色选择

https://docs.volcengine.com/docs/doubao-voice/tone-list-3?lang=zh&_vtm_=a106466.b106468.0_0.0_0.0.95_7709545187361785370#%E7%AB%AF%E5%88%B0%E7%AB%AF%E5%AE%9E%E6%97%B6%E8%AF%AD%E9%9F%B3%E5%A4%A7%E6%A8%A1%E5%9E%8B-s2s-o%E7%89%88%E6%9C%AC%E3%80%81sc-2-0%E7%89%88%E6%9C%AC%E3%80%81o-2-0%E7%89%88%E6%9C%AC-%E9%9F%B3%E8%89%B3%E5%88%97%E8%A1%A8

## 官方资料

- [实时互动数字人 Web SDK 接口文档](https://docs.volcengine.com/docs/large-model-of-image-generation/real-time-interactive-digital-human-web-sdk-interface-documentation?lang=zh)
- [火山引擎 Avatar Web SDK Quick Start 示例](./example/avatar-web-sdk-quick-start-demo_Volc/README.md)
- [火山引擎 Web SDK npm 包](https://www.npmjs.com/package/@volcengine/avatar-web-sdk)
