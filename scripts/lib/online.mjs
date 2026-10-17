// 线上的 skill：下载官方仓库（只留 SKILL.md 文字和文件清单，不把第三方脚本写到本机）、在公开目录里搜索、按需取回单个 skill
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const OFFICIAL_REPOS = ['anthropics/skills', 'openai/skills', 'anthropics/claude-plugins-official'];
export const OFFICIAL_DIR = path.join(ROOT, 'data', 'online', 'official');
const UA = { 'User-Agent': 'SkillLens (+https://github.com/noeigenstate/SkillLens)' };
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

const ghHeaders = () => {
  const tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return Object.assign({ Accept: 'application/vnd.github+json' }, UA, tok ? { Authorization: 'Bearer ' + tok } : {});
};

async function get(url, { headers = UA, timeout = 30000, as = 'json' } = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${new URL(url).host}`);
  return as === 'json' ? r.json() : as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
}

/* —— tar.gz：只在内存里读，GitHub 的打包带 pax 头（长路径、提交号） —— */
function* untar(buf) {
  let off = 0, pax = null, longName = null;
  const field = (h, a, b) => h.subarray(a, b).toString('utf8').replace(/\0[\s\S]*$/, '');
  const parsePax = data => {
    const out = {};
    const s = data.toString('utf8');
    for (let i = 0; i < s.length;) {
      const sp = s.indexOf(' ', i);
      const len = parseInt(s.slice(i, sp), 10);
      if (!len) break;
      const rec = s.slice(sp + 1, i + len - 1);
      const eq = rec.indexOf('=');
      out[rec.slice(0, eq)] = rec.slice(eq + 1);
      i += len;
    }
    return out;
  };
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h[0] === 0) break;
    let name = field(h, 0, 100);
    const prefix = field(h, 345, 500);
    if (prefix) name = prefix + '/' + name;
    const size = parseInt(field(h, 124, 136).trim() || '0', 8) || 0;
    const type = String.fromCharCode(h[156] || 48);
    const data = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'g') { yield { type, pax: parsePax(data) }; continue; }
    if (type === 'x') { pax = parsePax(data); continue; }
    if (type === 'L') { longName = field(data, 0, data.length); continue; }
    if (pax && pax.path) name = pax.path;
    if (longName) name = longName;
    pax = null; longName = null;
    yield { type, name, data };
  }
}

/* 下载一个官方仓库，写成 data/online/official/<owner>__<repo>.json */
export async function fetchRepo(repo) {
  if (!REPO_RE.test(repo)) throw new Error('仓库名不对：' + repo);
  const gz = await get(`https://codeload.github.com/${repo}/tar.gz/HEAD`, { as: 'buffer', timeout: 120000 });
  const tar = zlib.gunzipSync(gz);
  const files = [];
  const skillTexts = new Map();
  let commit = '';
  for (const e of untar(tar)) {
    if (e.type === 'g') { commit = (e.pax.comment || '').slice(0, 12); continue; }
    if (e.type !== '0' && e.type !== '\0') continue;
    const rel = e.name.split('/').slice(1).join('/'); // 去掉 <repo>-<sha>/ 这一层
    if (!rel) continue;
    files.push(rel);
    if (/(^|\/)skill\.md$/i.test(rel) && e.data.length < 512 * 1024) skillTexts.set(rel, e.data.toString('utf8'));
  }
  const skills = [...skillTexts].sort((a, b) => a[0].localeCompare(b[0])).map(([rel, text]) => {
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
    return { path: rel, text, files: files.filter(f => f !== rel && f.startsWith(dir) && (dir || !f.includes('/'))).map(f => f.slice(dir.length)).slice(0, 60) };
  });
  const out = { repo, commit, fetchedAt: new Date().toISOString(), skills };
  fs.mkdirSync(OFFICIAL_DIR, { recursive: true });
  fs.writeFileSync(path.join(OFFICIAL_DIR, repo.replace('/', '__') + '.json'), JSON.stringify(out));
  return { repo, commit, count: skills.length };
}

export async function fetchOfficial(log = () => {}) {
  const results = [];
  for (const repo of OFFICIAL_REPOS) {
    try {
      const r = await fetchRepo(repo);
      log(`${repo}: ${r.count} 个 skill`);
      results.push(Object.assign({ ok: true }, r));
    } catch (e) {
      log(`${repo}: 下载失败 ${e.message}`);
      results.push({ ok: false, repo, error: e.message });
    }
  }
  return results;
}

