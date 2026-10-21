/* skillflow 文本格式：解析与生成。写在 SKILL.md 的 ```skillflow 代码块里可以精确控制图 */
SV.mod.dsl = function (SV) {
  const COLORS = ['green', 'blue', 'purple', 'teal', 'rose', 'amber', 'slate'];
  const KINDS = ['flow', 'ref', 'notes', 'bare'];

  /* "标题 [tag] {icon} (opts) +flag" → 各部分 */
  function parseHead(s) {
    let text = String(s || '').trim();
    const out = { tag: '', icon: '', opts: [], flags: [] };
    for (let guard = 0; guard < 6; guard++) {
      let m;
      if ((m = text.match(/\s+\+([a-z]+)\s*$/i))) { out.flags.push(m[1].toLowerCase()); text = text.slice(0, m.index); continue; }
      if ((m = text.match(/\s*\{([a-z0-9-]+)\}\s*$/i))) { out.icon = m[1].toLowerCase(); text = text.slice(0, m.index); continue; }
      if ((m = text.match(/\s*\(([a-z ,]+)\)\s*$/i)) && m[1].split(/[\s,]+/).filter(Boolean).every(w => COLORS.includes(w.toLowerCase()) || KINDS.includes(w.toLowerCase()) || w.toLowerCase() === 'dashed')) {
        out.opts = m[1].toLowerCase().split(/[\s,]+/).filter(Boolean); text = text.slice(0, m.index); continue;
      }
      if ((m = text.match(/\s*\[([^\]]*)\]\s*$/))) { out.tag = m[1].trim(); text = text.slice(0, m.index); continue; }
      break;
    }
    out.text = text.trim();
    return out;
  }

  const indent = l => l.search(/\S|$/);

  function parse(src, ctx) {
    ctx = ctx || {};
    const spec = { title: '', subtitle: '', window: '', footer: '', hero: null, trigger: null, lanes: [], edges: [], reads: [], stubs: [], warnings: [] };
    const nodes = {};
    let auto = 0;
    const lines = String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    let lane = null, node = null, nodeIndent = 0, inFlow = false, hasFlow = false;

    const addNode = (n, line) => {
      if (!n.id) n.id = 'n' + (++auto);
      const id = n.id;
      while (nodes[n.id] && nodes[n.id] !== n) n.id += '_';
      if (n.id !== id) spec.warnings.push(SV.i18n.t('warn.dupId', line, id, n.id));
      nodes[n.id] = n;
      return n;
    };

    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) continue;
      const ind = indent(raw);

      if (inFlow && ind > 0) { parseEdgeLine(line, spec); continue; }
      if (ind === 0) { inFlow = false; node = null; }

      if (node && ind > nodeIndent) {
        if (line.startsWith('>')) node.detail = (node.detail ? node.detail + '\n' : '') + line.replace(/^>\s?/, '');
        else node.lines.push(line);
        continue;
      }
      node = null;

      let m;
      if (ind === 0 && /^flow\s*:?\s*$/i.test(line)) { inFlow = true; hasFlow = true; lane = null; continue; }
      if (ind === 0 && (m = line.match(/^(title|subtitle|window|footer|hero|cols)\s*:\s*(.*)$/i))) {
        const k = m[1].toLowerCase();
        if (k === 'hero') { const [t, sub] = m[2].split('|').map(s => s.trim()); spec.hero = { title: t || '', sub: sub || '' }; }
        else if (k === 'cols') spec.cols = parseInt(m[2], 10) || undefined;
        else spec[k] = m[2].trim();
        continue;
      }
      if (ind === 0 && (m = line.match(/^trigger(?:\s+([\w-]+))?\s*:\s*(.*)$/i))) {
        const h = parseHead(m[2]);
        node = addNode({ id: m[1] || 'start', type: 'trigger', title: h.text, tag: h.tag, icon: h.icon || 'bell', lines: [] }, li + 1);
        nodeIndent = ind;
        spec.trigger = node;
        lane = null;
        continue;
      }
      if (ind === 0 && (m = line.match(/^lane(?:\s+([\w-]+))?\s*:\s*(.*)$/i))) {
        const h = parseHead(m[2]);
        lane = { id: m[1] || 'L' + (spec.lanes.length + 1), title: h.text, tag: h.tag, color: '', kind: 'flow', nodes: [], notes: [] };
        h.opts.forEach(o => { if (COLORS.includes(o)) lane.color = o; else if (KINDS.includes(o)) lane.kind = o; else if (o === 'dashed') lane.kind = 'ref'; });
        spec.lanes.push(lane);
        continue;
      }
      if (lane && (m = line.match(/^note\s*:\s*(.*)$/i))) { lane.notes.push(m[1].trim()); continue; }
      if (lane && (m = line.match(/^summary\s*:\s*(.*)$/i))) { lane.summary = (lane.summary || []).concat(m[1].trim()).slice(0, 2); continue; }
      if (lane && (m = line.match(/^(step|node|decide|decision|if|card)(?:\s+([\w-]+))?\s*:\s*(.*)$/i))) {
        const h = parseHead(m[3]);
        const type = /^(decide|decision|if)$/i.test(m[1]) ? 'decision' : 'step';
        node = addNode({ id: m[2], type, title: h.text, tag: h.tag, icon: h.icon, lines: [], optional: h.flags.includes('optional'), terminal: h.flags.includes('end') || h.flags.includes('terminal') }, li + 1);
        nodeIndent = ind;
        lane.nodes.push(node);
        continue;
      }
      if (lane && (m = line.match(/^[-*]\s+(.*)$/))) {
        const h = parseHead(m[1]);
        node = addNode({ type: 'step', title: h.text, tag: h.tag, icon: h.icon, lines: [] }, li + 1);
        nodeIndent = ind;
        lane.nodes.push(node);
        continue;
      }
      if (/->|~>|=>|\.>/.test(line)) { parseEdgeLine(line, spec); hasFlow = true; continue; }
      spec.warnings.push(SV.i18n.t('warn.dslLine', li + 1, line));
    }

    if (!hasFlow) {
      const chain = [];
      spec.lanes.filter(l => l.kind === 'flow' || l.kind === 'bare').forEach(l => l.nodes.forEach(n => chain.push(n)));
      if (spec.trigger && chain[0]) spec.edges.push({ from: spec.trigger.id, to: chain[0].id, kind: 'flow' });
      for (let i = 0; i + 1 < chain.length; i++) spec.edges.push({ from: chain[i].id, to: chain[i + 1].id, kind: 'flow' });
    }
    spec.edges = spec.edges.filter(e => {
      const ok = nodes[e.from] && (e.stub || nodes[e.to]);
      if (!ok) spec.warnings.push(SV.i18n.t('warn.edgeMissing', e.from, e.to || e.stub));
      return ok;
    });
    spec.edges.filter(e => e.stub).forEach(e => spec.stubs.push({ from: e.from, text: e.stub, label: e.label || '' }));
    spec.edges = spec.edges.filter(e => !e.stub);
    spec.reads = spec.reads.filter(e => {
      const ok = nodes[e.from] && nodes[e.to];
      if (!ok) spec.warnings.push(SV.i18n.t('warn.edgeMissing', e.from, e.to));
      return ok;
    });
    spec.lanes.filter(l => l.kind === 'flow' || l.kind === 'bare').forEach(l => l.nodes.forEach(n => { n.numText = null; }));

    const anyTerminal = Object.values(nodes).some(n => n.terminal);
    if (!anyTerminal) {
      const outs = new Set(spec.edges.map(e => e.from));
      const flowNodes = [];
      spec.lanes.filter(l => l.kind === 'flow' || l.kind === 'bare').forEach(l => l.nodes.forEach(n => flowNodes.push(n)));
      const last = flowNodes.filter(n => !spec.edges.some(e => e.from === n.id && e.kind !== 'loop')).pop();
      if (last && !outs.has(last.id + '__none')) last.terminal = true;
    }
    spec.title = spec.title || ctx.name || 'Skill';
    if (!spec.subtitle && ctx.description) spec.subtitle = SV.text.cut(SV.text.firstSentence(SV.md.strip(ctx.description)), 92);
    spec.window = spec.window || `skills / ${ctx.name || 'skill'} / SKILL.md`;
    spec.name = ctx.name || spec.title;
    spec.description = ctx.description || '';
    spec.zh = SV.text.cjkRatio(src) > 0.1;
    spec.stats = { lanes: spec.lanes.length, steps: spec.lanes.filter(l => l.kind === 'flow').reduce((a, l) => a + l.nodes.length, 0), nodes: Object.keys(nodes).length };
    return spec;
  }

  /* a -> b -> c : 标签   a ~> b   a .> b   a -> "出口说明" */
  function parseEdgeLine(line, spec) {
    let label = '';
    const lm = line.match(/^(.*?)(?:\s+:\s+|\s*：\s*)([^"]*)$/);
    let body = line;
    if (lm && /->|~>|=>|\.>/.test(lm[1])) { body = lm[1]; label = lm[2].trim(); }
    const parts = body.split(/\s*(->|~>|=>|\.>)\s*/);
    for (let i = 0; i + 2 < parts.length; i += 2) {
      const from = parts[i].trim(), arrow = parts[i + 1], to = parts[i + 2].trim();
      if (arrow === '.>') { spec.reads.push({ from, to }); continue; }
      const e = { from, kind: arrow === '~>' ? 'loop' : 'flow', label };
      const q = to.match(/^["“](.*)["”]$/);
      if (q) e.stub = q[1]; else e.to = to;
      spec.edges.push(e);
    }
  }

  /* spec → skillflow 文本 */
  function serialize(spec) {
    const out = [];
    const linesOf = n => (Array.isArray(n.lines) ? n.lines : (n.lines ? [n.lines] : [])).filter(Boolean);
    const head = (n) => {
      let s = n.title || '';
      if (n.tag) s += ` [${n.tag}]`;
      if (n.icon && n.type !== 'decision') s += ` {${n.icon}}`;
      if (n.optional) s += ' +optional';
      return s;
    };
    out.push(`title: ${spec.title || ''}`);
    if (spec.subtitle) out.push(`subtitle: ${spec.subtitle}`);
    if (spec.hero && (spec.hero.title || spec.hero.sub)) out.push(`hero: ${spec.hero.title || ''}${spec.hero.sub ? ' | ' + spec.hero.sub : ''}`);
    if (spec.window) out.push(`window: ${spec.window}`);
    if (spec.footer) out.push(`footer: ${spec.footer}`);
    if (spec.cols) out.push(`cols: ${spec.cols}`);
    out.push('');
    if (spec.trigger) {
      out.push(`trigger ${spec.trigger.id}: ${head(spec.trigger)}`);
      linesOf(spec.trigger).forEach(l => out.push('  ' + l));
      out.push('');
    }
    for (const lane of spec.lanes) {
      const opts = [lane.color, lane.kind !== 'flow' ? lane.kind : ''].filter(Boolean).join(' ');
      out.push(`lane ${lane.id}: ${lane.title}${lane.tag ? ` [${lane.tag}]` : ''}${opts ? ` (${opts})` : ''}`);
      (lane.summary || []).slice(0, 2).forEach(t => out.push(`  summary: ${t}`));
      for (const n of lane.nodes) {
        out.push(`  ${n.type === 'decision' ? 'decide' : 'step'} ${n.id}: ${head(n)}${n.terminal && !n.more ? ' +end' : ''}`);
        linesOf(n).forEach(l => out.push('    ' + l));
      }
      (lane.notes || []).forEach(t => out.push(`  note: ${t}`));
      out.push('');
    }
    out.push('flow:');
    for (const e of spec.edges) out.push(`  ${e.from} ${e.kind === 'loop' ? '~>' : '->'} ${e.to}${e.label ? ' : ' + e.label : ''}`);
    for (const s of spec.stubs || []) out.push(`  ${s.from} -> "${s.text}"${s.label ? ' : ' + s.label : ''}`);
    for (const r of spec.reads || []) out.push(`  ${r.from} .> ${r.to}`);
    return out.join('\n');
  }

  SV.dsl = { parse, serialize, parseHead };
};
SV.mod.dsl(SV);
