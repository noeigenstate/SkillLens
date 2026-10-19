// 把图里的文字翻成界面语言，并为每个 skill 生成最简测试用例与使用前后对比。
// 默认使用局域网 Qwen 大模型（http://192.168.1.19:8000/v1 · qwen3.8-27b，单路并发队列，直连不走代理）。
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

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  // 直接双击 index.html 时也能用上已有的译文
  fs.writeFileSync(CACHE_JS, '/* 由翻译功能生成，不要手改 */\nwindow.SV_TRANS = ' + JSON.stringify(cache).replace(/</g, '\\u003c') + ';\n');
}

export function saveTcCache() {
  fs.mkdirSync(path.dirname(TC_CACHE_FILE), { recursive: true });
  fs.writeFileSync(TC_CACHE_FILE, JSON.stringify(tcCache, null, 2));
  fs.writeFileSync(TC_CACHE_JS, '/* 由测试用例生成功能生成，不要手改 */\nwindow.SV_TESTCASES = ' + JSON.stringify(tcCache).replace(/</g, '\\u003c') + ';\n');
}

export function getOllamaConfig() {
  let fileCfg = {};
  try { fileCfg = JSON.parse(fs.readFileSync(OLLAMA_CFG_FILE, 'utf8')); } catch { /* ignore */ }
  const rawUrl = process.env.SV_LLM_URL || process.env.SV_OLLAMA_URL || fileCfg.baseUrl || fileCfg.url || 'http://192.168.1.19:8000/v1';
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
function directJsonRequest(urlStr, { method = 'GET', body = null, timeoutMs = 60000, apiKey = 'local' } = {}) {
  return new Promise((resolve, reject) => {
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
    const req = lib.request(u, { method, headers, agent: false }, res => {
      let out = '';
      res.setEncoding('utf8');
      res.on('data', d => { out += d; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${out.slice(0, 240)}`));
        }
        try { resolve(JSON.parse(out)); }
        catch (e) { reject(new Error(`JSON 解析失败: ${out.slice(0, 200)}`)); }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`请求超时 (${timeoutMs}ms)`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* 从模型返回文本中提取 JSON（支持 {"translations":[...]}、裸数组 [...]、带代码块或格式瑕疵） */
function extractJsonAny(rawText) {
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
export async function probeOllama(force = false) {
  if (resolvedOllama !== undefined && !force) return resolvedOllama;
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
        max_tokens: 4,
      },
    });
    if (j && j.choices) {
      return (resolvedOllama = { url: cfg.baseUrl, chatUrl, model: cfg.model, apiKey: cfg.apiKey });
    }
  } catch {
    if (resolvedOllama) return resolvedOllama;
  }
  return (resolvedOllama = null);
}

async function viaLocalLlm(llm, target, items, markdown) {
  const j = await directJsonRequest(llm.chatUrl, {
    method: 'POST',
    apiKey: llm.apiKey,
    timeoutMs: 90000,
    body: {
      model: llm.model,
      messages: [
        { role: 'system', content: systemPrompt(target, markdown) },
        { role: 'user', content: JSON.stringify(items) },
      ],
      chat_template_kwargs: { enable_thinking: false },
      temperature: 0.1,
      max_tokens: 4096,
    },
  });
  const content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
  const parsed = extractJsonAny(content);
  let list = null;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && Array.isArray(parsed.translations)) {
    list = parsed.translations;
  } else if (parsed && typeof parsed === 'object') {
    const vals = Object.values(parsed);
    if (vals.length && vals.every(v => typeof v === 'string')) list = vals;
  }
  if (!Array.isArray(list)) throw new Error('模型返回缺少 translations 译文数组');
  return list;
}

function systemPrompt(target, markdown) {
  return [
    'You translate text shown by a tool that draws workflow diagrams of AI agent skills (SKILL.md files).',
    `Translate every string the user sends into ${LANG_NAME[target]}.`,
    'Keep code, file paths, command lines, flags, URLs, product names, skill names and anything in backticks exactly as written.',
    markdown
      ? 'Each string is Markdown: keep its structure (headings, lists, tables, links, code blocks) and translate only the prose; never change the inside of code blocks or inline code.'
      : 'The strings are short labels on diagram cards: keep each translation about as short as the original and add no explanations.',
    `If a string is already in ${LANG_NAME[target]}, return it unchanged.`,
    'Output ONLY a valid JSON object {"translations": [...]} with exactly one translation per input string, in the same order. Do not wrap in markdown fences.',
  ].join('\n');
}

/* —— 后端一：Anthropic SDK —— */
async function loadSdk() {
  try { return (await import('@anthropic-ai/sdk')).default; } catch { return null; }
}
async function viaSdk(Anthropic, target, items, markdown) {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: process.env.SV_TRANSLATE_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: systemPrompt(target, markdown),
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  });
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
function viaCli(bin, target, items, markdown) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--tools', '', '--effort', 'low', '--no-session-persistence', '--strict-mcp-config',
      '--system-prompt', systemPrompt(target, markdown), '--json-schema', JSON.stringify(SCHEMA)];
    if (process.env.SV_TRANSLATE_MODEL) args.push('--model', process.env.SV_TRANSLATE_MODEL);
    const p = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => {
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
export async function detectBackend(force = false) {
  if (backend !== undefined && !force) return backend;
  const mode = process.env.SV_TRANSLATE;
  if (mode === 'off') return (backend = null);
  const llm = await probeOllama(force);
  if (llm && mode !== 'sdk' && mode !== 'claude') {
    return (backend = { name: `${llm.model} (${llm.url})`, ollama: llm, run: (t, i, m) => viaLocalLlm(llm, t, i, m) });
  }
  // 如果默认配置了局域网地址（如 192.168.1.19:8000），绝不降级到已超限的 Claude
  const cfg = getOllamaConfig();
  if (cfg.baseUrl && (mode === 'ollama' || (!process.env.ANTHROPIC_API_KEY && !process.env.SV_CLAUDE && !mode))) {
    const chatUrl = cfg.baseUrl.endsWith('/v1') ? `${cfg.baseUrl}/chat/completions` : `${cfg.baseUrl}/v1/chat/completions`;
    const fallbackLlm = { url: cfg.baseUrl, chatUrl, model: cfg.model, apiKey: cfg.apiKey };
    return (backend = { name: `${fallbackLlm.model} (${fallbackLlm.url})`, ollama: fallbackLlm, run: (t, i, m) => viaLocalLlm(fallbackLlm, t, i, m) });
  }
  const Anthropic = await loadSdk();
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (Anthropic && (hasKey || mode === 'sdk')) return (backend = { name: 'sdk', run: (t, i, m) => viaSdk(Anthropic, t, i, m) });
  const bin = mode === 'sdk' ? null : findClaude();
  if (bin) return (backend = { name: 'claude-cli', run: (t, i, m) => viaCli(bin, t, i, m) });
  return (backend = null);
}

/* —— 全局单路并发双优先级队列（前台交互优先，后台预热垫后） —— */
const hiQueue = [];
const loQueue = [];
let queueRunning = false;

function pumpQueue() {
  if (queueRunning) return;
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

export function enqueueLlm(fn, priority = 'high') {
  return new Promise((resolve, reject) => {
    if (priority === 'low') loQueue.push({ fn, resolve, reject });
    else hiQueue.push({ fn, resolve, reject });
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

export function translate(target, items, markdown = false, priority = 'high') {
  return enqueueLlm(() => doTranslate(target, items, markdown), priority);
}

async function doTranslate(target, items, markdown) {
  if (!LANG_NAME[target]) throw new Error('不支持的语言：' + target);
  const uniq = [...new Set(items.filter(s => typeof s === 'string' && s.trim()))];
  const missing = uniq.filter(s => cache[key(target, s)] == null);
  if (missing.length) {
    const be = await detectBackend();
    if (!be) throw new Error('没有可用的模型后端：请检查局域网 http://192.168.1.19:8000/v1 连通性');
    for (const batch of chunks(missing, markdown)) {
      try {
        const out = await be.run(target, batch, markdown);
        if (Array.isArray(out)) {
          batch.forEach((s, i) => {
            if (typeof out[i] === 'string' && out[i].trim()) {
              cache[key(target, s)] = out[i].trim();
            }
          });
          saveCache();
        }
      } catch (err) {
        console.warn('翻译分批调用警告（继续处理后续分批）：', err.message);
      }
    }
  }
  const map = {};
  for (const s of uniq) if (cache[key(target, s)] != null) map[s] = cache[key(target, s)];
  return map;
}

