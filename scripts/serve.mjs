// 本地服务：列表实时扫描、支持在页面里录视频
//   node scripts/serve.mjs [--port 5178] [--no-claude] [--no-open] [--root 名字=路径]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, resolveRoots, scan, version } from './lib/scan.mjs';
import { record } from './lib/recorder.mjs';
import { translate, detectBackend } from './lib/translate.mjs';

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? +argv[portArg + 1] : 5178;
const roots = resolveRoots(argv);
const OUT = path.join(ROOT, 'output');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('请求太大')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

let recording = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/skills') return send(res, 200, scan(roots));
    if (url.pathname === '/api/version') return send(res, 200, version(roots), 'text/plain; charset=utf-8');
    if (url.pathname === '/api/translate' && req.method === 'GET') {
      const be = await detectBackend();
      return send(res, 200, { backend: be ? be.name : null });
    }
    if (url.pathname === '/api/translate' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      try {
        const map = await translate(body.target, Array.isArray(body.items) ? body.items.slice(0, 500) : [], !!body.markdown);
        return send(res, 200, { ok: true, map });
      } catch (e) {
        console.error('翻译失败：' + e.message);
        return send(res, 200, { ok: false, error: e.message });
      }
    }
    if (url.pathname === '/api/record' && req.method === 'POST') {
      if (recording) return send(res, 409, { ok: false, error: '上一个视频还在录' });
      recording = true;
      try {
        const body = JSON.parse(await readBody(req));
        const name = String(body.name || 'skill').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);
        fs.mkdirSync(path.join(OUT, '.tmp'), { recursive: true });
        const page = path.join(OUT, '.tmp', name + '.html');
        fs.writeFileSync(page, String(body.html || ''));
        const file = path.join(OUT, name + '.mp4');
        const r = await record({ url: `http://127.0.0.1:${PORT}/output/.tmp/${encodeURIComponent(name)}.html?record=1`, out: file, seconds: body.seconds || null, log: m => console.log(m) });
        console.log('视频完成：' + path.relative(ROOT, file));
        return send(res, 200, { ok: true, file: path.relative(ROOT, file).replace(/\\/g, '/'), url: '/output/' + encodeURIComponent(name) + '.mp4', seconds: r.seconds });
      } finally { recording = false; }
    }
    // 静态文件，只允许项目目录内
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.resolve(ROOT, '.' + p);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, 'forbidden', 'text/plain');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const langArg = argv.indexOf('--lang');
  const link = `http://localhost:${PORT}/` + (langArg >= 0 && argv[langArg + 1] ? `?lang=${encodeURIComponent(argv[langArg + 1])}` : '');
  const n = scan(roots).skills.length;
  console.log(`SkillLens 已启动：${link}`);
  console.log(`当前扫描到 ${n} 个 skill；来源：${roots.filter(r => fs.existsSync(r.dir)).map(r => r.label).join('、')}`);
  console.log('改了 SKILL.md 刷新页面就能看到。按 Ctrl+C 退出。');
  if (!argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : process.platform === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* 手动打开即可 */ }
  }
});
