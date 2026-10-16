// 扫描 skill，写出 data/skills.js，直接双击 index.html 打开时用
//   node scripts/scan.mjs               项目 skills/、examples/，以及本机 Claude 用户和插件目录里的 skill
//   node scripts/scan.mjs --no-claude   只扫项目里的
//   node scripts/scan.mjs --root 名字=路径
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, resolveRoots, scan } from './lib/scan.mjs';

const roots = resolveRoots(process.argv.slice(2));
const data = scan(roots);
const out = path.join(ROOT, 'data/skills.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, '/* 由 scripts/scan.mjs 生成，不要手改 */\nwindow.SV_DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n');

const byGroup = {};
data.skills.forEach(s => { byGroup[s.group] = (byGroup[s.group] || 0) + 1; });
console.log(`找到 ${data.skills.length} 个 skill → ${path.relative(ROOT, out)}`);
for (const r of roots) console.log(`  ${r.label.padEnd(14)} ${String(byGroup[r.label] || 0).padStart(3)}  ${fs.existsSync(r.dir) ? '' : '（目录不存在）'}`);
