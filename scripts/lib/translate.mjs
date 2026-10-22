// 把图里的文字翻成界面语言，并为每个 skill 生成最简测试用例与使用前后对比。
// 支持本地 / 局域网大模型（OpenAI 兼容 /v1/chat/completions，直连不走系统代理；本地配置见 data/ollama.json）。
// 结果缓存在 data/translations.json 与 data/testcases.json。
import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './scan.mjs';

const CACHE_FILE = path.join(ROOT, 'data/translations.json');
const CACHE_JS = path.join(ROOT, 'data/translations.js');
const TC_CACHE_FILE = path.join(ROOT, 'data/testcases.json');
const TC_CACHE_JS = path.join(ROOT, 'data/testcases.js');
const OLLAMA_CFG_FILE = path.join(ROOT, 'data/ollama.json');
const LANG_NAME = { zh: 'Simplified Chinese', en: 'English' };
const SCHEMA = {
  type: 'object',
  properties: { translations: { type: 'array', items: { type: 'string' } } },
  required: ['translations'],
  additionalProperties: false,
};

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* 第一次用 */ }
let tcCache = {};
try { tcCache = JSON.parse(fs.readFileSync(TC_CACHE_FILE, 'utf8')); } catch { /* 第一次用 */ }
const key = (lang, text) => lang + '\u0001' + text;

let tempSeq = 0;
export function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.${++tempSeq}.tmp`;
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* 已替换 */ }
  }
}

export function mergeDisk(file, entries) {
  try {
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(disk)) if (!Object.hasOwn(entries, k)) entries[k] = v;
  } catch { /* 首次写入 */ }
}

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  mergeDisk(CACHE_FILE, cache);
  atomicWrite(CACHE_FILE, JSON.stringify(cache));
  // 直接双击 index.html 时也能用上已有的译文
  atomicWrite(CACHE_JS, '/* 由翻译功能生成，不要手改 */\nwindow.SV_TRANS = ' + JSON.stringify(cache).replace(/</g, '\\u003c') + ';\n');
}

export function saveTcCache() {
  fs.mkdirSync(path.dirname(TC_CACHE_FILE), { recursive: true });
  mergeDisk(TC_CACHE_FILE, tcCache);
  atomicWrite(TC_CACHE_FILE, JSON.stringify(tcCache, null, 2));
  atomicWrite(TC_CACHE_JS, '/* 由测试用例生成功能生成，不要手改 */\nwindow.SV_TESTCASES = ' + JSON.stringify(tcCache).replace(/</g, '\\u003c') + ';\n');
}

export function getOllamaConfig() {
  let fileCfg = {};
  try { fileCfg = JSON.parse(fs.readFileSync(OLLAMA_CFG_FILE, 'utf8')); } catch { /* ignore */ }
  const rawUrl = process.env.SV_LLM_URL || process.env.SV_OLLAMA_URL || fileCfg.baseUrl || fileCfg.url || 'http://localhost:11434/v1';
  const baseUrl = String(rawUrl).replace(/\/+$/, '');
  const model = process.env.SV_LLM_MODEL || process.env.SV_OLLAMA_MODEL || fileCfg.model || 'qwen3.8-27b';
  const apiKey = process.env.SV_LLM_KEY || fileCfg.apiKey || 'local';
  return {
    baseUrl: /^https?:\/\//i.test(baseUrl) ? baseUrl : 'http://' + baseUrl,
    model,
    apiKey,
  };
}

/* 直连 HTTP/HTTPS 请求（等效于 curl --noproxy '*'，不受系统代理干扰） */
export function directJsonRequest(urlStr, { method = 'GET', body = null, timeoutMs = 60000, apiKey = 'local', signal } = {}) {
  return new Promise((resolve, reject) => {
    let timer, settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err); else resolve(value);
    };
    const disconnected = () => finish(Object.assign(new Error('模型连接中断'), { backendUnreachable: true }));
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey || 'local'}`,
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = lib.request(u, { method, headers, agent: false, signal }, res => {
      let out = '';
      res.setEncoding('utf8');
      res.on('data', d => { out += d; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return finish(new Error(`模型请求失败：HTTP ${res.statusCode}`));
        }
        try { finish(null, JSON.parse(out)); }
        catch { finish(new Error('模型返回无效 JSON')); }
      });
      res.on('error', disconnected);
      res.on('aborted', disconnected);
      res.on('close', () => { if (!res.complete) disconnected(); });
    });
    timer = setTimeout(() => {
      const err = Object.assign(new Error(`请求超时 (${timeoutMs}ms)`), { backendUnreachable: true });
      finish(err);
      req.destroy(err);
    }, timeoutMs);
    req.on('error', err => {
      if (err.name !== 'AbortError') err.backendUnreachable = true;
      finish(err);
    });
    if (payload) req.write(payload);
    req.end();
  });
}

