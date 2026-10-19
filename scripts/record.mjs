// 录视频：node scripts/record.mjs <skill 名或 id> [--seconds 40] [--scale 2] [--cols 4] [--theme blueprint|dark|light] [--motion 3d|flat] [--lang en|zh] [--out 文件.mp4]
// 先运行 npm run scan，让 data/skills.js 里有这个 skill
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/scan.mjs';
import { fileUrl } from './lib/cdp.mjs';
import { record } from './lib/recorder.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const name = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!name) {
  console.log('用法：node scripts/record.mjs <skill 名或 id> [--seconds 秒数] [--scale 2] [--cols 4] [--theme light] [--motion 3d|flat] [--lang zh|en] [--out 输出.mp4]');
  process.exit(1);
}
if (!fs.existsSync(path.join(ROOT, 'data/skills.js'))) {
  console.log('还没有 data/skills.js，先运行 npm run scan');
  process.exit(1);
}
const motion = opt('motion') || '3d';
if (!['3d', 'flat'].includes(motion)) throw new Error('--motion: 3d | flat');
const q = new URLSearchParams({ skill: name, record: '1', lang: opt('lang') || 'en', motion });
if (opt('cols')) q.set('cols', opt('cols'));
if (opt('theme')) q.set('theme', opt('theme'));
const out = path.resolve(opt('out') || path.join(ROOT, 'output', name.replace(/[\\/:*?"<>|\s]+/g, '-') + '.mp4'));
fs.mkdirSync(path.dirname(out), { recursive: true });

const r = await record({
  url: fileUrl(path.join(ROOT, 'index.html')) + '?' + q,
  out, seconds: opt('seconds') ? +opt('seconds') : null, scale: opt('scale') ? +opt('scale') : 1,
  log: m => console.log(m),
});
console.log(`完成：${path.relative(process.cwd(), r.file)}（${r.width}×${r.height}，${r.seconds.toFixed(1)} 秒）`);
