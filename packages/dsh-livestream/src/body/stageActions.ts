/**
 * 舞台动作分发：把"舞台上发生的一件事"（放歌、音效、横幅、进度条、切场景…）打包成舞台事件推给舞台。
 *
 * 舞台动作协议（Stage Action Protocol, v1）：新增功能只在这里加一个动作类型（protocol.ts 的 StageAction），
 * 舞台侧（stage/store.ts 的 onAction）集中处理一次，就不用再改舞台的渲染器。动作是纯增量的——
 * 旧舞台收到不认识的 action.name 会静默跳过，新身体和老舞台可以共存。
 *
 * 用：`new StageActions(show.stage)`（见 runtime.ts），工具或控制台直接调方法 / sendRaw。
 */
import type { Stage } from './stage';
import type { StageAction, AudioChannel } from '../stage/protocol';

/** 协议认识的（能播出去的）动作名；不认识的拒绝，避免把垃圾推给舞台 */
export const KNOWN_ACTIONS = new Set<StageAction['name']>([
  'play_audio',
  'stop_audio',
  'play_video',
  'stop_video',
  'set_scene',
  'play_sfx',
  'show_banner',
  'dismiss_banner',
  'set_progress',
  'clear_progress',
  'set_song',
  'clear_song',
]);

// —— 字段校验小工具：外来的 JSON 什么都有，先洗一遍再上舞台 ——
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
/** 限长：横幅/标题这些上屏的，太长会撑坏布局 */
const slice = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

/**
 * 把外部输入洗成合法动作；不认识的、缺关键字段的返回 null（调用方按"没这个动作"处理）。
 * 只保留协议字段，多余的丢掉。这是身体往外推东西的必经之路。
 */
export function cleanAction(input: unknown): StageAction | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const r = input as Record<string, unknown>;
  const name = str(r.name);
  if (!name || !KNOWN_ACTIONS.has(name as StageAction['name'])) return null;

  switch (name) {
    case 'play_audio': {
      const id = str(r.id);
      const src = str(r.src);
      if (!id || !src) return null;
      const channel = str(r.channel);
      return {
        name: 'play_audio',
        id: slice(id, 64),
        src: slice(src, 1024),
        channel: (channel === 'music' || channel === 'sfx' || channel === 'ambient' ? channel : 'ambient') as AudioChannel,
        title: str(r.title) === undefined ? undefined : slice(str(r.title)!, 64),
        loop: bool(r.loop),
        volume: num(r.volume) === undefined ? undefined : clamp(num(r.volume)!, 0, 1),
        duckOnTalk: bool(r.duckOnTalk),
        from: num(r.from) === undefined ? undefined : Math.max(0, num(r.from)!),
      };
    }
    case 'stop_audio': {
      const id = str(r.id);
      return id ? { name: 'stop_audio', id: slice(id, 64) } : null;
    }
    case 'play_video': {
      const id = str(r.id);
      const title = str(r.title);
      const src = str(r.src);
      const from = num(r.from);
      const until = num(r.until);
      if (!id || !src || from === undefined || until === undefined) return null;
      return { name: 'play_video', id: slice(id, 64), title: title ? slice(title, 80) : '', up: str(r.up) ? slice(str(r.up)!, 40) : '', src: slice(src, 1024), from: Math.max(0, from), until: Math.max(0, until) };
    }
    case 'stop_video': {
      const id = str(r.id);
      return id ? { name: 'stop_video', id: slice(id, 64) } : null;
    }
    case 'set_scene': {
      const scene = str(r.scene);
      if (scene !== 'chat' && scene !== 'video' && scene !== 'game') return null;
      return { name: 'set_scene', scene, label: str(r.label) === undefined ? undefined : slice(str(r.label)!, 32) };
    }
    case 'play_sfx': {
      const src = str(r.src);
      if (!src) return null;
      return { name: 'play_sfx', src: slice(src, 1024), volume: num(r.volume) === undefined ? undefined : clamp(num(r.volume)!, 0, 1) };
    }
    case 'show_banner': {
      const id = str(r.id);
      const title = str(r.title);
      if (!id || !title) return null;
      return { name: 'show_banner', id: slice(id, 64), title: slice(title, 80), text: str(r.text) === undefined ? undefined : slice(str(r.text)!, 160), ms: num(r.ms) === undefined ? undefined : clamp(num(r.ms)!, 300, 600000) };
    }
    case 'dismiss_banner': {
      const id = str(r.id);
      return id ? { name: 'dismiss_banner', id: slice(id, 64) } : null;
    }
    case 'set_progress': {
      const id = str(r.id);
      const value = num(r.value);
      if (!id || value === undefined) return null;
      return { name: 'set_progress', id: slice(id, 64), label: str(r.label) === undefined ? undefined : slice(str(r.label)!, 40), value: Math.max(0, value), total: num(r.total) === undefined ? undefined : Math.max(0, num(r.total)!), ms: num(r.ms) === undefined ? undefined : clamp(num(r.ms)!, 300, 600000) };
    }
    case 'clear_progress': {
      const id = str(r.id);
      return id ? { name: 'clear_progress', id: slice(id, 64) } : null;
    }
    case 'set_song': {
      const id = str(r.id);
      const src = str(r.src);
      const title = str(r.title);
      if (!id || !src || !title) return null;
      return { name: 'set_song', id: slice(id, 64), title: slice(title, 80), ...(str(r.who) === undefined ? {} : { who: slice(str(r.who)!, 32) }), src: slice(src, 1024), ...(num(r.from) === undefined ? {} : { from: Math.max(0, num(r.from)!) }) };
    }
    case 'clear_song': {
      const id = str(r.id);
      return id ? { name: 'clear_song', id: slice(id, 64) } : null;
    }
    default:
      return null;
  }
}

