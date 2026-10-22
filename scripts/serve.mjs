// 本地服务：列表实时扫描、在页面里录视频、下载官方 skill 库、在网上搜 skill
//   node scripts/serve.mjs [--port 5178] [--no-open] [--project-only] [--no-agents] [--no-workspace] [--no-official] [--no-catalog] [--workspace 目录] [--root 名字=路径]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, resolveRoots, scan, version, summarize } from './lib/scan.mjs';
import { fetchOfficial, officialStatus, search, fetchSkill } from './lib/online.mjs';
import { record } from './lib/recorder.mjs';
import { translate, detectBackend, generateTestCase, getAllCachedTestCases, probeOllama, markForeground, msSinceForeground } from './lib/translate.mjs';
import { analyze, jobState } from './lib/aiflow.mjs';
import { explain, explainAvailable } from './lib/explain.mjs';

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? +argv[portArg + 1] : 5178;
const roots = resolveRoots(argv);
const OUT = path.join(ROOT, 'output');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8' };

function send(res, code, body, type) {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) return res.destroy();
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('请求太大'), { status: 413 })); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('客户端已断开')));
  });
}

/* 扫描结果按版本号缓存：文件没变就不重扫（一千多个 skill 扫一遍要一秒多） */
let cache = { v: null, data: null };
function skillsNow() {
  const v = version(roots);
  if (cache.v !== v) cache = { v, data: scan(roots) };
  return cache.data;
}

let recording = false;
let fetching = null;
const server = http.createServer(async (req, res) => {
  try {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return send(res, 400, { ok: false, error: '无效的请求地址' }); }
    if (url.pathname === '/api/skills') return send(res, 200, skillsNow());
    if (url.pathname === '/api/version') return send(res, 200, version(roots), 'text/plain; charset=utf-8');
    // npm run stop 用它确认端口上确实是 SkillLens，再结束这个进程
    if (url.pathname === '/api/pid' && req.method === 'GET') return send(res, 200, { app: 'skilllens', pid: process.pid });
    if (url.pathname === '/api/aiflow' && req.method === 'GET') {
      return send(res, 200, jobState(url.searchParams.get('key')) || { state: 'none' });
    }
    if (url.pathname === '/api/aiflow' && req.method === 'POST') {
      let body;
      try { body = JSON.parse(await readBody(req, 1024 * 1024)); }
      catch (e) { return send(res, e.status || 400, { error: e.status === 413 ? 'body-too-large' : 'invalid-json' }); }
      if (!body || typeof body.text !== 'string' || !body.text.trim()) return send(res, 400, { error: 'missing-text' });
      try {
        return send(res, 200, await analyze({ id: String(body.id || ''), name: String(body.name || ''), text: body.text }, { force: body.force === true, peek: body.peek === true }));
      } catch (e) { return send(res, e.status || 500, { error: e.status === 503 ? 'no-llm' : 'aiflow-failed' }); }
    }
    // 通俗讲解：一层图一次请求；没有大模型时返回 503，页面退回普通翻译
    if (url.pathname === '/api/explain' && req.method === 'GET') return send(res, 200, explainAvailable());
    if (url.pathname === '/api/explain' && req.method === 'POST') {
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });
      let body;
      try { body = JSON.parse(await readBody(req, 2 * 1024 * 1024)); }
      catch (e) { return send(res, e.status || 400, { error: e.status === 413 ? 'body-too-large' : 'invalid-json' }); }
      try {
        return send(res, 200, { ok: true, ...(await explain(body, { signal: ac.signal })) });
      } catch (e) {
        if (e.aborted) return;
        if (e.status === 503) return send(res, 503, { error: 'no-llm' });
        if (e.status === 400) return send(res, 400, { error: 'bad-request' });
        console.error('讲解失败：' + e.message);
        return send(res, 500, { error: 'explain-failed' });
      }
    }
    if (url.pathname === '/api/ollama' && req.method === 'GET') {
      const ol = await probeOllama(true);
      return send(res, 200, { ok: !!ol, ollama: ol ? { url: ol.url, model: ol.model } : null });
    }
    if (url.pathname === '/api/testcase' && req.method === 'GET') {
      return send(res, 200, { ok: true, map: getAllCachedTestCases() });
    }
    if (url.pathname === '/api/testcase' && req.method === 'POST') {
      markForeground();
      const body = JSON.parse(await readBody(req));
      try {
        const tc = await generateTestCase(body, 'high');
        return send(res, 200, { ok: true, tc });
      } catch (e) {
        return send(res, 200, { ok: false, error: e.message });
      }
    }
    if (url.pathname === '/api/translate' && req.method === 'GET') {
      const be = await detectBackend();
      return send(res, 200, { backend: be ? be.name : null });
    }
    if (url.pathname === '/api/translate' && req.method === 'POST') {
      markForeground();
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });
      const body = JSON.parse(await readBody(req));
      try {
        const result = await translate(body.target, Array.isArray(body.items) ? body.items.slice(0, 500) : body.items, !!body.markdown, 'high', ac.signal);
        return send(res, 200, { ok: true, ...result });
      } catch (e) {
        console.error('翻译失败：' + e.message);
        return send(res, 200, { ok: false, error: e.message });
      }
    }
    if (url.pathname === '/api/online/official' && req.method === 'GET') return send(res, 200, { libs: officialStatus(), busy: !!fetching });
    if (url.pathname === '/api/online/official' && req.method === 'POST') {
      // 下载官方库：anthropics/skills、openai/skills、anthropics/claude-plugins-official
      fetching = fetching || fetchOfficial(m => console.log('官方库 ' + m)).finally(() => { fetching = null; });
      const results = await fetching;
      cache.v = null;
      return send(res, 200, { ok: results.some(r => r.ok), results, libs: officialStatus() });
    }
    if (url.pathname === '/api/online/search') {
      try { return send(res, 200, { ok: true, items: await search(url.searchParams.get('q')) }); }
      catch (e) { return send(res, 200, { ok: false, error: e.message }); }
    }
    if (url.pathname === '/api/online/skill') {
      const q = url.searchParams;
      try { return send(res, 200, Object.assign({ ok: true }, await fetchSkill({ repo: q.get('repo'), name: q.get('name'), path: q.get('path') || null }))); }
      catch (e) { return send(res, 200, { ok: false, error: e.message }); }
    }
    if (url.pathname === '/api/record' && req.method === 'POST') {
      if (recording) return send(res, 409, { ok: false, error: '上一个视频还在录' });
      recording = true;
      try {
        const body = JSON.parse(await readBody(req));
        if (body.seconds != null && (typeof body.seconds !== 'number' || !Number.isFinite(body.seconds))) {
          return send(res, 400, { ok: false, error: 'seconds 必须是有限数字或 null' });
        }
        const seconds = body.seconds == null ? null : Math.max(1, Math.min(90, body.seconds));
        const name = String(body.name || 'skill').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);
        fs.mkdirSync(path.join(OUT, '.tmp'), { recursive: true });
        const page = path.join(OUT, '.tmp', name + '.html');
        fs.writeFileSync(page, String(body.html || ''));
        const file = path.join(OUT, name + '.mp4');
        const motion = body.motion === 'flat' || body.motion === 'minimal' ? 'flat' : '3d';
        const r = await record({ url: `http://127.0.0.1:${PORT}/output/.tmp/${encodeURIComponent(name)}.html?record=1&motion=${motion}`, out: file, seconds, log: m => console.log(m) });
        console.log('视频完成：' + path.relative(ROOT, file));
        return send(res, 200, { ok: true, file: path.relative(ROOT, file).replace(/\\/g, '/'), url: '/output/' + encodeURIComponent(name) + '.mp4', seconds: r.seconds });
      } finally { recording = false; }
    }
    // 静态资源白名单，隐藏目录仅放行录制临时页
    let p, rawPath;
    try {
      p = decodeURIComponent(url.pathname);
      rawPath = decodeURIComponent(req.url.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0]);
    } catch { return send(res, 400, 'bad path', 'text/plain'); }
    const parts = rawPath.split('/').filter(Boolean);
    if (rawPath.includes('\\') || parts.some((s, i) => s.startsWith('.') && !(s === '.tmp' && i === 1 && parts[0] === 'output'))) {
      return send(res, 404, 'not found', 'text/plain');
    }
    if (p === '/') p = '/index.html';
    const file = path.resolve(ROOT, '.' + p);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, 'forbidden', 'text/plain');
    if (!(p === '/index.html' || /^\/(src|docs|output)\//.test(p) || /^\/data\/(skills|translations|testcases)\.js$/.test(p))) {
      return send(res, 404, 'not found', 'text/plain');
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found', 'text/plain');
    const stream = fs.createReadStream(file);
    stream.on('error', e => {
      if (res.headersSent) res.destroy();
      else send(res, e.code === 'ENOENT' ? 404 : 500, 'read failed', 'text/plain');
    });
    res.on('close', () => stream.destroy());
    stream.on('open', () => {
      if (res.destroyed) return stream.destroy();
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      stream.pipe(res);
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, error: e.message });
  }
});

