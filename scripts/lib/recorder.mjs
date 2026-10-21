// 把一个暴露了 window.SVRec 的页面逐帧截图，交给 ffmpeg 编成 mp4
import { spawn } from 'node:child_process';
import { launch } from './cdp.mjs';

export async function record({ url, out, fps = 30, seconds = null, scale = 1, log = () => {} }) {
  if (seconds != null && (typeof seconds !== 'number' || !Number.isFinite(seconds))) throw new Error('seconds 必须是有限数字或 null');
  if (seconds != null) seconds = Math.max(1, Math.min(90, seconds));
  const b = await launch();
  let ff, done;
  try {
    await b.setViewport(1280, 900, 1);
    await b.goto(url);
    let info = null;
    for (let i = 0; i < 100 && !info; i++) {
      info = await b.evaluate('window.SVRec ? window.SVRec.info() : null');
      if (!info) await new Promise(r => setTimeout(r, 100));
    }
    if (!info) throw new Error('页面没有准备好（找不到 skill，或脚本出错）');
    const auto = info.round0 || info.duration;
    if (seconds == null && (typeof auto !== 'number' || !Number.isFinite(auto))) throw new Error('页面返回无效录制时长');
    const dur = seconds ?? Math.max(1, Math.min(auto, 90));
    const frames = Math.max(1, Math.round(dur * fps));
    await b.setViewport(info.W, info.H, scale);
    log(`画面 ${info.W}×${info.H}，${dur.toFixed(1)} 秒，${frames} 帧`);

    ff = spawn(process.env.SV_FFMPEG || 'ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'pipe'], windowsHide: true });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d; });
    let ffFailure;
    done = new Promise((resolve, reject) => {
      ff.on('error', e => reject(new Error('启动 ffmpeg 失败：' + e.message + '（可以用环境变量 SV_FFMPEG 指定路径）')));
      ff.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg 出错：' + ffErr.trim())));
      ff.stdin.on('error', reject);
    });
    done.catch(e => { ffFailure = e; });
    const write = buf => new Promise((resolve, reject) => {
      if (ffFailure) return reject(ffFailure);
      if (ff.stdin.destroyed) return reject(new Error('ffmpeg 已退出：' + ffErr.trim()));
      const finish = err => {
        ff.stdin.off('drain', drained);
        ff.stdin.off('error', failed);
        ff.off('close', closed);
        if (err) reject(err); else resolve();
      };
      const drained = () => finish();
      const failed = e => finish(e);
      const closed = () => finish(new Error('ffmpeg 已退出：' + ffErr.trim()));
      ff.stdin.once('drain', drained);
      ff.stdin.once('error', failed);
      ff.once('close', closed);
      if (ff.stdin.write(buf)) finish();
    });
    const clip = { x: 0, y: 0, width: info.W, height: info.H };
    for (let i = 0; i < frames; i++) {
      if (ffFailure) throw ffFailure;
      await b.evaluate(`window.SVRec.seek(${(i / fps).toFixed(4)})`);
      await write(await b.screenshot({ format: 'jpeg', quality: 94, clip }));
      if (i % (fps * 5) === 0) log(`  ${Math.round(i / frames * 100)}%`);
    }
    ff.stdin.end();
    await done;
    return { file: out, seconds: dur, frames, width: info.W * scale, height: info.H * scale };
  } finally {
    if (ff && ff.exitCode === null) ff.kill();
    if (done) await done.catch(() => {});
    await b.close();
  }
}
