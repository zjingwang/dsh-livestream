/**
 * 舞台上放歌（观众点的/她自放的）：同一时间只放一首。用 set_song/clear_song 动作让舞台音乐播放器组件播。
 *
 * B 站音频的地址是 CDN 的、要带 Referer：舞台页不直接连，走舞台服务器转一道（/video?id=…，见 Player.source）。
 * 这里 broadcast 的 src 是相对路径，舞台页自己拼 host + token（mediaUrl）。
 */

import { randomUUID } from 'node:crypto';
import type { Stage } from './stage';

export interface SongRequest {
  bvid: string;
  title: string;
  /** 点这首歌的观众（点歌栏显示） */
  who?: string;
  /** B 站 CDN 上的音频地址（audioUrl 拿到的 m4a） */
  url: string;
  /** 从第几秒开始放 */
  from?: number;
}

export interface SongPlaying extends SongRequest {
  id: string;
  startedAt: number;
}

export class SongPlayer {
  private song: SongPlaying | null = null;

  constructor(private readonly stage: Stage) {}

  get current(): SongPlaying | null {
    return this.song;
  }

  /** 换到这首歌（正在放的直接换掉，不算放完） */
  play(request: SongRequest): SongPlaying {
    const song: SongPlaying = { ...request, id: `song:${randomUUID()}`, startedAt: Date.now() };
    this.song = song;
    this.stage.broadcast({
      type: 'action',
      action: {
        name: 'set_song',
        id: song.id,
        title: song.title,
        ...(song.who ? { who: song.who } : {}),
        src: `/video?id=${song.id}`,
        ...(song.from ? { from: song.from } : {}),
      },
    });
    return song;
  }

  /** 她让停的：音乐播放器收起来 */
  stop(): SongPlaying | null {
    const song = this.song;
    if (!song) return null;
    this.song = null;
    this.stage.broadcast({ type: 'action', action: { name: 'clear_song', id: song.id } });
    return song;
  }

  /** 舞台服务器转发音频时问：这个 id 现在对应哪个地址 */
  source(id: string): string | null {
    return this.song?.id === id ? this.song.url : null;
  }
}