/* 已下载的官方库（给扫描和页面用） */
export function officialLibs() {
  let names = [];
  try { names = fs.readdirSync(OFFICIAL_DIR).filter(f => f.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const f of names) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(OFFICIAL_DIR, f), 'utf8'));
      if (j && j.repo && Array.isArray(j.skills)) out.push(j);
    } catch { /* 坏文件跳过，下次下载会覆盖 */ }
  }
  return out.sort((a, b) => OFFICIAL_REPOS.indexOf(a.repo) - OFFICIAL_REPOS.indexOf(b.repo));
}

export function officialStatus() {
  return officialLibs().map(l => ({ repo: l.repo, count: l.skills.length, fetchedAt: l.fetchedAt, commit: l.commit }));
}

/* —— 在公开目录里搜：skills.sh（按安装量）+ claudeskills.info（带路径和描述） —— */
export async function search(q) {
  q = String(q || '').trim().slice(0, 80);
  if (q.length < 2) return [];
  const enc = encodeURIComponent(q);
  const [a, b] = await Promise.allSettled([
    get(`https://skills.sh/api/search?q=${enc}&limit=20`, { timeout: 15000 }),
    get(`https://claudeskills.info/api/v1/search?q=${enc}&limit=20`, { timeout: 15000 }),
  ]);
  const map = new Map();
  const put = (repo, name, extra) => {
    if (!repo || !name || !REPO_RE.test(repo)) return;
    const k = (repo + '/' + name).toLowerCase();
    const cur = map.get(k) || { id: repo + '/' + name, repo, name, from: [] };
    for (const [key, v] of Object.entries(extra)) if (v != null && v !== '' && cur[key] == null) cur[key] = v;
    map.set(k, cur);
    return cur;
  };
  if (a.status === 'fulfilled') for (const s of a.value.skills || []) put(s.source, s.skillId || s.name, { installs: s.installs })?.from.push('skills.sh');
  if (b.status === 'fulfilled') {
    for (const s of b.value.results || []) {
      if (s.type && s.type !== 'skill') continue;
      const url = s.source && s.source.url || '';
      const m = url.match(/github\.com\/[^/]+\/[^/]+\/(?:tree|blob)\/[^/]+\/(.+?)\/?$/);
      put(s.source && s.source.repo, s.name, { description: s.description, stars: s.stars, path: m ? decodeURIComponent(m[1]).replace(/\/SKILL\.md$/i, '') : null })?.from.push('claudeskills.info');
    }
  }
  if (a.status === 'rejected' && b.status === 'rejected') throw new Error(a.reason.message);
  return [...map.values()].slice(0, 30);
}

/* —— 取回一个 skill 的 SKILL.md —— */
const trees = new Map();
async function repoTree(repo) {
  if (trees.has(repo)) return trees.get(repo);
  const j = await get(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`, { headers: ghHeaders() });
  const list = (j.tree || []).filter(x => x.type === 'blob').map(x => x.path);
  trees.set(repo, list);
  return list;
}

export async function fetchSkill({ repo, name, path: p }) {
  // 错误用代码返回，页面按界面语言显示
  if (!REPO_RE.test(repo || '')) throw new Error('badRepo');
  if (p && (p.includes('..') || p.startsWith('/'))) throw new Error('badPath');
  let dir = p ? p.replace(/\/SKILL\.md$/i, '').replace(/\/$/, '') : null;
  let tree = null;
  if (dir == null) {
    tree = await repoTree(repo);
    const cands = tree.filter(f => /(^|\/)SKILL\.md$/i.test(f));
    const base = f => f.split('/').slice(-2, -1)[0] || '';
    const want = String(name || '').toLowerCase();
    const hit = cands.filter(f => base(f).toLowerCase() === want).sort((x, y) => x.length - y.length)[0]
      || cands.filter(f => base(f).toLowerCase().includes(want)).sort((x, y) => x.length - y.length)[0]
      || (cands.length === 1 ? cands[0] : null);
    if (!hit) throw new Error('notFound');
    dir = hit.includes('/') ? hit.slice(0, hit.lastIndexOf('/')) : '';
  }
  const rel = (dir ? dir + '/' : '') + 'SKILL.md';
  const text = await get(`https://raw.githubusercontent.com/${repo}/HEAD/${rel.split('/').map(encodeURIComponent).join('/')}`, { as: 'text', timeout: 20000 });
  let files = [];
  if (tree) files = tree.filter(f => f !== rel && f.startsWith(dir ? dir + '/' : '')).map(f => f.slice(dir ? dir.length + 1 : 0)).slice(0, 60);
  return { repo, path: repo + '/' + rel, url: `https://github.com/${repo}/tree/HEAD/${dir}`, text, files };
}
