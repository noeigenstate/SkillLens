/* 总览与阶段详情：只转换数据，保留原节点编号 */
SV.mod.hier = function (SV) {
  const isFlow = lane => lane.kind === 'flow' || lane.kind === 'bare';
  const copy = value => {
    if (Array.isArray(value)) return value.map(copy);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v)]));
    return value;
  };
  const unique = items => {
    const seen = new Set();
    return items.filter(item => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const sourceOf = lanes => lanes.map(l => l.source || '').filter(Boolean).join('\n\n');
  const linesOf = n => Array.isArray(n.lines) ? n.lines.filter(Boolean).join(' ') : String(n.lines || '');
  /* 取原文首句：去掉标题、代码块、表格和列表符号，只留正文第一句；与标题重复、只有网址的句子跳过 */
  function lead(text, title) {
    const strip = SV.md && SV.md.strip ? SV.md.strip : s => String(s).replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, '');
    const items = [];
    let buf = '', fence = false;
    const flush = () => { if (buf.trim()) items.push(buf.trim()); buf = ''; };
    for (const line of String(text || '').split('\n')) {
      if (/^\s*(?:`{3,}|~{3,})/.test(line)) { flush(); fence = !fence; continue; }
      if (fence) continue;
      if (!line.trim() || /^\s*(?:#{1,6}\s|\||[-*_]{3,}\s*$)/.test(line)) { flush(); continue; }
      const bullet = line.match(/^\s*(?:[-*+]|\d+[.)、])\s+(?:\[[ xX]\]\s*)?(.*)$/);
      if (bullet) { flush(); buf = bullet[1]; } else buf += ' ' + line.replace(/^\s*>\s?/, '');
    }
    flush();
    // strip 之后再清一遍残留：<!doctype …>、被截断的标签、没配对的反引号
    const clean = s => s.replace(/<![a-zA-Z][^>]*>/g, '').replace(/<[!/]?[a-zA-Z][^>]*$/, '').replace(/`+/g, '').replace(/\s+/g, ' ').trim();
    const sentences = items.flatMap(item => clean(strip(item)).replace(/([。！？!?；;])\s*/g, '$1\u0001').replace(/\.\s+/g, '.\u0001').split('\u0001').map(s => s.trim()).filter(Boolean));
    const skip = s => /^https?:\/\/\S+$/.test(s) || !norm(s) || norm(s) === norm(title);
    const i = sentences.findIndex(s => !skip(s));
    if (i < 0) return '';
    let out = sentences[i];
    // 以冒号结尾只是引出下文，把下一句接上
    if (/[:：]$/.test(out) && sentences[i + 1] && !skip(sentences[i + 1])) out += (/[㐀-鿿]$/.test(out.slice(0, -1)) ? '' : ' ') + sentences[i + 1];
    out = out.replace(/[\s:：.。;；]+$/, '');
    const cjk = SV.text && SV.text.cjkRatio ? SV.text.cjkRatio(out) > 0.3 : /[㐀-鿿]/.test(out);
    return SV.text && SV.text.cut ? SV.text.cut(out, cjk ? 140 : 110) : out.slice(0, cjk ? 70 : 110);
  }
  const nodesOf = lanes => lanes.flatMap(l => l.nodes || []);
  const statsOf = spec => ({
    lanes: spec.lanes.length,
    steps: nodesOf(spec.lanes.filter(isFlow)).length,
    nodes: nodesOf(spec.lanes).length + (spec.trigger ? 1 : 0),
  });

  function build(spec) {
    const T = (key, ...args) => SV.i18n.t(key, ...args);
    const labels = { from: T('hier.from'), refs: T('hier.refs') };
    const edges = spec.edges || [], reads = spec.reads || [], stubs = spec.stubs || [];
    const cut = text => SV.text && SV.text.cut ? SV.text.cut(text, 60) : text.length > 60 ? text.slice(0, 59) + '…' : text;
    const canDrill = lanes => {
      const nodes = nodesOf(lanes), ids = new Set(nodes.map(n => n.id));
      return nodes.length >= 2 || nodes.some(n => n.type === 'decision') ||
        edges.some(e => e.kind === 'loop' && ids.has(e.from) && ids.has(e.to)) || stubs.some(s => ids.has(s.from));
    };
    const whole = lane => ({ lanes: [lane], title: lane.title, kind: isFlow(lane) ? 'flow' : lane.kind, laneTitle: null, whole: true });
    /* 阶段一句话：整条泳道取原文首句，拆出来的阶段取第一个节点的原文；
       参考资料的节点标题本身就够短（文件名、几个词）时直接列标题；都没有再用节点标题 */
    const FILE = /^[\w.@~/-]+\.\w{1,5}$/;
    const width = s => SV.text && SV.text.units ? SV.text.units(s) : String(s).length;
    function describe(group, nodes) {
      const titles = nodes.slice(0, 3).map(n => n.title).join(' · ');
      const byTitles = group.kind === 'ref' && nodes.length > 0 &&
        (nodes.every(n => FILE.test(n.title)) || nodes.length <= 3 && width(titles) <= 56 && !titles.includes('…'));
      const found = byTitles ? '' : group.whole
        ? lead(sourceOf(group.lanes), group.title) || lead(nodes.slice(0, 2).map(n => (n.detail || '') + '\n' + linesOf(n)).join('\n\n'), group.title)
        : lead(nodes.slice(0, 1).map(n => (n.detail || '') + '\n' + linesOf(n)).join(''), group.title);
      return found || cut(titles);
    }
    let groups = spec.lanes.filter(isFlow).map(whole);
    const authored = spec.source === 'ai' && groups.length >= 1 && groups.length <= 8 && groups.every(g => (g.lanes[0].summary || []).length);

    /* 节点按原顺序展开；判断与紧随其后的分支目标留在同一阶段 */
    function expand(group) {
      const lane = group.lanes[0], units = [];
      let targets = new Set();
      for (const node of lane.nodes) {
        if (!units.length || !targets.has(node.id) &&
          (node.type !== 'decision' || units[units.length - 1].lanes[0].nodes[0].type !== 'decision')) {
          units.push({ lanes: [{ ...lane, nodes: [] }], title: node.title, kind: 'flow', laneTitle: lane.title, whole: false });
          targets = new Set();
        }
        units[units.length - 1].lanes[0].nodes.push(node);
        if (node.type === 'decision') {
          // 提取器的 Yes 出口已是 stub；其 No 连线表示主线继续。
          edges.filter(e => e.from === node.id && e.kind !== 'loop' && !(node.stub && e.label === 'No')).forEach(e => targets.add(e.to));
        }
      }
      return units;
    }
    while (!authored && groups.length < 3) {
      let largest = -1;
      groups.forEach((group, i) => {
        if (group.whole && nodesOf(group.lanes).length >= 2 &&
          (largest < 0 || nodesOf(group.lanes).length > nodesOf(groups[largest].lanes).length)) largest = i;
      });
      if (largest < 0) break;
      groups.splice(largest, 1, ...expand(groups[largest]));
    }
    /* 主流程集中在一条泳道时（超过一半的步骤），展开后不超过八个就展开，免得真正的步骤都藏在一个节点里；
       作者写了 summary: 的泳道是有意定下的阶段，不拆 */
    for (let again = true; again;) {
      again = false;
      const total = nodesOf(groups.flatMap(g => g.lanes)).length;
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i], n = nodesOf(g.lanes).length;
        if (!g.whole || n < 2 || n * 2 <= total || (g.lanes[0].summary || []).length) continue;
        const units = expand(g);
        if (groups.length - 1 + units.length > 8) continue;
        groups.splice(i, 1, ...units);
        again = true;
        break;
      }
    }

    /* 优先合并节点总数最少的相邻对，同数时优先同泳道、再优先单步 */
    while (groups.length > 8) {
      let best = 0, bestScore;
      for (let i = 0; i + 1 < groups.length; i++) {
        const a = groups[i], b = groups[i + 1];
        const sameLane = a.lanes.length === 1 && b.lanes.length === 1 && a.lanes[0].id === b.lanes[0].id;
        const score = nodesOf(a.lanes).length + nodesOf(b.lanes).length;
        const rank = [score, sameLane ? 0 : 1, !canDrill(a.lanes) && !canDrill(b.lanes) && !a.merged && !b.merged ? 0 : 1];
        if (!bestScore || rank[0] < bestScore[0] || rank[0] === bestScore[0] &&
          (rank[1] < bestScore[1] || rank[1] === bestScore[1] && rank[2] < bestScore[2])) { best = i; bestScore = rank; }
      }
      const a = groups[best], b = groups[best + 1], lanes = a.lanes.map(l => ({ ...l }));
      b.lanes.forEach(lane => {
        const existing = lanes.find(l => l.id === lane.id);
        if (existing) existing.nodes = existing.nodes.concat(lane.nodes);
        else lanes.push(lane);
      });
      const firstTitle = a.firstTitle || a.title, lastTitle = b.lastTitle || b.title;
      groups.splice(best, 2, { lanes, title: T('hier.range', firstTitle, lastTitle), firstTitle, lastTitle,
        kind: 'flow', laneTitle: lanes.length === 1 ? a.laneTitle || b.laneTitle : null, whole: false, merged: true });
    }
    const flowCount = groups.length;
    groups = groups.concat(spec.lanes.filter(l => l.kind === 'ref' || l.kind === 'notes').map(whole));
    const phases = groups.map((group, i) => {
      const nodes = nodesOf(group.lanes);
      const decisions = nodes.filter(n => n.type === 'decision').length;
      const summaries = group.laneTitle === null ? group.lanes.flatMap(l => l.summary || []).filter(Boolean) : [];
      const rules = group.lanes.reduce((n, l) => n + (l.notes || []).length, 0);
      return {
        id: 'P' + (i + 1), title: group.title,
        summary: summaries.length ? summaries.slice(0, 2) : [describe(group, nodes)],
        badge: group.kind === 'notes' ? T('hier.rules', rules) : group.kind === 'ref' ? T('hier.badgeItems', nodes.length) : T(decisions ? 'hier.badge' : 'hier.badgeSteps', nodes.length, decisions),
        // 参考与规则不在总览画布上，只能从右侧列表点进详情，所以有内容就可展开
        drill: group.kind === 'flow' ? !!group.merged || canDrill(group.lanes) : nodes.length >= 1 || rules > 0,
        laneIds: group.lanes.map(l => l.id), nodeIds: nodes.map(n => n.id), laneTitle: group.laneTitle, kind: group.kind,
      };
    });
    const flow = phases.slice(0, flowCount), side = phases.slice(flowCount);
    const owner = new Map();
    phases.forEach(phase => phase.nodeIds.forEach(id => owner.set(id, phase)));
    const phaseNode = phase => {
      const lanes = groups[phases.indexOf(phase)].lanes, first = nodesOf(lanes)[0];
      return {
        ...(!phase.drill && first ? copy(first) : { title: phase.title, tag: phase.badge, icon: first && first.icon || (phase.drill ? 'layers' : ''), lines: copy(phase.summary) }),
        id: phase.id, type: 'step', drill: phase.drill ? phase.id : null,
        detail: phase.kind === 'flow' && !phase.drill && first ? first.detail : sourceOf(lanes),
      };
    };
    const overview = {};
    ['title', 'subtitle', 'window', 'hero', 'footer', 'name', 'description', 'zh', 'frontMatter'].forEach(k => { if (k in spec) overview[k] = copy(spec[k]); });
    overview.trigger = spec.trigger || null;
    // 详情图沿用总览卡片的颜色：主流程绿、参考与规则灰
    const MAIN = 'green', SIDE = 'slate';
    overview.lanes = [{ id: 'OV', kind: 'flow', title: flow.length ? T('hier.main', flow.length) : T('hier.overview'), color: MAIN, nodes: flow.map((phase, i) => ({ ...phaseNode(phase), terminal: i === flow.length - 1 })), notes: [] }];
    // 参考与规则默认不上总览（与主线没有连线，只会占画布）；完全没有主线时才留一条，免得总览是空的
    const inView = phase => phase.kind === 'flow' || !flow.length;
    if (side.length && !flow.length) overview.lanes.push({ id: 'OVR', kind: 'ref', title: labels.refs, color: SIDE, nodes: side.map(phaseNode), notes: [] });
    overview.edges = [];
    if (overview.trigger && flow.length) overview.edges.push({ from: overview.trigger.id, to: flow[0].id, kind: 'flow' });
    flow.forEach((phase, i) => { if (i) overview.edges.push({ from: flow[i - 1].id, to: phase.id, kind: 'flow' }); });
    const seenEdges = new Set();
    edges.forEach(edge => {
      const from = owner.get(edge.from), to = owner.get(edge.to);
      if (!from || !to || from === to || !inView(from) || !inView(to)) return;
      if (edge.kind !== 'loop' && from.kind === 'flow' && to.kind === 'flow' && flow.indexOf(to) === flow.indexOf(from) + 1) return;
      const mapped = { from: from.id, to: to.id, kind: edge.kind, label: edge.label || '' };
      const key = JSON.stringify(mapped);
      if (!seenEdges.has(key)) { seenEdges.add(key); overview.edges.push(mapped); }
    });
    overview.reads = unique(reads.flatMap(read => {
      const from = owner.get(read.from), to = owner.get(read.to);
      return from && to && from !== to && inView(from) && inView(to) ? [{ from: from.id, to: to.id }] : [];
    }));
    overview.stubs = [];
    // 画布不画的参考与规则阶段：只带标题，让右侧列表里的标题和图上文字一起翻译
    overview.sidePhases = side.map(phase => ({ id: phase.id, title: phase.title }));
    overview.stats = statsOf(overview);

    const exits = flow.map((phase, i) => flow[i + 1] ? T('hier.next', flow[i + 1].title) : '');
    function detail(phaseId) {
      const index = phases.findIndex(phase => phase.id === phaseId);
      if (index < 0) return null;
      const phase = phases[index], lanes = groups[index].lanes, ids = new Set(phase.nodeIds);
      const color = phase.kind === 'flow' ? MAIN : SIDE;
      const result = { title: phase.title, subtitle: phase.summary.join(' · '), phase: phase.id, source: sourceOf(lanes), trigger: null, lanes: copy(lanes).map(l => ({ ...l, color })) };
      ['window', 'hero', 'footer', 'name', 'zh'].forEach(k => { if (k in spec) result[k] = copy(spec[k]); });
      if (phase.kind === 'flow') {
        // 第一个阶段的入口就是触发点，不再标「上一步」
        result.trigger = { id: '__from', type: 'trigger', title: index ? flow[index - 1].title : spec.trigger && spec.trigger.title || '', tag: index ? labels.from : '', icon: 'corner-down-right', lines: '' };
      }
      const refs = nodesOf(spec.lanes.filter(l => l.kind === 'ref')).filter(n => !ids.has(n.id) && reads.some(r => ids.has(r.from) && r.to === n.id));
      if (refs.length) {
        let id = '__refs';
        while (result.lanes.some(l => l.id === id)) id += '_';
        result.lanes.push({ id, kind: 'ref', title: labels.refs, color: 'slate', nodes: copy(refs), notes: [] });
      }
      const refIds = new Set(refs.map(n => n.id).concat(nodesOf(lanes.filter(l => l.kind === 'ref')).map(n => n.id)));
      result.edges = copy(edges.filter(e => ids.has(e.from) && ids.has(e.to)));
      if (result.trigger && phase.nodeIds.length) result.edges.push({ from: '__from', to: phase.nodeIds[0], kind: 'flow' });
      result.reads = copy(reads.filter(r => ids.has(r.from) && refIds.has(r.to)));
      result.stubs = copy(stubs.filter(s => ids.has(s.from)));
      if (phase.kind === 'flow' && exits[index] && phase.nodeIds.length) {
        const leaving = edges.filter(e => ids.has(e.from) && !ids.has(e.to)).map(e => e.from);
        const from = leaving.length ? [...new Set(leaving)] : phase.nodeIds.slice(-1);
        from.forEach(id => result.stubs.push({ from: id, text: exits[index], label: '' }));
      }
      result.stats = statsOf(result);
      return result;
    }
    return { overview, phases, detail };
  }

  SV.hier = { build };
};
SV.mod.hier(SV);
