/* 通俗讲解：把一层图整理成给服务端的请求，再把讲解结果套回图上（纯函数，不碰网络）。
   页面和独立网页共用这一份，所以写成 SV.mod.explain 形式，导出时用 toString() 内联 */
SV.mod.explain = function (SV) {
  const CAP = 1200; // 每个节点最多送出的原文
  const FILE = /^[\w.@~/ +-]+\.\w{1,5}$|\/$/;
  const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
  const linesOf = n => Array.isArray(n.lines) ? n.lines.filter(Boolean).map(String) : n.lines ? [String(n.lines)] : [];
  const bare = s => String(s == null ? '' : s).replace(/`/g, ''); // 卡片和标题是纯文字，反引号只在右侧面板里变成代码样式
  const plainLabel = s => /^(?:yes|no|是|否)$/i.test(String(s).trim());

  /* 原文太长时尽量停在段落或句子边界 */
  function clipSource(text) {
    const s = String(text || '').replace(/\r\n?/g, '\n');
    if (s.length <= CAP) return s;
    const head = s.slice(0, CAP);
    const stop = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('\n- '), head.lastIndexOf('. '), head.lastIndexOf('。'));
    return (stop > CAP * 0.6 ? head.slice(0, stop + 1) : head).trimEnd();
  }

  /* 值得讲解的节点：触发条件、步骤、判断；跳过「还有 N 项」占位、纯文件名卡片和内部节点（__from / __refs） */
  function members(spec) {
    const out = [];
    if (spec.trigger && spec.trigger.id && !/^__/.test(spec.trigger.id)) out.push(spec.trigger);
    for (const lane of spec.lanes || []) {
      if (/^__/.test(lane.id || '')) continue;
      for (const n of lane.nodes || []) {
        if (n.more || !n.id || (lane.kind === 'ref' && FILE.test(String(n.title || '').trim()))) continue;
        out.push(n);
      }
    }
    return out;
  }

  /* 请求体：只含当前这一层可见的内容。opt: { lang, skill:{name,description}, parts:{节点编号:[里面的步骤标题]} } */
  function payload(spec, opt) {
    const nodes = members(spec).map(n => {
      const o = { id: n.id, type: n.type || 'step', title: clip(n.title, 300), lines: linesOf(n).map(l => clip(l, 400)), source: clipSource(n.detail || '') };
      if (n.alternative) o.alternative = true;
      const parts = opt.parts && opt.parts[n.id];
      if (parts && parts.length) o.parts = parts.slice(0, 10).map(p => clip(p, 120));
      return o;
    });
    if (!nodes.length) return null;
    const ids = new Set(nodes.map(n => n.id));
    const edges = (spec.edges || []).filter(e => ids.has(e.from) && ids.has(e.to) && e.label && !plainLabel(e.label))
      .map(e => ({ from: e.from, to: e.to, label: clip(e.label, 120) }));
    const level = spec.phase ? 'phase' : 'overview';
    const out = { lang: opt.lang, skill: { name: clip(opt.skill && opt.skill.name, 120), description: clip(opt.skill && opt.skill.description, 1500) }, level };
    if (level === 'phase') out.phase = { title: clip(spec.title, 200) };
    out.nodes = nodes;
    out.edges = edges;
    return out;
  }

  /* 缓存键：页面自己用，和服务端的键无关 */
  function hash(str) {
    let a = 0x811c9dc5, b = 0x9e3779b9;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b + c + i, 0x85ebca6b) ^ (b >>> 13);
    }
    return (a >>> 0).toString(36) + (b >>> 0).toString(36) + str.length.toString(36);
  }
  const keyOf = pl => pl ? hash(JSON.stringify(pl)) : '';

  /* 讲解要接管的原文（标题、说明行、连线文字、副标题）。讲解还没回来时，这些先不送去翻译 */
  function scope(spec, pl) {
    const out = new Set();
    if (!pl) return out;
    const byId = new Map(members(spec).map(n => [n.id, n]));
    for (const p of pl.nodes) {
      const n = byId.get(p.id);
      if (!n) continue;
      if (n.type !== 'trigger' && n.title) out.add(String(n.title));
      linesOf(n).forEach(l => out.add(l));
    }
    pl.edges.forEach(e => out.add(e.label));
    if (spec.subtitle) out.add(String(spec.subtitle));
    return out;
  }

  /* 把讲解结果写进图（会改 spec）。返回已被讲解覆盖的文字集合。
     ctx（只用于阶段详情）：{ phaseTitle, fromTitle, stubs: { 原文: 新文 } }，用总览里讲解过的阶段名保持上下一致 */
  function apply(spec, ex, ctx) {
    const covered = new Set();
    const put = s => { covered.add(s); return s; };
    ctx = ctx || {};
    const nodes = (ex && ex.nodes) || {};
    for (const n of members(spec)) {
      const x = nodes[n.id];
      if (!x || !(x.explain || x.line || x.title)) continue;
      if (n.type !== 'trigger' && x.title) n.title = put(bare(x.title));
      if (x.line) n.lines = [put(bare(x.line))];
      n.ex = { explain: x.explain || '', why: x.why || '', watch: x.watch || '' };
    }
    const labels = (ex && ex.labels) || {};
    for (const e of spec.edges || []) {
      const label = labels[e.from + '>' + e.to];
      if (label) e.label = put(bare(label));
    }
    if (ex && ex.skill && ex.skill.what && !spec.phase) {
      spec.subtitle = put(bare(ex.skill.what));
      spec.ex = { what: ex.skill.what, when: ex.skill.when || '', result: ex.skill.result || '' };
    }
    if (ex && ex.phase && ex.phase.what && spec.phase) {
      spec.subtitle = put(bare(ex.phase.what));
      spec.ex = { what: ex.phase.what };
    }
    if (spec.phase && ctx.phaseTitle) {
      // 整条泳道就是这个阶段时，泳道名和页面标题一起换成讲解过的阶段名，免得上下两个叫法
      const old = String(spec.title || '');
      spec.title = put(bare(ctx.phaseTitle));
      for (const lane of spec.lanes || []) if (old && lane.title === old) lane.title = spec.title;
    }
    if (ctx.fromTitle && spec.trigger && spec.trigger.id === '__from') spec.trigger.title = put(bare(ctx.fromTitle));
    if (ctx.stubs) for (const s of spec.stubs || []) if (Object.prototype.hasOwnProperty.call(ctx.stubs, s.text)) s.text = put(bare(ctx.stubs[s.text]));
    return covered;
  }

  SV.explain = { payload, keyOf, hash, scope, apply, members, bare };
};
SV.mod.explain(SV);
