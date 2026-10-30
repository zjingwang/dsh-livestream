# OBS 推流问题修复：编码被写死 + 与直播姬抢推流

> 分支：`fix/obs-stream-bugs` ｜ 对应 GitHub Issue：#（见本文件末尾链接）
> 本文按代码逐行定位根因，说明为什么会出现这两个现象，以及这次改了什么。

---

## 现象（主播实测反馈）

1. **编码被写死、每次都覆盖 OBS 配置**
   插件一开播，OBS 的编码就被强制改成 NVENC H.264 + CBR 4500kbps 那一套，自己在 OBS 里调好的编码/码率被冲掉。

2. **和直播姬互相打架**
   - 直播姬（B 站官方推流客户端）开着播的时候，插件再点开播，OBS 推流 1~2 秒断一次、重连一次，反复不停；
   - 直播姬关掉的时候，插件点开播，被 B 站拒了，报 60043。

---

## 根因分析（按代码）

### 问题一：编码写死 + 覆盖配置

定位 `packages/dsh-livestream/src/body/obs.ts` 的 `prepareObs()`（旧版）。

旧代码每次开播（以及点「检查 OBS」）都无条件执行：

```ts
// 旧代码：每次无条件强制
['Output', 'Mode', 'Advanced'],                                  // 强制高级模式
['AdvOut', 'Encoder', 'obs_nvenc_h264_tex'],                     // 强制 NVENC
['AdvOut', 'Track1Bitrate', '192'],
['Audio', 'SampleRate', '48000'], ['Audio', 'ChannelSetup', 'Stereo'],
// 并且每次把固定编码参数写进 streamEncoder.json
writeFileSync(streamEncoder.json, JSON.stringify({ ...STREAM_ENCODER, bitrate: kbps }))
```

- `STREAM_ENCODER` 是写死的 NVENC 参数表，`streamEncoder.json` 每次都被覆写成同一份；
- 用户即使在 OBS 的「dsh-livestream」配置文件里把编码改成 x264 或调过码率，下次一开播又被覆盖回去；
- 写文件后还会做一次「切到别的配置再切回来」让 OBS 重读，如果当时正在推流，这种配置切换还可能干扰正在进行的输出。

**结论：编码不是"配置项"，而是被硬编码成 NVENC，且每次运行都强制覆盖。** 这就是"编码方式写死、每次覆盖 OBS 配置"的代码来源。

### 问题二 a：直播姬开着时 OBS 反复断连重连

链路：`broadcast/start` → `Broadcast.run()` → `BiliRoom.start()` 拿推流地址 → `startStreaming()` 让 OBS 推流。

- 直播姬已经在推同一路直播间时，B 站同一路直播间**只接受一个推流源**；
- OBS 再推，RTMP 被 B 站顶掉/拒绝，OBS 这边又配了：
  ```ts
  ['Output', 'Reconnect', 'true'],   // 断线自动重连
  ['Output', 'RetryDelay', '2'],     // 每 2 秒重连一次
  ['Output', 'MaxRetries', '25'],
  ```
  于是 OBS 推上 → 被顶 → 2 秒重连 → 再被顶，正好是"1~2 秒一次、反复断开重连"。

**结论：问题不在推流参数，而是没有在开播前检查"直播间是不是已经在直播"，直接把两个推流源怼到了一起。**

### 问题二 b：直播姬关掉时开播被拒 60043

- 插件开播走的是 `room/v1/Room/startLive`，用直播姬的 appkey/appsec 签名（`biliRoom.ts` 的 `livehimeSign`，和社区 StartLive 同款做法）；
- B 站对"没在官方客户端验证过的账号/设备"会回 **60043 风控验证**（代码里 `biliRoom.ts:204` 映射成 `kind: 'verify'`）；
- 旧代码直接抛错，只给一句话"用官方直播姬或 B 站 App 开播一次"，没有讲清楚前置条件，也没有提示"如果直播姬还开着会抢推流"。

**结论：60043 是 B 站服务端风控，代码层面无法绕过（伪造浏览器指纹属于 ToS 红线，不做）。** 能改进的是：把"必须先过官方客户端验证"和"过验证期间别让直播姬和 OBS 同时推"讲清楚，并补上重连兜底检测。

---

## 修复内容

### 1. 编码不再写死、不覆盖用户配置（`obs.ts`）

新增设置 **`obsEncoder`**（`'keep' | 'nvenc' | 'x264'`，默认 `keep`）：

- **`keep`（默认）**：`prepareObs` 完全不碰 `AdvOut.Encoder`、不写 `streamEncoder.json`、不动 `Mode/音质`，编码/码率/音质全按你在 OBS 里给「dsh-livestream」配置文件设的来，插件只负责把推流地址填进去并开始推流；
- **`nvenc` / `x264`**：恢复插件管编码（1080p30、CBR、关键帧 2 秒），`streamEncoder.json` 按所选编码写入对应的参数表（NVENC 的 P6/hq/qres 等，x264 的 veryfast/zerolatency）。
- 推流可靠性参数（断线重连、动态码率、服务设置）与画布 1080p30 仍由插件保证——舞台本来就是按 1080p 做的。

### 2. 开播前检查直播间状态，防止和直播姬抢推流（`broadcast.ts`）

在 `Broadcast.run()` 拿到房间号后、真正调开播接口前：

```ts
if ((await room.liveStatus(roomId)) === 1)
  throw '直播间已经在直播（直播姬或另一个 OBS 还开着？）：同一路直播间只能有一个推流源，先关掉直播姬 / 停掉别的推流，再点开播';
```

查询失败（网络抖动）时不拦，继续开播；真的撞上由下面的重连检测兜底。

### 3. OBS 重连检测兜底（`obs.ts` `startStreaming`）

推流 20 秒窗口内，一旦 `GetStreamStatus` 返回 `outputReconnecting=true`（推上过又被断开、一直在重连），直接报"被 B 站反复断开重连，多半是直播姬还开着"，不再让它无限循环重连。

### 4. 60043 提示更清楚（`broadcast.ts`）

错误信息改为：要先在官方客户端过验证（直播姬或 B 站 App 开播一次、出画面后关掉），再回来点开播。

### 5. 控制台加编码选择（`console.tsx` / `runtime.ts` / `index.ts`）

「推流到 B 站」设置里新增编码下拉：**编码跟随 OBS 现有设置（不覆盖）/ NVENC H.264（插件管）/ x264（插件管）**，并更新说明文字。

---

## 使用说明（主播）

- 想要"我 OBS 里设什么就是什么"：编码选 **跟随 OBS 现有设置**，去 OBS 里把「dsh-livestream」配置文件的编码/码率调好即可，插件不会动它；
- 想要插件一键管画质：编码选 **NVENC（N 卡）或 x264（CPU）**；
- **开播前一定先关掉直播姬**（或停掉其他推流）。如果直播间已经在播，插件会直接提示，不会再出现 1~2 秒反复断连；
- 如果报 60043：用官方直播姬/B 站 App 用同一账号开播一次（出画面后关掉），再回插件点开播。

---

## 遗留 / 边界

- 60043 是 B 站账号级风控，必须先在官方客户端过验证，代码无法绕过（也不应绕过）；
- 画布仍固定 1080p30（舞台按 1080p 设计）；`keep` 模式下只不覆盖"编码/码率/音质"，画布分辨率仍由插件保证，如需改画布请提 issue；
- 直播状态查询用 `room/v1/Room/get_info` 的 `live_status`，查不到时放行并依赖重连检测兜底。
