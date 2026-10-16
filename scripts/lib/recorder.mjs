// 把一个暴露了 window.SVRec 的页面逐帧截图，交给 ffmpeg 编成 mp4
import { spawn } from 'node:child_process';
import { launch } from './cdp.mjs';

export async function record({ url, out, fps = 30, seconds = null, scale = 1, log = () => {} }) {
  const b = await launch();
  try {
    await b.setViewport(1280, 900, 1);
    await b.goto(url);
    let info = null;
    for (let i = 0; i < 100 && !info; i++) {
      info = await b.evaluate('window.SVRec ? window.SVRec.info() : null');
      if (!info) await new Promise(r => setTimeout(r, 100));
    }
    if (!info) throw new Error('页面没有准备好（找不到 skill，或脚本出错）');
    const dur = seconds || Math.min(info.round0 || info.duration, 90);
    const frames = Math.max(1, Math.round(dur * fps));
    await b.setViewport(info.W, info.H, scale);
    log(`画面 ${info.W}×${info.H}，${dur.toFixed(1)} 秒，${frames} 帧`);

    const ff = spawn(process.env.SV_FFMPEG || 'ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d; });
    const done = new Promise((resolve, reject) => {
      ff.on('error', e => reject(new Error('启动 ffmpeg 失败：' + e.message + '（可以用环境变量 SV_FFMPEG 指定路径）')));
      ff.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg 出错：' + ffErr.trim())));
    });
    const write = buf => new Promise((resolve, reject) => {
      if (ff.stdin.destroyed) return reject(new Error('ffmpeg 已退出：' + ffErr.trim()));
      ff.stdin.write(buf) ? resolve() : ff.stdin.once('drain', resolve);
    });
    const clip = { x: 0, y: 0, width: info.W, height: info.H };
    for (let i = 0; i < frames; i++) {
      await b.evaluate(`window.SVRec.seek(${(i / fps).toFixed(4)})`);
      await write(await b.screenshot({ format: 'jpeg', quality: 94, clip }));
      if (i % (fps * 5) === 0) log(`  ${Math.round(i / frames * 100)}%`);
    }
    ff.stdin.end();
    await done;
    return { file: out, seconds: dur, frames, width: info.W * scale, height: info.H * scale };
  } finally {
    await b.close();
  }
}
