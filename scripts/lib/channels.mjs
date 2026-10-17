// skill 从哪里来：各家 agent 的安装目录、工作区里的项目、本机缓存的插件市场、下载下来的官方库
// 目录以各家官方文档为准；~ 会依次替换成每个候选家目录，同一个文件夹（含目录链接）只扫一次
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const env = process.env;
const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';

/* 候选家目录：系统家目录，再加上被 CLAUDE_CONFIG_DIR / CODEX_HOME 整体搬走的家目录（例如 <dir>/.claude → <dir>） */
export function homes() {
  const out = [os.homedir()];
  for (const [v, base] of [[env.CLAUDE_CONFIG_DIR, '.claude'], [env.CODEX_HOME, '.codex']]) {
    if (v && path.basename(v).toLowerCase() === base) out.push(path.dirname(v));
  }
  return uniqDirs(out);
}

function uniqDirs(list) {
  const seen = new Set();
  const out = [];
  for (const d of list) {
    if (!d) continue;
    let real;
    try { real = fs.realpathSync.native(d); } catch { real = path.resolve(d); }
    const k = WIN ? real.toLowerCase() : real;
    if (!seen.has(k)) { seen.add(k); out.push(d); }
  }
  return out;
}

/* 「~/x」在每个家目录下展开；环境变量给出的绝对路径原样用 */
function expand(p, hs) {
  if (!p) return [];
  if (p.startsWith('~/')) return hs.map(h => path.join(h, p.slice(2)));
  return [p];
}

const claudeHome = hs => env.CLAUDE_CONFIG_DIR ? [env.CLAUDE_CONFIG_DIR] : expand('~/.claude', hs);
const codexHome = hs => env.CODEX_HOME ? [env.CODEX_HOME] : expand('~/.codex', hs);
const xdgConfig = hs => env.XDG_CONFIG_HOME ? [env.XDG_CONFIG_HOME] : expand('~/.config', hs);
const xdgData = hs => env.XDG_DATA_HOME ? [env.XDG_DATA_HOME] : expand('~/.local/share', hs);
const under = (bases, sub) => bases.map(b => path.join(b, sub));
const envOr = (name, fallback, hs) => env[name] ? [env[name]] : expand(fallback, hs);

/* 已安装的：agent 名 → 目录。part: user 用户装的 / plugins 插件带的 / builtin 软件自带 / managed 管理员统一下发
   versioned: 相对目录第几段是版本号（插件缓存会留旧版本，只取最新的一个）
   idKey 沿用旧版本的 id 前缀，页面里保存的微调不会丢 */
