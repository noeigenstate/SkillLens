// 扫描目录里的 SKILL.md，给页面用
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// 复用页面里的 Markdown 解析
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/markdown.js'), 'utf8'), sandbox);
const md = sandbox.SV.md;

const SKIP = /^(node_modules|\.git|output|dist|\.venv|__pycache__)$/;

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

/* 默认来源：项目 skills/、examples/，再加 skillviz.config.json 和命令行里的 */
export function resolveRoots(argv = []) {
  const roots = [
    { key: 'project', label: '项目 skills', dir: path.join(ROOT, 'skills'), depth: 3 },
    { key: 'examples', label: '示例', dir: path.join(ROOT, 'examples'), depth: 3 },
  ];
  const cfgFile = path.join(ROOT, 'skillviz.config.json');
  // 默认带上本机 Claude 的 skill；--no-claude 只看项目里的
  let includeClaude = !argv.includes('--no-claude');
  if (fs.existsSync(cfgFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      (cfg.roots || []).forEach(r => roots.push({ label: r.label || r.dir, dir: path.resolve(ROOT, r.dir.replace(/^~(?=$|[\\/])/, os.homedir())), depth: r.depth || 8 }));
      if (cfg.claude === false) includeClaude = false;
    } catch (e) { console.warn('skillviz.config.json 读取失败：' + e.message); }
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) {
      const v = argv[++i];
      const m = v.match(/^([^=]+)=(.+)$/);
      roots.push({ label: m ? m[1] : path.basename(v), dir: path.resolve(m ? m[2] : v), depth: 8 });
    }
  }
  if (includeClaude) {
    const c = claudeDir();
    roots.push({ key: 'claudeUser', label: 'Claude 用户 skills', dir: path.join(c, 'skills'), depth: 4 });
    roots.push({ key: 'claudePlugins', label: 'Claude 插件 skills', dir: path.join(c, 'plugins'), depth: 9 });
  }
  return roots;
}

/* 只看文件路径和修改时间，给页面判断要不要刷新 */
export function version(roots) {
  const parts = [];
  for (const r of roots) {
    if (!fs.existsSync(r.dir)) continue;
    const files = [];
    findSkillFiles(r.dir, r.depth, files);
    for (const f of files) { try { parts.push(f + ':' + fs.statSync(f).mtimeMs); } catch { /* 刚被删 */ } }
  }
  parts.sort();
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '-' + parts.length;
}

export function scan(roots) {
  const skills = [];
  const seen = new Set();
  for (const r of roots) {
    if (!fs.existsSync(r.dir)) continue;
    const files = [];
    findSkillFiles(r.dir, r.depth, files);
    files.sort();
    for (const f of files) {
      const real = fs.realpathSync(f);
      if (seen.has(real)) continue;
      seen.add(real);
      const text = fs.readFileSync(f, 'utf8');
      const fm = md.parseFrontMatter(text);
      const dir = path.dirname(f);
      const rel = path.relative(r.dir, f).replace(/\\/g, '/');
      const desc = fm.data.description;
      skills.push({
        id: (r.key || r.label) + ':' + rel,
        group: r.label,
        groupKey: r.key || undefined,
        name: String(fm.data.name || path.basename(dir)),
        description: md.strip(Array.isArray(desc) ? desc.join(' ') : (desc || '')),
        path: rel,
        text,
        files: listFiles(dir).filter(x => x.toLowerCase() !== 'skill.md'),
      });
    }
  }
  return { generatedAt: new Date().toISOString(), skills };
}
