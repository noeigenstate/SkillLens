/* 几何 → SVG；播放器：当前步骤高亮、数据点沿线流动。所有画面都是时间 t 的纯函数 */
SV.mod.render = function (SV) {
  const { esc } = SV.md;

  /* 蓝图（默认）：Blueprint；深色：Midnight Terminal；浅色：Soft Glass */
  const THEMES = {
    blueprint: {
      blueprint: true, page: '#071e32', pageTo: '', grid: '#123b54', ruler: '#0a2740', path: '#5f86a3',
      text: '#e6f5ff', text2: '#8fafc6', text3: '#5d7f99', edge: '#3f8fb2', label: '#cfe9f7',
      comet: '#48edff', dotCore: '#e8fdff', loopDot: '#ffbe57', note: '#ffbe57', reads: '#cfe9f7', active: '#ffbe57', termIcon: '#071e32',
      tagBg: 'rgba(99,217,245,0.12)', tagText: '#7fd3ec', rCard: 8, rLane: 12, shadow: false,
      lanes: {
        green: { accent: '#63d9f5', stroke: '#2d7fa3', fill: 'rgba(9,40,64,0.72)', card: '#0e3049', cardStroke: 'rgba(99,217,245,0.7)', icon: '#0b2a42' },
        blue: { accent: '#7aa8ff', stroke: '#3a5f9e', fill: 'rgba(10,33,66,0.72)', card: '#10304f', cardStroke: 'rgba(122,168,255,0.7)', icon: '#0c2848' },
        purple: { accent: '#a99bff', stroke: '#4e4d96', fill: 'rgba(17,30,66,0.72)', card: '#142f50', cardStroke: 'rgba(169,155,255,0.65)', icon: '#13284a' },
        teal: { accent: '#5ee6d0', stroke: '#2a8a86', fill: 'rgba(8,42,58,0.72)', card: '#0d3349', cardStroke: 'rgba(94,230,208,0.65)', icon: '#0a2d40' },
        rose: { accent: '#ff8fb1', stroke: '#8a4d6b', fill: 'rgba(30,30,58,0.72)', card: '#16304b', cardStroke: 'rgba(255,143,177,0.6)', icon: '#1a2a46' },
        amber: { accent: '#ffbe57', stroke: '#8f7036', fill: 'rgba(24,36,50,0.72)', card: '#13314a', cardStroke: 'rgba(255,190,87,0.6)', icon: '#162c42' },
        slate: { accent: '#4598bb', stroke: '#24597a', fill: 'rgba(8,34,54,0.6)', card: '#0d2c45', cardStroke: 'rgba(69,152,187,0.6)', icon: '#0b2840' },
      },
    },
    dark: {
      page: '#0b0d12', pageTo: '', dots: '#2a3140', path: '#6b7488',
      text: '#eef1f8', text2: '#929caf', text3: '#5f687a', edge: '#5d6577', label: '#c3c9d6',
      comet: '#8fffd0', dotCore: '#e9fff6', loopDot: '#f5c470', note: '#7ae8bc', reads: '#a9adff', termIcon: '#0b0d12',
      tagBg: 'rgba(146,156,175,0.12)', tagText: '#9aa4b8', rCard: 12, rLane: 18, shadow: false,
      lanes: {
        green: { accent: '#7ae8bc', stroke: '#2b5a4a', fill: '#0d1714', card: '#121b1a', cardStroke: '#253633', icon: '#14302a' },
        blue: { accent: '#a3a7ff', stroke: '#363b73', fill: '#0e1020', card: '#141727', cardStroke: '#272c47', icon: '#1d2042' },
        purple: { accent: '#cfa8ff', stroke: '#4d3a73', fill: '#130e1f', card: '#191428', cardStroke: '#30284a', icon: '#271c42' },
        teal: { accent: '#6fdbe8', stroke: '#24575f', fill: '#0c1719', card: '#111c1f', cardStroke: '#233a3e', icon: '#13303a' },
        rose: { accent: '#ff9fbf', stroke: '#6b3348', fill: '#1a0e14', card: '#20141b', cardStroke: '#3e2532', icon: '#3a1c2a' },
        amber: { accent: '#f5c470', stroke: '#6b5326', fill: '#17130b', card: '#1d1912', cardStroke: '#3a3120', icon: '#352914' },
        slate: { accent: '#9ba6bb', stroke: '#2a3140', fill: '#0f1218', card: '#151a23', cardStroke: '#262d3a', icon: '#1e2430' },
      },
    },
    light: {
      page: '#eee9fc', pageTo: '#e6f5ef', dots: '#cfc8e6', path: '#8a93a6',
      text: '#283449', text2: '#66728a', text3: '#9aa3b5', edge: '#a2abbd', label: '#4a5568',
      comet: '#2fc28e', dotCore: '#ffffff', loopDot: '#e0a12e', note: '#3fa57f', reads: '#7c63d6', termIcon: '#ffffff',
      tagBg: 'rgba(124,135,155,0.12)', tagText: '#7c879b', rCard: 16, rLane: 22, shadow: true,
      lanes: {
        green: { accent: '#2f9d76', stroke: '#c4ebdb', fill: 'rgba(233,248,241,0.86)', card: '#ffffff', cardStroke: '#e3f1ea', icon: '#dcf4ea' },
        blue: { accent: '#3a78c9', stroke: '#cfe2f7', fill: 'rgba(235,244,253,0.86)', card: '#ffffff', cardStroke: '#e1eaf5', icon: '#dceafa' },
        purple: { accent: '#7d5bd0', stroke: '#e0d4f8', fill: 'rgba(243,238,253,0.86)', card: '#ffffff', cardStroke: '#ebe4f8', icon: '#ece3fb' },
        teal: { accent: '#1f9aa6', stroke: '#c5e9ec', fill: 'rgba(232,247,248,0.86)', card: '#ffffff', cardStroke: '#e0f0f2', icon: '#d8f1f3' },
        rose: { accent: '#d0517a', stroke: '#f5d0dc', fill: 'rgba(253,239,243,0.86)', card: '#ffffff', cardStroke: '#f5e2e8', icon: '#fbe2ea' },
        amber: { accent: '#c47f12', stroke: '#f1dfb8', fill: 'rgba(253,246,232,0.86)', card: '#ffffff', cardStroke: '#f2e8d2', icon: '#f9ecd2' },
        slate: { accent: '#5e6b80', stroke: '#dde1ea', fill: 'rgba(246,247,251,0.8)', card: '#ffffff', cardStroke: '#e6e9f0', icon: '#eceff4' },
      },
    },
  };

  const f1 = v => Math.round(v * 10) / 10;
  const icon = (name, x, y, size, color, width) => {
    const inner = SV.ICONS[name] || SV.ICONS['circle-dot'] || '';
    const s = size / 24;
    return `<g transform="translate(${f1(x)},${f1(y)}) scale(${f1(s * 1000) / 1000})" fill="none" stroke="${color}" stroke-width="${width || 2}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  };
  const txt = (x, y, s, attrs) => `<text x="${f1(x)}" y="${f1(y)}" ${attrs || ''}>${esc(s)}</text>`;
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  function bgColor(P, key) {
    if (!key || key === 'page') return P.page;
    const [, color] = key.split(':');
    return (P.lanes[color] || P.lanes.slate).fill;
  }

  function toSVG(G, opt) {
    opt = opt || {};
    const P = THEMES[opt.theme] || THEMES.dark;
    const K = G.K;
    const W = G.W, H = G.H;
    const pal = c => P.lanes[c] || P.lanes.slate;
    const reads = G.reads || [], readers = {};
    reads.forEach(r => { const ids = readers[r.to] = readers[r.to] || []; if (!ids.includes(r.from)) ids.push(r.from); });
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${G.FONT}' class="sv-svg" data-theme="${opt.theme || 'dark'}">`);
    out.push(`<defs>
<marker id="sv-arw" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M1.2,1.4 L8.8,5 L1.2,8.6 z" fill="${P.edge}"/></marker>
<radialGradient id="sv-glow"><stop offset="0" stop-color="${P.comet}" stop-opacity="0.75"/><stop offset="0.45" stop-color="${P.comet}" stop-opacity="0.22"/><stop offset="1" stop-color="${P.comet}" stop-opacity="0"/></radialGradient>
<radialGradient id="sv-glow-amber"><stop offset="0" stop-color="${P.loopDot}" stop-opacity="0.7"/><stop offset="1" stop-color="${P.loopDot}" stop-opacity="0"/></radialGradient>
<filter id="sv-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="sv-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#7d72b0" flood-opacity="0.13"/></filter>
<linearGradient id="sv-page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.page}"/><stop offset="1" stop-color="${P.pageTo || P.page}"/></linearGradient>
</defs>`);
    out.push(`<rect width="${W}" height="${H}" fill="url(#sv-page)"/>`);
    const BP = !!P.blueprint;
    if (BP) {
      out.push(`<pattern id="sv-grid-s" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="${P.grid}" stroke-width="0.6" opacity="0.5"/></pattern>`);
      out.push(`<pattern id="sv-grid" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#sv-grid-s)"/><path d="M100 0H0V100" fill="none" stroke="${P.grid}" stroke-width="1"/></pattern>`);
      out.push(`<rect width="${W}" height="${H}" fill="url(#sv-grid)"/>`);
      // 顶部与左侧刻度尺
      const R = 16, ticks = [];
      out.push(`<rect width="${W}" height="${R}" fill="${P.ruler}"/><rect width="${R}" height="${H}" fill="${P.ruler}"/><path d="M0 ${R}H${W}M${R} 0V${H}" stroke="${P.grid}"/>`);
      for (let x = 20; x < W; x += 20) ticks.push(`M${x} ${R}V${R - (x % 100 ? 4 : 9)}`);
      for (let y = 20; y < H; y += 20) ticks.push(`M${R} ${y}H${R - (y % 100 ? 4 : 9)}`);
      out.push(`<path d="${ticks.join('')}" stroke="${P.text3}" stroke-width="1" opacity="0.7"/>`);
      const nums = [];
      for (let x = 100; x < W - 20; x += 100) nums.push(txt(x + 3, 10.5, String(x), ''));
      for (let y = 100; y < H - 20; y += 100) nums.push(`<text transform="translate(10.5,${y + 3}) rotate(90)">${y}</text>`);
      out.push(`<g font-family='${G.MONO}' font-size="8.5" fill="${P.text3}">${nums.join('')}</g>`);
      out.push(txt(W - 22, 38.5, `W ${W} · H ${H}`, `text-anchor="end" font-family='${G.MONO}' font-size="11.5" fill="${P.text3}"`));
    }
    // 节点编号（蓝图里卡片右下角的 01 02…）
    const nodeNo = {};
    let noSeq = 0;
    (G.spec.lanes || []).forEach(l => (l.nodes || []).forEach(n => { nodeNo[n.id] = ++noSeq; }));
    const pad3 = v => String(v).padStart(3, '0');

    // 页眉：窗口小圆点 + 文件路径，下面是左对齐的大标题
    const hx = K.LANE_X + 2;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => out.push(`<circle cx="${hx + 5 + i * 17}" cy="34" r="5" fill="${c}" opacity="0.9"/>`));
    out.push(txt(hx + 58, 38.5, G.header.window, `font-family='${G.MONO}' font-size="12.5" fill="${P.path}" letter-spacing="0.2"`));
    out.push(txt(hx, 96, G.header.titleText, `font-size="36" font-weight="800" font-style="italic" letter-spacing="-0.6" fill="${P.text}"`));
    if (G.header.subText) out.push(txt(hx, 128, G.header.subText, `font-size="17" fill="${P.text2}"`));

    // 图例
    if (G.legend) {
      for (const it of G.legend.items) {
        const y = G.legend.y;
        if (it.kind === 'solid') out.push(`<line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 38)}" y2="${f1(y)}" stroke="${P.edge}" stroke-width="1.6"/>`);
        else if (it.kind === 'dashed') out.push(`<line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 38)}" y2="${f1(y)}" stroke="${P.edge}" stroke-width="1.6" stroke-dasharray="11 8"/>`);
        else if (it.kind === 'reads') out.push(`<line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 38)}" y2="${f1(y)}" stroke="${P.reads}" stroke-width="${P === THEMES.dark ? '2.0' : '1.8'}" stroke-dasharray="0.1 6" stroke-linecap="round"/><circle cx="${f1(it.x + 38)}" cy="${f1(y)}" r="2.8" fill="${P.reads}"/>`);
        else out.push(`<circle cx="${f1(it.x + 8)}" cy="${f1(y)}" r="12" fill="url(#sv-glow)" opacity="0.6"/><circle cx="${f1(it.x + 8)}" cy="${f1(y)}" r="4.5" fill="${P.dotCore}" stroke="${P.comet}" stroke-width="2"/>`);
        out.push(txt(it.x + (!reads.length && it.kind === 'dot' ? 36 : 48), y + 5.5, it.text, `font-size="15.5" fill="${P.text2}"`));
      }
    }

    // 泳道
    for (const L of G.lanes) {
      if (L.kind === 'bare') continue;
      const c = pal(L.color);
      const dash = L.kind === 'flow' && !BP ? '' : ' stroke-dasharray="5 6"';
      out.push(`<rect x="${L.x}" y="${f1(L.y)}" width="${L.w}" height="${f1(L.h)}" rx="${P.rLane}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.3"${dash}/>`);
      if (BP) {
        const x0 = L.x - 3, y0 = L.y - 3, x1 = L.x + L.w + 3, y1 = L.y + L.h + 3, k = 16;
        out.push(`<path d="M${x0} ${y0 + k}V${y0}H${x0 + k}M${x1 - k} ${y0}H${x1}V${y0 + k}M${x1} ${y1 - k}V${y1}H${x1 - k}M${x0 + k} ${y1}H${x0}V${y1 - k}" fill="none" stroke="${c.accent}" stroke-width="1.6"/>`);
        const ids = (G.spec.lanes.find(l => l.id === L.id) || { nodes: [] }).nodes.map(n => nodeNo[n.id]).filter(Boolean);
        if (ids.length) out.push(txt(L.x + L.w - 16, L.y + 30, '#' + pad3(Math.min(...ids)) + (ids.length > 1 ? '-' + pad3(Math.max(...ids)) : ''), `text-anchor="end" font-family='${G.MONO}' font-size="11" fill="${P.text3}"`));
      }
      let tx = L.x + 19;
      const band = [L.y + 8, L.y + 52];
      const crossing = G.edges.filter(e => e.pts.some((p, i) => i > 0 && Math.abs(p[0] - e.pts[i - 1][0]) < 0.5 && Math.min(p[1], e.pts[i - 1][1]) < band[1] && Math.max(p[1], e.pts[i - 1][1]) > band[0])).map(e => e.pts.find((p, i) => i > 0 && Math.abs(p[0] - e.pts[i - 1][0]) < 0.5 && Math.min(p[1], e.pts[i - 1][1]) < band[1] && Math.max(p[1], e.pts[i - 1][1]) > band[0])[0]);
      const span = L.titleW + (L.tagText ? 14 + SV.layoutUtil.measure(L.tagText, 14.5) : 0);
      for (const x of crossing.sort((a, b) => a - b)) if (x > tx - 12 && x < tx + span + 12) tx = x + 25;
      out.push(txt(tx, L.y + 36, L.titleText, `font-size="20" font-weight="700" fill="${P.text}"`));
      if (L.tagText) out.push(txt(tx + L.titleW + 13, L.y + 36, L.tagText, `font-size="14.5" fill="${P.text3}"`));
      if (L.notes.length) {
        const mid = (L.notes[0].y + L.notes[L.notes.length - 1].y) / 2 - 5;
        out.push(icon('info', L.x + 22, mid - 12, 24, P.text2, 1.6));
        for (const [ni, nt] of L.notes.entries()) {
          if (BP) out.push(txt(nt.x - 2, nt.y, String(ni + 1).padStart(2, '0'), `font-family='${G.MONO}' font-size="14" font-weight="500" fill="${P.note}"`));
          else out.push(`<line x1="${nt.x}" y1="${f1(nt.y - 5)}" x2="${nt.x + 16}" y2="${f1(nt.y - 5)}" stroke="${c.accent}" stroke-width="2" stroke-linecap="round"/>`);
          out.push(txt(nt.x + 30, nt.y, nt.text, `font-size="15.5" fill="${P.text2}"`));
        }
      }
    }

    // 连线
    // 标签及出口外扩 4px 后挖空，旋转标签沿用自己的局部坐标
    const labels = G.edges.map(e => e.lab).concat(G.stubs.map(s => s.lab)).filter(Boolean);
    const holes = reads.length ? labels.map(lab => {
      const w = lab.w || SV.layoutUtil.measure(lab.text, 13);
      if (lab.rotate) return `<g transform="translate(${f1(lab.x)},${f1(lab.y)}) rotate(${lab.rotate})"><rect x="${f1(-w / 2 - 10)}" y="-14" width="${f1(w + 20)}" height="28" fill="black"/></g>`;
      const x = lab.anchor === 'start' ? lab.x - 3 : lab.anchor === 'end' ? lab.x - w - 5 : lab.x - w / 2 - 4;
      return `<rect x="${f1(x - 4)}" y="${f1(lab.y - 17)}" width="${f1(w + 16)}" height="26" fill="black"/>`;
    }).concat(G.stubs.map(s => `<rect x="${f1(s.x - 4)}" y="${f1(s.y - 4)}" width="${f1(s.w + 8)}" height="${s.h + 8}" fill="black"/>`)).join('') : '';
    out.push('<g class="sv-reads" pointer-events="none">');
    for (const r of reads) {
      out.push(`<mask id="sv-read-mask-${r.id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path data-reveal="${r.id}" d="${r.d}" pathLength="${r.len}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-dasharray="${r.len} ${r.len}" stroke-dashoffset="${r.len}"/>${holes}</mask>`);
      out.push(`<path d="${r.d}" fill="none" stroke="${P.reads}" stroke-width="${P === THEMES.dark ? '2.0' : '1.8'}" stroke-dasharray="0.1 6" stroke-linecap="round" mask="url(#sv-read-mask-${r.id})" opacity="0" data-read="${r.id}"/>`);
    }
    out.push('</g>');
    out.push('<g class="sv-edges">');
    for (const e of G.edges) {
      out.push(`<path d="${e.d}" fill="none" stroke="${P.edge}" stroke-width="1.5"${e.kind === 'loop' ? ' stroke-dasharray="9 7"' : ''} marker-end="url(#sv-arw)" data-edge="${e.id}"/>`);
    }
    for (const s of G.stubs) {
      out.push(`<path d="${s.d}" fill="none" stroke="${P.edge}" stroke-width="1.3" marker-end="url(#sv-arw)"/>`);
      const bg = bgColor(P, G.bgAt(s.cx, s.y + 5));
      out.push(`<g class="sv-stub" data-stub="${s.id}"><rect x="${f1(s.x)}" y="${f1(s.y)}" width="${f1(s.w)}" height="${s.h}" rx="13" fill="${bg}" stroke="${P.note}" stroke-width="1.2" stroke-dasharray="4 4"/>`);
      out.push(`<rect class="sv-hl" x="${f1(s.x - 4)}" y="${f1(s.y - 4)}" width="${f1(s.w + 8)}" height="${s.h + 8}" rx="16" fill="none" stroke="${P.note}" stroke-width="1.6" opacity="0"/>`);
      out.push(txt(s.cx, s.y + 17.5, s.text, `text-anchor="middle" font-size="12.5" fill="${P.note}"`) + '</g>');
    }
    out.push('</g>');

    // 连线标签
    const yn = s => (s === 'Yes' ? SV.i18n.t('label.yes') : s === 'No' ? SV.i18n.t('label.no') : s);
    for (const lab of labels) {
      const bg = bgColor(P, lab.bg || G.bgAt(lab.x, lab.y));
      const w = lab.w || SV.layoutUtil.measure(lab.text, 13);
      if (lab.rotate) {
        out.push(`<g transform="translate(${f1(lab.x)},${f1(lab.y)}) rotate(${lab.rotate})"><rect x="${f1(-w / 2 - 6)}" y="-10" width="${f1(w + 12)}" height="20" fill="${bg}"/>${txt(0, 5, yn(lab.text), `text-anchor="middle" font-size="13.5" fill="${P.label}"`)}</g>`);
      } else {
        const x0 = lab.anchor === 'start' ? lab.x - 3 : lab.anchor === 'end' ? lab.x - w - 5 : lab.x - w / 2 - 4;
        out.push(`<rect x="${f1(x0)}" y="${f1(lab.y - 13)}" width="${f1(w + 8)}" height="18" rx="3" fill="${bg}" opacity="${reads.length ? 1 : 0.92}"/>`);
        out.push(txt(lab.x, lab.y, yn(lab.text), `text-anchor="${lab.anchor}" font-size="13" fill="${P.label}"`));
      }
    }

    // 主角区
    if (G.hero) {
      const h = G.hero;
      const cy = h.y + h.h / 2;
      const big = h.place === 'lane';
      const ix = h.x + (big ? 24 : 0);
      out.push(`<g class="sv-hero">`);
      out.push(icon('refresh-cw', ix, cy - (big ? 30 : 26), big ? 26 : 22, P.text2, 1.8));
      const tx = ix + (big ? 40 : 34);
      out.push(`<text class="sv-hero-title" x="${f1(tx)}" y="${f1(cy - (big ? 10 : 8))}" font-size="${big ? 29 : 24}" font-weight="800" font-style="italic" fill="${P.text}"></text>`);
      out.push(`<text class="sv-hero-sub" x="${f1(tx)}" y="${f1(cy + (big ? 20 : 16))}" font-size="${big ? 16 : 14.5}" fill="${P.text2}"></text>`);
      out.push(`<g class="sv-hero-dots" transform="translate(${f1(tx + 5)},${f1(cy + (big ? 42 : 36))})"></g>`);
      out.push('</g>');
      h.textX = tx;
      h.maxW = h.x + h.w - tx - 10;
    }

    // 节点
    out.push('<g class="sv-nodes">');
    const allNodes = Object.values(G.nodes);
    const trigColor = (G.lanes.find(l => l.kind === 'flow' || l.kind === 'bare') || {}).color || 'green';
    for (const n of allNodes) {
      const c = pal(n.type === 'trigger' ? trigColor : n.color);
      const act = P.active || c.accent;
      out.push(`<g class="sv-node" data-node="${esc(n.id)}" style="cursor:pointer">`);
      const tip = [n.spec.title, Array.isArray(n.spec.lines) ? n.spec.lines.join(' / ') : n.spec.lines].filter(Boolean).join(' — ');
      if (tip) out.push(`<title>${esc(tip)}</title>`);
      if (n.type === 'decision') {
        const pts = (o) => `${f1(n.cx)},${f1(n.cy - n.h / 2 - o)} ${f1(n.cx + n.w / 2 + o)},${f1(n.cy)} ${f1(n.cx)},${f1(n.cy + n.h / 2 + o)} ${f1(n.cx - n.w / 2 - o)},${f1(n.cy)}`;
        out.push(`<g class="sv-hl" opacity="0"><polygon points="${pts(2)}" fill="${act}" opacity="0.18" filter="url(#sv-blur)"/><polygon points="${pts(7)}" fill="none" stroke="${act}" stroke-width="1.4" opacity="0.6"/></g>`);
        out.push(`<polygon class="sv-shape" points="${pts(0)}" fill="${c.card}" stroke="${c.accent}" stroke-opacity="0.55" stroke-width="1.4"${P.shadow ? ' filter="url(#sv-shadow)"' : ''}/>`);
        out.push(`<polygon class="sv-hl" points="${pts(0)}" fill="none" stroke="${act}" stroke-width="2" opacity="0"/>`);
        const nl = n.titleLines.length;
        const base = n.cy - (nl - 1) * 10 + 5 - (n.sub ? 8 : 0);
        n.titleLines.forEach((l, i) => out.push(txt(n.cx, base + i * 20, l, `text-anchor="middle" font-size="${n.titleSize}" font-weight="700" fill="${P.text}"`)));
        if (n.sub) out.push(txt(n.cx, base + (nl - 1) * 20 + 20, n.sub, `text-anchor="middle" font-size="12" fill="${P.text3}"`));
      } else {
        const dash = n.optional ? ' stroke-dasharray="6 5"' : '';
        const rc = P.rCard;
        out.push(`<g class="sv-hl" opacity="0"><rect x="${f1(n.x)}" y="${f1(n.y)}" width="${n.w}" height="${n.h}" rx="${rc + 2}" fill="${act}" opacity="${P.shadow ? 0.28 : 0.18}" filter="url(#sv-blur)"/><rect x="${f1(n.x - 5)}" y="${f1(n.y - 5)}" width="${n.w + 10}" height="${n.h + 10}" rx="${rc + 4}" fill="none" stroke="${act}" stroke-width="1.2" opacity="0.5"/></g>`);
        out.push(`<rect class="sv-shape" x="${f1(n.x)}" y="${f1(n.y)}" width="${n.w}" height="${n.h}" rx="${rc}" fill="${c.card}" stroke="${c.cardStroke}" stroke-width="1.2"${dash}${P.shadow ? ' filter="url(#sv-shadow)"' : ''}/>`);
        out.push(`<rect class="sv-hl" x="${f1(n.x)}" y="${f1(n.y)}" width="${n.w}" height="${n.h}" rx="${rc}" fill="none" stroke="${act}" stroke-width="2" opacity="0"${dash}/>`);
        if (BP && nodeNo[n.id] || !BP && reads.length && ['flow', 'bare'].includes(n.laneKind)) out.push(txt(n.x + n.w - 9, n.y + n.h - 8, String(nodeNo[n.id]).padStart(2, '0'), `text-anchor="end" font-family='${G.MONO}' font-size="10" fill="${BP ? P.text3 : P.text2}"${BP ? '' : ' opacity="0.75" data-card-no="' + esc(n.id) + '"'}`));
        const ib = 52, ix = n.x + 12, iy = n.cy - ib / 2;
        if (n.terminal) {
          out.push(`<rect x="${f1(ix)}" y="${f1(iy)}" width="${ib}" height="${ib}" rx="11" fill="${c.accent}"/>`);
          out.push(icon(n.icon || 'circle-check', ix + 12, iy + 12, 28, P.termIcon, 2));
        } else {
          out.push(`<rect x="${f1(ix)}" y="${f1(iy)}" width="${ib}" height="${ib}" rx="${P.rCard - 2}" fill="${c.icon}"${BP ? ` stroke="${c.accent}" stroke-opacity="0.45"` : ''}/>`);
          out.push(`<rect class="sv-hl" x="${f1(ix)}" y="${f1(iy)}" width="${ib}" height="${ib}" rx="${P.rCard - 2}" fill="${act}" opacity="0" fill-opacity="0.14"/>`);
          out.push(icon(n.icon || 'circle-dot', ix + 12, iy + 12, 28, c.accent, 1.9));
        }
        const tx = n.x + K.TEXT_X;
        const tl = n.titleLines.length;
        const titleH = tl * 22, tagH = n.tagBelow ? 17 : 0, bodyH = n.body.length * 21;
        const blockH = titleH + tagH + (n.body.length ? 8 : 0) + bodyH;
        const top = n.cy - blockH / 2;
        n.titleLines.forEach((l, i) => out.push(txt(tx, top + 16 + i * 22, l, `font-size="${n.titleSize}" font-weight="700" fill="${P.text}"`)));
        const pill = (x, y) => {
          const tw = SV.layoutUtil.measure(n.tag, 10.5, 500, G.MONO);
          out.push(`<rect x="${f1(x)}" y="${f1(y - 11.5)}" width="${f1(tw + 12)}" height="16" rx="5" fill="${P.tagBg}"/>`);
          out.push(txt(x + 6, y, n.tag, `font-family='${G.MONO}' font-size="10.5" font-weight="500" fill="${P.tagText}"`));
        };
        if (n.tagInline) pill(tx + SV.layoutUtil.measure(n.titleLines[0], n.titleSize, 700) + 8, top + 15);
        else if (n.tagBelow) pill(tx, top + titleH + 12);
        n.body.forEach((l, i) => out.push(txt(tx, top + titleH + tagH + 8 + 15 + i * 21, l, `font-size="14" fill="${P.text2}"`)));
      }
      // 阅读目标只用内描边和轻洗色，不借用步骤的模糊光晕
      const shape = (attrs, inset) => n.type === 'decision'
        ? `<polygon points="${n.cx},${n.y + inset} ${n.x + n.w - inset},${n.cy} ${n.cx},${n.y + n.h - inset} ${n.x + inset},${n.cy}" ${attrs}/>`
        : `<rect x="${f1(n.x + inset)}" y="${f1(n.y + inset)}" width="${n.w - inset * 2}" height="${n.h - inset * 2}" rx="${P.rCard}" ${attrs}/>`;
      if (readers[n.id]) out.push(`<g class="sv-read-hl" opacity="0">${shape(`fill="${P.reads}" opacity="${BP ? 0.08 : P.shadow ? 0.10 : 0.07}"`, 0)}${shape(`fill="none" stroke="${P.reads}" stroke-width="1.6" opacity="0.9"`, 1)}</g>`);
      if (reads.some(r => r.from === n.id)) out.push(shape(`class="sv-reader-ring" fill="none" stroke="${P.reads}" stroke-width="1.4" opacity="0"`, -2));
      if (reads.length && n.type === 'decision' && ['flow', 'bare'].includes(n.laneKind)) out.push(txt(n.x + n.w - 9, n.y + n.h - 8, String(nodeNo[n.id]).padStart(2, '0'), `text-anchor="end" font-family='${G.MONO}' font-size="10" fill="${BP ? P.text3 : P.text2}" opacity="${BP ? 0.6 : 0.75}" data-card-no="${esc(n.id)}"`));
      if (n.laneKind === 'ref' && readers[n.id]) {
        const ids = readers[n.id].slice().sort((a, b) => nodeNo[a] - nodeNo[b]), shown = ids.slice(0, 3);
        const suffix = ids.length > 3 ? ' +' + (ids.length - 3) : '';
        const label = '← ' + shown.map(id => String(nodeNo[id]).padStart(2, '0')).join('·') + suffix;
        const x = n.x + 75, y = n.y + n.h - 11, w = SV.layoutUtil.measure(label, 10.5, 500, G.MONO) + 12;
        const box = fill => `<rect x="${f1(x)}" y="${f1(y - 11.5)}" width="${f1(w)}" height="16" rx="5" ${fill}/>`;
        const spans = shown.map((id, i) => `${i ? '·' : ''}<tspan data-reader="${esc(id)}" font-weight="500">${String(nodeNo[id]).padStart(2, '0')}</tspan>`).join('');
        const attrs = `font-family='${G.MONO}' font-size="10.5" font-weight="500"`;
        out.push(`<g class="sv-read-chip">${box(`fill="${P.tagBg}"`)}${txt(x + 6, y, label, `${attrs} fill="${P.tagText}"`)}</g>`);
        out.push(`<g class="sv-read-chip-lit" opacity="0">${box(`fill="${P.reads}" opacity="0.16"`)}<text x="${f1(x + 6)}" y="${f1(y)}" ${attrs} fill="${P.reads}">← ${spans}${suffix}</text></g>`);
      }
      out.push('</g>');
    }
    out.push('</g>');

    // 端点画在卡片之上，避免边缘圆点被卡片填色裁掉
    for (const r of reads) {
      const a = r.pts[0], b = r.pts[r.pts.length - 1], s = G.nodes[r.from];
      const c = pal(s.type === 'trigger' ? trigColor : s.color);
      out.push(`<circle data-read-origin="${r.id}" cx="${a[0]}" cy="${a[1]}" r="3" fill="${c.card}" stroke="${P.reads}" stroke-width="1.2" opacity="0" pointer-events="none"/>`);
      out.push(`<circle data-read-end="${r.id}" cx="${b[0]}" cy="${b[1]}" r="2.8" fill="${P.reads}" opacity="0" pointer-events="none"/><circle data-read-pulse="${r.id}" cx="${b[0]}" cy="${b[1]}" r="2.8" fill="none" stroke="${P.reads}" stroke-width="1.2" opacity="0" pointer-events="none"/>`);
    }

    // 流动层
    out.push('<g class="sv-flow" pointer-events="none">');
    for (const e of G.edges) {
      if (e.kind === 'loop') {
        out.push(`<g data-comet="${e.id}">` + [0, 1, 2].map(() => `<circle r="2.4" fill="${P.loopDot}" opacity="0"/>`).join('') + '</g>');
      } else {
        out.push(`<g data-comet="${e.id}"><circle r="10" fill="url(#sv-glow)" opacity="0"/>` + [3.4, 2.8, 2.3, 1.8, 1.3].map((r, i) => `<circle r="${r}" fill="${i === 0 ? P.dotCore : P.comet}" stroke="${i === 0 ? P.comet : 'none'}" stroke-width="${i === 0 ? 1.6 : 0}" opacity="0" data-k="${i}"/>`).join('') + '</g>');
      }
    }
    out.push(`<g class="sv-traveler"><circle r="15" fill="url(#sv-glow)" opacity="0"/>` + [5, 4.2, 3.6, 3, 2.5, 2, 1.6, 1.2].map((r, i) => `<circle r="${r}" fill="${i === 0 ? P.dotCore : P.comet}" stroke="${i === 0 ? P.comet : 'none'}" stroke-width="${i === 0 ? 2 : 0}" opacity="0"/>`).join('') + '</g>');
    out.push('</g>');

    if (G.footer) out.push(txt(16, G.footerY, SV.layoutUtil.fit(G.footer, W - 32, 12.5, 400, G.MONO), `font-family='${G.MONO}' font-size="12.5" fill="${P.text3}"`));
    out.push('</svg>');
    return out.join('\n');
  }

  /* —— 巡游路线：主路径一轮，然后每轮在一个分支点改走另一支 —— */
  function buildTour(G) {
    const outs = {};
    G.edges.forEach(e => { (outs[e.from] = outs[e.from] || []).push(e); });
    const stubsBy = {};
    G.stubs.forEach(s => { (stubsBy[s.from] = stubsBy[s.from] || []).push(s); });
    const firstFlow = G.lanes.find(l => (l.kind === 'flow' || l.kind === 'bare') && l.rows.length);
    const start = G.trigger && outs[G.trigger.id] ? G.trigger.id : (firstFlow ? firstFlow.rows[0].nodes[0].id : null);
    if (!start) return null;
    const options = id => {
      const es = (outs[id] || []).slice();
      const flow = es.filter(e => e.kind !== 'loop'), loop = es.filter(e => e.kind === 'loop');
      return flow.map(e => ({ edge: e })).concat(loop.map(e => ({ edge: e })), (stubsBy[id] || []).map(s => ({ stub: s })));
    };

    function walk(devId) {
      const steps = [];
      const visits = {};
      let cur = start, deviated = false;
      for (let guard = 0; guard < 80; guard++) {
        visits[cur] = (visits[cur] || 0) + 1;
        steps.push({ node: cur });
        const opts = options(cur);
        if (!opts.length) break;
        let pick = opts[0];
        if (cur === devId && !deviated && opts.length > 1) { pick = opts[1]; deviated = true; }
        if (pick.edge && pick.edge.kind === 'loop' && visits[cur] > 1) pick = opts.find(o => o.edge && o.edge.kind !== 'loop') || pick;
        if (pick.stub) { steps.push({ stub: pick.stub }); break; }
        const e = pick.edge;
        steps.push({ edge: e });
        if (visits[e.to] && (e.kind === 'loop' && !options(e.to).length || visits[e.to] >= 2 || e.to === start)) break;
        if (visits[e.to] && e.kind === 'loop' && (cur !== devId)) break;
        cur = e.to;
      }
      return steps;
    }
    const main = walk(null);
    const branchIds = [];
    main.forEach(s => { if (s.node && options(s.node).length > 1 && !branchIds.includes(s.node)) branchIds.push(s.node); });
    const rounds = [main].concat(branchIds.slice(0, 6).map(id => walk(id)));

    const NODE_T = 1.15, PAUSE = 0.9;
    const segs = [];
    let t = 0;
    rounds.forEach((steps, ri) => {
      const nodeSteps = steps.filter(s => s.node || s.stub);
      let idx = 0;
      steps.forEach(s => {
        if (s.node) {
          const n = G.nodes[s.node];
          const d = n.type === 'trigger' ? 1.3 : NODE_T;
          segs.push({ type: 'node', id: s.node, t0: t, t1: t + d, round: ri, idx: idx++, total: nodeSteps.length });
          t += d;
        } else if (s.edge) {
          const d = Math.max(0.5, Math.min(1.35, s.edge.len / 300));
          segs.push({ type: 'edge', id: s.edge.id, edge: s.edge, t0: t, t1: t + d, round: ri, idx, total: nodeSteps.length });
          t += d;
        } else if (s.stub) {
          const d = Math.max(0.4, Math.min(0.8, s.stub.len / 120));
          segs.push({ type: 'stubEdge', id: s.stub.id, stub: s.stub, t0: t, t1: t + d, round: ri, idx, total: nodeSteps.length });
          t += d;
          segs.push({ type: 'stub', id: s.stub.id, stub: s.stub, t0: t, t1: t + 1.2, round: ri, idx: idx++, total: nodeSteps.length });
          t += 1.2;
        }
      });
      segs.push({ type: 'pause', t0: t, t1: t + PAUSE, round: ri, idx, total: nodeSteps.length });
      t += PAUSE;
    });
    return { segs, duration: t, rounds: rounds.length };
  }

  /* 折线上按长度取点（忽略圆角，误差 < 3px） */
  function sampler(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = acc[acc.length - 1];
    return s => {
      if (s <= 0) return pts[0];
      if (s >= total) return pts[pts.length - 1];
      let i = 1;
      while (acc[i] < s) i++;
      const k = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    };
  }

  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

  function createPlayer(svg, G, opt) {
    opt = opt || {};
    const tour = buildTour(G);
    const nodeEls = {}, stubEls = {}, cards = {};
    svg.querySelectorAll('.sv-node').forEach(el => {
      const id = el.getAttribute('data-node');
      nodeEls[id] = Array.from(el.querySelectorAll('.sv-hl'));
      cards[id] = { el, hl: el.querySelector('.sv-read-hl'), chip: el.querySelector('.sv-read-chip-lit'), ring: el.querySelector('.sv-reader-ring'), nums: Array.from(el.querySelectorAll('[data-reader]')) };
    });
    svg.querySelectorAll('.sv-stub').forEach(el => { stubEls[el.getAttribute('data-stub')] = Array.from(el.querySelectorAll('.sv-hl')); });
    const readIndex = {};
    const reads = (G.reads || []).map(r => ({ r, index: readIndex[r.from] = (readIndex[r.from] == null ? 0 : readIndex[r.from] + 1),
      el: svg.querySelector(`[data-read="${r.id}"]`), mask: svg.querySelector(`[data-reveal="${r.id}"]`), origin: svg.querySelector(`[data-read-origin="${r.id}"]`), end: svg.querySelector(`[data-read-end="${r.id}"]`), pulse: svg.querySelector(`[data-read-pulse="${r.id}"]`) }));
    const comets = G.edges.map(e => {
      const g = svg.querySelector(`[data-comet="${e.id}"]`);
      const len = e.len;
      const loop = e.kind === 'loop';
      const speed = loop ? 46 : 74;
      const period = Math.max(len + (loop ? 120 : 170), 300) / speed;
      return { e, els: g ? Array.from(g.children) : [], at: sampler(e.pts), len, speed, period, phase: hash(e.id) * period, loop };
    });
    const traveler = svg.querySelector('.sv-traveler');
    const trav = Array.from(svg.querySelectorAll('.sv-traveler circle'));
    const travSamplers = {};
    G.edges.forEach(e => { travSamplers[e.id] = sampler(e.pts); });
    G.stubs.forEach(s => { travSamplers[s.id] = sampler(s.pts); });
    const heroTitle = svg.querySelector('.sv-hero-title');
    const heroSub = svg.querySelector('.sv-hero-sub');
    const heroDots = svg.querySelector('.sv-hero-dots');
    const P = THEMES[svg.getAttribute('data-theme')] || THEMES.dark;
    const laneOf = id => { const n = G.nodes[id]; return n && n.lane >= 0 ? G.lanes[n.lane] : null; };

    let t = 0, playing = opt.autoplay !== false, speed = 1, raf = 0, last = 0;
    let lastHero = '';
    let pin = null, hover = null, hoverLevel = 1, preview = null;
    // 同一时间重复渲染不依赖上一帧；只缓存相同属性值的写入
    const attrs = new WeakMap();
    const attr = (el, key, value) => {
      if (!el) return;
      let a = attrs.get(el); if (!a) attrs.set(el, a = {});
      value = String(value);
      if (a[key] !== value) { el.setAttribute(key, value); a[key] = value; }
    };
    const clamp = x => Math.max(0, Math.min(1, x));
    const listeners = [];

    function segAt(tt) {
      if (!tour) return null;
      const s = tour.segs;
      let lo = 0, hi = s.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid].t1 <= tt) lo = mid + 1; else hi = mid; }
      return lo;
    }

    function setAlpha(map) {
      Object.keys(nodeEls).concat(Object.keys(stubEls)).forEach(k => {
        const a = map[k] || 0;
        const els = nodeEls[k] || stubEls[k];
        if (els) els.forEach(el => attr(el, 'opacity', a.toFixed(3)));
      });
    }

    function renderReads(alpha, lit, tt, lt) {
      if (!reads.length) return;
      const targets = {}, chips = {}, activeReaders = {}, rings = {}, pinnedTargets = new Set();
      reads.forEach(read => {
        const { r } = read, s = lit[r.from];
        const age = s ? +(lt - s.t0).toFixed(9) : 0, arrival = 0.3 + Math.min(0.2, read.index * 0.05);
        const pinned = !!pin && (pin.step === r.from || pin.ref === r.to);
        if (pinned) { pinnedTargets.add(r.to); if (pin.ref) rings[r.from] = 0.6; }
        const previewed = !pin && preview === r.from;
        const hovered = hover === r.id;
        let glow = alpha[r.from] || 0, reveal = s ? 1 - Math.pow(1 - clamp(age / 0.3), 3) : 0;
        let target = glow * clamp((age - arrival) / 0.15);
        let phase = age;
        if (pinned || hovered || previewed) {
          glow = hovered ? hoverLevel : pinned ? (hover ? 0.25 : 1) : 0.4;
          reveal = 1; target = glow; phase = tt;
        }
        attr(read.el, 'opacity', ((P === THEMES.dark ? 1 : 0.85) * glow).toFixed(3));
        attr(read.el, 'stroke-dashoffset', (-10 * phase).toFixed(3));
        attr(read.mask, 'stroke-dashoffset', (r.len * (1 - reveal)).toFixed(3));
        attr(read.origin, 'opacity', glow.toFixed(3));
        attr(read.end, 'opacity', (reveal >= 1 ? glow : 0).toFixed(3));
        const pulse = clamp((age - 0.3) / 0.5);
        attr(read.pulse, 'r', (2.8 + 4.2 * pulse).toFixed(3));
        attr(read.pulse, 'opacity', (!pinned && !hovered && !previewed && s && age >= 0.3 && age < 0.8 ? 0.6 * (1 - pulse) * glow : 0).toFixed(3));
        targets[r.to] = Math.max(targets[r.to] || 0, target);
        chips[r.to] = Math.max(chips[r.to] || 0, glow);
        if (glow > 0) (activeReaders[r.to] = activeReaders[r.to] || new Set()).add(r.from);
      });
      Object.keys(cards).forEach(id => {
        const c = cards[id], n = G.nodes[id];
        attr(c.hl, 'opacity', (targets[id] || 0).toFixed(3));
        attr(c.chip, 'opacity', (chips[id] || 0).toFixed(3));
        c.nums.forEach(el => attr(el, 'font-weight', activeReaders[id] && activeReaders[id].has(el.getAttribute('data-reader')) ? 700 : 500));
        attr(c.ring, 'opacity', rings[id] || 0);
        if (n.laneKind === 'ref') attr(c.el, 'opacity', pin && pin.ref !== id && !pinnedTargets.has(id) ? 0.45 : 1);
      });
    }

    function hero(seg) {
      if (!heroTitle) return;
      let title = '', sub = '';
      const T = (k, ...a) => SV.i18n.t(k, ...a);
      if (!tour && !pin) { title = ''; sub = ''; }
      else if (pin) {
        const id = pin.step || pin.ref;
        title = G.nodes[id].spec.title || '';
        const related = (G.reads || []).filter(r => pin.step ? r.from === id : r.to === id);
        const count = new Set(related.map(r => pin.step ? r.to : r.from)).size;
        sub = T((pin.step ? 'hero.pinReads' : 'hero.pinUsed') + (count === 1 ? '1' : ''), count);
      } else if (!seg || seg.type === 'pause') {
        title = (G.spec.hero && G.spec.hero.title) || G.spec.title || '';
        sub = (G.spec.hero && G.spec.hero.sub) || T('hero.roundEnd', seg ? seg.round + 1 : 1, tour.rounds);
      } else {
        const id = seg.type === 'node' ? seg.id : null;
        let ref = id;
        if (!ref && seg.type === 'edge') ref = seg.edge.to;
        if (seg.type === 'stub' || seg.type === 'stubEdge') { title = '→ ' + seg.stub.full; sub = T('hero.exit'); }
        else {
          const n = G.nodes[ref];
          const sp = n.spec;
          title = (seg.type === 'edge' ? '→ ' : '') + (sp.title || '');
          const L = laneOf(ref);
          sub = [L ? L.title : T('hero.start'), T('hero.step', Math.min(seg.idx + 1, seg.total), seg.total), seg.round > 0 ? T('hero.branch', seg.round) : ''].filter(Boolean).join(' · ');
        }
      }
      attr(heroDots, 'opacity', pin ? 0 : 1);
      const key = title + '|' + sub + '|' + (pin ? 'pin' : seg ? seg.idx + ':' + seg.total : '');
      if (key === lastHero) return;
      lastHero = key;
      const big = G.hero.place === 'lane';
      heroTitle.textContent = SV.layoutUtil.fit(title, G.hero.maxW, big ? 29 : 24, 800);
      heroSub.textContent = SV.layoutUtil.fit(sub, G.hero.maxW, big ? 16 : 14.5, 400);
      const total = !pin && seg ? Math.min(seg.total, 18) : 0;
      const cur = seg ? Math.min(seg.idx, total - 1) : -1;
      let h = '';
      for (let i = 0; i < total; i++) h += `<circle cx="${i * 23}" cy="0" r="${i === cur ? 5 : 4.5}" fill="${i === cur && seg.type !== 'pause' ? (P.active || P.comet) : P.text3}" opacity="${i === cur ? 1 : 0.55}"/>`;
      heroDots.innerHTML = h;
    }

    function renderAt(tt) {
      t = tt;
      // 环境流动
      for (const c of comets) {
        if (!c.els.length) continue;
        const s = ((tt + c.phase) % c.period) * c.speed - 30;
        if (c.loop) {
          c.els.forEach((el, k) => {
            const ss = s - k * 8;
            const vis = ss >= 0 && ss <= c.len;
            const p = c.at(ss);
            el.setAttribute('cx', f1(p[0])); el.setAttribute('cy', f1(p[1]));
            el.setAttribute('opacity', vis ? (0.9 - k * 0.22).toFixed(2) : '0');
          });
        } else {
          const head = c.at(s);
          const vis0 = s >= 0 && s <= c.len;
          const fade = Math.min(1, s / 30, (c.len - s) / 30);
          c.els[0].setAttribute('cx', f1(head[0])); c.els[0].setAttribute('cy', f1(head[1]));
          c.els[0].setAttribute('opacity', vis0 ? (0.9 * Math.max(0, fade)).toFixed(2) : '0');
          for (let k = 1; k < c.els.length; k++) {
            const ss = s - (k - 1) * 5;
            const p = c.at(ss);
            const vis = ss >= 0 && ss <= c.len;
            c.els[k].setAttribute('cx', f1(p[0])); c.els[k].setAttribute('cy', f1(p[1]));
            c.els[k].setAttribute('opacity', vis ? ((1 - (k - 1) * 0.19) * Math.max(0.2, fade)).toFixed(2) : '0');
          }
        }
      }
      attr(traveler, 'opacity', pin ? 0 : 1);
      if (!tour) { setAlpha(pin && pin.step ? { [pin.step]: 1 } : {}); renderReads({}, {}, tt, tt); hero(null); return; }
      const T = tour.duration;
      const lt = ((tt % T) + T) % T;
      const i = segAt(lt);
      const seg = tour.segs[i];
      // 高亮：当前节点亮起，刚离开的节点慢慢暗下去
      const alpha = {}, lit = {};
      for (let j = Math.max(0, i - 4); j <= Math.min(tour.segs.length - 1, i + 1); j++) {
        const s = tour.segs[j];
        if (s.type !== 'node' && s.type !== 'stub') continue;
        let a = 0;
        if (lt >= s.t0 && lt < s.t1) a = Math.min(1, (lt - s.t0) / 0.22);
        else if (lt >= s.t1 && lt < s.t1 + 0.55) a = 1 - (lt - s.t1) / 0.55;
        if (a > (alpha[s.id] || 0)) { alpha[s.id] = a; lit[s.id] = s; }
      }
      // 固定卡片接管高亮，阅读关系也不再跟随播放步骤
      renderReads(pin ? {} : alpha, pin ? {} : lit, tt, lt);
      setAlpha(pin ? (pin.step ? { [pin.step]: 1 } : {}) : alpha);
      // 走动的数据点
      if (!pin && seg && (seg.type === 'edge' || seg.type === 'stubEdge')) {
        const len = seg.type === 'edge' ? seg.edge.len : seg.stub.len;
        const at = travSamplers[seg.id];
        const p = ease((lt - seg.t0) / (seg.t1 - seg.t0));
        const s = p * len;
        trav.forEach((el, k) => {
          const ss = k === 0 ? s : s - (k - 1) * 4.5;
          const q = at(Math.max(0, ss));
          el.setAttribute('cx', f1(q[0])); el.setAttribute('cy', f1(q[1]));
          el.setAttribute('opacity', ss >= 0 ? (k === 0 ? 0.95 : 1 - (k - 1) * 0.11).toFixed(2) : '0');
        });
      } else trav.forEach(el => { el.setAttribute('opacity', '0'); el.setAttribute('cx', '0'); el.setAttribute('cy', '0'); });
      hero(seg);
      listeners.forEach(fn => fn(seg, lt));
    }

    function frame(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (playing) t += dt * speed;
      renderAt(t);
      raf = requestAnimationFrame(frame);
    }
    if (opt.loop !== false) raf = requestAnimationFrame(frame);
    else renderAt(0);

    const stepStarts = tour ? tour.segs.filter(s => s.type === 'node' || s.type === 'stub').map(s => s.t0) : [];
    return {
      tour, G,
      get time() { return t; },
      get playing() { return playing; },
      get duration() { return tour ? tour.duration : 0; },
      play() { playing = true; },
      pause() { playing = false; },
      toggle() { playing = !playing; return playing; },
      setSpeed(v) { speed = v; },
      setPin(v) { pin = v; hover = null; preview = null; renderAt(t); },
      setHover(id, level) { hover = id; hoverLevel = level == null ? 1 : clamp(level); renderAt(t); },
      setPreview(id) { preview = id; renderAt(t); },
      seek(v) { t = v; renderAt(t); },
      renderAt,
      next() {
        if (!tour) return;
        const T = tour.duration, base = Math.floor(t / T) * T, lt = t - base;
        const n = stepStarts.find(s => s > lt + 0.01);
        t = n != null ? base + n + 0.25 : base + T + 0.25;
        renderAt(t);
      },
      prev() {
        if (!tour) return;
        const T = tour.duration, base = Math.floor(t / T) * T, lt = t - base;
        const before = stepStarts.filter(s => s < lt - 0.3);
        t = before.length > 1 ? base + before[before.length - 2] + 0.25 : base + 0.25;
        renderAt(t);
      },
      jumpTo(id) {
        if (!tour) return false;
        const s = tour.segs.find(x => (x.type === 'node' || x.type === 'stub') && x.id === id);
        if (!s) return false;
        const T = tour.duration;
        t = Math.floor(t / T) * T + s.t0 + 0.25;
        renderAt(t);
        return true;
      },
      onStep(fn) { listeners.push(fn); },
      destroy() { cancelAnimationFrame(raf); listeners.length = 0; },
    };
  }

  SV.render = { toSVG, createPlayer, buildTour, THEMES };
};
SV.mod.render(SV);