/**
 * 动作分发器：绑一个 Stage，把动作广播成舞台事件（自动带 v/at）。控制台调试面板、以后工具的 play 都走这里。
 */
export class StageActions {
  constructor(private readonly stage: Stage) {}

  /** 把合法动作广播到舞台；不认识的、字段不对的返回 false（不广播） */
  sendRaw(input: unknown): boolean {
    const action = cleanAction(input);
    if (!action) return false;
    this.send(action);
    return true;
  }

  /** 直接广播一个（调用方已确保合法） */
  send(action: StageAction): void {
    this.stage.broadcast({ type: 'action', action });
  }

  playAudio(input: { id: string; src: string; channel?: AudioChannel; title?: string; loop?: boolean; volume?: number; duckOnTalk?: boolean; from?: number }): void {
    this.send({ name: 'play_audio', channel: 'ambient', ...input });
  }

  stopAudio(id: string): void {
    this.send({ name: 'stop_audio', id });
  }

  playVideo(input: { id: string; title: string; up: string; src: string; from: number; until: number }): void {
    this.send({ name: 'play_video', ...input });
  }

  stopVideo(id: string): void {
    this.send({ name: 'stop_video', id });
  }

  setScene(scene: 'chat' | 'video' | 'game', label?: string): void {
    this.send({ name: 'set_scene', scene, label });
  }

  playSfx(src: string, volume?: number): void {
    this.send({ name: 'play_sfx', src, volume });
  }

  showBanner(input: { id: string; title: string; text?: string; ms?: number }): void {
    this.send({ name: 'show_banner', ...input });
  }

  dismissBanner(id: string): void {
    this.send({ name: 'dismiss_banner', id });
  }

  setProgress(input: { id: string; label?: string; value: number; total?: number; ms?: number }): void {
    this.send({ name: 'set_progress', ...input });
  }

  clearProgress(id: string): void {
    this.send({ name: 'clear_progress', id });
  }

  /** 音乐播放器：放一首歌（title 歌名、who 点歌人、src 走 /video 转发、from 从第几秒起） */
  setSong(input: { id: string; title: string; who?: string; src: string; from?: number }): void {
    this.send({ name: 'set_song', ...input });
  }

  clearSong(id: string): void {
    this.send({ name: 'clear_song', id });
  }
}
