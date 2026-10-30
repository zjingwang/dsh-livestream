# 本地 TTS（独立服务，可扩展模型）

不想用（或欠费）豆包云语音时，可以在本机跑一个独立的 TTS 服务，插件只当 HTTP 客户端：
模型由服务单独加载、常驻内存，**换模型、重启插件都不重新加载**，省启动时间和内存。

- 服务：`assets/tts/tts_server.py`（零外部依赖 + sherpa_onnx）
- 模型清单：`assets/tts/tts_models.json`（加模型改这一个文件）
- 模型文件：下载到 DSH 数据目录的 `tts-models/`，不随插件打包
- 控制台「设置 → 本地语音」：切引擎、选模型/音色、下载/删除模型、一键启动服务

## 装环境（一次性）

需要一个带 sherpa-onnx 的 Python（CPU 就行，AMD 核显笔记本也跑得动）：

```bash
python3 -m venv tts-venv
tts-venv/bin/python -m pip install sherpa-onnx
```

## 用起来（两条路任选）

**A. 让插件自动拉起（推荐）**：控制台「本地语音」里把上面的 Python 路径填到「装了
sherpa_onnx 的 python 路径」，插件检测到服务没跑就自己拉起来，不用手动开。

**B. 手动起服务**：

```bash
tts-venv/bin/python assets/tts/tts_server.py --port 7491
```

然后控制台「本地语音」把引擎切成「本地」，等服务显示「运行中」，选模型和音色。

## 模型哪来的

控制台模型列表里，没装的点「下载」即装即用（从 sherpa-onnx 官方 release 拉）。内置模型：

| id | 说明 | 采样率 | 合成速度（稳态） | 音质 |
|---|---|---|---|---|
| `melo`（默认） | MeloTTS 女声 | 44.1kHz | ×1.6 | 最佳 |
| `zh-ll` | LL 五音色（素影雪等） | 16kHz | ×1.6 | 一般 |
| `matcha` | Matcha 女声 | 22kHz | ×6.4（最快） | 干净 |
| `aishell3` | 174 个音色 | 8kHz | ×4.6 | 差（电话音） |
| `bronya` / `abyssinvoker` | 角色音 | 22kHz | ×1.7 | 角色 |

要更多模型：在 `assets/tts/tts_models.json` 里加一条，指向 sherpa-onnx release 的
`tar.bz2`。**坑**：每个包解压出的 onnx 文件名不一样（如 `bronya.onnx`、`abyssinvoker.onnx`），
`config.model` 要填实际文件名。

## 服务接口（以后别的程序也能用）

- `GET /models` 模型列表（含是否已安装、下载中）
- `POST /models/download?id=` / `POST /models/delete?id=` 装/删模型
- `GET /count?model=` 说话人数
- `GET /tts?model=&sid=&text=` 合成 → wav（`X-Synth-Ms` 头给合成耗时）
- `GET /health` 存活探测

开了 `--host 0.0.0.0` 后局域网内其它机器也能调（跨域已放开）。默认只听 127.0.0.1。