/* 从模型返回文本中提取 JSON（支持 {"translations":[...]}、裸数组 [...]、带代码块或格式瑕疵） */
export function extractJsonAny(rawText) {
  const cleaned = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/m, '')
    .trim();

  // 1. 直接解析
  try { return JSON.parse(cleaned); } catch {}

  // 2. 尝试提取包含的 { ... }
  const sObj = cleaned.indexOf('{');
  const eObj = cleaned.lastIndexOf('}');
  if (sObj >= 0 && eObj > sObj) {
    const sub = cleaned.slice(sObj, eObj + 1);
    try { return JSON.parse(sub); } catch {
      try { return JSON.parse(sub.replace(/,\s*([\]}])/g, '$1')); } catch {}
    }
  }

  // 3. 尝试提取包含的 [ ... ]
  const sArr = cleaned.indexOf('[');
  const eArr = cleaned.lastIndexOf(']');
  if (sArr >= 0 && eArr > sArr) {
    const sub = cleaned.slice(sArr, eArr + 1);
    try { return JSON.parse(sub); } catch {
      try { return JSON.parse(sub.replace(/,\s*([\]}])/g, '$1')); } catch {}
    }
  }

  // 4. 清除尾随逗号重试
  try { return JSON.parse(cleaned.replace(/,\s*([\]}])/g, '$1')); } catch {}

  throw new Error('模型未返回有效 JSON：' + cleaned.slice(0, 160));
}

/* —— 后端零：局域网 Qwen (OpenAI 兼容 /v1/chat/completions) —— */
let resolvedOllama = undefined;
let probedAt = 0;
export function cachedOllama() { return resolvedOllama || null; }
export async function probeOllama(force = false) {
  if (!force && (resolvedOllama || (resolvedOllama === null && Date.now() - probedAt < 30000))) return resolvedOllama;
  const cfg = getOllamaConfig();
  const chatUrl = cfg.baseUrl.endsWith('/v1')
    ? `${cfg.baseUrl}/chat/completions`
    : `${cfg.baseUrl}/v1/chat/completions`;
  try {
    const j = await directJsonRequest(chatUrl, {
      method: 'POST',
      apiKey: cfg.apiKey,
      timeoutMs: 15000,
      body: {
        model: cfg.model,
        messages: [{ role: 'user', content: 'ok' }],
        chat_template_kwargs: { enable_thinking: false },
        temperature: 0.2,
        max_tokens: 4,
      },
    });
    if (j && j.choices) {
      return (resolvedOllama = { url: cfg.baseUrl, chatUrl, model: cfg.model, apiKey: cfg.apiKey });
    }
  } catch { /* 稍后重试 */ }
  probedAt = Date.now();
  return (resolvedOllama = null);
}

