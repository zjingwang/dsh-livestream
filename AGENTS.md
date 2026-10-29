# AGENTS.md — dsh-livestream 二开仓库规范

> 本文件约束**所有**对 `dsh-livestream` 仓库的改动，包括人类开发者与 AI agent。提交代码前务必通读并遵守。

## 仓库定位

- 上游：https://github.com/luckui/dsh-livestream（本仓库为 fork 二开版，见 README「本仓库说明」）。
- 定位：DeepSeek Harness（DSH）的 **Cordis bundle 插件**，让 DSH 里的 agent 在 B 站直播间当 AI 主播（弹幕/礼物/SC 互动、TTS 念话、舞台渲染、OBS 推流）。
- 二开方向：**聚焦 B 站单平台**，把 AI 主播做得"更像真人"（点歌系统、记忆回旋镖、情绪状态机、舞台动作协议等）。多平台（抖音/快手）已暂缓。
- 默认角色「大肥鱼」素材是 **CC BY-NC-SA 4.0**（非商业授权）：**不要修改/替换** `packages/dsh-livestream/assets/characters/` 下的素材与其 `LICENSE.md`；商业用途需自备角色素材。

## 目录结构与架构约定

```
packages/dsh-livestream/
  src/
    core/                 # 平台无关的核心：live.ts（LiveEvent/LivePlatform 抽象）、hub.ts（事件中枢）、
    core/attention/       #   attention.ts 注意力层（打分取舍）、memory/（观众记忆库 SQLite + 下播提炼）
    core/platforms/       #   平台适配器（目前仅 bilibili/：biliSource/biliProtocol/biliDecode…）
    body/                 # 直播"身体"：show.ts（LiveShow 导演/节奏/say）、tts、stage server、obs、broadcast
    dsh/                  # DSH 集成：index.ts（宿主插件入口/路由）、agent.ts（agent 子插件/工具）、packs
    console/              # DSH 侧边栏「直播」控制台（React）
    stage/                # 舞台页（浏览器端渲染，OBS 浏览器源）
  stage/                  # 舞台页静态资源
  assets/                 # 角色素材（勿动）
  test/                   # vitest 单测（*test.ts）
  build.mjs               # esbuild 打包：lib/index.js + lib/agent.js + lib/client.js + lib/stage.js
  cordis.patch.yml        # DSH bundle 组合层（根插件 + agent 预设）
```

- **大脑/身体分离**：`core/` 是平台无关的"大脑与事件模型"，`body/` 是"身体与平台执行"。新功能优先放 `core/`（平台无关逻辑），只有真正平台相关才进 `body/` 或 `core/platforms/<平台>/`。
- **事件模型**：所有直播间事件都归一化成 `core/live.ts` 的 `LiveEvent`，解码层（如 `biliDecode.ts`）负责平台 cmd → LiveEvent；不要在 body 层散落平台原始格式。
- **依赖纪律**：插件运行时**零外部依赖**（`dependencies` 为空），一切用 esbuild 打进 `lib/`；`@deepseek-ai/*` 与 `react` 只作 devDependencies，由 DSH 运行时/网页外壳提供。**不要给运行时加 npm 依赖**，确需引入请先与维护者讨论。
- **构建产物不入库**：`lib/` 已被 `.gitignore` 忽略，改源码后由 CI / 本地 `build` 生成。

## 常用命令（仓库根目录）

```bash
pnpm install                          # 安装工作区依赖
pnpm -C packages/dsh-livestream build # esbuild 打包（生成 lib/）
pnpm -C packages/dsh-livestream check # tsc 类型检查（--noEmit）
pnpm -C packages/dsh-livestream test  # vitest 单测
pnpm -C packages/dsh-livestream pack  # 打 tgz，配合 dsh plugin add 本地安装
```

提交前必须保证：`check` 通过、`test` 通过；改动运行时代码时 `build` 通过。

## 代码风格

- TypeScript **strict**，ESM，target ES2023，模块解析 Bundler。
- 命名：文件/变量小驼峰，类名大驼峰；测试文件 `*.test.ts` 与被测文件同目录。
- 中文注释为主（本项目惯例）；对外 README 用中文。
- 保持小步提交，一次提交一个逻辑改动。

## 提交规范（Conventional Commits）

仓库已用 **husky + commitlint**（`@commitlint/config-conventional`，即 Angular 规范）强制校验提交信息，格式：

```
<type>(<scope>): <subject>
```

- **type**：`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `style` / `revert`
- **scope**（可选）：`core` / `body` / `attention` / `memory` / `bili` / `dsh` / `console` / `stage` / `docs` / `ci` / `deps`
- **subject**：祈使句、小写开头（英文）或简洁中文均可，不要句号结尾。
- 示例：`feat(body): 新增点歌队列与切歌/顶歌`、`fix(bili): 礼物连击合并时错误计入 valueYuan`、`docs: 补充本地安装说明`。

> husky 钩子在 `.husky/`，commitlint 配置在 `commitlint.config.mjs`。若改动绕过钩子（如 CI、脚本），提交人仍需自觉遵守本规范。提交人为**本人 + agent**

## ⚠️ 敏感信息红线（提交前必查）

**每次提交前，检查工作区与本次 diff，严禁把以下内容带进仓库（含提交历史）：**

- 任何密钥/令牌/密码：B 站 cookie、豆包 TTS 的 API Key / App ID / Access Key、OpenAI/DeepSeek 等 API key、`github token`、`.npmrc` 里的 `_authToken`
- `.env` / `.dev.env` 内容（已被 gitignore，确认从未被 `git add`）
- 个人敏感信息：真实姓名、**公司/内部邮箱、内部用户名/工号**、内网 IP/域名、内部系统路径
- 未打码的账号 cookie 串、二维码里的登录态
- 私密对话/日志内容

自查命令（提交前执行）：

```bash
git status --short                    # 确认没有误加文件
git diff --cached --stat              # 确认本次提交内容
git diff --cached | grep -nE "(BILIBILI_COOKIE|DOUBAO_TTS|api[_-]?key|secret|token|cookie|@company|password)" -i   # 扫敏感关键字
```

发现任何一条命中：**不要提交**，把文件从暂存区移除（`git restore --staged <file>`）并修改后再提交。

## CI / Release

- `.github/workflows/ci.yml`：push/PR 时跑 install → typecheck → test → build。
- `.github/workflows/release.yml`：打 `v*` tag 时构建并打 tgz 附到 GitHub Release；仅当仓库配置了 `NPM_TOKEN` secret 时才 `npm publish`。
- 版本号遵循 semver；release 由 tag 触发，不要手动在 CI 外发布。

## 提交前 checklist（适用于所有提交）

1. `pnpm -C packages/dsh-livestream check && pnpm -C packages/dsh-livestream test` 通过；
2. `git diff` 自查，确认无敏感信息（见上红线）；
3. 确认没有把 `lib/`、`node_modules/`、`.env` 等忽略文件加进去；
4. 提交信息符合 Conventional Commits 规范；
5. 未修改 `assets/characters/` 素材及其许可文件。
