import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StageServer } from '../src/body/server';
import type { Packs } from '../src/body/packs';
import type { Stage } from '../src/body/stage';

// 舞台服务器的测试音：真实起一个服务、发请求验证（调试面板的「音效/音频」按钮就是拿它试听）
const PORT = 18373;
const TOKEN = 'tone-test-token';

let dir: string;
let server: StageServer;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-live-tone-'));
  server = new StageServer({
    port: PORT,
    token: TOKEN,
    packageDir: dir,
    packs: {} as Packs,
    stage: {} as Stage,
    current: () => ({ character: '', template: '' }),
  });
  await server.start();
});

afterAll(() => {
  server.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe('舞台服务器测试音', () => {
  it('toneUrl 是带 token 的 /tone.wav 地址', () => {
    expect(server.toneUrl).toBe(`http://127.0.0.1:${PORT}/tone.wav?token=${TOKEN}`);
  });

  it('GET /tone.wav 返回合法 WAV：RIFF/WAVE 头、audio/wav、长度对上', async () => {
    const res = await fetch(server.toneUrl);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/wav');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(Number(res.headers.get('content-length')));
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    expect(buf.readUInt32LE(40)).toBe(buf.length - 44); // data 段长度
    expect(buf.length).toBeGreaterThan(44); // 真有几秒采样，不是空文件
  });

  it('token 不对给 401', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/tone.wav?token=wrong`);
    expect(res.status).toBe(401);
  });
});