async function viaLocalLlm(llm, target, items, markdown, signal) {
  const j = await directJsonRequest(llm.chatUrl, {
    method: 'POST',
    apiKey: llm.apiKey,
    timeoutMs: 90000,
    signal,
    body: {
      model: llm.model,
      messages: [
        { role: 'system', content: systemPrompt(target, markdown, true) },
        { role: 'user', content: JSON.stringify(Object.fromEntries(items.map((s, i) => [String(i + 1), s]))) },
      ],
      chat_template_kwargs: { enable_thinking: false },
      temperature: 0.1,
      max_tokens: 4096,
    },
  });
  const content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
  const parsed = extractJsonAny(content);
  const values = parsed && Object.hasOwn(parsed, 'translations') ? parsed.translations : parsed;
  const separator = target === 'zh' ? '；' : '; ';
  if (Array.isArray(values)) {
    if (values.length === items.length) return values;
    if (items.length === 1 && values.every(v => typeof v === 'string')) return [values.join(separator)];
    throw new Error('译文数量与输入不符');
  }
  if (!values || typeof values !== 'object') throw new Error('模型返回缺少 translations 译文对象');
  // 按编号对齐，缺项留给单条重试
  return items.map((s, i) => {
    const id = String(i + 1);
    const value = Object.hasOwn(values, id) ? values[id] : null;
    if (value === null || typeof value === 'string') return value;
    if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value.join(separator);
    throw new Error('模型返回无效译文');
  });
}

function systemPrompt(target, markdown, keyed = false) {
  return [
    'You translate text shown by a tool that draws workflow diagrams of AI agent skills (SKILL.md files).',
    `Translate every string the user sends into ${LANG_NAME[target]}.`,
    'Keep code, file paths, command lines, flags, URLs, product names, skill names and anything in backticks exactly as written.',
    markdown
      ? 'Each string is Markdown: keep its structure (headings, lists, tables, links, code blocks) and translate only the prose; never change the inside of code blocks or inline code.'
      : 'The strings are short labels on diagram cards: keep each translation about as short as the original and add no explanations.',
    `If a string is already in ${LANG_NAME[target]}, return it unchanged.`,
    keyed
      ? 'Input is a JSON object mapping ids to strings. Output ONLY a JSON object {"translations": {"<id>": "<translation>", ...}} with exactly the same ids. Translate each string as ONE string; never split it into several. Do not wrap in markdown fences.'
      : 'Output ONLY a valid JSON object {"translations": [...]} with exactly one translation per input string, in the same order. Do not wrap in markdown fences.',
  ].join('\n');
}

/* —— 后端一：Anthropic SDK —— */
async function loadSdk() {
  try { return (await import('@anthropic-ai/sdk')).default; } catch { return null; }
}
async function viaSdk(Anthropic, target, items, markdown, signal) {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: process.env.SV_TRANSLATE_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: systemPrompt(target, markdown),
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  }, { signal, timeout: 90000 });
  if (response.stop_reason === 'refusal') throw new Error('模型拒绝了这次翻译');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text).translations;
}

/* —— 后端二：Claude Code 命令行 —— */
export function findClaude() {
  const env = process.env.SV_CLAUDE;
  if (env && fs.existsSync(env)) return env;
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const names = process.platform === 'win32'
    ? ['node_modules/@anthropic-ai/claude-code/bin/claude.exe', 'claude.exe']
    : ['claude'];
  for (const d of dirs) for (const n of names) {
    const p = path.join(d, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function viaCli(bin, target, items, markdown, signal) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--tools', '', '--effort', 'low', '--no-session-persistence', '--strict-mcp-config',
      '--system-prompt', systemPrompt(target, markdown), '--json-schema', JSON.stringify(SCHEMA)];
    if (process.env.SV_TRANSLATE_MODEL) args.push('--model', process.env.SV_TRANSLATE_MODEL);
    const p = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, signal });
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error('Claude Code 请求超时 (90000ms)'));
    }, 90000);
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.stdin.on('error', e => { clearTimeout(timer); p.kill(); reject(e); });
    p.on('close', code => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out);
        if (j.is_error) return reject(new Error(String(j.result || 'Claude Code 返回错误')));
        const data = j.structured_output || JSON.parse(j.result);
        resolve(data.translations);
      } catch (e) { reject(new Error(`Claude Code 调用失败（退出码 ${code}）：${(err || out).trim().slice(0, 300) || e.message}`)); }
    });
    p.stdin.end(JSON.stringify(items));
  });
}

