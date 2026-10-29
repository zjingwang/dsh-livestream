import { describe, expect, it } from 'vitest';
import { cleanAction, KNOWN_ACTIONS, StageActions } from '../src/body/stageActions';
import { Stage } from '../src/body/stage';
import type { StageEvent } from '../src/stage/protocol';

describe('cleanAction（外部输入 → 合法动作）', () => {
  it('收下完整、合法的动作，去掉多余的字段', () => {
    expect(cleanAction({ name: 'play_audio', id: 'a1', src: 'http://x/1.wav', channel: 'music', title: '歌', loop: true, volume: 0.7, duckOnTalk: true, from: 3, extra: 1 }))
      .toEqual({ name: 'play_audio', id: 'a1', src: 'http://x/1.wav', channel: 'music', title: '歌', loop: true, volume: 0.7, duckOnTalk: true, from: 3 });
  });

  it('play_audio 没给 channel 或给了不认识的 → 按 ambient 处理', () => {
    expect(cleanAction({ name: 'play_audio', id: 'a1', src: 'http://x/1.wav' })?.channel).toBe('ambient');
    expect(cleanAction({ name: 'play_audio', id: 'a1', src: 'http://x/1.wav', channel: 'weird' })?.channel).toBe('ambient');
  });

  it('音量夹在 0~1，进度/时间不小于 0', () => {
    expect(cleanAction({ name: 'play_audio', id: 'a', src: 's', volume: 9 })).toMatchObject({ volume: 1 });
    expect(cleanAction({ name: 'play_audio', id: 'a', src: 's', volume: -2 })).toMatchObject({ volume: 0 });
    expect(cleanAction({ name: 'play_sfx', src: 's', volume: 3 })).toMatchObject({ volume: 1 });
  });

  it('play_video / set_progress 各字段齐全才收', () => {
    const video = cleanAction({ name: 'play_video', id: 'v1', title: '标题', up: 'UP', src: 'http://x/1.mp4', from: 0, until: 100 });
    expect(video).toMatchObject({ name: 'play_video', id: 'v1', title: '标题', src: 'http://x/1.mp4', from: 0, until: 100 });
    expect(cleanAction({ name: 'play_video', id: 'v1', title: '标题', src: 's', until: 100 })).toBeNull(); // 缺 from
    expect(cleanAction({ name: 'set_progress', id: 'p', label: '点歌', value: 2, total: 5 })).toMatchObject({ value: 2, total: 5 });
    expect(cleanAction({ name: 'set_progress', id: 'p', value: 2 })).toMatchObject({ total: undefined });
    expect(cleanAction({ name: 'set_progress', id: 'p' })).toBeNull(); // 缺 value
  });

  it('set_scene 只认三种场景', () => {
    expect(cleanAction({ name: 'set_scene', scene: 'game' })).toMatchObject({ scene: 'game' });
    expect(cleanAction({ name: 'set_scene', scene: 'party' })).toBeNull();
  });

  it('show_banner / stop / dismiss / clear 缺 id 不收', () => {
    expect(cleanAction({ name: 'show_banner', id: 'b', title: '欢迎' })).toMatchObject({ title: '欢迎' });
    expect(cleanAction({ name: 'show_banner', title: '欢迎' })).toBeNull();
    expect(cleanAction({ name: 'stop_audio', id: 'a' })).toEqual({ name: 'stop_audio', id: 'a' });
    expect(cleanAction({ name: 'dismiss_banner' })).toBeNull();
    expect(cleanAction({ name: 'clear_progress', id: 'p' })).toEqual({ name: 'clear_progress', id: 'p' });
  });

  it('不认识的、缺名字的、不是对象的都拒绝', () => {
    expect(cleanAction({ name: 'fly' })).toBeNull();
    expect(cleanAction({})).toBeNull();
    expect(cleanAction(null)).toBeNull();
    expect(cleanAction('play_sfx')).toBeNull();
    expect(cleanAction(['play_sfx'])).toBeNull();
  });

  it('白名单和协议里的动作名一致', () => {
    for (const action of [
      { name: 'play_audio', id: 'a', src: 's' }, { name: 'stop_audio', id: 'a' },
      { name: 'play_video', id: 'v', title: 't', up: 'u', src: 's', from: 0, until: 1 }, { name: 'stop_video', id: 'v' },
      { name: 'set_scene', scene: 'chat' }, { name: 'play_sfx', src: 's' },
      { name: 'show_banner', id: 'b', title: 't' }, { name: 'dismiss_banner', id: 'b' },
      { name: 'set_progress', id: 'p', value: 1 }, { name: 'clear_progress', id: 'p' },
    ]) {
      expect(KNOWN_ACTIONS.has(action.name as never), action.name).toBe(true);
      expect(cleanAction(action)).not.toBeNull();
    }
  });
});

describe('StageActions（动作分发 → 舞台事件）', () => {
  function capture() {
    const stage = new Stage();
    const got: StageEvent[] = [];
    stage.subscribe((e) => got.push(e));
    return { actions: new StageActions(stage), got };
  }

  it('send 发出带 v/at 的 action 事件，动作原样带上', () => {
    const { actions, got } = capture();
    actions.playSfx('http://127.0.0.1/tone.wav', 0.5);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ v: 1, type: 'action', action: { name: 'play_sfx', src: 'http://127.0.0.1/tone.wav', volume: 0.5 } });
    expect(typeof (got[0] as { at?: unknown }).at).toBe('number');
  });

  it('几个便捷方法发对动作', () => {
    const { actions, got } = capture();
    actions.playAudio({ id: 'bgm', src: 'http://x/b.wav', channel: 'music', loop: true, duckOnTalk: true });
    actions.setScene('video', '放视频');
    actions.showBanner({ id: 'b1', title: '欢迎', ms: 6000 });
    actions.setProgress({ id: 'p1', label: '点歌', value: 2, total: 5 });
    actions.playVideo({ id: 'v1', title: '标题', up: 'UP', src: 'http://x/v.mp4', from: 0, until: 10 });
    expect(got.map((e) => (e as { action?: { name: string } }).action?.name)).toEqual(['play_audio', 'set_scene', 'show_banner', 'set_progress', 'play_video']);
    expect(got[0]).toMatchObject({ action: { name: 'play_audio', channel: 'music', loop: true, duckOnTalk: true } });
    expect(got[1]).toMatchObject({ action: { name: 'set_scene', scene: 'video', label: '放视频' } });
  });

  it('sendRaw：合法的广播、非法的忽略且不广播', () => {
    const { actions, got } = capture();
    expect(actions.sendRaw({ name: 'play_sfx', src: 'http://x/s.wav' })).toBe(true);
    expect(actions.sendRaw({ name: 'nope' })).toBe(false);
    expect(got).toHaveLength(1);
  });
});
