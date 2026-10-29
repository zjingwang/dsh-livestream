/**
 * 舞台动作事件流的渲染：播放中的音频（play_audio）、一次性音效（play_sfx）、横幅（banner）、进度条（progress）。
 * 状态都在 store（state.audio / sfx / banners / progress），这里只负责把状态变成真东西：
 *   音频 → HTMLAudioElement（music 通道在她开口时自动降音量）
 *   音效 → 一次性 new Audio，放完由 store 撤掉
 *   横幅/进度 → 纯样式，store 定时自动撤
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dropSfx, getState, mediaUrl, subscribe } from './store';

/** 她开口时，声明了 duckOnTalk 的 music 通道降到这个音量（听歌时也能听清她说话） */
export const DUCK_LEVEL = 0.35;

const useStage = () => useSyncExternalStore(subscribe, getState);

/** 音频总线：只认「现在该放谁」。play_audio 来了就建一个元素放，stop_audio 停掉、同 id 不重复启动 */
export function AudioBus() {
  const { audio, sfx, line } = useStage();
  const players = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    for (const item of Object.values(audio)) {
      const existing = players.current.get(item.id);
      if (existing) {
        if (existing.paused) void existing.play().catch(() => {});
        continue;
      }
      const el = new Audio();
      el.loop = item.loop ?? false;
      el.volume = (item.volume ?? 1) * (item.duckOnTalk && line ? DUCK_LEVEL : 1);
      const setFrom = () => {
        if (item.from) el.currentTime = item.from;
      };
      el.addEventListener('loadedmetadata', setFrom, { once: true });
      el.src = item.src;
      players.current.set(item.id, el);
      void el.play().catch(() => {});
    }
    // stop_audio / 舞台上撤掉了：把不再播的元素真正停下来（光从 state 里删掉，声音还会一直响）
    for (const [id, el] of [...players.current]) {
      if (audio[id]) continue;
      el.pause();
      el.removeAttribute('src');
      el.load();
      players.current.delete(id);
    }
  }, [audio, line]);

  // 她开口了：music 通道、声明了 duckOnTalk 的降音量；说完恢复（改 line 时就调，不用等 audio 变）
  useEffect(() => {
    for (const item of Object.values(audio)) {
      if (!item.duckOnTalk) continue;
      const el = players.current.get(item.id);
      if (el) el.volume = (item.volume ?? 1) * (line ? DUCK_LEVEL : 1);
    }
  }, [line, audio]);

  // 一次性音效（play_sfx）：放完（或放不出来）就撤掉。同一 key 只启动一次——
  // dropSfx 会让 sfx 数组变化、effect 重跑，没有去重的话第二条音效会被重复放
  const launchedSfx = useRef(new Set<string>());
  useEffect(() => {
    const active = new Set(sfx.map((s) => s.key));
    for (const item of sfx) {
      if (launchedSfx.current.has(item.key)) continue;
      launchedSfx.current.add(item.key);
      const el = new Audio();
      el.volume = item.volume ?? 1;
      const done = () => dropSfx(item.key);
      el.onended = done;
      el.onerror = done;
      el.src = item.src;
      void el.play().catch(done);
    }
    for (const key of [...launchedSfx.current]) if (!active.has(key)) launchedSfx.current.delete(key);
  }, [sfx]);

  return null;
}

/** 横幅：title 大字 + text 小字，从右上角往下摞；ms 到点由 store 自动撤 */
export function Banners() {
  const { banners } = useStage();
  const list = Object.values(banners);
  if (!list.length) return null;
  return (
    <div className="ls-banners">
      {list.map((b) => (
        <div key={b.id} className="ls-banner">
          <div className="ls-banner-title">{b.title}</div>
          {b.text ? <div className="ls-banner-text">{b.text}</div> : null}
        </div>
      ))}
    </div>
  );
}

/** 进度条：label + 进度（value/total，没 total 就当 0~1）；ms 到点由 store 自动撤 */
export function Progress() {
  const { progress } = useStage();
  const list = Object.values(progress);
  if (!list.length) return null;
  return (
    <div className="ls-progress-wrap">
      {list.map((p) => {
        const ratio = p.total ? Math.min(1, Math.max(0, p.value / p.total)) : Math.min(1, Math.max(0, p.value));
        return (
          <div key={p.id} className="ls-progress">
            {p.label ? <span className="ls-progress-label">{p.label}</span> : null}
            <span className="ls-progress-track"><span className="ls-progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
            <span className="ls-progress-value">{p.total ? `${p.value}/${p.total}` : `${Math.round(ratio * 100)}%`}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 音乐播放器：舞台正在放的歌（set_song/clear_song）。自己持有一个 <audio>（src 走 /video 转发），
 * 进度条跟着播放位置走；她开口时整首歌降音量（听歌时也能听清她说话）。
 */
export function MusicPlayer() {
  const { song, line } = useStage();
  const el = useRef<HTMLAudioElement | null>(null);
  const [pos, setPos] = useState({ t: 0, d: 0 });

  useEffect(() => {
    if (!song) {
      if (el.current) {
        el.current.pause();
        el.current.removeAttribute('src');
        el.current.load();
      }
      return;
    }
    const audio = el.current ?? new Audio();
    el.current = audio;
    const onTime = () => setPos({ t: audio.currentTime || 0, d: audio.duration || 0 });
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onTime);
    audio.volume = line ? DUCK_LEVEL : 1;
    audio.src = mediaUrl(song.src);
    if (song.from) audio.currentTime = song.from;
    void audio.play().catch(() => {});
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onTime);
    };
  }, [song?.id, song?.src]);

  // 她开口了：整首歌降音量；说完恢复
  useEffect(() => {
    if (el.current) el.current.volume = line ? DUCK_LEVEL : 1;
  }, [line]);

  if (!song) return null;
  const pct = pos.d > 0 ? Math.min(100, Math.max(0, (pos.t / pos.d) * 100)) : 0;
  return (
    <div className="ls-music">
      <div className="ls-music-disc">♪</div>
      <div className="ls-music-body">
        <div className="ls-music-title">{song.title}{song.who ? <span className="ls-music-who"> · {song.who} 点</span> : null}</div>
        <div className="ls-music-track"><div className="ls-music-fill" style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}