/* —— 选后端（优先局域网 Qwen 27B） —— */
let backend = undefined;
let backendAt = 0;
export function __setBackendForTest(fn) {
  backend = fn ? { name: 'test', run: fn } : undefined;
}
export async function detectBackend(force = false) {
  if (backend !== undefined && !force && (backend || Date.now() - backendAt < 30000)) return backend;
  backendAt = Date.now();
  const mode = process.env.SV_TRANSLATE;
  if (mode === 'off') return (backend = null);
  const llm = await probeOllama(force);
  if (llm && mode !== 'sdk' && mode !== 'claude') {
    return (backend = { name: `${llm.model} (${llm.url})`, ollama: llm, run: (t, i, m, s) => viaLocalLlm(llm, t, i, m, s) });
  }
  // 如果本地或环境变量配置了大模型接口，优先使用，不降级到已超限的 Claude
  const cfg = getOllamaConfig();
  if (cfg.baseUrl && (mode === 'ollama' || (!process.env.ANTHROPIC_API_KEY && !process.env.SV_CLAUDE && !mode))) {
    const chatUrl = cfg.baseUrl.endsWith('/v1') ? `${cfg.baseUrl}/chat/completions` : `${cfg.baseUrl}/v1/chat/completions`;
    const fallbackLlm = { url: cfg.baseUrl, chatUrl, model: cfg.model, apiKey: cfg.apiKey };
    return (backend = { name: `${fallbackLlm.model} (${fallbackLlm.url})`, ollama: fallbackLlm, run: (t, i, m, s) => viaLocalLlm(fallbackLlm, t, i, m, s) });
  }
  const Anthropic = await loadSdk();
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (Anthropic && (hasKey || mode === 'sdk')) return (backend = { name: 'sdk', run: (t, i, m, s) => viaSdk(Anthropic, t, i, m, s) });
  const bin = mode === 'sdk' ? null : findClaude();
  if (bin) return (backend = { name: 'claude-cli', run: (t, i, m, s) => viaCli(bin, t, i, m, s) });
  return (backend = null);
}

/* —— 全局单路并发双优先级队列（前台交互优先，后台预热垫后） —— */
const hiQueue = [];
const loQueue = [];
let queueRunning = false;
let requestSeq = 0;
let foregroundAt = Date.now();
export function markForeground() { foregroundAt = Date.now(); }
export function msSinceForeground() { return Date.now() - foregroundAt; }

function pumpQueue() {
  if (queueRunning) return;
  hiQueue.sort((a, b) => b.seq - a.seq || a.batchIndex - b.batchIndex);
  const task = hiQueue.shift() || loQueue.shift();
  if (!task) return;
  queueRunning = true;
  Promise.resolve()
    .then(task.fn)
    .then(task.resolve, task.reject)
    .finally(() => {
      queueRunning = false;
      pumpQueue();
    });
}

export function enqueueLlm(fn, priority = 'high', seq = ++requestSeq, batchIndex = 0) {
  return new Promise((resolve, reject) => {
    const task = { fn, resolve, reject, seq, batchIndex };
    if (priority === 'low') loQueue.push(task);
    else hiQueue.push(task);
    pumpQueue();
  });
}

/* —— 用局域网 Qwen 为任意 skill 生成最简测试用例与使用前后对比 —— */
export function generateTestCase(skill, priority = 'high') {
  const k = String(skill.name || skill.id || '').toLowerCase();
  if (tcCache[k] && tcCache[k].input && tcCache[k].before && tcCache[k].after) {
    return Promise.resolve(tcCache[k]);
  }
  return enqueueLlm(() => doGenerateTestCase(k, skill), priority);
}

