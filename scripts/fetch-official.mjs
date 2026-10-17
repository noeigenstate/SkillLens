// 下载官方 skill 库到 data/online/official/（只保存 SKILL.md 的文字和文件清单）
//   node scripts/fetch-official.mjs
// 页面列表底部的「官方 skill 库 · 下载」做的是同一件事
import { fetchOfficial, OFFICIAL_DIR } from './lib/online.mjs';
import path from 'node:path';
import { ROOT } from './lib/scan.mjs';

const results = await fetchOfficial(m => console.log('  ' + m));
const ok = results.filter(r => r.ok);
console.log(`完成：${ok.reduce((a, r) => a + r.count, 0)} 个 skill → ${path.relative(ROOT, OFFICIAL_DIR)}`);
if (ok.length < results.length) process.exitCode = 1;