function agentChannels(hs) {
  const localApp = env.LOCALAPPDATA || (hs[0] && path.join(hs[0], 'AppData', 'Local'));
  const programData = env.ProgramData || 'C:\\ProgramData';
  const copilot = h => envOr('COPILOT_HOME', '~/.copilot', h);
  return [
    { agent: 'Claude Code', idKey: 'claudeUser', dirs: under(claudeHome(hs), 'skills'), depth: 4 },
    { agent: 'Claude Code', part: 'plugins', idKey: 'claudePlugins', dirs: under(claudeHome(hs), 'plugins/cache'), depth: 7, versioned: 2 },
    { agent: 'Claude Code', part: 'managed', idKey: 'claudeManaged', dirs: [WIN ? 'C:\\Program Files\\ClaudeCode\\.claude\\skills' : MAC ? '/Library/Application Support/ClaudeCode/.claude/skills' : '/etc/claude-code/.claude/skills'], depth: 4 },
    { agent: 'Codex', idKey: 'codex', dirs: under(codexHome(hs), 'skills'), depth: 4 },
    { agent: 'Codex', part: 'plugins', idKey: 'codexPlugins', dirs: under(codexHome(hs), 'plugins/cache'), depth: 7, versioned: 2 },
    { agent: 'Codex', part: 'managed', idKey: 'codexManaged', dirs: [WIN ? path.join(programData, 'OpenAI', 'Codex', 'skills') : '/etc/codex/skills'], depth: 4 },
    { agent: '~/.agents', idKey: 'agents', dirs: [...expand('~/.agents/skills', hs), ...under(xdgConfig(hs), 'agents/skills')], depth: 4 },
    { agent: 'GitHub Copilot', idKey: 'copilot', dirs: under(copilot(hs), 'skills'), depth: 4 },
    { agent: 'GitHub Copilot', part: 'plugins', idKey: 'copilotPlugins', dirs: under(copilot(hs), 'installed-plugins'), depth: 6 },
    { agent: 'GitHub Copilot', part: 'builtin', idKey: 'copilotBuiltin', dirs: localApp ? [path.join(localApp, 'copilot', 'pkg')] : [], depth: 5, versioned: 1 },
    { agent: 'Cursor', idKey: 'cursor', dirs: expand('~/.cursor/skills', hs), depth: 4 },
    { agent: 'Gemini CLI', idKey: 'gemini', dirs: expand('~/.gemini/skills', hs), depth: 4 },
    { agent: 'Gemini CLI', part: 'plugins', idKey: 'geminiExt', dirs: expand('~/.gemini/extensions', hs), depth: 5 },
    { agent: 'Antigravity', idKey: 'antigravity', dirs: expand('~/.gemini/antigravity-cli/skills', hs), depth: 4 },
    { agent: 'Antigravity', part: 'builtin', idKey: 'antigravityBuiltin', dirs: expand('~/.gemini/antigravity-cli/builtin/skills', hs), depth: 4 },
    { agent: 'Windsurf / Devin', idKey: 'windsurf', dirs: [...expand('~/.codeium/windsurf/skills', hs), ...under(xdgConfig(hs), 'devin/skills')], depth: 4 },
    { agent: 'Windsurf / Devin', part: 'managed', idKey: 'devinManaged', dirs: [WIN ? path.join(programData, 'Devin', 'skills') : MAC ? '/Library/Application Support/Devin/skills' : '/etc/devin/skills'], depth: 4 },
    { agent: 'OpenCode', idKey: 'opencode', dirs: [...under(xdgConfig(hs), 'opencode/skills'), ...under(xdgConfig(hs), 'opencode/skill')], depth: 4 },
    { agent: 'Goose', idKey: 'goose', dirs: under(xdgConfig(hs), 'goose/skills'), depth: 4 },
    { agent: 'Amp', idKey: 'amp', dirs: under(xdgConfig(hs), 'amp/skills'), depth: 4 },
    { agent: 'Factory Droid', idKey: 'factory', dirs: expand('~/.factory/skills', hs), depth: 4 },
    { agent: 'Kiro', idKey: 'kiro', dirs: expand('~/.kiro/skills', hs), depth: 4 },
    { agent: 'Pi', idKey: 'pi', dirs: under(envOr('PI_CODING_AGENT_DIR', '~/.pi/agent', hs), 'skills'), depth: 4 },
    { agent: 'OpenClaw', idKey: 'openclaw', dirs: under(envOr('OPENCLAW_STATE_DIR', '~/.openclaw', hs), 'skills'), depth: 4 },
    { agent: 'Cline', idKey: 'cline', dirs: expand('~/.cline/skills', hs), depth: 4 },
    { agent: 'Roo Code', idKey: 'roo', dirs: expand('~/.roo/skills', hs), depth: 4 },
    { agent: 'Qwen Code', idKey: 'qwen', dirs: expand('~/.qwen/skills', hs), depth: 4 },
    { agent: 'Kimi Code', idKey: 'kimi', dirs: under(envOr('KIMI_CODE_HOME', '~/.kimi-code', hs), 'skills'), depth: 4 },
    { agent: 'Trae', idKey: 'trae', dirs: [...expand('~/.trae/skills', hs), ...expand('~/.trae-cn/skills', hs)], depth: 4 },
    { agent: 'Lingma', idKey: 'lingma', dirs: expand('~/.lingma/skills', hs), depth: 4 },
    { agent: 'Vibe', idKey: 'vibe', dirs: expand('~/.vibe/skills', hs), depth: 4 },
    { agent: 'Grok', idKey: 'grok', dirs: expand('~/.grok/skills', hs), depth: 4 },
    { agent: 'Grok', part: 'plugins', idKey: 'grokPlugins', dirs: expand('~/.grok/installed-plugins', hs), depth: 6 },
    { agent: 'Grok', part: 'builtin', idKey: 'grokBuiltin', dirs: expand('~/.grok/bundled/skills', hs), depth: 4 },
    { agent: 'mimocode', part: 'builtin', idKey: 'mimocode', dirs: [...under(xdgData(hs), 'mimocode/builtin_skills'), ...under(xdgData(hs), 'mimocode/compose')], depth: 5, versioned: 0 },
    { agent: 'claude-science', idKey: 'claudeScience', dirs: expand('~/.claude-science/skills', hs), depth: 4 },
  ];
}

