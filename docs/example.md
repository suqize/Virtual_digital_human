<span id="u6lSLuX6"></span>
## 1. 集成指南

<span id="Q3S1uTd2"></span>
### 1.1 环境要求


* **安全上下文**：SDK 需要在 HTTPS 或 localhost 环境下运行（WebRTC 和 Web Audio API 要求）


<span id="CEw0N6a7"></span>
### 1.2 安装方式

<span id="uyx1zAKo"></span>
#### npm 安装

```Bash
npm install @volcengine/avatar-web-sdk --save
```


<span id="KqAYSV82"></span>
## 2. 调用流程

<span id="rNlOB1Y4"></span>
### 2.1 创建 AvatarSDK 实例

调用数字人服务，你首先需要创建 AvatarSDK 实例，通常而言，一个应用只需要创建一个实例。我们推荐你将这个实例作为单例持有，以确保全局唯一性。SDK 实例负责管理全局信息，如会话认证、日志记录、事件通知等。

<span id="X2LJm8Ms"></span>
#### 认证方式说明

SDK 支持三种认证方式：


|**认证方式** |**适用场景** |**需要配置** |**时效性** |**刷新接口** |
|---|---|---|---|---|
|**WSS Token** |无需 AK/SK 的场景（推荐） |wssToken |短期有效 |updateWssToken() |
|**永久 AK/SK** |长期有效的 AppKey/SecretKey |appKey + secretKey |长期有效 |无需刷新 |
|**临时 AK/SK + STS** |使用临时凭证的场景 |appKey + secretKey + stsToken |短期有效 |updateTempAKSK() |


**推荐使用 WSS Token 认证方式**，无需暴露 AK/SK，安全性更高。

<span id="WNvI79xE"></span>
#### 认证方式示例

**方式一：WSS Token 认证（推荐，短期有效）** 

不需要 AK/SK，直接使用 WSS Token 进行认证。安全性更高，无需暴露密钥。WSS Token 有过期时间，需要在过期前刷新。WSS Token由后端生成，通过接口下发到客户端。文末我们提供了一个WSS Token生成的示例代码：wss_token_volc.zip，供参考。

```TypeScript
import { AvatarSDK, AvatarSDKConfig } from '@volcengine/avatar-web-sdk';

const config: AvatarSDKConfig = {
  wssToken: 'your_wss_token',
  environment: 'cn',
  logLevel: 'info',
};

const avatarSDK = new AvatarSDK(config);

// wssToken 过期前调用更新接口
avatarSDK.updateWssToken('new_wss_token');
```


**方式二：永久 AK/SK 认证（长期有效）** 

使用长期有效的 AppKey/SecretKey，无需刷新。

