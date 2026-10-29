<p align="center">
  <img src="docs/hero.jpg" alt="大肥鱼直播计划" width="100%">
</p>

<h1 align="center">dsh-livestream</h1>

<p align="center">
  <b>DeepSeek Harness 的直播插件：让 DSH 里的 agent 在 B 站直播间当主播。</b><br>
  默认角色是「大肥鱼」。她自己看弹幕、谢礼物、点播视频、给观众写私信，用自己的声音说话。
</p>

<p align="center">
  <a href="LICENSE"><img alt="code: MIT" src="https://img.shields.io/badge/code-MIT-3f7cf0"></a>
  <a href="packages/dsh-livestream/assets/characters/dafeiyu/LICENSE.md"><img alt="大肥鱼素材: CC BY-NC-SA 4.0" src="https://img.shields.io/badge/大肥鱼素材-CC%20BY--NC--SA%204.0-e0763c"></a>
  <img alt="DeepSeek Harness 插件" src="https://img.shields.io/badge/DeepSeek%20Harness-插件-283270">
  <img alt="Bilibili 直播" src="https://img.shields.io/badge/Bilibili-直播-fb7299">
</p>

<p align="center">演示视频：<a href="https://www.bilibili.com/video/BV1xpn66GExn/">《大肥鱼你来B站直播嘛！大肥鱼彩排、Claudia被记仇？》</a>（B 站）</p>

---

## 本仓库说明（Fork 二开）

> **本仓库是从上游 fork 出来做二次开发的版本，非原版。**