// 页面常复用连接，等大模型的几十秒里别让服务端先把空闲连接关了
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

server.on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  const link = `http://localhost:${PORT}/`;
  console.log(`端口 ${PORT} 已被占用，SkillLens 可能已在运行：${link}`);
  console.log(`如需另开一个，请用 --port 指定其他端口，例如：node scripts/serve.mjs --port ${PORT + 1}`);
  if (!argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : process.platform === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* 手动打开即可 */ }
  }
  process.exit(0);
});

server.listen(PORT, '127.0.0.1', async () => {
  const langArg = argv.indexOf('--lang');
  const link = `http://localhost:${PORT}/` + (langArg >= 0 && argv[langArg + 1] ? `?lang=${encodeURIComponent(argv[langArg + 1])}` : '');
  const data = skillsNow();
  console.log(`SkillLens 已启动：${link}`);
  console.log(`当前扫描到 ${data.skills.length} 个 skill：`);
  for (const line of summarize(data)) console.log('  ' + line);
  const be = await detectBackend();
  if (be) console.log(`局域网大模型已就绪：${be.name}（单路并发队列）`);
  console.log('改了 SKILL.md 刷新页面就能看到。按 Ctrl+C 退出。');
  if (!argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : process.platform === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* 手动打开即可 */ }
  }
  // 后台低优单路预热本机技能的「最简测试用例 + 使用前后对比」
  if (be && be.ollama && !argv.includes('--no-warm')) {
    (async () => {
      const tcMap = getAllCachedTestCases();
      const localSkills = data.skills.filter(s => s.kind !== 'catalog' && s.kind !== 'official' && s.groupKey !== 'market');
      const seen = new Set();
      for (const s of localSkills) {
        const k = String(s.name || '').toLowerCase();
        if (!k || seen.has(k) || (tcMap[k] && tcMap[k].input)) continue;
        seen.add(k);
        try {
          while (msSinceForeground() < 20000) {
            await new Promise(r => setTimeout(r, 20000 - msSinceForeground()));
          }
          await generateTestCase(s, 'low');
          await new Promise(r => setTimeout(r, 600));
        } catch { break; }
      }
    })();
  }
});
