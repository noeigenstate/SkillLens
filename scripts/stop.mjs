// 停止本机正在运行的 SkillLens 服务
//   node scripts/stop.mjs [--port 5178] [--all]
// 先向端口要进程号（/api/pid），确认是 SkillLens 才结束，不会误杀占用同一端口的其他程序。
const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const ports = argv.includes('--all')
  ? Array.from({ length: 22 }, (_, i) => 5178 + i)
  : [portArg >= 0 ? +argv[portArg + 1] : 5178];

async function ask(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/pid`, { signal: AbortSignal.timeout(2000) });
    const body = res.ok ? await res.json() : null;
    return body && body.app === 'skilllens' && Number.isInteger(body.pid) ? body.pid : null;
  } catch { return null; }
}

let stopped = 0;
for (const port of ports) {
  if (!Number.isInteger(port) || port <= 0) { console.log('端口无效：' + argv[portArg + 1]); process.exit(1); }
  const pid = await ask(port);
  if (!pid) continue;
  try { process.kill(pid); } catch (e) { console.log(`无法结束端口 ${port} 上的进程 ${pid}：${e.message}`); process.exitCode = 1; continue; }
  // 等端口真正释放，最多 5 秒
  for (let i = 0; i < 25 && await ask(port); i++) await new Promise(r => setTimeout(r, 200));
  console.log(`已停止 SkillLens（端口 ${port}，进程 ${pid}）`);
  stopped++;
}
if (!stopped && !process.exitCode) {
  console.log(argv.includes('--all') ? '没有发现正在运行的 SkillLens。' : `端口 ${ports[0]} 上没有正在运行的 SkillLens（其他端口可用 --port 指定，或用 --all 全部停止）。`);
}
