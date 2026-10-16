// 不依赖第三方包，直接用 DevTools 协议驱动本机 Chrome / Edge（无头）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function findChrome() {
  const env = process.env.SV_CHROME || process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const cands = process.platform === 'win32' ? [
    path.join(process.env['ProgramFiles'] || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles'] || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  const hit = cands.find(p => p && fs.existsSync(p));
  if (!hit) throw new Error('找不到 Chrome / Edge，可以用环境变量 SV_CHROME 指定浏览器路径');
  return hit;
}

export async function launch(opts = {}) {
  const exe = opts.chrome || findChrome();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-chrome-'));
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--allow-file-access-from-files', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    'about:blank',
  ], { stdio: 'ignore' });
  const portFile = path.join(dir, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 200 && !port; i++) {
    await sleep(100);
    try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() || null; } catch { /* 还没写出来 */ }
  }
  if (!port) { proc.kill(); throw new Error('浏览器没有启动调试端口'); }
  let page = null;
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch { await sleep(100); }
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === msg.method) { waiters[i].resolve(msg.params); waiters.splice(i, 1); }
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = method => new Promise(resolve => waiters.push({ method, resolve }));
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  return {
    send, evaluate,
    async goto(url) { const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url }); await loaded; },
    async setViewport(width, height, scale = 1) { await send('Emulation.setDeviceMetricsOverride', { width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: scale, mobile: false }); },
    async screenshot({ format = 'png', quality, clip } = {}) {
      const params = { format, captureBeyondViewport: false };
      if (quality) params.quality = quality;
      if (clip) params.clip = { ...clip, scale: 1 };
      const r = await send('Page.captureScreenshot', params);
      return Buffer.from(r.data, 'base64');
    },
    async close() {
      try { await send('Browser.close'); } catch { /* 已关闭 */ }
      try { ws.close(); } catch { /* ignore */ }
      setTimeout(() => { try { proc.kill(); } catch { /* ignore */ } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }, 500);
    },
  };
}

export function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'file:///' + encodeURI(abs.replace(/^\//, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