async function doGenerateTestCase(k, skill) {
  if (tcCache[k] && tcCache[k].input) return tcCache[k];
  const llm = await probeOllama();
  if (!llm) throw new Error('局域网模型未连接');
  const snippet = String(skill.text || skill.description || '').slice(0, 4000);
  const sys = [
    '你是一个 AI 技能（SKILL.md）评测专家。请根据用户提供的技能名称、简介与 SKILL.md 内容，为该技能设计一个供用户一眼判断价值的「最简测试用例」以及「使用前 vs 使用后」对比。',
    '要求全部使用简洁、地道的简体中文，不要夹杂英文术语缩写：',
    '1. input（最简测试输入）：给出一句用户可以直接复制发给 AI 试玩的最小具体测试指令（20~45字，具体到某个小任务或测试素材，不要空泛）。',
    '2. before（使用前 · 普通直出）：未启用该技能时，普通 AI 往往怎么敷衍、漏掉什么关键步骤或有什么痛点（25~55字）。',
    '3. after（使用后 · 技能赋能）：启用该技能后，严格按其工作流步骤产出了什么高质量、结构化或可验证的结果（25~60字）。',
    '只输出纯 JSON 对象，不要加任何代码块标记或额外解释：{"input":"...","before":"...","after":"..."}',
  ].join('\n');
  const userMsg = `技能名称：${skill.name}\n技能描述：${skill.description || ''}\nSKILL.md 内容节选：\n${snippet}`;
  const j = await directJsonRequest(llm.chatUrl, {
    method: 'POST',
    apiKey: llm.apiKey,
    timeoutMs: 60000,
    body: {
      model: llm.model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
      chat_template_kwargs: { enable_thinking: false },
      temperature: 0.2,
      max_tokens: 512,
    },
  });
  const content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
  const parsed = extractJsonAny(content);
  if (parsed && parsed.input && parsed.before && parsed.after) {
    tcCache[k] = {
      input: String(parsed.input).trim(),
      before: String(parsed.before).trim(),
      after: String(parsed.after).trim(),
    };
    saveTcCache();
    return tcCache[k];
  }
  throw new Error('模型生成的测试用例字段不完整');
}

export function getAllCachedTestCases() {
  return tcCache;
}

/* 分批：短文本一批最多 15 条 / 1500 字，Markdown 一条一批（更轻更快） */
function chunks(items, markdown) {
  if (markdown) return items.map(x => [x]);
  const out = [];
  let cur = [], size = 0;
  for (const s of items) {
    if (cur.length && (cur.length >= 15 || size + s.length > 1500)) { out.push(cur); cur = []; size = 0; }
    cur.push(s);
    size += s.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

// 空行仅在围栏外分段，分隔符原样保留
function markdownSegments(text) {
  const parts = [];
  const lines = [...text.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)].filter(m => m[0]);
  let start = 0, fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i][0].replace(/[\r\n]+$/, '');
    if (!fence && /^[ \t]*$/.test(line)) {
      let end = lines[i].index + lines[i][0].length;
      let sep = lines[i].index;
      if (sep > start) sep -= text.slice(0, sep).endsWith('\r\n') ? 2 : 1;
      while (i + 1 < lines.length && /^[ \t]*$/.test(lines[i + 1][0].replace(/[\r\n]+$/, ''))) {
        i++;
        end = lines[i].index + lines[i][0].length;
      }
      if (sep > start) parts.push({ text: text.slice(start, sep) });
      parts.push({ separator: text.slice(sep, end) });
      start = end;
      continue;
    }
    const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!m) continue;
    if (!fence && (m[1][0] !== '`' || !m[2].includes('`'))) fence = m[1];
    else if (fence && m[1][0] === fence[0] && m[1].length >= fence.length && !m[2].trim()) fence = null;
  }
  if (start < text.length) parts.push({ text: text.slice(start) });

  const codeOnly = s => {
    const lines = s.trim().split(/\r\n|\n|\r/);
    const open = lines[0].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!open || (open[1][0] === '`' && open[2].includes('`'))) return false;
    const end = lines.findIndex((line, i) => i > 0 && new RegExp('^ {0,3}' + open[1][0] + '{' + open[1].length + ',}[ \\t]*$').test(line));
    return end === lines.length - 1;
  };
  const packed = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.separator !== undefined) { packed.push(part); continue; }
    const code = codeOnly(part.text);
    const prev = packed.at(-2), sep = packed.at(-1);
    if (!code && prev?.text !== undefined && !prev.code && sep?.separator !== undefined && prev.text.length + sep.separator.length + part.text.length <= 1800) {
      prev.text += sep.separator + part.text;
      packed.pop();
    } else packed.push({ ...part, code });
  }
  return packed;
}

