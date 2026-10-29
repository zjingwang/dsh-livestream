import { describe, expect, it } from 'vitest';
import { SongPlayer } from '../src/body/songPlayer';
import { Stage } from '../src/body/stage';
import type { StageEvent } from '../src/stage/protocol';

function capture() {
  const stage = new Stage();
  const got: StageEvent[] = [];
  stage.subscribe((e) => got.push(e));
  return { player: new SongPlayer(stage), got };
}

describe('SongPlayer（音乐播放器）', () => {
  it('play 广播 set_song，src 走 /video?id= 转发', () => {
    const { player, got } = capture();
    const song = player.play({ bvid: 'BV1xx', title: '晴天', who: '晚风', url: 'https://upos/audio.m4a' });
    expect(got).toHaveLength(1);
    const action = (got[0] as { action?: Record<string, unknown> }).action ?? {};
    expect(got[0].type).toBe('action');
    expect(action.name).toBe('set_song');
    expect(action.src).toBe(`/video?id=${song.id}`);
    expect(action.title).toBe('晴天');
    expect(action.who).toBe('晚风');
    expect(player.current).toBe(song);
    expect(song.id.startsWith('song:')).toBe(true);
  });

  it('没人点的歌不写 who', () => {
    const { player, got } = capture();
    player.play({ bvid: 'BV1xx', title: '纯音乐', url: 'u' });
    const action = (got[0] as { action?: Record<string, unknown> }).action ?? {};
    expect(action.who).toBeUndefined();
  });

  it('source(id) 只认正在放的那首', () => {
    const { player } = capture();
    const song = player.play({ bvid: 'BV1xx', title: 'a', url: 'u1' });
    expect(player.source(song.id)).toBe('u1');
    expect(player.source('song:other')).toBeNull();
  });

  it('stop 广播 clear_song 并收起来', () => {
    const { player, got } = capture();
    const song = player.play({ bvid: 'BV1xx', title: 'a', url: 'u1' });
    const stopped = player.stop();
    expect(stopped?.id).toBe(song.id);
    expect(got).toHaveLength(2);
    expect(got[1]).toMatchObject({ type: 'action', action: { name: 'clear_song', id: song.id } });
    expect(player.current).toBeNull();
    expect(player.source(song.id)).toBeNull();
  });

  it('再放一首把上一首换掉', () => {
    const { player, got } = capture();
    const first = player.play({ bvid: 'BV1', title: 'a', url: 'u1' });
    const second = player.play({ bvid: 'BV2', title: 'b', url: 'u2' });
    expect(player.current?.id).toBe(second.id);
    expect(got).toHaveLength(2);
    expect(got[1]).toMatchObject({ action: { name: 'set_song', id: second.id } });
    expect(player.source(first.id)).toBeNull();
    expect(player.source(second.id)).toBe('u2');
  });

  it('没在放的时候 stop 返 null 不广播', () => {
    const { player, got } = capture();
    expect(player.stop()).toBeNull();
    expect(got).toHaveLength(0);
  });
});