长期有效的 AppKey/SecretKey 获取方式请参考 [获取AccessKey、SecretKey](https://docs.volcengine.com/docs/6291/65568)。

```TypeScript
import { AvatarSDK, AvatarSDKConfig } from '@volcengine/avatar-web-sdk';

const config: AvatarSDKConfig = {
  appKey: 'your_app_key',
  secretKey: 'your_secret_key',
  environment: 'cn',
  logLevel: 'info',
};

const avatarSDK = new AvatarSDK(config);
```


**方式三：临时 AK/SK + STS Token 认证（短期有效）** 

使用临时凭证的场景，必须配置 stsToken。三者具有相同的过期时间，需要一起刷新。

临时AK/SK/STS Token 获取方式请参考 ** ** [获取临时密钥（STS）](https://docs.volcengine.com/docs/86081/2549793?lang=zh) **。** 

```TypeScript
import { AvatarSDK, AvatarSDKConfig } from '@volcengine/avatar-web-sdk';

const config: AvatarSDKConfig = {
  appKey: 'temp_app_key',
  secretKey: 'temp_secret_key',
  stsToken: 'your_sts_token',
  environment: 'cn',
  logLevel: 'info',
};

const avatarSDK = new AvatarSDK(config);

// 凭证过期前一起刷新
avatarSDK.updateTempAKSK('new_temp_app_key', 'new_temp_secret_key', 'new_sts_token');
```


<span id="lrMtCoIg"></span>
#### Token 刷新说明

对于使用临时 AK/SK + STS Token 或 WSS Token 的场景，凭证具有时效性。为确保后续连接顺利，请在凭证过期前调用对应的更新接口：


* 更新临时 AK/SK + STS：avatarSDK.updateTempAKSK(appKey, secretKey, stsToken)

* 更新 WSS Token：avatarSDK.updateWssToken(wssToken)


更新后的凭证将在下次创建会话时生效，不会影响当前正在进行的会话。

<span id="kT5S5b73"></span>
### 2.2 创建数字人会话

AvatarSession 实例表示一个数字人会话，每个会话对应一个数字人实例。通过 AvatarSDK.createSession() 方法创建会话。

示例代码如下：

```TypeScript
import { AvatarSessionConfig } from '@volcengine/avatar-web-sdk';

const sessionConfig: AvatarSessionConfig = {
  avatarImageUrl: 'https://example.com/avatar.jpg',
  speaker: 'saturn_zh_female_aojiaonvyou_tob',
  userPrompt: '你是一个智能助手',
  speechRate: 0,
  loudnessRate: 0,
  enableWebsearch: false,
  actionList: ['avatar_action_1'],
};

const session = avatarSDK.createSession(sessionConfig);
```


其中，对于音色参数 speaker，可以查询如下文档获取：[音色列表](https://docs.volcengine.com/docs/6561/1257544?lang=zh#%E7%AB%AF%E5%88%B0%E7%AB%AF%E5%AE%9E%E6%97%B6%E8%AF%AD%E9%9F%B3%E5%A4%A7%E6%A8%A1%E5%9E%8B-s2s-o%E7%89%88%E6%9C%AC%E3%80%81sc-2-0%E7%89%88%E6%9C%AC%E3%80%81o-2-0%E7%89%88%E6%9C%AC-%E9%9F%B3%E8%89%B2%E5%88%97%E8%A1%A8)

其中SC 2.0版本和O 2.0版本的音色皆支持。

<span id="WsqIuPjs"></span>
### 2.3 注册会话事件监听

通过事件监听接收会话生命周期及音频事件回调。

示例代码如下：

```TypeScript
session.on('start', () => {
  console.log('会话启动成功');
});

session.on('end', (error) => {
  if (error) {
    console.error('会话异常结束:', error);
  } else {
    console.log('会话正常结束');
  }
});

session.on('audioCaptureStart', () => {
  console.log('音频采集已启动');
});

session.on('audioCaptureStop', () => {
  console.log('音频采集已停止');
});

session.on('audioCaptureFail', (error) => {
  console.error('音频采集失败:', error);
});

session.on('audioFrame', (frame) => {
  console.log('收到音频帧:', frame);
});
```


<span id="oHaL5BNd"></span>
### 2.4 启动数字人会话

会话创建成功后，调用 start() 方法开启会话。

示例代码如下：

```TypeScript
try {
  await session.start();
} catch (error) {
  console.error('启动会话失败:', error);
}
```


<span id="4RClnV2Y"></span>
### 2.5 设置数字人视图

为会话设置渲染视图容器，会话启动成功后调用 setAvatarVideoCanvas() 方法显示数字人视频流。

示例代码如下：

```TypeScript
session.on('start', () => {
  const container = document.getElementById('avatar-container');
  session.setAvatarVideoCanvas(container, 'fit');
});
```


<span id="D4NGMR1O"></span>
### 2.6 语音交互

会话启动成功后，调用 startAudioCapture() 方法开始采集麦克风输入与数字人交互。

示例代码如下：

```TypeScript
session.on('start', () => {
  try {
    await session.startAudioCapture();
  } catch (error) {
    console.error('启动音频采集失败:', error);
  }
});
```


会话期间，可以调用 stopAudioCapture() 方法停止采集，调用 startAudioCapture() 方法重新开始采集。

```TypeScript
// 停止音频采集
await session.stopAudioCapture();

// 重新开始音频采集
await session.startAudioCapture();
```


<span id="rjXss20R"></span>
### 2.7 结束会话

不需要时调用 end() 方法结束会话，释放会话资源。

示例代码如下：

```TypeScript
await session.end();
```


<span id="CsICWhSZ"></span>
## 3. 接口详情

<span id="V7NUJ2Lr"></span>
### 3.1 AvatarSDKConfig (SDK 实例创建配置)

SDK 初始化配置接口。


|**属性** |**类型** |**描述** |**是否必填** |
|---|---|---|---|
|appKey |string |App Key |**必填** |
|secretKey |string |Secret Key |**必填** |
|stsToken |string |STS Token |选填 |
|wssToken |string |WSS Token |选填 |
|logEnabled |boolean |是否启用日志，默认为 true |选填 |
|logLevel |LogLevel |日志级别，默认为 "info" |选填 |
|environment |Environment |环境类型，"cn" 国内环境，默认"cn" |选填 |
|extraDict |Record<string, unknown\> |额外参数 |选填 |


对于采用临时 appKey/secretKey 的场景，stsToken 不能为空。

<span id="TaxW3SSu"></span>
### 3.2 LogLevel (日志级别)

```TypeScript
type LogLevel = "verbose" | "debug" | "info" | "warn" | "error";
```


<span id="4Eu5YwvD"></span>
### 3.3 Environment (环境类型)

```TypeScript
type Environment = "cn";
```


<span id="Mo9rpwaH"></span>
### 3.4 AvatarSDK (SDK 实例)

SDK 的核心管理类。

<span id="RSrfLmxj"></span>
#### 构造函数

```TypeScript
new AvatarSDK(config: AvatarSDKConfig)
```



* **参数**: config \- AvatarSDKConfig 对象。

* **说明**: 最佳实践是在应用程序的生命周期中创建一个实例并将其作为单例使用。初始化后配置对象变为不可变，任何后续修改将不会生效。


<span id="FguknMut"></span>
#### createSession()

通过配置创建数字人会话实例。

```TypeScript
createSession(config: AvatarSessionConfig): AvatarSession
```



* **参数**: config \- AvatarSessionConfig 对象。

* **返回值**: 返回一个初始化的 AvatarSession 实例。


<span id="YzgHHLfw"></span>
### 3.5 AvatarSessionConfig (会话配置)

数字人会话相关的参数配置。

avatarImageUrl 为数字人形象图片的 https URL，推荐的图片比例为 16:9 或者 4:3。speaker 为数字人音色，支持的SC2.0音色。参考[SC2.0音色](https://docs.volcengine.com/docs/6561/1257544?lang=zh#%E7%AB%AF%E5%88%B0%E7%AB%AF%E5%AE%9E%E6%97%B6%E8%AF%AD%E9%9F%B3%E5%A4%A7%E6%A8%A1%E5%9E%8B-s2s-o%E7%89%88%E6%9C%AC%E3%80%81sc-2-0%E7%89%88%E6%9C%AC%E3%80%81o-2-0%E7%89%88%E6%9C%AC-%E9%9F%B3%E8%89%B2%E5%88%97%E8%A1%A8)。


|**属性** |**类型** |**描述** |**是否必填** |
|---|---|---|---|
|avatarImageUrl |string |数字人形象图片 https URL |**必填** |
|speaker |string |发音人标识 |**必填** |
|userPrompt |string |用户提示词 |选填 |
|speechRate |number |输出语音的语速，范围 [\-50, 100]，默认为 0 |选填 |
|loudnessRate |number |输出语音的音量，范围 [\-50, 100]，默认为 0 |选填 |
|enableWebsearch |boolean |是否开启网页搜索，默认为 false |选填 |
|actionList |string[] |数字人循环动作列表，每个元素为动作标识符字符串 |选填 |
|extraParams |Record<string, unknown\> |额外参数字典 |选填 |


<span id="hzq0A4Sm"></span>
#### 支持的动作列表

actionList 支持的动作标识符如下：

```Plain Text
聆听（不说话） - 自然呼吸
聆听（不说话） - 小动作-整理头发
聆听（不说话） - 开心
聆听（不说话） - 惊讶
开场 - 招手
开场 - 双手合十
开场 - 整理仪态
感谢礼物与打赏 - 双手并拢比心
感谢礼物与打赏 - 起立致敬
感谢礼物与打赏 - 双手捂嘴感动
感谢礼物与打赏 - 单手竖起大拇指
感谢礼物与打赏 - 双手竖起大拇指
引导关注与点赞 - 手指上方引导
引导关注与点赞 - 手指下方引导
引导关注与点赞 - 比"1"
情绪调节与氛围 - 比耶（V手势）
情绪调节与氛围 - 单手托下巴
情绪调节与氛围 - 捂嘴笑
情绪调节与氛围 - 嘟嘟嘴
情绪调节与氛围 - 凑近镜头
情绪调节与氛围 - 摸摸头
情绪调节与氛围 - 比出嘘
情绪调节与氛围 - 隔空"飞吻"气流
情绪调节与氛围 - 开心笑
情绪调节与氛围 - 整理衣服
情绪调节与氛围 - 双手欢呼
情绪调节与氛围 - 双手托脸
情绪调节与氛围 - OK 手势
情绪调节与氛围 - 嘘
其他 - 悲伤（低头摇晃）
其他 - 扶额
其他 - 无聊
复位 - 复位
```


<span id="UFWVKXRS"></span>
### 3.6 AvatarSessionState (会话状态)

```TypeScript
type AvatarSessionState = "idle" | "starting" | "started" | "ending" | "ended";
```



|**状态** |**描述** |
|---|---|
|idle |空闲状态，会话尚未启动 |
|starting |会话正在启动中 |
|started |会话已启动，可进行交互 |
|ending |会话正在结束中 |
|ended |会话已结束 |


<span id="VmYar9hy"></span>
### 3.7 RenderMode (渲染模式)

```TypeScript
type RenderMode = "hidden" | "fit" | "fill";
```



|**模式** |**描述** |
|---|---|
|hidden |铺满视图，视频多出部分将被裁剪（默认） |
|fit |视频完全显示，空白部分填充背景色 |
|fill |拉伸视频以铺满视图，可能导致比例改变 |


<span id="vmUOakUB"></span>
### 3.8 AudioFrame (音频帧)

```TypeScript
interface AudioFrame {
  sampleRate: number;  // 采样率
  channel: number;     // 通道数
  samples: number;     // 采样数
  buffer: Uint8Array;  // PCM 音频数据
}
```


<span id="qHTc649H"></span>
### 3.9 AvatarSessionEvents (事件类型)

```TypeScript
interface AvatarSessionEvents {
  start: [];                              // 会话启动成功
  end: [error?: Error];                   // 会话结束
  audioCaptureStart: [];                  // 音频采集启动
  audioCaptureStop: [];                   // 音频采集停止
  audioCaptureFail: [error: Error];       // 音频采集失败
  audioFrame: [frame: AudioFrame];        // 音频帧回调
}
```


<span id="8ilbQcvl"></span>
### 3.10 AvatarSession (会话管理)

管理单个数字人会话的生命周期、渲染和麦克风控制。

<span id="9bm9nEww"></span>
#### 属性


|**属性** |**类型** |**描述** |
|---|---|---|
|state |AvatarSessionState |当前会话状态（只读） |
|localSessionId |string |本地会话标识（只读） |


<span id="2SMaSyDA"></span>
#### start()

启动数字人会话。

```TypeScript
async start(): Promise<void>
```



* **返回值**: Promise，会话启动成功时 resolve。

* **说明**: 如果会话已经处于 starting 或 started 状态，此方法将忽略请求。


<span id="YhJfLfQm"></span>
#### end()

结束数字人会话。

```TypeScript
async end(): Promise<void>
```



* **返回值**: Promise，会话结束时 resolve。

* **说明**: 如果会话已经处于 idle、ending 或 ended 状态，此方法将忽略请求。调用此方法后，会话对象变为无效，不能重新使用。如需启动新会话，需通过 AvatarSDK.createSession() 创建新实例。


<span id="EaVzyXLn"></span>
#### setAvatarVideoCanvas()

设置数字人视频渲染画布。

```TypeScript
setAvatarVideoCanvas(container: HTMLDivElement | null, mode: RenderMode): void
```



* **参数**:

   * container (HTMLDivElement): 用于渲染数字人视频的 DOM 容器。传入 null 取消画布。

   * mode (RenderMode): 渲染模式。

* **说明**: 建议在 start 事件触发后调用此方法。


<span id="Mv8H0imL"></span>
#### startAudioCapture()

启动本地麦克风音频采集。

```TypeScript
async startAudioCapture(): Promise<void>
```



* **返回值**: Promise，音频采集启动成功时 resolve。

* **异常**: 如果会话未启动或音频采集失败，Promise 将 reject。

* **说明**: 音频格式为：单声道、16000Hz 采样率、int16 采样格式、小端字节序。


<span id="IJJ9ByIq"></span>
#### stopAudioCapture()

停止本地麦克风音频采集。

```TypeScript
async stopAudioCapture(): Promise<void>
```



* **返回值**: Promise，音频采集停止成功时 resolve。


<span id="OSze8vSR"></span>
## 4. 错误处理

SDK 使用 AvatarError 类统一处理错误，包含错误码和详细信息。

<span id="lOURoYmG"></span>
### 4.1 AvatarError (错误类)

```TypeScript
class AvatarError extends Error {
  readonly domain: string;           // 错误域
  readonly code: AvatarErrorCode;    // 错误码
  readonly cause?: Error;            // 底层错误
  readonly details?: Record<string, unknown>;  // 详细信息
}
```


<span id="623oTTj8"></span>
### 4.2 错误处理示例

```TypeScript
try {
  await session.start();
} catch (error) {
  if (error instanceof AvatarError) {
    console.error(`错误码: ${error.code}, 消息: ${error.message}`);
    if (error.details) {
      console.error('详细信息:', error.details);
    }
  } else {
    console.error('未知错误:', error);
  }
}
```


<span id="XAoY0kak"></span>
## 5. 示例代码


* avatar\-web\-sdk\-quick\-start\-demo_Volc.zip


<Attachment link="https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a34fd823fbe85621be996f7465215590.zip" name="avatar-web-sdk-quick-start-demo_Volc.zip">avatar-web-sdk-quick-start-demo_Volc.zip</Attachment>



* wss_token_volc.zip


<Attachment link="https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f1ffe6ab993d9438e5deefaaac440edc.zip" name="wss_token_volc.zip">wss_token_volc.zip</Attachment>




