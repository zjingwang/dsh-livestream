/**
 * 本地 TTS（独立服务）：dsh-livestream 只当 HTTP 客户端，模型由 assets/tts/tts_server.py 管。
 *
 *   - 设置 ttsEngine='local' 时，speech() 走这里：调 /tts 拿 wav
 *   - 模型下载/删除/列表走 /models（控制台也能直接调，这里留同样的口）
 *   - 服务没启动：ttsPython 填了带 sherpa_onnx 的 Python 就自动拉起（python …/tts_server.py
 *     --dir <dataDir>/tts-models --port …），没填就只探测：不通返回 null，她安静（只出字幕）
 *   - 本地合成没有逐字时间戳：timeline 给空，舞台按字数估算字幕节奏
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

export interface LocalTtsOptions {
  /** 服务地址，如 http://127.0.0.1:7491 */
  url: () => string;
  /** 用的模型 id（清单里的 id，如 melo） */
  model: () => string;
  /** 说话人 sid */
  sid: () => number;
  /** 装了 sherpa_onnx 的 Python；空串表示服务手动启动、插件不拉起 */
  python: () => string;
  /** tts_server.py 的路径 */
  script: string;
  /** tts_models.json 的路径 */
  manifest: string;
  /** 模型放哪（<dataDir>/tts-models） */
  modelsDir: string;
  log: (level: 'info' | 'warn', message: string) => void;
}

export interface LocalModelInfo {
  id: string;
  name: string;
  installed: boolean;
  speakers: string[];
  size_mb: number;
  downloading: boolean;
  error?: string;
}

export class LocalTts {
  private child: ChildProcess | null = null;
  private started = false;
  /** 主动 close() 关掉的：exit 时不再当异常报 */
  private closing = false;
  /** 最近一次探测到的可用性 + 时间（3 秒内不重复探测） */
  private reachable: boolean | null = null;
  private reachAt = 0;

  constructor(private readonly options: LocalTtsOptions) {
    // 模型目录（modelsDir）由服务自己建（tts_server.py 启动时 os.makedirs），插件不预先创建
  }

  private get port(): number {
    try {
      return Number(new URL(this.options.url()).port) || 7491;
    } catch {
      return 7491;
    }
  }

  /** 探测服务在不在（结果缓存 3 秒） */
  async ping(): Promise<boolean> {
    if (this.reachable !== null && Date.now() - this.reachAt < 3000) return this.reachable;
    try {
      const res = await fetch(`${this.options.url()}/health`, { signal: AbortSignal.timeout(1500) });
      this.reachable = res.ok;
    } catch {
      this.reachable = false;
    }
    this.reachAt = Date.now();
    return this.reachable;
  }

  /** 确保服务在跑：探测不通、且配了 Python 就自己拉起；拉不起来返回 false */
  async ensure(): Promise<boolean> {
    if (await this.ping()) return true;
    if (this.started || !this.options.python().trim()) return false;
    const python = this.options.python().trim();
    const port = this.port;
    this.started = true;
    this.options.log('info', `本地 TTS 服务没在跑，用 ${python} 拉起来（端口 ${port}）`);
    this.child = spawn(python, [this.options.script, '--dir', this.options.modelsDir, '--manifest', this.options.manifest, '--port', String(port)], { stdio: 'ignore' });
    this.child.on('exit', (code) => {
      this.started = false;
      this.reachable = null;
      if (!this.closing && code !== 0) this.options.log('warn', `本地 TTS 服务退出（码 ${code}）：模型没装齐或 sherpa_onnx 没装？`);
    });
    // 等它就绪（最多 30 秒：第一次要加载模型、下不了就 404 也算起来）
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (await this.ping()) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    this.options.log('warn', '本地 TTS 服务 30 秒内没就绪');
    return false;
  }

  /** 合成一句：返回 wav 音频（无逐字时间戳）。不通/失败返回 null */
  async synthesize(text: string): Promise<{ audio: Uint8Array; timeline: Array<{ chars: number; atMs: number }> } | null> {
    if (!(await this.ensure())) return null;
    const url = `${this.options.url()}/tts?model=${encodeURIComponent(this.options.model())}&sid=${this.options.sid()}&text=${encodeURIComponent(text)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) {
        this.options.log('warn', `本地 TTS 合成失败（HTTP ${res.status}）：${(await res.text()).slice(0, 120)}`);
        return null;
      }
      return { audio: new Uint8Array(await res.arrayBuffer()), timeline: [] };
    } catch (err) {
      this.options.log('warn', `本地 TTS 合成出错：${(err as Error).message}`);
      this.reachable = null;
      return null;
    }
  }

  /** 模型清单（含是否已安装） */
  async models(): Promise<LocalModelInfo[]> {
    if (!(await this.ping())) return [];
    try {
      const res = await fetch(`${this.options.url()}/models`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      return (await res.json()) as LocalModelInfo[];
    } catch {
      return [];
    }
  }

  /** 下载模型（后台解压完 installed 变 true） */
  async download(id: string): Promise<boolean> {
    if (!(await this.ping())) return false;
    try {
      const res = await fetch(`${this.options.url()}/models/download?id=${encodeURIComponent(id)}`, { method: 'POST', signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** 删除模型 */
  async remove(id: string): Promise<boolean> {
    if (!(await this.ping())) return false;
    try {
      const res = await fetch(`${this.options.url()}/models/delete?id=${encodeURIComponent(id)}`, { method: 'POST', signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** 说话人数（多说话人、没名字的模型用） */
  async count(id: string): Promise<number> {
    if (!(await this.ping())) return 0;
    try {
      const res = await fetch(`${this.options.url()}/count?model=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return 0;
      const d = (await res.json()) as { count?: number };
      return d.count ?? 0;
    } catch {
      return 0;
    }
  }

  /** 插件卸载时把拉起来的服务关掉 */
  close(): void {
    this.closing = true;
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.started = false;
    this.reachable = null;
  }
}

/** 默认模型：清单里标了 default 的那个（melo），或第一个 */
export const DEFAULT_TTS_MODEL = 'melo';