- 上游原版：[`luckui/dsh-livestream`](https://github.com/luckui/dsh-livestream)
- 本仓库：[`zjingwang/dsh-livestream`](https://github.com/zjingwang/dsh-livestream)
- 当前状态：在保持上游"大脑/身体分离、DSH 插件、B 站直播"核心架构不变的前提下，聚焦 B 站单平台体验与功能扩展（AI 主播"更像真人"方向：点歌系统、记忆回旋镖、情绪状态机、舞台动作协议等），多平台（抖音/快手）扩展暂缓。
- 代码许可沿用上游 MIT；角色素材（大肥鱼）许可不变，见下文[许可](#许可)。
- 改动请遵循 [AGENTS.md](AGENTS.md) 的仓库规范与提交约定。

---

## Roadmap

聚焦 B 站单平台、让 AI 主播"更像真人"的改进计划与进度：

- 📋 完整详情（涉及模块/依赖/验收标准）：[docs/ROADMAP.md](docs/ROADMAP.md)
- 🗂 进度看板（GitHub Projects）：https://github.com/users/zjingwang/projects/2

> 状态：✅ 已完成 · 🚧 进行中 · 📅 计划

| 优先级 | 改进项 | 状态 | 预计完成 |
|---|---|---|---|
| P0 | 舞台动作协议（Stage Action Protocol） | 🚧 进行中 | 2026-11-07 |
| P0 | 点歌系统（点歌队列 + 音乐播放器） | 📅 计划 | 2026-11-21 |
| P0 | 打断策略（控场节奏） | 📅 计划 | 2026-11-14 |
| P1 | 事件记忆回旋镖 | 📅 计划 | 2026-11-28 |
| P1 | 情绪状态机 | 📅 计划 | 2026-12-05 |
| P1 | 可控的不完美（口误/没听清） | 📅 计划 | 2026-12-05 |
| P1 | 事故圆场（OBS/推流状态感知） | 📅 计划 | 2026-12-12 |
| P2 | 音效/氛围音 | 📅 计划 | 2026-12-19 |
| P2 | BGM 与场景切换 | 📅 计划 | 2027-01-09 |
| P2 | 伪连麦 | 📅 计划 | 2027-01-23 |
| P2 | 弹幕小游戏/抽奖竞猜 | 📅 计划 | 2027-02（评估）|

> 每完成一项，把上面和 ROADMAP 里的状态改为 ✅，进度即可在此一眼可见。

---

## 是真的在直播

<p align="center"><img src="docs/live-proof.jpg" alt="左边本机 DSH 里的她，右边 B 站直播间里的她" width="100%"></p>

左边是本机 DSH 控制台里的她，右边是 B 站直播间里观众看到的她：同一个她，B 站那边晚几秒。插件调 B 站开播接口、驱动本机 OBS 推流，弹幕和礼物从 B 站直播间的消息服务实时收进来。

## 她会做什么

<table>
<tr>
<td width="38%" align="center"><img src="docs/expressions.gif" alt="边说话边换表情" width="100%"></td>
<td>

**自己的声音、自己的表情**
豆包语音合成，字幕按发音一个字一个字亮；她在话里写个 `[shocked]`、`[shy]`，念到那里就换表情。换表情时挑姿势最像的那一帧切，不叠影。

**接住直播间里的事**
弹幕、礼物、SC、上舰、进场、关注，插件按轻重缓急一件一件交给她，她自己决定怎么回。人多的时候先回舰长和老粉，冷场了她会自己找话说。

**记得人**
这一场和以前来过的观众、他们说过的话，她都记得；常来的人会被认出来。

</td>
</tr>
</table>

<table>
<tr>
<td width="50%"><img src="docs/video.jpg" alt="在直播间里放 B 站视频" width="100%"></td>
<td width="50%"><img src="docs/ending.jpg" alt="下播谢幕" width="100%"></td>
</tr>
<tr>
<td><b>点播视频</b>：观众想看什么，她自己去 B 站搜、在直播间里放，她说话时视频自动调小声；还能看主页、写私信。每次用工具，舞台终端里都记一行「调用 …」，观众看得到她做了什么。</td>
<td><b>开播和下播</b>：控制台一键开播，下播前她先道别，舞台出谢幕画面（播了多久、几条弹幕、吃了几粒米、谢谢的人）。右上角的饭碗是这场用掉的 token 换算成的米饭。</td>
</tr>
</table>

## 控制台

<p align="center"><img src="docs/console.jpg" alt="DSH 里的直播控制台" width="100%"></p>

在 DSH 侧边栏打开「直播」：看舞台预览、换皮肤、开播下播、跟她说话、模拟观众（不开播也能彩排）。

## 需要

- DeepSeek Harness（网页版）
- OBS Studio 30 以上（开 WebSocket）
- B 站账号的 cookie（开播需要实名认证过的账号）
- 豆包语音（火山引擎）的 API Key / App ID / Access Key

## 安装（开发方式）

插件未发布到 npm，两种本地安装方式任选其一。

### 方式一：本地打包（tgz）安装（推荐）

```bash
pnpm install
pnpm -C packages/dsh-livestream build     # 生成 lib/
pnpm -C packages/dsh-livestream pack      # 生成 packages/dsh-livestream/dsh-livestream-0.0.1.tgz
```

把生成的 tgz 装进 DSH 的 web profile（`file:` 指向本仓库内的绝对路径，把 `<本仓库路径>` 换成你自己的）：

```bash
dsh plugin --profile web add file:<本仓库路径>/packages/dsh-livestream/dsh-livestream-0.0.1.tgz
```

`dsh plugin` 会自动把 `dsh-livestream` 登记进 profile 的 `dsh.profile.bundles` 并写入依赖，随后**重启 DSH**，侧边栏出现「直播」面板。

> 说明：tgz 是快照拷贝。每次改代码后要重新 `build` → `pack` → `add`。
> 想免打包、边改边生效，可改用 `file:<本仓库路径>/packages/dsh-livestream`（目录符号链接），改代码只需重新 `build` + 重启 DSH。

### 方式二：手动链接 node_modules（上游原方式）

```bash
pnpm install
pnpm -C packages/dsh-livestream build
ln -s <本仓库路径>/packages/dsh-livestream $DSH_HOME/profiles/web/node_modules/dsh-livestream
```

手动链接不会自动登记，需在 `$DSH_HOME/profiles/web/package.json` 里手动补两处：
1. `dependencies` 增加 `"dsh-livestream": "file:<本仓库路径>/packages/dsh-livestream"`
2. `dsh.profile.bundles` 增加 `"dsh-livestream"`

然后 `pnpm install` 同步 lockfile，重启 DSH。这种方式容易漏登记，不推荐，与方式一不要混用。

### 卸载

```bash
dsh plugin --profile web remove dsh-livestream
```

（会自动清掉依赖与 bundles 登记，重启 DSH 后「直播」面板消失。）

### 密钥与环境

密钥写在 DSH 主目录的 `.env`：

```
BILIBILI_COOKIE=...
DOUBAO_TTS_API_KEY=...
DOUBAO_TTS_APP_ID=...
DOUBAO_TTS_ACCESS_KEY=...
```

然后在 DSH 侧边栏打开「直播」：填房间号，选「本地彩排」或「推流到 B 站」，开播。

> ⚠️ 密钥、cookie、推流码等一律只放 DSH 主目录 `.env`（已被 gitignore 忽略），**不要写进仓库**。提交前按 [AGENTS.md](AGENTS.md) 检查工作区，避免泄露敏感信息。

## 许可

- **代码**：MIT（见 [`LICENSE`](LICENSE)）。
- **大肥鱼的动画片段**（`packages/dsh-livestream/assets/characters/dafeiyu/`）：CC BY-NC-SA 4.0，是社区作品的衍生作品，署名和来源见那个目录里的 [`LICENSE.md`](packages/dsh-livestream/assets/characters/dafeiyu/LICENSE.md)。只能非商业使用；商业用途请自备角色素材，或向原作者申请许可。
- `docs/` 里的截图来自演示视频的录制，其中 B 站视频的画面做了模糊处理。
