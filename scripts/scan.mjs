// 扫描 skill，写出 data/skills.js，直接双击 index.html 打开时用
//   node scripts/scan.mjs                 本仓库、本机所有 agent 装的、工作区项目、下载过的官方库、本机缓存的插件市场
//   node scripts/scan.mjs --project-only  只扫本仓库
//   其他开关：--no-agents --no-workspace --no-official --no-catalog --workspace 目录 --root 名字=路径
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, resolveRoots, scan, summarize } from './lib/scan.mjs';

const roots = resolveRoots(process.argv.slice(2));
const data = scan(roots);
const out = path.join(ROOT, 'data/skills.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, '/* 由 scripts/scan.mjs 生成，不要手改 */\nwindow.SV_DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n');

console.log(`找到 ${data.skills.length} 个 skill → ${path.relative(ROOT, out)}`);
for (const line of summarize(data)) console.log('  ' + line);
