// 批量调用本地 / 局域网大模型（OpenAI 兼容 /v1/chat/completions，单路并发）
// 为本机扫描到的技能批量生成「最简测试用例 + 使用前后对比」，结果实时落盘到 data/testcases.json 与 data/testcases.js
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, resolveRoots, scan } from './lib/scan.mjs';
import { getOllamaConfig, getAllCachedTestCases, saveTcCache } from './lib/translate.mjs';

const argv = process.argv.slice(2);
const limitArg = argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? +argv[limitArg + 1] : 120;
const BATCH_SIZE = 6;

function directPost(urlStr, body, apiKey = 'local', timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    let timer, settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err); else resolve(value);
    };
    const disconnected = () => finish(new Error('模型连接中断'));
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = lib.request(u, {
      method: 'POST',
      agent: false,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
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
      const err = new Error(`请求超时 (${timeoutMs}ms)`);
      finish(err);
      req.destroy(err);
    }, timeoutMs);
    req.on('error', err => finish(err));
    req.write(payload);
    req.end();
  });
}

function parseJson(rawText) {
  const cleaned = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try { return JSON.parse(cleaned); } catch {
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new Error('返回非 JSON: ' + cleaned.slice(0, 120));
  }
}

async function main() {
  const cfg = getOllamaConfig();
  const chatUrl = cfg.baseUrl.endsWith('/v1')
    ? `${cfg.baseUrl}/chat/completions`
    : `${cfg.baseUrl}/v1/chat/completions`;
  const tcCache = getAllCachedTestCases();
  const data = scan(resolveRoots([]));

  // 优先本机项目 / 各 Agent 技能，再去重
  const localFirst = data.skills.filter(s => s.kind !== 'catalog' && s.kind !== 'official' && s.groupKey !== 'market')
    .concat(data.skills.filter(s => s.kind === 'official' || s.kind === 'catalog'));
  const uniq = [];
  const seen = new Set();
  for (const s of localFirst) {
    const k = String(s.name || '').toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (tcCache[k] && tcCache[k].input && tcCache[k].before && tcCache[k].after) continue;
    uniq.push(s);
  }

  const todo = uniq.slice(0, LIMIT);
  console.log(`局域网模型：${cfg.model} @ ${chatUrl}`);
  console.log(`已有缓存：${Object.keys(tcCache).length} 个，本次待生成：${todo.length} 个（单路并发，每批 ${BATCH_SIZE} 个）`);

  const sys = [
    '你是一个 AI 技能（SKILL.md）评测专家。用户会发给你一组技能（包含 key、name、description 和 SKILL.md 摘要）。',
    '请为每个技能生成供用户一眼判断价值的「最简测试用例」以及「使用前 vs 使用后」对比。',
    '要求全部使用简洁、自然、地道的简体中文：',
    '- input（最简测试输入）：一句用户可以直接复制发给 AI 试玩的最小具体测试指令（18~42字，具体到一个最小测试任务或示例数据）。',
    '- before（使用前 · 普通直出）：未启用该技能时，普通 AI 往往怎么敷衍、漏掉什么关键步骤或有什么痛点（22~50字）。',
    '- after（使用后 · 技能赋能）：启用该技能后，严格按其工作流步骤产出了什么高质量、结构化或可验证的结果（24~55字）。',
    '严格只输出纯 JSON 对象，格式为：{"items": {"技能key": {"input": "...", "before": "...", "after": "..."}}}，不要加代码块标记。',
  ].join('\n');

  let doneCount = 0;
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const payloadItems = batch.map(s => ({
      key: String(s.name).toLowerCase(),
      name: s.name,
      description: String(s.description || '').slice(0, 300),
      excerpt: String(s.text || '').replace(/^---[\s\S]*?---\s*/, '').slice(0, 700),
    }));
    try {
      const t0 = Date.now();
      const j = await directPost(chatUrl, {
        model: cfg.model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(payloadItems) },
        ],
        chat_template_kwargs: { enable_thinking: false },
        temperature: 0.2,
        max_tokens: 2200,
      }, cfg.apiKey, 120000);
      const content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
      const parsed = parseJson(content);
      const map = parsed.items || parsed;
      let batchSaved = 0;
      for (const s of batch) {
        const k = String(s.name).toLowerCase();
        const hit = map[k] || map[s.name];
        if (hit && hit.input && hit.before && hit.after) {
          tcCache[k] = {
            input: String(hit.input).trim(),
            before: String(hit.before).trim(),
            after: String(hit.after).trim(),
          };
          batchSaved++;
          doneCount++;
        }
      }
      saveTcCache();
      console.log(`[${Math.min(i + BATCH_SIZE, todo.length)}/${todo.length}] 成功生成 ${batchSaved} 个 (${((Date.now() - t0) / 1000).toFixed(1)}s) · 累计缓存 ${Object.keys(tcCache).length} 个`);
    } catch (e) {
      console.error(`批次 [${i}..${i + batch.length - 1}] 失败：${e.message}`);
    }
  }
  console.log(`完成！共新增 ${doneCount} 个，当前总缓存 ${Object.keys(tcCache).length} 个技能测试用例。`);
}

main().catch(e => { console.error(e); process.exit(1); });
