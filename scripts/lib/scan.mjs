// 扫描各个渠道里的 SKILL.md，给页面用
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { channelRoots } from './channels.mjs';
import { officialLibs, OFFICIAL_DIR } from './online.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// 复用页面里的 Markdown 解析
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/markdown.js'), 'utf8'), sandbox);
const md = sandbox.SV.md;

const SKIP = /^(node_modules|\.git|output|dist|\.venv|__pycache__|\.trash)$/;

function findSkillFiles(dir, depth, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isFile() && /^skill\.md$/i.test(e.name)) out.push(path.join(dir, e.name));
  }
  if (depth <= 0) return;
  for (const e of entries) {
    if (e.isDirectory() && !SKIP.test(e.name)) findSkillFiles(path.join(dir, e.name), depth - 1, out);
  }
}

function listFiles(dir, limit = 60) {
  const out = [];
  (function walk(d, rel, depth) {
    if (out.length >= limit || depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => (a.isDirectory() - b.isDirectory()) || a.name.localeCompare(b.name));
    for (const e of entries) {
      if (out.length >= limit) return;
      if (SKIP.test(e.name)) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r, depth + 1);
      else out.push(r);
    }
  })(dir, '', 0);
  return out;
}

export function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

const tilde = p => p.replace(/^~(?=$|[\\/])/, os.homedir());

/* 要扫哪些地方。默认：本仓库、本机所有 agent 装的、工作区里的项目、下载过的官方库、本机缓存的插件市场
   命令行：--project-only（旧名 --no-claude）只看本仓库；--no-agents --no-workspace --no-official --no-catalog 分别关掉一类；
   --workspace 目录（可多次）指定工作区，默认是本仓库所在的上一级文件夹；--root 名字=路径 额外加一个目录
   skillviz.config.json 里的同名字段（agents / workspaces / official / catalog / roots）效果一样 */
export function resolveRoots(argv = []) {
  const roots = [
    { kind: 'project', key: 'project', idKey: 'project', dir: path.join(ROOT, 'skills'), depth: 3 },
    { kind: 'project', key: 'examples', idKey: 'examples', dir: path.join(ROOT, 'examples'), depth: 3 },
  ];
  const opt = { projectOnly: false, agents: true, workspace: true, official: true, catalog: true, workspaces: null };
  const cfgFile = path.join(ROOT, 'skillviz.config.json');
  if (fs.existsSync(cfgFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      (cfg.roots || []).forEach(r => roots.push({ kind: 'custom', label: r.label || r.dir, dir: path.resolve(ROOT, tilde(r.dir)), depth: r.depth || 8 }));
      if (cfg.claude === false) opt.projectOnly = true;
      for (const k of ['agents', 'official', 'catalog']) if (cfg[k] === false) opt[k] = false;
      if (Array.isArray(cfg.workspaces)) opt.workspaces = cfg.workspaces.map(d => path.resolve(ROOT, tilde(d)));
    } catch (e) { console.warn('skillviz.config.json 读取失败：' + e.message); }
  }
  const cliWs = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-claude' || a === '--project-only') opt.projectOnly = true;
    else if (a === '--no-agents') opt.agents = false;
    else if (a === '--no-workspace') opt.workspace = false;
    else if (a === '--no-official') opt.official = false;
    else if (a === '--no-catalog') opt.catalog = false;
    else if (a === '--workspace' && argv[i + 1]) cliWs.push(path.resolve(tilde(argv[++i])));
    else if (a === '--root' && argv[i + 1]) {
      const v = argv[++i];
      const m = v.match(/^([^=]+)=(.+)$/);
      roots.push({ kind: 'custom', label: m ? m[1] : path.basename(v), dir: path.resolve(m ? m[2] : v), depth: 8 });
    }
  }
  if (opt.projectOnly) return roots.filter(r => fs.existsSync(r.dir));
  const workspaces = !opt.workspace ? [] : cliWs.length ? cliWs : opt.workspaces || [path.dirname(ROOT)];
  roots.push(...channelRoots({ agents: opt.agents, catalog: false, workspaces, excludeProjects: [ROOT] }));
  if (opt.official) roots.push({ kind: 'official', key: 'official', virtual: true, dir: OFFICIAL_DIR });
  if (opt.catalog) roots.push(...channelRoots({ agents: false, catalog: true }));
  return roots.filter(r => r.virtual || fs.existsSync(r.dir));
}

/* 插件缓存里同一个插件可能留着好几个版本：只要最新的（被标记 .orphaned_at 的旧版本不算） */
function latestVersions(files, root) {
  const idx = root.versioned;
  const pick = new Map();
  const slotOf = f => {
    const seg = path.relative(root.dir, f).split(path.sep);
    return seg.length > idx + 1 ? { slot: seg.slice(0, idx).join('/'), ver: seg[idx] } : null;
  };
  for (const f of files) {
    const s = slotOf(f);
    if (!s || pick.has(s.slot)) continue;
    const slotDir = path.join(root.dir, s.slot);
    let best = null, bestTime = -1, versions = [];
    try { versions = fs.readdirSync(slotDir, { withFileTypes: true }); } catch { /* 刚被删 */ }
    for (const v of versions) {
      if (!v.isDirectory() && !v.isSymbolicLink()) continue;
      const vd = path.join(slotDir, v.name);
      if (fs.existsSync(path.join(vd, '.orphaned_at'))) continue;
      let t = 0;
      try { t = fs.statSync(vd).mtimeMs; } catch { continue; }
      if (t > bestTime) { best = v.name; bestTime = t; }
    }
    pick.set(s.slot, best);
  }
  return files.filter(f => { const s = slotOf(f); return s && pick.get(s.slot) === s.ver; });
}

