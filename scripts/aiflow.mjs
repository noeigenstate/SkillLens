// 离线扫描来源，共用服务端队列和缓存。
import { resolveRoots, scan } from './lib/scan.mjs';
import { analyze, jobState } from './lib/aiflow.mjs';

const argv = process.argv.slice(2), names = argv.filter(s => !s.startsWith('--'));
if (!names.length) {
  console.error('Usage: npm run aiflow -- <name-or-id> [...] [--force]');
  process.exitCode = 1;
} else {
  const { skills } = scan(resolveRoots([]));
  for (const name of names) {
    const skill = skills.find(s => s.id === name) || skills.find(s => s.name === name);
    if (!skill) { console.error(name + ': skill not found'); process.exitCode = 1; continue; }
    try {
      let job = await analyze(skill, { force: argv.includes('--force') });
      while (['queued', 'running'].includes(job.state)) {
        await new Promise(r => setTimeout(r, 250));
        job = jobState(job.key);
      }
      if (job.state !== 'done') throw new Error(job.error);
      const sp = job.spec, flow = sp.lanes.filter(l => l.kind === 'flow'), nodes = flow.flatMap(l => l.nodes);
      console.log(`${name}: ${(sp.ai.ms / 1000).toFixed(1)}s${job.cached ? ' (cached)' : ''}`);
      flow.forEach(l => console.log(`  ${l.title} · ${l.nodes.length} nodes · ${l.nodes.filter(n => n.type === 'decision').length} decisions`));
      console.log(`  ${nodes.length} nodes · ${nodes.filter(n => n.type === 'decision').length} decisions · ${sp.edges.filter(e => e.kind === 'loop').length} loops · ${sp.stubs.length} exits · quoted ${sp.ai.verify.quoted}/${sp.ai.verify.nodes}`);
      console.log(`  fallback: ${sp.ai.verify.fallbackPhases.join(', ') || '—'}; truncated: ${sp.ai.verify.truncatedPhases.join(', ') || '—'}`);
    } catch (e) { console.error(name + ': ' + e.message); process.exitCode = 1; }
  }
}
