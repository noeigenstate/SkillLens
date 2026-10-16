// 把图里的文字翻成界面语言。优先用 Anthropic SDK（有 API key 且装了 @anthropic-ai/sdk 时），
// 否则调用本机的 Claude Code 命令行。结果缓存在 data/translations.json，同一句话只翻一次。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './scan.mjs';

const CACHE_FILE = path.join(ROOT, 'data/translations.json');
const CACHE_JS = path.join(ROOT, 'data/translations.js');
const LANG_NAME = { zh: 'Simplified Chinese', en: 'English' };
const SCHEMA = {
  type: 'object',
  properties: { translations: { type: 'array', items: { type: 'string' } } },
  required: ['translations'],
  additionalProperties: false,
};

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* 第一次用 */ }
const key = (lang, text) => lang + '\u0001' + text;

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  // 直接双击 index.html 时也能用上已有的译文
  fs.writeFileSync(CACHE_JS, '/* 由翻译功能生成，不要手改 */\nwindow.SV_TRANS = ' + JSON.stringify(cache).replace(/</g, '\\u003c') + ';\n');
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
    'Return JSON {"translations": [...]} with exactly one translation per input string, in the same order.',
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
    // 某个模型拒绝时由服务端自动换模型重试
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

/* —— 选后端 —— */
let backend = undefined;
export async function detectBackend() {
  if (backend !== undefined) return backend;
  const mode = process.env.SV_TRANSLATE;
  if (mode === 'off') return (backend = null);
  const Anthropic = await loadSdk();
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (Anthropic && (hasKey || mode === 'sdk')) return (backend = { name: 'sdk', run: (t, i, m) => viaSdk(Anthropic, t, i, m) });
  const bin = mode === 'sdk' ? null : findClaude();
  if (bin) return (backend = { name: 'claude-cli', run: (t, i, m) => viaCli(bin, t, i, m) });
  return (backend = null);
}

/* 分批：短文本一批最多 60 条 / 6000 字，Markdown 一条一批 */
function chunks(items, markdown) {
  if (markdown) return items.map(x => [x]);
  const out = [];
  let cur = [], size = 0;
  for (const s of items) {
    if (cur.length && (cur.length >= 60 || size + s.length > 6000)) { out.push(cur); cur = []; size = 0; }
    cur.push(s);
    size += s.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

let queue = Promise.resolve();
export function translate(target, items, markdown = false) {
  const job = queue.then(() => doTranslate(target, items, markdown));
  queue = job.catch(() => {});
  return job;
}

async function doTranslate(target, items, markdown) {
  if (!LANG_NAME[target]) throw new Error('不支持的语言：' + target);
  const uniq = [...new Set(items.filter(s => typeof s === 'string' && s.trim()))];
  const missing = uniq.filter(s => cache[key(target, s)] == null);
  if (missing.length) {
    const be = await detectBackend();
    if (!be) throw new Error('没有可用的翻译方式：安装并登录 Claude Code，或设置 ANTHROPIC_API_KEY 并运行 npm install');
    for (const batch of chunks(missing, markdown)) {
      const out = await be.run(target, batch, markdown);
      if (!Array.isArray(out)) throw new Error('翻译结果格式不对');
      batch.forEach((s, i) => { if (typeof out[i] === 'string' && out[i].trim()) cache[key(target, s)] = out[i]; });
      saveCache();
    }
  }
  const map = {};
  for (const s of uniq) if (cache[key(target, s)] != null) map[s] = cache[key(target, s)];
  return map;
}
