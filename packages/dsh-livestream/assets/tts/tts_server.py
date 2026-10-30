# -*- coding: utf-8 -*-
"""本地 TTS 服务（可扩展）：模型清单驱动，支持下载/删除模型、切换模型+音色、合成。

和 dsh-livestream 插件的「本地语音」引擎配套：
  - 插件只在设置里填 ttsUrl，合成时调 /tts；模型管理（下载/删除）调 /models 接口
  - 模型文件下载到 --dir（默认 DSH 的数据目录 tts-models/），不随插件打包
  - 要加新模型：改 tts_models.json 加一条（指向 sherpa-onnx 官方 release 的下载地址即可）

用法：
  python tts_server.py [--dir 模型根目录] [--manifest 清单路径] [--port 7491]

零额外依赖（标准库 + sherpa_onnx）。
"""
import argparse, http.server, urllib.parse, wave, io, threading, time, os, array, json, tarfile, shutil, urllib.request
import sherpa_onnx

# ---- 启动参数 ----
ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.path.dirname(os.path.abspath(__file__)), help='模型根目录（模型解压到这里）')
ap.add_argument('--manifest', default=None, help='模型清单 JSON 路径（默认 --dir/../tts_models.json 同目录）')
ap.add_argument('--port', type=int, default=7491)
ap.add_argument('--host', default='127.0.0.1')
args = ap.parse_args()

BASE = os.path.abspath(args.dir)
MANIFEST_FILE = os.path.abspath(args.manifest) if args.manifest else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tts_models.json')
os.makedirs(BASE, exist_ok=True)
os.chdir(BASE)

# ---- 模型清单 ----
def load_manifest():
    with open(MANIFEST_FILE, encoding='utf-8') as f:
        return json.load(f)['models']

MANIFEST = load_manifest()
_cache, _cache_lock = {}, threading.Lock()
SYNTH_LOCK = threading.Lock()
DL = {}  # mid -> {status, error}

def model_installed(m):
    key = m['config'].get('model') or m['config'].get('acoustic_model')
    return bool(key) and os.path.exists(os.path.join(BASE, key))

def load(m):
    if m['id'] in _cache:
        return _cache[m['id']]
    with _cache_lock:
        if m['id'] in _cache:
            return _cache[m['id']]
        mc = sherpa_onnx.OfflineTtsModelConfig(num_threads=4)
        if m['kind'] == 'vits':
            mc.vits = sherpa_onnx.OfflineTtsVitsModelConfig(**m['config'])
        elif m['kind'] == 'matcha':
            mc.matcha = sherpa_onnx.OfflineTtsMatchaModelConfig(**m['config'])
        else:
            raise ValueError('未知模型类型: ' + m['kind'])
        tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=mc, rule_fsts=','.join(m['rule'])))
        _cache[m['id']] = tts
        return tts

def download_model(m):
    if m['id'] in DL and DL[m['id']]['status'] == 'downloading':
        return False
    def work():
        DL[m['id']] = {'status': 'downloading'}
        try:
            arc = os.path.join(BASE, m['archive'])
            req = urllib.request.Request(m['url'], headers={'User-Agent': 'Mozilla/5.0 dsh-tts'})
            with urllib.request.urlopen(req, timeout=60) as r, open(arc, 'wb') as f:
                shutil.copyfileobj(r, f)
            with tarfile.open(arc, 'r:bz2') as t:
                t.extractall(BASE)
            DL[m['id']] = {'status': 'done'}
        except Exception as e:
            DL[m['id']] = {'status': 'error', 'error': str(e)[:200]}
    threading.Thread(target=work, daemon=True).start()
    return True

def delete_model(m):
    with _cache_lock:
        _cache.pop(m['id'], None)
    d = os.path.join(BASE, m['dir'])
    if os.path.isdir(d):
        shutil.rmtree(d)
    arc = os.path.join(BASE, m['archive'])
    if os.path.exists(arc):
        os.remove(arc)

def speak(m, text, sid):
    tts = load(m)
    sid = max(0, min(tts.num_speakers - 1, sid))
    t0 = time.time()
    with SYNTH_LOCK:
        g = tts.generate(text, sid=sid, speed=1.0)
    samples, sr = g.samples, g.sample_rate
    buf = io.BytesIO()
    w = wave.open(buf, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(array.array('h', (int(max(-1.0, min(1.0, s)) * 32767) for s in samples)).tobytes())
    w.close()
    return buf.getvalue(), round((time.time() - t0) * 1000)

# ---- HTTP ----
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def _ok(self, ctype, body):
        self.send_response(200); self._cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def _err(self, code, msg):
        body = str(msg).encode('utf-8')[:300]
        self.send_response(code); self._cors()
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/health':
            self._ok('application/json', b'{"ok":true}'); return
        if u.path == '/models':
            out = []
            for m in MANIFEST:
                out.append({'id': m['id'], 'name': m['name'], 'installed': model_installed(m),
                            'speakers': m['speakers'], 'size_mb': m['size_mb'],
                            'downloading': DL.get(m['id'], {}).get('status') == 'downloading',
                            'error': DL.get(m['id'], {}).get('error', '')})
            self._ok('application/json', json.dumps(out, ensure_ascii=False).encode('utf-8')); return
        if u.path == '/count':
            m = next((x for x in MANIFEST if x['id'] == q.get('model', [''])[0]), None)
            if not m:
                self._err(400, 'bad model'); return
            try:
                self._ok('application/json', json.dumps({'count': load(m).num_speakers}).encode()); return
            except Exception as e:
                self._err(500, e); return
        if u.path == '/tts':
            m = next((x for x in MANIFEST if x['id'] == q.get('model', [''])[0]), None)
            text = (q.get('text', [''])[0] or '').strip()[:300]
            sid = int(q.get('sid', ['0'])[0])
            if not m or not text:
                self._err(400, 'model or text missing'); return
            try:
                body, ms = speak(m, text, sid)
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('X-Synth-Ms', str(ms))
                self.send_header('Content-Length', str(len(body)))
                self.end_headers(); self.wfile.write(body); return
            except Exception as e:
                self._err(500, e); return
        self._err(404, 'not found')
    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        mid = q.get('id', [''])[0]
        m = next((x for x in MANIFEST if x['id'] == mid), None)
        if u.path == '/models/download' and m:
            ok = download_model(m)
            self.send_response(200 if ok else 409); self._cors(); self.end_headers(); return
        if u.path == '/models/delete' and m:
            delete_model(m); DL.pop(m['id'], None)
            self.send_response(200); self._cors(); self.end_headers(); return
        self._err(404, 'not found')

if __name__ == '__main__':
    http.server.ThreadingHTTPServer((args.host, args.port), H).serve_forever()