/* 本机缓存着、但还没装的：插件市场的本地副本。量大，默认折叠 */
function catalogChannels(hs) {
  return [
    { agent: 'Claude Code', idKey: 'claudeMarket', dirs: under(claudeHome(hs), 'plugins/marketplaces'), depth: 7 },
    { agent: 'Codex', idKey: 'codexMarket', dirs: [...under(codexHome(hs), '.tmp/plugins'), ...under(codexHome(hs), '.tmp/bundled-marketplaces')], depth: 7 },
    { agent: 'Codex', idKey: 'codexCurated', dirs: under(codexHome(hs), 'vendor_imports'), depth: 7 },
    { agent: 'Grok', idKey: 'grokMarket', dirs: expand('~/.grok/marketplace-cache', hs), depth: 7 },
  ];
}

/* 项目里放 skill 的位置（各家的项目级目录） */
export const PROJECT_SKILL_DIRS = [
  'skills', 'skill', '.claude/skills', '.agents/skills', '.agent/skills', '.codex/skills', '.github/skills', '.cursor/skills',
  '.gemini/skills', '.opencode/skills', '.opencode/skill', '.windsurf/skills', '.devin/skills', '.kiro/skills', '.factory/skills',
  '.roo/skills', '.cline/skills', '.clinerules/skills', '.qwen/skills', '.pi/skills', '.trae/skills', '.kimi-code/skills', '.goose/skills', '.grok/skills',
];
const NOT_PROJECT = /^(\.|node_modules$|dist$|build$|out$|output$|tmp$|temp$|backups?$|_backup$|__pycache__$|venv$|site-packages$)/i;

function subdirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !NOT_PROJECT.test(e.name)).map(e => e.name); } catch { return []; }
}

/* 工作区：它下面的每个文件夹算一个项目，再往下看一层（项目里套着的子项目） */
function workspaceRoots(workspaces, exclude) {
  const roots = [];
  for (const ws of workspaces) {
    for (const p of subdirs(ws)) {
      const proj = path.join(ws, p);
      if (exclude.some(x => path.resolve(x) === path.resolve(proj))) continue;
      for (const sub of ['', ...subdirs(proj)]) {
        for (const d of PROJECT_SKILL_DIRS) {
          const dir = path.join(proj, sub, d);
          if (fs.existsSync(dir)) roots.push({ kind: 'workspace', key: 'workspace', arg: p, idKey: 'ws:' + p + ':' + (sub ? sub + '/' : '') + d, dir, base: proj, depth: 4 });
        }
      }
    }
  }
  return roots;
}

/* 选项 → 要扫的根目录，按显示顺序排好 */
export function channelRoots({ agents = true, catalog = true, workspaces = [], excludeProjects = [] } = {}) {
  const hs = homes();
  const roots = [];
  const push = (list, kind, keyOf) => {
    for (const c of list) {
      uniqDirs(c.dirs).forEach((dir, i) => {
        roots.push({ kind, key: keyOf(c), arg: c.agent, idKey: c.idKey + (i ? '#' + i : ''), dir, depth: c.depth, versioned: c.versioned });
      });
    }
  };
  if (agents) push(agentChannels(hs), 'installed', c => c.part ? 'agent' + c.part[0].toUpperCase() + c.part.slice(1) : 'agent');
  if (workspaces.length) roots.push(...workspaceRoots(workspaces, excludeProjects));
  if (catalog) push(catalogChannels(hs), 'catalog', () => 'market');
  return roots.filter(r => fs.existsSync(r.dir));
}
