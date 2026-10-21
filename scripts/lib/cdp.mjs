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
  ], { stdio: 'ignore', windowsHide: true });
  let spawnError;
  proc.on('error', e => { spawnError = e; });
  const cleanup = () => {
    try { proc.kill(); } catch { /* 已退出 */ }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 稍后清理 */ }
  };
  let ws;
  try {
    const portFile = path.join(dir, 'DevToolsActivePort');
    let port = null;
    for (let i = 0; i < 200 && !port; i++) {
      await sleep(100);
      if (spawnError) throw new Error('启动浏览器失败：' + spawnError.message);
      if (proc.exitCode !== null) throw new Error('浏览器已退出');
      try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() || null; } catch { /* 还没写出来 */ }
    }
    if (!port) throw new Error('浏览器没有启动调试端口');
    let page = null;
    for (let i = 0; i < 50 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json()).find(t => t.type === 'page'); } catch { await sleep(100); }
    }
    if (!page) throw new Error('找不到浏览器调试页面');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('浏览器连接超时')), 10000);
      const finish = err => { clearTimeout(timer); if (err) reject(err); else resolve(); };
      ws.onopen = () => finish();
      ws.onerror = () => finish(new Error('浏览器连接失败'));
      ws.onclose = () => finish(new Error('浏览器连接已关闭'));
    });
    let seq = 0;
    const pending = new Map();
    const waiters = [];
    const rejectAll = () => {
      const err = new Error('浏览器连接已关闭');
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(err); }
      pending.clear();
      for (const w of waiters.splice(0)) { clearTimeout(w.timer); w.reject(err); }
    };
    ws.onclose = rejectAll;
    ws.onerror = rejectAll;
    ws.onmessage = ev => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method) {
        for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === msg.method) { clearTimeout(waiters[i].timer); waiters[i].resolve(msg.params); waiters.splice(i, 1); }
      }
    };
    const send = (method, params = {}, timeoutMs = 30000) => new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) return reject(new Error('浏览器连接已关闭'));
      const id = ++seq;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('浏览器命令超时：' + method)); }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { ws.send(JSON.stringify({ id, method, params })); }
      catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
    });
    const once = method => {
      let waiter;
      const cancel = () => {
        clearTimeout(waiter.timer);
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
      };
      const promise = new Promise((resolve, reject) => {
        waiter = { method, resolve, reject };
        waiter.timer = setTimeout(() => { cancel(); reject(new Error('页面导航超时 (30000ms)')); }, 30000);
        waiters.push(waiter);
      });
      return { promise, cancel };
    };
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    return {
      send, evaluate,
      async goto(url) {
        const loaded = once('Page.loadEventFired');
        try {
          await Promise.all([loaded.promise, send('Page.navigate', { url }).then(r => {
            if (r.errorText) throw new Error('页面导航失败：' + r.errorText);
          })]);
        } finally { loaded.cancel(); }
      },
      async setViewport(width, height, scale = 1) { await send('Emulation.setDeviceMetricsOverride', { width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: scale, mobile: false }); },
      async screenshot({ format = 'png', quality, clip } = {}) {
        const params = { format, captureBeyondViewport: false };
        if (quality) params.quality = quality;
        if (clip) params.clip = { ...clip, scale: 1 };
        const r = await send('Page.captureScreenshot', params);
        return Buffer.from(r.data, 'base64');
      },
      async close() {
        try { await send('Browser.close', {}, 1000); } catch { /* 已关闭 */ }
        try { ws.close(); } catch { /* ignore */ }
        setTimeout(cleanup, 500);
      },
    };
  } catch (e) {
    try { ws?.close(); } catch { /* 未连接 */ }
    cleanup();
    throw e;
  }
}

export function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'file:///' + encodeURI(abs.replace(/^\//, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