function unreachable(err) {
  return err.backendUnreachable || /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|EPIPE)$/.test(err.code || '');
}

export async function translate(target, items, markdown = false, priority = 'high', signal) {
  if (!Object.hasOwn(LANG_NAME, target)) throw new Error('不支持的语言：' + target);
  if (!Array.isArray(items)) throw new Error('items 必须是数组');
  const uniq = [...new Set(items.filter(s => typeof s === 'string' && s.trim()))];
  const cached = s => typeof cache[key(target, s)] === 'string' && !!cache[key(target, s)].trim();
  const missing = uniq.filter(s => !cached(s));
  const seq = ++requestSeq;
  let batchIndex = 0, attempts = 0, offline = 0, lastError;

  const runBatch = async (batch, index, retried = false) => {
    if (signal?.aborted) return null;
    try {
      const out = await enqueueLlm(async () => {
        if (signal?.aborted) return null;
        attempts++;
        const be = await detectBackend();
        if (signal?.aborted) return null;
        if (!be) throw Object.assign(new Error('没有可用的模型后端'), { backendUnreachable: true });
        return be.run(target, batch, markdown, signal);
      }, priority, seq, index);
      if (signal?.aborted) return null;
      if (!Array.isArray(out) || out.length !== batch.length) throw new Error('译文数量与输入不符');
      // 空译文单独重试，不能写入缓存
      const result = new Map();
      for (let i = 0; i < batch.length; i++) {
        if (typeof out[i] === 'string' && out[i].trim()) result.set(batch[i], out[i]);
      }
      for (const s of batch.filter(s => !result.has(s))) {
        if (batch.length === 1) throw new Error('模型返回空译文');
        const one = await runBatch([s], index);
        if (one) for (const [k, v] of one) result.set(k, v);
      }
      return result;
    } catch (err) {
      if (signal?.aborted) return null;
      lastError = err;
      if (unreachable(err)) offline++;
      if (batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        const left = await runBatch(batch.slice(0, mid), index);
        const right = await runBatch(batch.slice(mid), index);
        return new Map([...(left || []), ...(right || [])]);
      }
      if (!retried) return runBatch(batch, index, true);
      console.warn(`翻译放弃 ${batch.length} 项：${err.message}`);
      return null;
    }
  };

  for (const batch of chunks(missing, markdown)) {
    if (signal?.aborted) break;
    const index = batchIndex++;
    if (markdown && batch[0].length > 1800) {
      const parts = markdownSegments(batch[0]);
      let complete = true;
      const translated = [];
      for (const part of parts) {
        if (signal?.aborted) { complete = false; break; }
        if (part.separator !== undefined || part.code) {
          translated.push(part.separator ?? part.text);
          continue;
        }
        const result = await runBatch([part.text], index);
        if (!result?.has(part.text)) complete = false;
        translated.push(result?.get(part.text) ?? part.text);
      }
      if (complete && translated.join('').trim()) {
        cache[key(target, batch[0])] = translated.join('');
        saveCache();
      }
    } else {
      const result = await runBatch(batch, index);
      if (signal?.aborted) break;
      if (result?.size) {
        for (const [s, value] of result) cache[key(target, s)] = value;
        saveCache();
      }
    }
  }
  if (!signal?.aborted && attempts && offline === attempts) throw lastError;
  const map = Object.fromEntries(uniq.filter(cached).map(s => [s, cache[key(target, s)]]));
  return { map, failed: uniq.filter(s => !cached(s)) };
}