function rootFiles(r) {
  const files = [];
  findSkillFiles(r.dir, r.depth, files);
  files.sort();
  return r.versioned != null ? latestVersions(files, r) : files;
}

/* 只看文件路径和修改时间，给页面判断要不要刷新。市场目录量大、很少变，不在这里看 */
export function version(roots) {
  const parts = [];
  for (const r of roots) {
    if (r.kind === 'catalog') continue;
    if (r.virtual) {
      try { for (const f of fs.readdirSync(r.dir)) parts.push(f + ':' + fs.statSync(path.join(r.dir, f)).mtimeMs); } catch { /* 还没下载 */ }
      continue;
    }
    for (const f of rootFiles(r)) { try { parts.push(f + ':' + fs.statSync(f).mtimeMs); } catch { /* 刚被删 */ } }
  }
  parts.sort();
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '-' + parts.length;
}

const hashOf = text => crypto.createHash('sha1').update(text.replace(/\r\n/g, '\n').trim()).digest('hex');

/* 一个根目录里的条目：{ real, rel, text, files, full } */
function entriesOf(r) {
  if (r.virtual) {
    const out = [];
    for (const lib of officialLibs()) {
      for (const s of lib.skills) out.push({ real: 'official:' + lib.repo + '/' + s.path, rel: s.path, text: s.text, files: s.files || [], arg: lib.repo, url: `https://github.com/${lib.repo}/tree/HEAD/${s.path.replace(/\/?SKILL\.md$/i, '')}` });
    }
    return out;
  }
  return rootFiles(r).map(f => {
    let real = f;
    try { real = fs.realpathSync.native(f); } catch { /* 刚被删 */ }
    return { real, rel: path.relative(r.base || r.dir, f).replace(/\\/g, '/'), file: f };
  });
}

export function scan(roots) {
  const skills = [];
  const seenReal = new Set();
  const byHash = new Map();
  const sameWhere = (a, b) => a.key === b.key && a.arg === b.arg && a.label === b.label;
  for (const r of roots) {
    let entries;
    try { entries = entriesOf(r); } catch (e) { console.warn(`扫描 ${r.dir} 失败：${e.message}`); continue; }
    for (const e of entries) {
      const realKey = process.platform === 'win32' ? e.real.toLowerCase() : e.real;
      if (seenReal.has(realKey)) continue;
      seenReal.add(realKey);
      let text = e.text;
      if (text == null) { try { text = fs.readFileSync(e.file, 'utf8'); } catch { continue; } }
      const where = { key: r.key, arg: e.arg || r.arg, label: r.label };
      const h = hashOf(text);
      const first = byHash.get(h);
      if (first) {
        // 同一份内容装在好几个地方：只列一次，记下还在哪
        if (!sameWhere(first.where, where) && !first.alsoIn.some(w => sameWhere(w, where))) first.alsoIn.push(where);
        continue;
      }
      const fm = md.parseFrontMatter(text);
      const dir = e.file ? path.dirname(e.file) : null;
      const desc = fm.data.description;
      const s = {
        id: (r.idKey || r.key || r.label) + ':' + (r.virtual ? where.arg + '/' : '') + e.rel,
        group: r.label || undefined,
        groupKey: r.key || undefined,
        groupArg: where.arg || undefined,
        kind: r.kind,
        name: String(fm.data.name || (dir ? path.basename(dir) : e.rel.split('/').slice(-2, -1)[0] || 'skill')),
        description: md.strip(Array.isArray(desc) ? desc.join(' ') : (desc || '')),
        path: r.virtual ? where.arg + '/' + e.rel : e.rel,
        full: e.file ? path.resolve(e.file) : undefined,
        url: e.url,
        text,
        files: e.files || listFiles(dir).filter(x => x.toLowerCase() !== 'skill.md'),
        alsoIn: [],
      };
      Object.defineProperty(s, 'where', { value: where, enumerable: false });
      byHash.set(h, s);
      skills.push(s);
    }
  }
  return { generatedAt: new Date().toISOString(), skills };
}

/* 按来源汇总，命令行和启动日志用 */
const KIND_NAMES = { project: '本仓库', installed: '已安装', workspace: '工作区项目', official: '官方库', catalog: '插件市场（未安装）', custom: '自定义目录' };
export function summarize(data) {
  const kinds = {};
  for (const s of data.skills) {
    const k = kinds[s.kind] || (kinds[s.kind] = { n: 0, by: {} });
    k.n++;
    const sub = s.groupArg || s.group || '';
    if (sub) k.by[sub] = (k.by[sub] || 0) + 1;
  }
  return Object.keys(KIND_NAMES).filter(k => kinds[k]).map(k => {
    const by = Object.entries(kinds[k].by).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(' · ');
    return `${KIND_NAMES[k]} ${kinds[k].n}${by ? `（${by}）` : ''}`;
  });
}
