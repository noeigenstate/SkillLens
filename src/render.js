/* 几何 → SVG；播放器：当前步骤高亮、数据点沿线流动。所有画面都是时间 t 的纯函数 */
SV.mod.render = function (SV) {
  const { esc } = SV.md;

  /* 蓝图（默认）：Blueprint；深色：Midnight Terminal；浅色：Soft Glass */
  const THEMES = {
    blueprint: {
      blueprint: true, page: '#071e32', pageTo: '', grid: '#123b54', ruler: '#0a2740', path: '#5f86a3',
      text: '#e6f5ff', text2: '#8fafc6', text3: '#5d7f99', edge: '#3f8fb2', label: '#cfe9f7',
      comet: '#48edff', dotCore: '#e8fdff', loopDot: '#ffbe57', note: '#ffbe57', reads: '#cfe9f7', active: '#ffbe57', termIcon: '#071e32',
      tagBg: 'rgba(99,217,245,0.18)', tagText: '#9be7fc', rCard: 14, rLane: 20, shadow: false,
      lanes: {
        green: { accent: '#63d9f5', stroke: '#3ca4cf', slab: '#175e80', fill: 'rgba(10,44,70,0.86)', card: '#134063', cardStroke: '#4fc7e8', icon: '#0d2d47' },
        blue: { accent: '#7aa8ff', stroke: '#4d7fd1', slab: '#1e4682', fill: 'rgba(12,38,74,0.86)', card: '#173f6b', cardStroke: '#6b9cf7', icon: '#0f2b52' },
        purple: { accent: '#a99bff', stroke: '#6c68c4', slab: '#353178', fill: 'rgba(20,34,74,0.86)', card: '#1e3c69', cardStroke: '#9688f2', icon: '#162b52' },
        teal: { accent: '#5ee6d0', stroke: '#36b5ae', slab: '#156664', fill: 'rgba(9,46,64,0.86)', card: '#12435e', cardStroke: '#4dd4be', icon: '#0b3045' },
        rose: { accent: '#ff8fb1', stroke: '#b85c87', slab: '#6b2d4d', fill: 'rgba(34,32,64,0.86)', card: '#223c5e', cardStroke: '#f27ea3', icon: '#1d2b4a' },
        amber: { accent: '#ffbe57', stroke: '#bd903c', slab: '#705118', fill: 'rgba(28,40,56,0.86)', card: '#1d405e', cardStroke: '#f2b046', icon: '#182f47' },
        slate: { accent: '#4598bb', stroke: '#357ca8', slab: '#154969', fill: 'rgba(9,38,60,0.78)', card: '#123959', cardStroke: '#4598bb', icon: '#0c2a45' },
      },
    },
    dark: {
      page: '#0b0d12', pageTo: '', dots: '#2a3140', path: '#6b7488',
      text: '#eef1f8', text2: '#929caf', text3: '#5f687a', edge: '#5d6577', label: '#c3c9d6',
      comet: '#8fffd0', dotCore: '#e9fff6', loopDot: '#f5c470', note: '#7ae8bc', reads: '#a9adff', active: '#8fffd0', termIcon: '#0b0d12',
      tagBg: 'rgba(146,156,175,0.18)', tagText: '#b4bfd4', rCard: 16, rLane: 22, shadow: false,
      lanes: {
        green: { accent: '#7ae8bc', stroke: '#3c856d', slab: '#1b4d3e', fill: '#101d19', card: '#182b27', cardStroke: '#42967a', icon: '#12332b' },
        blue: { accent: '#a3a7ff', stroke: '#5259ad', slab: '#282d66', fill: '#111428', card: '#1c223b', cardStroke: '#5b63bd', icon: '#1c2047' },
        purple: { accent: '#cfa8ff', stroke: '#7256a8', slab: '#3e2b63', fill: '#171129', card: '#241c3b', cardStroke: '#7d5eb8', icon: '#281b47' },
        teal: { accent: '#6fdbe8', stroke: '#36818f', slab: '#194b54', fill: '#0f1d21', card: '#172b30', cardStroke: '#3d91a1', icon: '#123340' },
        rose: { accent: '#ff9fbf', stroke: '#994766', slab: '#592238', fill: '#201219', card: '#2e1c28', cardStroke: '#a84f70', icon: '#3b1b2b' },
        amber: { accent: '#f5c470', stroke: '#997736', slab: '#594218', fill: '#1c170e', card: '#2b2419', cardStroke: '#a8833b', icon: '#362912' },
        slate: { accent: '#9ba6bb', stroke: '#45516b', slab: '#232a3b', fill: '#121720', card: '#1e2633', cardStroke: '#4c5975', icon: '#1e2533' },
      },
    },
    light: {
      page: '#faf5ea', pageTo: '#f3ece0', dots: '#d6cbb6', path: '#576478',
      text: '#171f2b', text2: '#3a4659', text3: '#5e6b80', edge: '#465872', label: '#171f2b',
      comet: '#15b07a', dotCore: '#ffffff', loopDot: '#e08600', note: '#1a8760', reads: '#7c63d6', active: '#1f8f69', termIcon: '#ffffff',
      tagBg: 'rgba(70,88,114,0.12)', tagText: '#3a4659', rCard: 18, rLane: 24, shadow: true,
      lanes: {
        green: { accent: '#14855d', stroke: '#35a87d', slab: '#7cd6b3', fill: 'rgba(227,246,237,0.94)', card: '#fffdf9', cardStroke: '#38ab80', icon: '#d2f4e6' },
        blue: { accent: '#1e60b5', stroke: '#4689db', slab: '#8cbbf5', fill: 'rgba(229,241,254,0.94)', card: '#fffdf9', cardStroke: '#498cde', icon: '#d4e6fd' },
        purple: { accent: '#643fb8', stroke: '#8463d9', slab: '#b69df2', fill: 'rgba(240,233,254,0.94)', card: '#fffdf9', cardStroke: '#8766db', icon: '#e5dafd' },
        teal: { accent: '#117b87', stroke: '#39a0ad', slab: '#7ad1dc', fill: 'rgba(225,245,247,0.94)', card: '#fffdf9', cardStroke: '#3ca3b0', icon: '#cef0f4' },
        rose: { accent: '#ba3662', stroke: '#d15e84', slab: '#f59dba', fill: 'rgba(254,233,240,0.94)', card: '#fffdf9', cardStroke: '#d46187', icon: '#fde0ea' },
        amber: { accent: '#ad6600', stroke: '#cf8b24', slab: '#f5c26b', fill: 'rgba(254,243,221,0.95)', card: '#fffdf9', cardStroke: '#d18e28', icon: '#fce7be' },
        slate: { accent: '#445266', stroke: '#75869e', slab: '#b0bdcf', fill: 'rgba(239,235,226,0.95)', card: '#fffdf9', cardStroke: '#7889a1', icon: '#e4e8f0' },
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
  const clamp = x => Math.max(0, Math.min(1, x));
  const E1 = x => 1 - Math.pow(1 - clamp(x), 3);
  const E2 = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const B = x => { x = clamp(x) - 1; return 1 + 2.2 * x * x * x + 1.2 * x * x; };
  const spacing = s => /[㐀-鿿]/.test(s) ? 0 : -0.5;
  const accent = P => P.active;
  const readingOrder = G => [G.trigger && G.trigger.id].concat((G.spec.lanes || []).flatMap(l => (l.nodes || []).map(n => n.id))).filter((id, i, a) => G.nodes[id] && a.indexOf(id) === i);
  // 一体式 3D 倒角立面路径（置于同一外轮廓内部，无断层分割线）
  const bevelRect = (x, y, w, h, r, th) => {
    const rr = Math.max(2, Math.min(r, w / 2, (h - th) / 2));
    const y1 = f1(y + h - th), y2 = f1(y + h), yr = f1(y + h - th - rr), y2r = f1(y + h - rr);
    return `M${f1(x)} ${yr}V${y2r}Q${f1(x)} ${y2} ${f1(x + rr)} ${y2}H${f1(x + w - rr)}Q${f1(x + w)} ${y2} ${f1(x + w)} ${y2r}V${yr}Q${f1(x + w)} ${y1} ${f1(x + w - rr)} ${y1}H${f1(x + rr)}Q${f1(x)} ${y1} ${f1(x)} ${yr}Z`;
  };
  const bevelDiamond = (n, th) => {
    const inset = 1.2;
    return `M${f1(n.x + inset)} ${f1(n.cy)}L${f1(n.cx)} ${f1(n.y + n.h - inset - th)}L${f1(n.x + n.w - inset)} ${f1(n.cy)}L${f1(n.cx)} ${f1(n.y + n.h - inset)}Z`;
  };
  const blockBevel = (n, P, c, th = 6.5) => {
    const wall = c.slab || c.cardStroke || P.note;
    const a1 = P.shadow ? 0.28 : 0.32, a2 = P.shadow ? 0.72 : 0.68;
    if (n.type === 'decision') {
      return `<path d="${bevelDiamond(n, th + 3.5)}" fill="${wall}" opacity="${a1}"/><path d="${bevelDiamond(n, th)}" fill="${wall}" opacity="${a2}"/>`;
    }
    const ins = 1, rx = Math.max(2, P.rCard - ins);
    return `<path d="${bevelRect(n.x + ins, n.y + ins, n.w - ins * 2, n.h - ins * 2, rx, th + 3)}" fill="${wall}" opacity="${a1}"/><path d="${bevelRect(n.x + ins, n.y + ins, n.w - ins * 2, n.h - ins * 2, rx, th)}" fill="${wall}" opacity="${a2}"/>`;
  };
  // 共用几何：底座、光晕、涟漪始终与顶面同形；不使用模糊滤镜
  const shape = (n, P, attrs, inset = 0) => n.type === 'decision'
    ? `<polygon points="${f1(n.cx)},${f1(n.y + inset)} ${f1(n.x + n.w - inset)},${f1(n.cy)} ${f1(n.cx)},${f1(n.y + n.h - inset)} ${f1(n.x + inset)},${f1(n.cy)}" ${attrs}/>`
    : `<rect x="${f1(n.x + inset)}" y="${f1(n.y + inset)}" width="${f1(n.w - inset * 2)}" height="${f1(n.h - inset * 2)}" rx="${P.rCard - inset}" ${attrs}/>`;
  function depth(n, P, c) {
    const k = P === THEMES.blueprint ? 0 : P === THEMES.dark ? 1 : 2;
    const shadow = ['#02101c', '#000', '#877558'][k];
    return shape(n, P, `class="sv-shadow2" transform="translate(0,6)" fill="${shadow}" opacity="${[.12, .16, .06][k]}"`) +
      shape(n, P, `class="sv-shadow1" transform="translate(0,3)" fill="${shadow}" opacity="${[.24, .30, .12][k]}"`) +
      shape(n, P, `class="sv-slab" transform="translate(0,0)" fill="none" stroke="none"`) +
      [1, 2, 3, 4].map(i => shape(n, P, `class="sv-extrusion" transform="translate(0,${6 * (1 - i / 4)})" fill="none" stroke="none" opacity="0"`)).join('');
  }
  const glow = (n, P, color) => `<g class="sv-hl" opacity="0">${[14, 8, 3].map((w, i) => shape(n, P, `fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" opacity="${[.04, .08, .16][i]}"`, -w / 2)).join('')}</g>`;
  const activeFace = (n, P) => glow(n, P, P.active) +
    shape(n, P, `class="sv-hl sv-active-tint" fill="${P.active}" fill-opacity="${P.shadow ? .08 : .10}" opacity="0"`) +
    shape(n, P, `class="sv-hl sv-active-stroke" fill="none" stroke="${P.active}" stroke-width="${P.shadow ? 2.6 : 2.4}" opacity="0"`);
  function highlight(n, P) {
    const k = P === THEMES.blueprint ? 0 : P === THEMES.dark ? 1 : 2;
    const rim = ['#d4f4ff', '#ffffff', '#ffffff'][k], alpha = [.36, .24, .96][k];
    const d = n.type === 'decision'
      ? `M${f1(n.x + 3)} ${f1(n.cy)}L${f1(n.cx)} ${f1(n.y + 3)}L${f1(n.x + n.w - 3)} ${f1(n.cy)}`
      : `M${f1(n.x + 2.5)} ${f1(n.y + n.h - P.rCard)}V${f1(n.y + P.rCard)}Q${f1(n.x + 2.5)} ${f1(n.y + 2.5)} ${f1(n.x + P.rCard)} ${f1(n.y + 2.5)}H${f1(n.x + n.w - P.rCard)}`;
    const capsule = n.type === 'decision' || n.w < 90 ? '' : `<line x1="${f1(n.x + P.rCard + 4)}" y1="${f1(n.y + 5)}" x2="${f1(n.x + P.rCard + 32)}" y2="${f1(n.y + 5)}" stroke="${rim}" stroke-width="2.8" stroke-linecap="round" opacity="${f1(alpha * .92)}"/>`;
    return `<path d="${d}" fill="none" stroke="${rim}" stroke-width="2" stroke-linecap="round" opacity="${alpha}"/>` + capsule;
  }

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
<marker id="sv-arw" viewBox="0 0 12 12" refX="9.2" refY="6" markerWidth="7.6" markerHeight="7.6" orient="auto-start-reverse"><path d="M1.2,1.5 L10.4,6 L1.2,10.5 L3.1,6 z" fill="${P.edge}" stroke="${P.edge}" stroke-width="0.7" stroke-linejoin="round"/></marker>
<marker id="sv-arw-loop" viewBox="0 0 12 12" refX="9.2" refY="6" markerWidth="7.6" markerHeight="7.6" orient="auto-start-reverse"><path d="M1.2,1.5 L10.4,6 L1.2,10.5 L3.1,6 z" fill="${P.loopDot}" stroke="${P.loopDot}" stroke-width="0.7" stroke-linejoin="round"/></marker>
<marker id="sv-arw-act" viewBox="0 0 12 12" refX="9.2" refY="6" markerWidth="7.6" markerHeight="7.6" orient="auto-start-reverse"><path d="M1.2,1.5 L10.4,6 L1.2,10.5 L3.1,6 z" fill="${P.comet}" stroke="${P.comet}" stroke-width="0.7" stroke-linejoin="round"/></marker>
<radialGradient id="sv-glow"><stop offset="0" stop-color="${P.comet}" stop-opacity="0.82"/><stop offset="0.45" stop-color="${P.comet}" stop-opacity="0.28"/><stop offset="1" stop-color="${P.comet}" stop-opacity="0"/></radialGradient>
<radialGradient id="sv-glow-amber"><stop offset="0" stop-color="${P.loopDot}" stop-opacity="0.78"/><stop offset="1" stop-color="${P.loopDot}" stop-opacity="0"/></radialGradient>
<linearGradient id="sv-page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.page}"/><stop offset="1" stop-color="${P.pageTo || P.page}"/></linearGradient>
</defs>`);
    out.push(`<rect width="${W}" height="${H}" fill="url(#sv-page)"/>`);
    out.push('<g class="sv-scene">');
    const BP = !!P.blueprint;
    if (BP) {
      out.push('<g class="sv-grid-rulers">');
      out.push(`<pattern id="sv-grid-s" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="${P.grid}" stroke-width="0.6" opacity="0.5"/></pattern>`);
      out.push(`<pattern id="sv-grid" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#sv-grid-s)"/><path d="M100 0H0V100" fill="none" stroke="${P.grid}" stroke-width="1"/></pattern>`);
      out.push(`<rect class="sv-grid-plane" x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="url(#sv-grid)"/>`);
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
      out.push('</g>');
    } else {
      out.push(`<pattern id="sv-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${P.dots}"/></pattern><rect class="sv-grid-plane" x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="url(#sv-grid)"/>`);
    }
    // 节点编号
    const nodeNo = {};
    let noSeq = 0;
    (G.spec.lanes || []).forEach(l => (l.nodes || []).forEach(n => { nodeNo[n.id] = ++noSeq; }));
    const pad3 = v => String(v).padStart(3, '0');

    // 页眉：3D 糖果圆点 + 文件路径，下面是左对齐的大标题
    const hx = K.LANE_X + 2;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      const cx = hx + 6 + i * 18;
      out.push(`<circle cx="${cx}" cy="36.2" r="5.8" fill="rgba(0,0,0,0.28)"/><circle cx="${cx}" cy="34" r="5.8" fill="${c}" stroke="rgba(0,0,0,0.25)" stroke-width="1.2"/><circle cx="${f1(cx - 1.8)}" cy="32.2" r="1.6" fill="#ffffff" opacity="0.72"/>`);
    });
    const zh = SV.i18n.lang === 'zh';
    // 页眉的路径是真实路径，任何语言都原样、等宽显示（布局里也是按等宽量的）
    const winText = G.header.window;
    out.push(txt(hx + 62, 38.5, winText, `font-family='${G.MONO}' font-size="12.5" font-weight="600" fill="${P.path}" letter-spacing="0.2"`));
    out.push(txt(hx, 96, G.header.titleText, `class="sv-header-title" font-size="40" font-weight="800" letter-spacing="${/[㐀-鿿]/.test(G.header.titleText) ? 0 : -1}" fill="${P.text}"`));
    out.push(`<rect class="sv-title-bar" x="${hx}" y="107" width="56" height="4" rx="2" fill="${accent(P)}"/>`);
    if (G.header.subText) out.push(txt(hx, 134, G.header.subText, `class="sv-header-sub" font-size="17" font-weight="500" fill="${P.text2}"`));

    // 图例
    if (G.legend) {
      out.push('<g class="sv-legend">');
      for (const it of G.legend.items) {
        const y = G.legend.y;
        if (it.kind === 'solid') out.push(`<line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 38)}" y2="${f1(y)}" stroke="${P.edge}" stroke-width="5.6" opacity="0.18" stroke-linecap="round"/><line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 36)}" y2="${f1(y)}" stroke="${P.edge}" stroke-width="2.6" stroke-linecap="round" marker-end="url(#sv-arw)"/>`);
        else if (it.kind === 'dashed') out.push(`<line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 36)}" y2="${f1(y)}" stroke="${P.loopDot}" stroke-width="2.3" stroke-dasharray="9 6" stroke-linecap="round" marker-end="url(#sv-arw-loop)"/>`);
        else if (it.kind === 'reads') out.push(`<line x1="${f1(it.x)}" y1="${f1(y)}" x2="${f1(it.x + 38)}" y2="${f1(y)}" stroke="${P.reads}" stroke-width="${P === THEMES.dark ? '2.0' : '1.8'}" stroke-dasharray="0.1 6" stroke-linecap="round"/><circle cx="${f1(it.x + 38)}" cy="${f1(y)}" r="2.8" fill="${P.reads}"/>`);
        else out.push(`<circle cx="${f1(it.x + 8)}" cy="${f1(y)}" r="13" fill="url(#sv-glow)" opacity="0.68"/><circle cx="${f1(it.x + 8)}" cy="${f1(y)}" r="5" fill="${P.dotCore}" stroke="${P.comet}" stroke-width="2.2"/>`);
        out.push(txt(it.x + (!reads.length && it.kind === 'dot' ? 36 : 48), y + 5.5, it.text, `font-size="15.5" font-weight="700" fill="${P.text2}"`));
      }
      out.push('</g>');
    }

    // 泳道：一体式 3D 奶油积木托盘（单一外轮廓包裹顶面与底部 3D 立面，无断层分割线）
    for (const L of G.lanes) {
      if (L.kind === 'bare') continue;
      const c = pal(L.color);
      const dash = L.kind === 'flow' && !BP ? '' : ' stroke-dasharray="7 6"';
      const rl = P.rLane;
      out.push(`<g data-lane="${esc(L.id)}">`);
      out.push(`<rect x="${L.x}" y="${f1(L.y + 4)}" width="${L.w}" height="${f1(L.h)}" rx="${rl}" fill="${P.shadow ? '#877558' : '#000000'}" opacity="${P.shadow ? 0.09 : 0.22}"/>`);
      out.push(`<rect x="${L.x}" y="${f1(L.y)}" width="${L.w}" height="${f1(L.h)}" rx="${rl}" fill="${c.fill}"/>`);
      if (!BP) {
        out.push(`<path d="${bevelRect(L.x + 1, L.y + 1, L.w - 2, L.h - 2, rl - 1, 10)}" fill="${c.slab}" opacity="${P.shadow ? 0.22 : 0.28}"/>`);
        out.push(`<path d="${bevelRect(L.x + 1, L.y + 1, L.w - 2, L.h - 2, rl - 1, 6.5)}" fill="${c.slab}" opacity="${P.shadow ? 0.55 : 0.65}"/>`);
      }
      out.push(`<path d="M${L.x + rl} ${f1(L.y + 2.2)}H${L.x + L.w - rl}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="${P.shadow ? 0.94 : 0.16}"/>`);
      out.push(`<rect class="sv-lane-border" x="${L.x}" y="${f1(L.y)}" width="${L.w}" height="${f1(L.h)}" rx="${rl}" fill="none" stroke="${c.stroke}" stroke-opacity="0.78" stroke-width="2.2"${dash}/>`);
      if (BP) {
        const x0 = L.x - 3, y0 = L.y - 3, x1 = L.x + L.w + 3, y1 = L.y + L.h + 3, k = 16;
        out.push(`<g class="sv-brackets">${[[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]].map(([x, y, dx, dy]) => `<path data-corner="${dx},${dy}" d="M${x} ${y + k * dy}V${y}H${x + k * dx}" fill="none" stroke="${c.accent}" stroke-width="2" stroke-linecap="round"/>`).join('')}</g>`);
        const ids = (G.spec.lanes.find(l => l.id === L.id) || { nodes: [] }).nodes.map(n => nodeNo[n.id]).filter(Boolean);
        if (ids.length) out.push(txt(L.x + L.w - 16, L.y + 30, '#' + pad3(Math.min(...ids)) + (ids.length > 1 ? '-' + pad3(Math.max(...ids)) : ''), `text-anchor="end" font-family='${G.MONO}' font-size="11" fill="${P.text3}"`));
      }
      let tx = L.x + 28;
      const band = [L.y + 8, L.y + 52];
      const crossing = G.edges.filter(e => e.pts.some((p, i) => i > 0 && Math.abs(p[0] - e.pts[i - 1][0]) < 0.5 && Math.min(p[1], e.pts[i - 1][1]) < band[1] && Math.max(p[1], e.pts[i - 1][1]) > band[0])).map(e => e.pts.find((p, i) => i > 0 && Math.abs(p[0] - e.pts[i - 1][0]) < 0.5 && Math.min(p[1], e.pts[i - 1][1]) < band[1] && Math.max(p[1], e.pts[i - 1][1]) > band[0])[0]);
      const span = L.titleW + (L.tagText ? 14 + SV.layoutUtil.measure(L.tagText, 14.5) : 0);
      for (const x of crossing.sort((a, b) => a - b)) if (x > tx - 16 && x < tx + span + 12) tx = x + 28;
      out.push(`<line x1="${f1(tx - 10)}" y1="${f1(L.y + 21)}" x2="${f1(tx - 10)}" y2="${f1(L.y + 39)}" stroke="${c.accent}" stroke-width="5" stroke-linecap="round"/>`);
      out.push(txt(tx, L.y + 36, L.titleText, `font-size="20" font-weight="800" fill="${P.text}"`));
      if (L.tagText && L.tagText.toLowerCase() !== L.titleText.toLowerCase()) out.push(txt(tx + L.titleW + 13, L.y + 36, L.tagText, `font-size="14" font-weight="700" fill="${c.accent}" opacity="0.88"`));
      if (L.notes.length) {
        const mid = (L.notes[0].y + L.notes[L.notes.length - 1].y) / 2 - 6;
        out.push(icon('info', L.x + 22, mid - 12, 24, P.text2, 1.8));
        for (const [ni, nt] of L.notes.entries()) {
          if (BP) out.push(txt(nt.x - 2, nt.y - 2, String(ni + 1).padStart(2, '0'), `font-family='${G.MONO}' font-size="14" font-weight="700" fill="${P.note}"`));
          else out.push(`<line x1="${nt.x}" y1="${f1(nt.y - 7)}" x2="${nt.x + 16}" y2="${f1(nt.y - 7)}" stroke="${c.accent}" stroke-width="2.5" stroke-linecap="round"/>`);
          out.push(txt(nt.x + 30, nt.y - 2, nt.text, `font-size="15.5" font-weight="500" fill="${P.text2}"`));
        }
      }
      out.push('</g>');
    }

    // 连线：3D 管道底槽 + 高对比主线 + 立体大箭头
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
      const isLoop = e.kind === 'loop';
      out.push(`<g data-edge-build="${e.id}">`);
      out.push(`<path d="${e.d}" fill="none" stroke="${isLoop ? P.loopDot : P.edge}" stroke-width="${isLoop ? 4.8 : 5.8}" opacity="${P.shadow ? 0.14 : 0.22}" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<path d="${e.d}" fill="none" stroke="${isLoop ? P.loopDot : P.edge}" stroke-width="${isLoop ? 2.2 : 2.6}" stroke-linecap="round" stroke-linejoin="round"${isLoop ? ' stroke-dasharray="9 7"' : ''} marker-end="url(#sv-arw${isLoop ? '-loop' : ''})" data-edge="${e.id}"/>`);
      if (!isLoop) out.push(`<path data-ink="${e.d ? e.id : ''}" d="${e.d}" fill="none" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" stroke="${P.comet}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#sv-arw-act)" opacity="0"/>`);
      out.push('</g>');
    }
    for (const s of G.stubs) {
      out.push(`<g data-edge-build="${s.id}"><path d="${s.d}" fill="none" stroke="${P.edge}" stroke-width="5" opacity="${P.shadow ? 0.14 : 0.2}" stroke-linecap="round"/><path d="${s.d}" fill="none" stroke="${P.edge}" stroke-width="2.3" stroke-linecap="round" marker-end="url(#sv-arw)"/><path data-ink="${s.id}" d="${s.d}" fill="none" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" stroke="${P.comet}" stroke-width="3.4" stroke-linecap="round" opacity="0"/></g>`);
      const bg = bgColor(P, G.bgAt(s.cx, s.y + 5));
      const n = { ...s, cy: s.y + s.h / 2 }, c = { cardStroke: P.note, slab: P.note };
      out.push(`<g class="sv-stub" data-stub="${s.id}">`, depth(n, P, c));
      out.push(shape(n, P, `class="sv-ripple" fill="none" stroke="${P.active}" stroke-width="1.4" opacity="0"`, -5), '<g class="sv-face">');
      out.push(shape(n, P, `class="sv-shape" fill="${bg}" stroke="${P.note}" stroke-width="1.8" stroke-dasharray="4 4"`), blockBevel(n, P, c, 3.5), highlight(n, P), activeFace(n, P));
      out.push(txt(s.cx, s.y + 16.5, s.text, `text-anchor="middle" font-size="12.5" font-weight="700" fill="${P.note}"`) + '</g></g>');
    }
    out.push('</g>');

    // 连线标签：3D 胶囊贴纸
    const yn = s => (s === 'Yes' ? SV.i18n.t('label.yes') : s === 'No' ? SV.i18n.t('label.no') : s);
    for (const lab of labels) {
      const owner = G.edges.concat(G.stubs).find(e => e.lab === lab);
      out.push(`<g data-label-build="${owner.id}">`);
      const bg = bgColor(P, lab.bg || G.bgAt(lab.x, lab.y));
      const w = lab.w || SV.layoutUtil.measure(lab.text, 13);
      if (lab.rotate) {
        out.push(`<g transform="translate(${f1(lab.x)},${f1(lab.y)}) rotate(${lab.rotate})"><rect x="${f1(-w / 2 - 6)}" y="-10" width="${f1(w + 12)}" height="20" fill="${bg}"/>${txt(0, 5, yn(lab.text), `text-anchor="middle" font-size="13.5" font-weight="700" fill="${P.label}"`)}</g>`);
      } else {
        const x0 = lab.anchor === 'start' ? lab.x - 3 : lab.anchor === 'end' ? lab.x - w - 5 : lab.x - w / 2 - 4;
        const rx = f1(x0), ry = f1(lab.y - 13), rw = f1(w + 8), rh = 18;
        out.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="6" fill="${bg}" opacity="${reads.length ? 1 : 0.92}"/>`);
        out.push(`<path d="M${f1(+rx + 5)} ${ry}H${f1(+rx + +rw - 5)}Q${f1(+rx + +rw)} ${ry} ${f1(+rx + +rw)} ${f1(+ry + 5)}V${f1(+ry + rh - 5)}Q${f1(+rx + +rw)} ${f1(+ry + rh)} ${f1(+rx + +rw - 5)} ${f1(+ry + rh)}H${f1(+rx + 5)}Q${rx} ${f1(+ry + rh)} ${rx} ${f1(+ry + rh - 5)}V${f1(+ry + 5)}Q${rx} ${ry} ${f1(+rx + 5)} ${ry}Z" fill="none" stroke="${P.edge}" stroke-width="1.4" opacity="0.45"/>`);
        out.push(txt(lab.x, lab.y, yn(lab.text), `text-anchor="${lab.anchor}" font-size="13" font-weight="700" fill="${P.label}"`));
      }
      out.push('</g>');
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
      const titleAttrs = `x="${f1(tx)}" y="${f1(cy - (big ? 8 : 6))}" font-size="${big ? 30 : 25}" font-weight="800" fill="${P.text}"`;
      const kickAttrs = `x="${f1(tx)}" y="${f1(cy - (big ? 38 : 34))}" font-family='${zh ? G.FONT : G.MONO}' font-size="${zh ? 13 : 12}" font-weight="${zh ? 700 : 500}" letter-spacing="${zh ? 1 : 1.6}" fill="${accent(P)}"`;
      const tour = buildTour(G), first = tour && tour.segs[0], n = first && G.nodes[first.id];
      const title = n ? SV.layoutUtil.fit(n.spec.title, h.x + h.w - tx - 10 - SV.layoutUtil.measure('→ ', big ? 30 : 25, 800), big ? 30 : 25, 800) : '';
      out.push(`<text class="sv-hero-kicker" ${kickAttrs}>${first ? esc(kickerOf(tour, first)) : ''}</text><text class="sv-hero-kicker-old" ${kickAttrs} opacity="0"></text>`);
      out.push(`<text class="sv-hero-title-old" ${titleAttrs} opacity="0"></text><text class="sv-hero-prefix" ${titleAttrs} opacity="0">→ </text><text class="sv-hero-title" ${titleAttrs} letter-spacing="${spacing(title)}">${esc(title)}</text>`);
      const lane = n && n.lane >= 0 ? G.lanes[n.lane] : null;
      out.push(`<text class="sv-hero-sub" x="${f1(tx)}" y="${f1(cy + (big ? 20 : 16))}" font-size="${big ? 16 : 14.5}" font-weight="600" fill="${P.text2}">${esc(lane ? lane.title : '')}</text>`);
      out.push(`<g class="sv-hero-dots" transform="translate(${f1(tx + 5)},${f1(cy + (big ? 42 : 36))})">`);
      // 每种路线长度只生成一次，切段仅修改属性
      const totals = tour ? [...new Set(tour.segs.map(s => s.total))] : [];
      for (const total of totals) {
        const w = 23 * (total - 1);
        out.push(`<g data-dot-total="${total}" opacity="${first.total === total ? 1 : 0}"><rect y="-1" width="${w}" height="2.4" rx="1.2" fill="${P.text3}" opacity="0.28"/><rect class="sv-progress" y="-1" width="0" height="2.4" rx="1.2" fill="${accent(P)}" opacity="0.75"/>`);
        for (let i = 0; i < total; i++) out.push(`<circle data-dot-index="${i}" cx="${23 * i}" cy="0" r="4.5" fill="${i ? P.text3 : accent(P)}" opacity="${i ? .45 : .9}"/><circle data-dot-ring="${i}" cx="${23 * i}" cy="0" r="7" fill="none" stroke="${accent(P)}" stroke-width="1.4" opacity="0"/>`);
        out.push('</g>');
      }
      out.push('</g>');
      out.push('</g>');
      h.textX = tx;
      h.maxW = h.x + h.w - tx - 10;
    }

    // 节点：一体式 3D 积木步骤卡（单一外框包裹顶面与底部 3D 立面，内部图标键帽同样一体成型）
    const isRedundantTag = (tag, title) => !tag || /^(?:step|stage|phase|步骤|阶段)\s*\d+/i.test(tag) || /^(?:trigger|when|触发|触发条件|时机)$/i.test(tag) || tag.toLowerCase() === String(title || '').toLowerCase();
    const pillPath = (x, y, w, h, r) => `M${f1(x + r)} ${f1(y)}H${f1(x + w - r)}Q${f1(x + w)} ${f1(y)} ${f1(x + w)} ${f1(y + r)}V${f1(y + h - r)}Q${f1(x + w)} ${f1(y + h)} ${f1(x + w - r)} ${f1(y + h)}H${f1(x + r)}Q${f1(x)} ${f1(y + h)} ${f1(x)} ${f1(y + h - r)}V${f1(y + r)}Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)}Z`;
    out.push('<g class="sv-nodes">');
    const allNodes = Object.values(G.nodes);
    const trigColor = (G.lanes.find(l => l.kind === 'flow' || l.kind === 'bare') || {}).color || 'green';
    // 主流程里可展开的卡片占多数时（≥ 3 张且 ≥ 60%），入口收成一个小圆钮，别让十张卡片各挂一个「查看」
    const isMain = n => ['flow', 'bare'].includes(n.laneKind);
    const mainNodes = allNodes.filter(isMain), mainDrill = mainNodes.filter(n => n.spec.drill);
    const dense = mainDrill.length >= 3 && mainDrill.length >= mainNodes.length * 0.6;
    // 悬停抬起用 CSS 过渡，只动外层包裹，不碰播放器写的属性；样式每张图只放一份
    if (allNodes.some(n => n.spec.drill)) out.push('<style>.sv-drill-surface{transition:transform .16s ease-out}.sv-drill:hover .sv-drill-surface,.sv-drill:focus .sv-drill-surface{transform:translate(-2px,-5px)}</style>');
    for (const n of allNodes) {
      const c = pal(n.type === 'trigger' ? trigColor : n.color);
      const act = P.active;
      let gate = n.x + n.w, readX = n.x + 75; // 底行右侧入口的左边界（读取标记别越过它）、读取标记的起点
      const numStr = nodeNo[n.id] && ['flow', 'bare'].includes(n.laneKind) ? String(nodeNo[n.id]).padStart(2, '0') : '';
      const drill = n.spec.drill;
      out.push(`<g class="sv-node${drill ? ' sv-drill' : ''}" data-node="${esc(n.id)}"${drill ? ` tabindex="0" role="button" aria-label="${esc(n.spec.title + ' · ' + SV.i18n.t('hier.open'))}"` : ''} style="cursor:pointer">`);
      const tip = [n.spec.title, Array.isArray(n.spec.lines) ? n.spec.lines.join(' / ') : n.spec.lines].filter(Boolean).join(' — ');
      if (tip) out.push(`<title>${esc(tip)}</title>`);
      if (drill) {
        // 叠层底板：深色主题用更深的立面色，卡片与底板才分得开；矮卡片（参考资料条）不叠
        if (!n.compact) out.push(`<rect class="sv-stack" x="${f1(n.x + 9)}" y="${f1(n.y + 9)}" width="${n.w}" height="${n.h}" rx="${P.rCard}" fill="${P.shadow ? c.icon : c.slab}" stroke="${c.accent}" stroke-width="1.8"/>`);
        out.push('<g class="sv-drill-surface">');
      }
      out.push(depth(n, P, c));
      out.push(shape(n, P, `class="sv-ripple" fill="none" stroke="${act}" stroke-width="1.4" opacity="0"`, -5));
      out.push('<g class="sv-face">');
      if (n.type === 'decision') {
        const pts = (o) => `${f1(n.cx)},${f1(n.cy - n.h / 2 - o)} ${f1(n.cx + n.w / 2 + o)},${f1(n.cy)} ${f1(n.cx)},${f1(n.cy + n.h / 2 + o)} ${f1(n.cx - n.w / 2 - o)},${f1(n.cy)}`;
        out.push(`<polygon class="sv-shape" points="${pts(0)}" fill="${c.card}" stroke="${c.accent}" stroke-opacity="0.86" stroke-width="2.2"/>`, blockBevel(n, P, c, 7), highlight(n, P), activeFace(n, P));
        if (numStr) {
          out.push(`<path d="${pillPath(n.cx - 13, n.y + 11, 26, 16, 8)}" fill="${c.accent}" opacity="0.9"/>`);
          out.push(txt(n.cx, n.y + 22.5, numStr, `text-anchor="middle" font-family='${G.MONO}' font-size="10.5" font-weight="800" fill="${P.termIcon}"`));
        }
        const nl = n.titleLines.length;
        const showSub = n.sub && !isRedundantTag(n.sub, n.titleLines[0]);
        const base = n.cy - 2 - (nl - 1) * 10 + 6 - (showSub ? 7 : 0);
        n.titleLines.forEach((l, i) => out.push(txt(n.cx, base + i * 20, l, `text-anchor="middle" font-size="${n.titleSize}" font-weight="800" fill="${P.text}"`)));
        if (showSub) out.push(txt(n.cx, base + (nl - 1) * 20 + 19, n.sub, `text-anchor="middle" font-size="12" font-weight="600" fill="${P.text3}"`));
      } else {
        const dash = n.optional ? ' stroke-dasharray="7 5"' : '';
        const rc = P.rCard;
        const faceCy = n.cy - 2.5;
        out.push(`<rect class="sv-shape" x="${f1(n.x)}" y="${f1(n.y)}" width="${n.w}" height="${n.h}" rx="${rc}" fill="${c.card}" stroke="${c.cardStroke}" stroke-width="2.2"${dash}/>`, blockBevel(n, P, c, 6.5), highlight(n, P), activeFace(n, P));
        if (!drill && numStr && !BP) out.push(`<path d="${pillPath(n.x + n.w - 29, n.y + n.h - 24, 23, 15, 6)}" fill="${c.icon}" stroke="${c.accent}" stroke-opacity="0.45" stroke-width="1.2"/>`);
        if (!drill && (BP && nodeNo[n.id] || !BP && reads.length && ['flow', 'bare'].includes(n.laneKind))) out.push(txt(n.x + n.w - 9, n.y + n.h - 11, String(nodeNo[n.id]).padStart(2, '0'), `text-anchor="end" font-family='${G.MONO}' font-size="10" font-weight="700" fill="${BP ? P.text3 : P.text2}"${BP ? '' : ' opacity="0.75" data-card-no="' + esc(n.id) + '"'}`));
        else if (!drill && numStr && !BP) out.push(txt(n.x + n.w - 17.5, n.y + n.h - 12.5, numStr, `text-anchor="middle" font-family='${G.MONO}' font-size="10" font-weight="800" fill="${c.accent}"`));
        const ib = 50, ix = n.x + 13, iy = faceCy - ib / 2, ir = Math.min(13, P.rCard - 2);
        if (n.terminal) {
          out.push(`<rect x="${f1(ix)}" y="${f1(iy)}" width="${ib}" height="${ib}" rx="${ir}" fill="${c.accent}" stroke="${c.stroke}" stroke-width="1.8"/>`);
          out.push(`<path d="${bevelRect(ix + 1, iy + 1, ib - 2, ib - 2, ir - 1, 5)}" fill="${c.stroke}" opacity="0.48"/>`);
          out.push(`<path d="M${f1(ix + 5)} ${f1(iy + 11)}Q${f1(ix + 5)} ${f1(iy + 2.8)} ${f1(ix + 13)} ${f1(iy + 2.8)}H${f1(ix + ib - 13)}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>`);
          out.push(icon(n.icon || 'circle-check', ix + 11, iy + 9.5, 28, P.termIcon, 2.3));
        } else {
          out.push(`<rect x="${f1(ix)}" y="${f1(iy)}" width="${ib}" height="${ib}" rx="${ir}" fill="${c.icon}" stroke="${c.accent}" stroke-opacity="0.62" stroke-width="1.8"/>`);
          out.push(`<path d="${bevelRect(ix + 1, iy + 1, ib - 2, ib - 2, ir - 1, 5)}" fill="${c.slab}" opacity="${P.shadow ? 0.65 : 0.55}"/>`);
          out.push(`<path d="M${f1(ix + 5)} ${f1(iy + 11)}Q${f1(ix + 5)} ${f1(iy + 2.8)} ${f1(ix + 13)} ${f1(iy + 2.8)}H${f1(ix + ib - 13)}" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" opacity="${P === THEMES.light ? 0.94 : 0.25}"/>`);
          out.push(`<rect class="sv-hl" x="${f1(ix)}" y="${f1(iy)}" width="${ib}" height="${ib}" rx="${ir}" fill="${act}" opacity="0" fill-opacity="0.14"/>`);
          out.push(icon(n.icon || 'circle-dot', ix + 11, iy + 9.5, 28, c.accent, 2.2));
        }
        const tx = n.x + K.TEXT_X;
        if (drill) {
          // 展开卡片：标题、两行摘要，底行从左到右是编号、徽标、入口（文字按钮或小圆钮）
          const top = n.y + 25, yc = n.y + n.h - 22.5;
          n.titleLines.forEach((l, i) => out.push(txt(tx, top + i * 21, l, `font-size="${n.titleSize}" font-weight="800" fill="${P.text}"`)));
          const sumTop = top + (n.titleLines.length - 1) * 21 + (n.compact ? 21 : 24);
          n.sumLines.forEach((l, i) => out.push(txt(tx, sumTop + i * 16, l, `font-size="12.5" fill="${P.text2}"`)));
          if (n.compact || dense) {
            const cx = n.x + n.w - 20;
            out.push(`<circle cx="${f1(cx)}" cy="${f1(yc)}" r="12" fill="${c.accent}"/><path d="M${f1(cx - 2.4)} ${f1(yc - 4.8)}L${f1(cx + 2.6)} ${f1(yc)}L${f1(cx - 2.4)} ${f1(yc + 4.8)}" fill="none" stroke="${P.termIcon}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`);
            gate = cx - 12;
          } else {
            const label = SV.i18n.t('hier.open'), w = SV.layoutUtil.measure(label, 12.5, 700) + 20;
            const x = n.x + n.w - w - 8;
            out.push(`<rect x="${f1(x)}" y="${f1(yc - 13.5)}" width="${f1(w)}" height="27" rx="9" fill="${c.accent}"/>`);
            out.push(txt(x + w / 2, yc + 4.5, label, `text-anchor="middle" font-size="12.5" font-weight="700" fill="${P.termIcon}"`));
            gate = x;
          }
          if (numStr) {
            if (BP) out.push(txt(n.x + 13, yc + 3.5, numStr, `font-family='${G.MONO}' font-size="10" font-weight="700" fill="${P.text3}"`));
            else {
              out.push(`<path d="${pillPath(n.x + 13, yc - 7.5, 23, 15, 6)}" fill="${c.icon}" stroke="${c.accent}" stroke-opacity="0.45" stroke-width="1.2"/>`);
              out.push(txt(n.x + 24.5, yc + 3.5, numStr, `text-anchor="middle" font-family='${G.MONO}' font-size="10" font-weight="800" fill="${c.accent}"`));
            }
          }
          // 矮卡片的图标占满左侧，徽标挪到文字栏底行
          const tagX = n.compact ? tx : n.x + (numStr ? 42 : 13);
          const tag = SV.layoutUtil.fit(n.tag, Math.max(0, gate - tagX - 8), 12, 700);
          out.push(txt(tagX, yc + 4.3, tag, `font-size="12" font-weight="700" fill="${P.tagText}"`));
          readX = Math.max(readX, tagX + SV.layoutUtil.measure(tag, 12, 700) + 10);
        } else {
          const tl = n.titleLines.length;
          const showTag = n.type === 'trigger' && !isRedundantTag(n.tag, n.titleLines[0]);
          const titleH = tl * 22, tagH = showTag && n.tagBelow ? 17 : 0, bodyH = n.body.length * 20;
          const blockH = titleH + tagH + (n.body.length ? 6 : 0) + bodyH;
          // 参考资料条里的矮卡片：标题行与展开卡对齐
          const top = n.compact ? n.y + 9 : faceCy - blockH / 2;
          n.titleLines.forEach((l, i) => out.push(txt(tx, top + 16 + i * 22, l, `font-size="${n.titleSize}" font-weight="800" fill="${P.text}"`)));
          const pill = (x, y) => {
            const tw = SV.layoutUtil.measure(n.tag, 10.5, 500, zh ? G.FONT : G.MONO);
            out.push(`<rect x="${f1(x)}" y="${f1(y - 11.5)}" width="${f1(tw + 12)}" height="16" rx="6" fill="${P.tagBg}" stroke="${c.accent}" stroke-opacity="0.32"/>`);
            out.push(txt(x + 6, y, n.tag, `font-family='${zh ? G.FONT : G.MONO}' font-size="10.5" font-weight="700" fill="${P.tagText}"`));
          };
          if (showTag && n.tagInline) pill(tx + SV.layoutUtil.measure(n.titleLines[0], n.titleSize, 700) + 8, top + 15);
          else if (showTag && n.tagBelow) pill(tx, top + titleH + 12);
          n.body.forEach((l, i) => out.push(txt(tx, top + titleH + tagH + (n.compact ? 16 : 21) + i * 20, l, `font-size="13.5" font-weight="500" fill="${P.text2}"`)));
        }
      }
      // 阅读目标使用内描边和轻洗色，独立于步骤的描边光晕
      const readShape = (attrs, inset) => n.type === 'decision'
        ? `<polygon points="${n.cx},${n.y + inset} ${n.x + n.w - inset},${n.cy} ${n.cx},${n.y + n.h - inset} ${n.x + inset},${n.cy}" ${attrs}/>`
        : `<rect x="${f1(n.x + inset)}" y="${f1(n.y + inset)}" width="${n.w - inset * 2}" height="${n.h - inset * 2}" rx="${P.rCard}" ${attrs}/>`;
      if (readers[n.id]) out.push(`<g class="sv-read-hl" opacity="0">${readShape(`fill="${P.reads}" opacity="${BP ? 0.08 : P.shadow ? 0.10 : 0.07}"`, 0)}${readShape(`fill="none" stroke="${P.reads}" stroke-width="1.6" opacity="0.9"`, 1)}</g>`);
      if (reads.some(r => r.from === n.id)) out.push(readShape(`class="sv-reader-ring" fill="none" stroke="${P.reads}" stroke-width="1.4" opacity="0"`, -2));
      if (reads.length && n.type === 'decision' && ['flow', 'bare'].includes(n.laneKind)) out.push(txt(n.x + n.w - 9, n.y + n.h - 11, String(nodeNo[n.id]).padStart(2, '0'), `text-anchor="end" font-family='${G.MONO}' font-size="10" fill="${BP ? P.text3 : P.text2}" opacity="${BP ? 0.6 : 0.75}" data-card-no="${esc(n.id)}"`));
      if (n.laneKind === 'ref' && readers[n.id]) {
        const ids = readers[n.id].slice().sort((a, b) => nodeNo[a] - nodeNo[b]);
        const x = drill ? readX : n.x + 75, y = drill ? n.y + n.h - 18.2 : n.y + n.h - 14;
        // 展开卡的底行右侧有入口，读取标记放不下时少列几个编号
        let take = Math.min(3, ids.length), shown, suffix, label, w;
        for (;;) {
          shown = ids.slice(0, take);
          suffix = ids.length > take ? ' +' + (ids.length - take) : '';
          label = '← ' + shown.map(id => String(nodeNo[id]).padStart(2, '0')).join('·') + suffix;
          w = SV.layoutUtil.measure(label, 10.5, 500, G.MONO) + 12;
          if (!drill || take <= 1 || x + w <= gate - 6) break;
          take--;
        }
        const box = fill => `<rect x="${f1(x)}" y="${f1(y - 11.5)}" width="${f1(w)}" height="16" rx="5" ${fill}/>`;
        const spans = shown.map((id, i) => `${i ? '·' : ''}<tspan data-reader="${esc(id)}" font-weight="500">${String(nodeNo[id]).padStart(2, '0')}</tspan>`).join('');
        const attrs = `font-family='${G.MONO}' font-size="10.5" font-weight="500"`;
        out.push(`<g class="sv-read-chip">${box(`fill="${P.tagBg}"`)}${txt(x + 6, y, label, `${attrs} fill="${P.tagText}"`)}</g>`);
        out.push(`<g class="sv-read-chip-lit" opacity="0">${box(`fill="${P.reads}" opacity="0.16"`)}<text x="${f1(x + 6)}" y="${f1(y)}" ${attrs} fill="${P.reads}">← ${spans}${suffix}</text></g>`);
      }
      out.push(drill ? '</g></g></g>' : '</g></g>');
    }
    out.push('</g>');

    out.push(`<line class="sv-scan" x1="0" x2="${W}" y1="0" y2="0" stroke="${P.comet}" stroke-width="1.2" opacity="0" pointer-events="none"/><line class="sv-lap-sweep" x1="0" x2="0" y1="0" y2="${H}" stroke="${P.comet}" stroke-width="1" opacity="0" pointer-events="none"/><circle class="sv-arrival" r="4" fill="none" stroke="${P.comet}" stroke-width="1.6" opacity="0" pointer-events="none"/>`);

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
        out.push(`<g data-comet="${e.id}">` + [0, 1, 2].map(() => `<circle r="3" fill="${P.loopDot}" stroke="${P.dotCore}" stroke-width="1" opacity="0"/>`).join('') + '</g>');
      } else {
        out.push(`<g data-comet="${e.id}"><circle r="11" fill="url(#sv-glow)" opacity="0"/>` + [4.0, 3.3, 2.7, 2.1, 1.5].map((r, i) => `<circle r="${r}" fill="${i === 0 ? P.dotCore : P.comet}" stroke="${i === 0 ? P.comet : 'none'}" stroke-width="${i === 0 ? 2 : 0}" opacity="0" data-k="${i}"/>`).join('') + '</g>');
      }
    }
    out.push(`<g class="sv-traveler"><circle r="16" fill="url(#sv-glow)" opacity="0"/>` + [5.5, 4.6, 3.9, 3.3, 2.7, 2.2, 1.7, 1.3].map((r, i) => `<circle r="${r}" fill="${i === 0 ? P.dotCore : P.comet}" stroke="${i === 0 ? P.comet : 'none'}" stroke-width="${i === 0 ? 2.4 : 0}" opacity="0"/>`).join('') + '</g>');
    out.push('</g>');

    if (G.footer) out.push(txt(16, G.footerY - 4, SV.layoutUtil.fit(G.footer, W - 32, 12.5, 400, zh ? G.FONT : G.MONO), `font-family='${zh ? G.FONT : G.MONO}' font-size="12.5" font-weight="500" fill="${P.text3}"`));
    if (!BP) {
      out.push(`<path d="${bevelRect(0, 0, W, H, 22, 12)}" fill="${P.shadow ? '#cbbba0' : '#090d16'}" opacity="${P.shadow ? 0.28 : 0.4}" pointer-events="none"/>`);
      out.push(`<path d="${bevelRect(0, 0, W, H, 22, 7.5)}" fill="${P.shadow ? '#cbbba0' : '#090d16'}" opacity="${P.shadow ? 0.72 : 0.75}" pointer-events="none"/>`);
      out.push(`<path d="M22 2.2H${W - 22}" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="${P.shadow ? 0.9 : 0.14}" pointer-events="none"/>`);
    }
    out.push('</g></svg>');
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
    // skip = 1：路线从触发点出发，编号里不算它，这样与卡片上的 01、02… 对得上
    return { segs, duration: t, rounds: rounds.length, skip: G.trigger && start === G.trigger.id ? 1 : 0 };
  }

  // 主角区角标：触发点标「起点」，其余是第几步 / 共几步（与卡片编号一致）
  function kickerOf(tour, seg) {
    const pad = v => String(Math.max(1, v)).padStart(2, '0');
    if (tour.skip && seg.type === 'node' && seg.idx === 0) return SV.i18n.t('hero.kickerStart');
    return SV.i18n.t('hero.kicker', pad(Math.min(seg.idx + 1, seg.total) - tour.skip), pad(seg.total - tour.skip));
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

  // CSS order: perspective · translation · Rx · Ry · Rz · scale.
  // Coordinates here are relative to the centre (the wrapper's transform-origin).
  function cameraPose(tt, S, INTRO = 1.6) {
    const e = INTRO ? E1(tt / INTRO) : 1;
    return {
      rx: S * (13 + 2 * Math.sin(2 * Math.PI * tt / 22 + 1.1) + 16 * (1 - e)),
      ry: S * (-4 + 3.5 * Math.sin(2 * Math.PI * tt / 16) - 8 * (1 - e)),
      rz: S * .6 * Math.sin(2 * Math.PI * tt / 28),
      zoomIn: 1 - S * (1 - (.88 + .12 * e)),
    };
  }
  function projectCorner(x, y, pose, P) {
    const rad = Math.PI / 180, ax = pose.rx * rad, ay = pose.ry * rad, az = pose.rz * rad;
    x *= pose.zoomIn; y *= pose.zoomIn;
    const zx = x * Math.cos(az) - y * Math.sin(az), zy = x * Math.sin(az) + y * Math.cos(az);
    const xx = zx * Math.cos(ay), xz = -zx * Math.sin(ay);
    const yy = zy * Math.cos(ax) - xz * Math.sin(ax), z = zy * Math.sin(ax) + xz * Math.cos(ax);
    return [xx / (1 - z / P), yy / (1 - z / P)];
  }
  function cameraFit(width, height, S, INTRO) {
    const P = 2.6 * Math.max(width, height), xs = [], ys = [];
    // The five intro samples are explicit; the steady sweep includes both endpoints.
    const times = [...new Set([0, .4, .8, 1.2, 1.6, ...Array.from({ length: 24 }, (_, i) => 44 * i / 23)])];
    for (const tt of times) for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) {
      const q = projectCorner(x, y, cameraPose(tt, S, INTRO), P); xs.push(q[0]); ys.push(q[1]);
    }
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const scale = .97 * Math.min(width / (right - left), height / (bottom - top));
    return { P, scale, cx: -(left + right) / 2 * scale, cy: -(top + bottom) / 2 * scale };
  }

  function createPlayer(svg, G, opt) {
    opt = opt || {};
    const tour = buildTour(G);
    const reduced = !!opt.reducedMotion, INTRO = reduced ? 0 : 1.6, order = readingOrder(G);
    const cardOrder = order.flatMap(id => [id].concat(G.stubs.filter(s => s.from === id).map(s => s.id)));
    const cardStarts = Object.fromEntries(cardOrder.map((id, k) => [id, .25 + .85 * k / Math.max(1, cardOrder.length - 1)]));
    const nodeEls = {}, stubEls = {}, cards = {};
    svg.querySelectorAll('.sv-node').forEach(el => {
      const id = el.getAttribute('data-node');
      nodeEls[id] = Array.from(el.querySelectorAll('.sv-hl'));
      cards[id] = { el, face: el.querySelector('.sv-face'), shadow1: el.querySelector('.sv-shadow1'), shadow2: el.querySelector('.sv-shadow2'), extrusion: Array.from(el.querySelectorAll('.sv-extrusion')), ripple: el.querySelector('.sv-ripple'), hl: el.querySelector('.sv-read-hl'), chip: el.querySelector('.sv-read-chip-lit'), ring: el.querySelector('.sv-reader-ring'), nums: Array.from(el.querySelectorAll('[data-reader]')), dim: 1 };
    });
    svg.querySelectorAll('.sv-stub').forEach(el => { stubEls[el.getAttribute('data-stub')] = Array.from(el.querySelectorAll('.sv-hl')); });
    const depthCards = { ...cards }, geometries = { ...G.nodes };
    G.stubs.forEach(s => {
      const el = svg.querySelector(`[data-stub="${s.id}"]`);
      geometries[s.id] = { ...s, cy: s.y + s.h / 2 };
      depthCards[s.id] = { el, face: el.querySelector('.sv-face'), shadow1: el.querySelector('.sv-shadow1'), shadow2: el.querySelector('.sv-shadow2'), extrusion: Array.from(el.querySelectorAll('.sv-extrusion')), ripple: el.querySelector('.sv-ripple') };
    });
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
    const heroGroup = svg.querySelector('.sv-hero'), heroOld = svg.querySelector('.sv-hero-title-old'), prefix = svg.querySelector('.sv-hero-prefix');
    const kicker = svg.querySelector('.sv-hero-kicker'), kickerOld = svg.querySelector('.sv-hero-kicker-old');
    const dotSets = Array.from(svg.querySelectorAll('[data-dot-total]')).map(el => ({ el, total: +el.getAttribute('data-dot-total'), rail: el.querySelector('.sv-progress'), dots: Array.from(el.querySelectorAll('[data-dot-index]')), rings: Array.from(el.querySelectorAll('[data-dot-ring]')) }));
    const lanes = G.lanes.map((L, index) => { const el = svg.querySelector(`[data-lane="${L.id}"]`); return { L, index, el, border: el && el.querySelector('.sv-lane-border'), brackets: el && el.querySelector('.sv-brackets'), corners: el ? Array.from(el.querySelectorAll('[data-corner]')) : [] }; });
    const edgeEls = G.edges.concat(G.stubs).map(e => ({ e, path: svg.querySelector(`[data-edge="${e.id}"]`), build: svg.querySelector(`[data-edge-build="${e.id}"]`), label: svg.querySelector(`[data-label-build="${e.id}"]`), ink: svg.querySelector(`[data-ink="${e.id}"]`) }));
    const header = svg.querySelector('.sv-header-title'), subtitle = svg.querySelector('.sv-header-sub'), legend = svg.querySelector('.sv-legend'), bar = svg.querySelector('.sv-title-bar'), grid = svg.querySelector('.sv-grid-rulers');
    const scan = svg.querySelector('.sv-scan'), sweep = svg.querySelector('.sv-lap-sweep'), burst = svg.querySelector('.sv-arrival'), gridPlane = svg.querySelector('.sv-grid-plane');
    const P = THEMES[svg.getAttribute('data-theme')] || THEMES.dark;
    const laneOf = id => { const n = G.nodes[id]; return n && n.lane >= 0 ? G.lanes[n.lane] : null; };

    let t = 0, playing = opt.autoplay !== false, speed = 1, raf = 0, last = 0;
    let pin = null, hover = null, hoverLevel = 1, preview = null;
    const camera = { el: opt.camera && opt.camera.el, width: G.W, height: G.H, strength: opt.camera ? opt.camera.strength ?? 1 : 0, ...opt.camera };
    let fitKey = '', fit, cameraTransform, cameraTween = null;
    function renderCamera(tt, seg, u, inIntro) {
      const S = reduced ? 0 : clamp(camera.strength) * (P === THEMES.light ? .8 : 1);
      const pose = cameraPose(tt, S, INTRO);
      attr(gridPlane, 'x', (-20 - 12 * pose.ry / 15).toFixed(4));
      if (!camera.el) return;
      let transform = 'none';
      if (S && camera.width > 0 && camera.height > 0) {
        const { width, height } = camera, key = `${width}/${height}/${S}`;
        if (key !== fitKey) { fit = cameraFit(width, height, S, INTRO); fitKey = key; }
        let C = { cx: G.W / 2, cy: G.H / 2 };
        if (!inIntro && seg) {
          if (seg.type === 'node' || seg.type === 'stub') C = geometries[seg.id] || C;
          else if (seg.type === 'edge' || seg.type === 'stubEdge') {
            const edge = seg.edge || seg.stub, from = geometries[edge.from] || C, to = geometries[edge.to || edge.id] || C;
            const e = E2((u - seg.t0) / (seg.t1 - seg.t0));
            C = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e };
          }
        }
        const pan = (v, centre) => Math.max(-.02 * G.W, Math.min(.02 * G.W, -.04 * S * (v - centre))) * width / G.W;
        const num = n => n.toFixed(8);
        transform = `perspective(${num(fit.P)}px) translate(${num(pan(C.cx, G.W / 2))}px,${num(pan(C.cy, G.H / 2))}px) translate(${num(fit.cx)}px,${num(fit.cy)}px) rotateX(${num(pose.rx)}deg) rotateY(${num(pose.ry)}deg) rotateZ(${num(pose.rz)}deg) scale(${num(fit.scale * pose.zoomIn)})`;
      }
      if (transform !== cameraTransform) { camera.el.style.transform = transform; cameraTransform = transform; }
    }
    // 同一时间重复渲染不依赖上一帧；只缓存相同属性值的写入
    const attrs = new WeakMap();
    const attr = (el, key, value) => {
      if (!el) return;
      let a = attrs.get(el); if (!a) attrs.set(el, a = {});
      value = String(value);
      if (a[key] !== value) { el.setAttribute(key, value); a[key] = value; }
    };
    const text = (el, value) => { if (el && el.textContent !== value) el.textContent = value; };
    const pos = (el, q) => { attr(el, 'cx', f1(q[0])); attr(el, 'cy', f1(q[1])); };
    let alphaIds = new Set(Object.keys(nodeEls).concat(Object.keys(stubEls))), depthIds = new Set(Object.keys(depthCards));
    const listeners = [];

    function segAt(tt) {
      if (!tour) return null;
      const s = tour.segs;
      let lo = 0, hi = s.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid].t1 <= tt) lo = mid + 1; else hi = mid; }
      return lo;
    }

    function setAlpha(map) {
      const ids = new Set(Object.keys(map));
      new Set([...alphaIds, ...ids]).forEach(k => {
        const a = map[k] || 0;
        const els = nodeEls[k] || stubEls[k];
        if (els) els.forEach(el => attr(el, 'opacity', a.toFixed(3)));
      });
      alphaIds = ids;
    }

    function renderReads(alpha, lit, tt, lt) {
      if (!reads.length) return;
      const targets = {}, chips = {}, activeReaders = {}, rings = {}, pinnedTargets = new Set();
      reads.forEach(read => {
        const { r } = read, s = lit[r.from];
        const rise = reduced ? .15 : .3, age = s ? +(lt - s.t0).toFixed(9) : 0, arrival = rise + Math.min(0.2, read.index * 0.05);
        const pinned = !!pin && (pin.step === r.from || pin.ref === r.to);
        if (pinned) { pinnedTargets.add(r.to); if (pin.ref) rings[r.from] = 0.6; }
        const previewed = !pin && preview === r.from;
        const hovered = hover === r.id;
        let glow = alpha[r.from] || 0, reveal = s ? E1(age / rise) : 0;
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
        const pulse = clamp((age - rise) / 0.5);
        attr(read.pulse, 'r', (2.8 + 4.2 * pulse).toFixed(3));
        attr(read.pulse, 'opacity', (!reduced && !pinned && !hovered && !previewed && s && age >= rise && age < rise + .5 ? 0.6 * (1 - pulse) * glow : 0).toFixed(3));
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
        c.dim = n.laneKind === 'ref' && pin && pin.ref !== id && !pinnedTargets.has(id) ? 0.45 : 1;
      });
    }

    // 文案由当前段和前一段决定，倒放和跳帧无需保存旧标题
    function heroInfo(seg) {
      const T = (k, ...a) => SV.i18n.t(k, ...a);
      let title = '', sub = '', kick = '', arrow = false;
      if (pin) {
        const id = pin.step || pin.ref, related = (G.reads || []).filter(r => pin.step ? r.from === id : r.to === id);
        const count = new Set(related.map(r => pin.step ? r.to : r.from)).size;
        title = G.nodes[id].spec.title || '';
        sub = T((pin.step ? 'hero.pinReads' : 'hero.pinUsed') + (count === 1 ? '1' : ''), count);
      } else if (seg) {
        kick = kickerOf(tour, seg);
        if (seg.type === 'pause') {
          title = (G.spec.hero && G.spec.hero.title) || G.spec.title || '';
          sub = (G.spec.hero && G.spec.hero.sub) || T('hero.roundEnd', seg.round + 1, tour.rounds);
        } else if (seg.type === 'stub' || seg.type === 'stubEdge') {
          title = seg.stub.full; sub = T('hero.exit'); arrow = true;
        } else {
          const id = seg.type === 'node' ? seg.id : seg.edge.to, n = G.nodes[id], L = laneOf(id);
          title = n.spec.title || ''; arrow = seg.type === 'edge';
          sub = [L ? L.title : '', seg.round > 0 ? T('hero.branch', seg.round) : ''].filter(Boolean).join(' · ');
        }
      }
      return { title, sub, kick, arrow };
    }

    function hero(seg, previous, u, hidden) {
      if (!heroTitle) return;
      const now = heroInfo(seg), old = !pin && previous ? heroInfo(previous) : { title: '', kick: '' };
      const age = seg ? Math.max(0, u - seg.t0) : 0, big = G.hero.place === 'lane', size = big ? 30 : 25;
      const same = now.title === old.title;
      const incoming = pin || reduced && !previous ? 1 : E1((age - .08) / .28), outgoing = pin || same ? 0 : 1 - E1(age / .12);
      const ARROW_W = SV.layoutUtil.measure('→ ', size, 800);
      const postEdge = !pin && seg && seg.type === 'node' && previous && previous.type === 'edge' && same;
      const offset = now.arrow ? ARROW_W : postEdge && !reduced ? ARROW_W * (1 - E2(age / .25)) : 0;
      const prefixAlpha = pin ? 0 : postEdge ? reduced ? 0 : 1 - E1(age / .15) : now.arrow ? seg.type === 'edge' ? E1(age / .2) : 1 : 0;
      const dx = reduced || pin || same ? 0 : -10 * (1 - incoming);
      const fitted = SV.layoutUtil.fit(now.title, G.hero.maxW - ARROW_W, size, 800);
      text(heroTitle, fitted); text(heroOld, SV.layoutUtil.fit(old.title, G.hero.maxW - ARROW_W, size, 800));
      text(heroSub, SV.layoutUtil.fit(now.sub, G.hero.maxW, big ? 16 : 14.5, 400));
      text(kicker, now.kick); text(kickerOld, old.kick);
      attr(heroGroup, 'opacity', hidden ? 0 : 1);
      attr(heroTitle, 'letter-spacing', spacing(fitted)); attr(heroOld, 'letter-spacing', spacing(old.title));
      attr(heroTitle, 'opacity', same || pin ? 1 : incoming); attr(heroOld, 'opacity', outgoing);
      attr(heroTitle, 'x', f1(G.hero.textX + dx + offset));
      attr(prefix, 'x', f1(G.hero.textX)); attr(prefix, 'opacity', prefixAlpha);
      attr(heroOld, 'x', f1(G.hero.textX + (old.arrow ? ARROW_W : 0) + (reduced ? 0 : 6 * E1(age / .12))));
      const sameKick = now.kick === old.kick;
      attr(kicker, 'opacity', pin ? 0 : sameKick ? 1 : incoming); attr(kickerOld, 'opacity', pin || sameKick ? 0 : 1 - E1(age / .12));
      [kicker, kickerOld].forEach(el => attr(el, 'letter-spacing', SV.i18n.lang === 'zh' ? 1 : 1.6));
      attr(heroDots, 'opacity', pin ? 0 : 1);
      const x = seg ? clamp(age / (seg.t1 - seg.t0)) : 0;
      const prog = seg ? seg.type === 'pause' ? seg.total - 1 : seg.type === 'edge' || seg.type === 'stubEdge' ? seg.idx - 1 + E2(x) : seg.idx : 0;
      dotSets.forEach(set => {
        const active = !!seg && !pin && set.total === seg.total, current = active && seg.type !== 'pause' ? Math.min(seg.idx, set.total - 1) : -1;
        attr(set.el, 'opacity', active ? 1 : 0); attr(set.rail, 'width', active ? f1(23 * clamp(prog / Math.max(1, set.total - 1)) * (set.total - 1)) : 0);
        set.dots.forEach((el, k) => {
          const past = active && (k <= prog || k === current);
          attr(el, 'fill', past ? accent(P) : P.text3); attr(el, 'opacity', past ? .9 : .45);
          attr(el, 'r', k === current ? (4.5 + 2.5 * B(age / .3)).toFixed(3) : 4.5);
          attr(set.rings[k], 'r', k === current ? (7 + 9 * E1(age / .5)).toFixed(3) : 7);
          attr(set.rings[k], 'opacity', k === current && !reduced ? (.6 * (1 - clamp(age / .5))).toFixed(3) : 0);
        });
      });
    }

    function cardDepth(lifts, ripples) {
      const ids = new Set(Object.keys(lifts).concat(Object.keys(ripples)));
      new Set([...depthIds, ...ids]).forEach(id => {
        const c = depthCards[id], n = geometries[id]; if (!c) return;
        const L = reduced ? 0 : lifts[id] || 0, dx = -2 * L, dy = -7 * L;
        attr(c.face, 'transform', `translate(${dx.toFixed(3)},${dy.toFixed(3)})`);
        attr(c.face, 'data-lift', L.toFixed(3));
        const k = P === THEMES.blueprint ? 0 : P === THEMES.dark ? 1 : 2;
        [[c.shadow1, 0, 3, [.24, .30, .12][k]], [c.shadow2, 0, 6, [.12, .16, .06][k]]].forEach(([el, x, y, a]) => {
          attr(el, 'transform', `translate(${(x + 2 * L).toFixed(3)},${(y + 8 * L).toFixed(3)})`);
          attr(el, 'opacity', (a * (1 - .25 * L)).toFixed(3));
        });
        c.extrusion.forEach((el, i) => {
          const p = (i + 1) / 4;
          attr(el, 'transform', `translate(${(dx * p).toFixed(3)},${(6 + (dy - 6) * p).toFixed(3)})`);
          attr(el, 'opacity', L < .02 ? 0 : 1);
        });
        const x = reduced || pin ? 1 : clamp(ripples[id] == null ? 1 : ripples[id]), inset = -5 - 19 * E1(x);
        attr(c.ripple, 'opacity', (.55 * (1 - E1(x))).toFixed(3));
        if (n.type === 'decision') attr(c.ripple, 'points', `${f1(n.cx)},${f1(n.y + inset)} ${f1(n.x + n.w - inset)},${f1(n.cy)} ${f1(n.cx)},${f1(n.y + n.h - inset)} ${f1(n.x + inset)},${f1(n.cy)}`);
        else { attr(c.ripple, 'x', f1(n.x + inset)); attr(c.ripple, 'y', f1(n.y + inset)); attr(c.ripple, 'width', f1(n.w - 2 * inset)); attr(c.ripple, 'height', f1(n.h - 2 * inset)); }
      });
      depthIds = ids;
    }

    function renderAt(tt) {
      t = Math.max(0, tt); tt = t;
      const elapsed = Math.max(0, tt - INTRO), T = tour ? tour.duration : 0, u = T ? elapsed % T : elapsed;
      const inIntro = tt < INTRO && !pin, i = tour ? segAt(u) : 0, seg = tour && tour.segs[i];
      renderCamera(tt, seg, u, tt < INTRO);
      const moving = !inIntro && seg && (seg.type === 'edge' || seg.type === 'stubEdge');
      const near = tour && !inIntro ? tour.segs.slice(Math.max(0, i - 4), i + 2) : [];
      const alpha = {}, lit = {}, lifts = {}, ripples = {}, laneAlpha = {}, inks = {};
      let damping = 0, arrival = null;
      for (const s of near) {
        const age = +(u - s.t0).toFixed(9), after = +(u - s.t1).toFixed(9);
        if (s.type === 'node' || s.type === 'stub') {
          let a = 0, L = 0;
          if (age >= 0 && after < 0) { a = E1(age / (reduced ? .15 : .30)); L = B(age / .32); }
          else if (after >= 0 && after < .7) { a = Math.pow(1 - after / .7, 2); L = 1 - E2(after / .5); }
          if (a > (alpha[s.id] || 0)) { alpha[s.id] = a; lit[s.id] = s; }
          if (L > (lifts[s.id] || 0)) lifts[s.id] = L;
          if (age >= 0 && age < .5) ripples[s.id] = age / .5;
          const lane = laneOf(s.id), brightness = age >= 0 && after < 0 ? E1(age / .5) : after >= 0 ? 1 - E2(after / .5) : 0;
          if (lane) laneAlpha[lane.id] = Math.max(laneAlpha[lane.id] || 0, brightness);
        } else if (s.type === 'edge' || s.type === 'stubEdge') {
          const e = s.edge || s.stub;
          if (age >= 0 && after < 0) {
            const progress = E2(age / (s.t1 - s.t0));
            inks[s.id] = { p: progress, a: .85, loop: .7 * Math.sin(Math.PI * progress) };
            damping = Math.max(damping, E1(age / .2));
            if (s.type === 'edge') alpha[e.to] = Math.max(alpha[e.to] || 0, .35 * E1((u - (s.t1 - .25)) / .25));
          } else if (after >= 0 && after < .6) {
            inks[s.id] = { p: 1, a: .85 * (1 - after / .6), loop: 0 };
            damping = Math.max(damping, 1 - E1(after / .2));
            if (after < .4) arrival = { e, age: after };
          }
        }
      }
      if (!reduced && !pin && seg && seg.type === 'pause' && !inIntro) cardOrder.forEach((id, k) => {
        const x = clamp((u - seg.t0 - Math.min(.4, .03 * k)) / .5);
        lifts[id] = Math.max(lifts[id] || 0, .6 * Math.sin(Math.PI * x));
      });
      if (pin) {
        [lifts, ripples, laneAlpha].forEach(map => Object.keys(map).forEach(id => delete map[id]));
        if (pin.step) lifts[pin.step] = 1;
        const lane = laneOf(pin.step || pin.ref); if (lane) laneAlpha[lane.id] = 1;
      }
      renderReads(pin ? {} : alpha, pin ? {} : lit, u, u);
      setAlpha(pin ? (pin.step ? { [pin.step]: 1 } : {}) : alpha);
      cardDepth(lifts, ripples);

      // 第一圈装配；静态 SVG 完整，隐藏状态只由播放器施加
      const built = start => inIntro ? E1((tt - start) / .4) : 1;
      const startAt = id => cardStarts[id] == null ? .25 : cardStarts[id];
      cardOrder.forEach(id => {
        const n = geometries[id], c = depthCards[id], x = inIntro ? clamp((tt - startAt(id)) / .4) : 1;
        const scale = inIntro ? Math.min(1, .94 + .06 * B(x)) : 1;
        attr(c.el, 'opacity', (built(startAt(id)) * (c.dim == null ? 1 : c.dim)).toFixed(3));
        attr(c.el, 'transform', `translate(${f1(n.cx)},${f1(n.cy + 10 * (1 - E1(x)))}) scale(${scale.toFixed(4)}) translate(${f1(-n.cx)},${f1(-n.cy)})`);
      });
      attr(header, 'opacity', inIntro ? E1((tt - .05) / .5) : 1);
      attr(header, 'transform', `translate(0,${(inIntro ? 12 * (1 - E1((tt - .05) / .5)) : 0).toFixed(3)})`);
      attr(subtitle, 'opacity', inIntro ? E1((tt - .3) / .4) : 1);
      attr(subtitle, 'transform', `translate(0,${(inIntro ? 12 * (1 - E1((tt - .3) / .4)) : 0).toFixed(3)})`);
      attr(legend, 'opacity', inIntro ? E1((tt - .3) / .4) : 1);
      attr(bar, 'width', inIntro ? f1(56 * E1((tt - .35) / .5)) : 56);
      attr(grid, 'opacity', inIntro ? E1(tt / .6) : 1);
      lanes.forEach(({ L, index, el, border, brackets, corners }) => {
        const x = inIntro ? E1((tt - .08 * index) / .45) : 1, a = laneAlpha[L.id] || 0;
        attr(el, 'opacity', x); attr(el, 'transform', `translate(0,${(14 * (1 - x)).toFixed(3)})`);
        attr(border, 'stroke-opacity', (.7 * (1 + .4 * a)).toFixed(3));
        const trail = inIntro ? E1((tt - .08 * index - .1) / .45) : 1;
        attr(brackets, 'opacity', (trail * (.6 + .4 * a)).toFixed(3));
        corners.forEach(c => { const [dx, dy] = c.getAttribute('data-corner').split(',').map(Number); attr(c, 'transform', `translate(${(-dx * 8 * (1 - trail)).toFixed(3)},${(-dy * 8 * (1 - trail)).toFixed(3)})`); });
      });
      edgeEls.forEach(({ e, path, build, label, ink }) => {
        const a = built(startAt(e.from) + .15), state = !pin && inks[e.id];
        attr(build, 'opacity', a); attr(label, 'opacity', a);
        attr(path, 'opacity', e.kind === 'loop' ? (Math.min(1, .3 + (state ? state.loop : 0))).toFixed(3) : 1);
        attr(ink, 'opacity', state && e.kind !== 'loop' ? state.a.toFixed(3) : 0);
        attr(ink, 'stroke-dashoffset', state ? (1 - state.p).toFixed(5) : 1);
      });

      // 环境与旅行者使用属性缓存；不可见点归零保证随机寻址一致
      for (const c of comets) {
        const s = ((tt + c.phase) % c.period) * c.speed - 30, fade = Math.max(0, Math.min(1, s / 30, (c.len - s) / 30));
        c.els.forEach((el, k) => {
          const ss = s - (c.loop ? k * 8 : Math.max(0, k - 1) * 5), vis = !reduced && !inIntro && ss >= 0 && ss <= c.len;
          const a = c.loop ? .9 - k * .22 : k === 0 ? .9 * fade : (1 - (k - 1) * .19) * Math.max(.2, fade);
          pos(el, vis ? c.at(ss) : [0, 0]); attr(el, 'opacity', vis ? (a * (1 - .4 * damping)).toFixed(3) : 0);
        });
      }
      attr(traveler, 'opacity', pin || inIntro ? 0 : 1);
      if (!pin && moving) {
        const e = seg.edge || seg.stub, x = clamp((u - seg.t0) / (seg.t1 - seg.t0)), p = E2(x), s = p * e.len;
        const v = Math.min(1, (x < .5 ? 12 * x * x : 12 * (1 - x) * (1 - x)) / 3), spacing = reduced ? 3 : 3 + 6 * v;
        trav.forEach((el, k) => { const ss = k === 0 ? s : s - (k - 1) * spacing; pos(el, travSamplers[seg.id](Math.max(0, ss))); attr(el, 'opacity', ss >= 0 ? (k === 0 ? .95 : 1 - (k - 1) * .11).toFixed(3) : 0); });
      } else trav.forEach(el => { attr(el, 'opacity', 0); pos(el, [0, 0]); });
      const showBurst = !reduced && !pin && arrival;
      pos(burst, showBurst ? arrival.e.pts[ arrival.e.pts.length - 1 ] : [0, 0]);
      attr(burst, 'r', showBurst ? (4 + 18 * E1(arrival.age / .4)).toFixed(3) : 4);
      attr(burst, 'opacity', showBurst ? (.8 * (1 - arrival.age / .4)).toFixed(3) : 0);
      const scanY = reduced ? 0 : tt % 9 / 9 * G.H;
      attr(scan, 'y1', f1(scanY)); attr(scan, 'y2', f1(scanY));
      attr(scan, 'opacity', reduced || inIntro ? 0 : P === THEMES.blueprint ? .10 : P === THEMES.dark ? .06 : 0);
      const wrapping = !reduced && elapsed >= T && T > 0 && u < .6;
      attr(sweep, 'x1', wrapping ? f1(E2(u / .6) * G.W) : 0); attr(sweep, 'x2', wrapping ? f1(E2(u / .6) * G.W) : 0); attr(sweep, 'opacity', wrapping ? .5 : 0);
      const previous = tour && (i > 0 ? tour.segs[i - 1] : elapsed >= T ? tour.segs[tour.segs.length - 1] : null);
      hero(seg, previous, u, inIntro);
      if (!inIntro && seg) listeners.forEach(fn => fn(seg, u));
    }

    function frame(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (cameraTween) {
        if (cameraTween.start == null) cameraTween.start = now;
        const e = clamp((now - cameraTween.start) / 300);
        camera.strength = cameraTween.from + (cameraTween.to - cameraTween.from) * E2(e);
        if (e === 1) { const done = cameraTween.done; cameraTween = null; if (done) done(); }
      }
      if (playing) t += dt * speed;
      renderAt(t);
      raf = requestAnimationFrame(frame);
    }
    if (opt.loop !== false) raf = requestAnimationFrame(frame);
    else renderAt(0);

    const stepStarts = tour ? tour.segs.filter(s => s.type === 'node' || s.type === 'stub').map(s => s.t0) : [];
    return {
      tour, G, intro: INTRO,
      get time() { return t; },
      get playing() { return playing; },
      get duration() { return tour ? tour.duration : 0; },
      play() { playing = true; },
      pause() { playing = false; },
      toggle() { playing = !playing; return playing; },
      setSpeed(v) { speed = v; },
      // Optional real-time easing is used only by normal app interactions.
      // Record/export pass a constant strength and never request a transition.
      setCamera({ strength, width, height, ease = false, onSettled } = {}) {
        if (width != null) camera.width = width;
        if (height != null) camera.height = height;
        if (strength != null && strength !== (cameraTween ? cameraTween.to : camera.strength)) {
          if (ease && opt.loop !== false) cameraTween = { from: camera.strength, to: strength, start: null, done: onSettled };
          else { camera.strength = strength; cameraTween = null; }
        } else if (cameraTween && onSettled) cameraTween.done = onSettled;
        if (!cameraTween) { if (opt.loop === false) renderAt(t); if (onSettled) onSettled(); }
      },
      setPin(v) { pin = v; hover = null; preview = null; renderAt(t); },
      setHover(id, level) { hover = id; hoverLevel = level == null ? 1 : clamp(level); renderAt(t); },
      setPreview(id) { preview = id; renderAt(t); },
      seek(v) { t = v; renderAt(t); },
      renderAt,
      next() {
        if (!tour) return;
        const T = tour.duration, base = INTRO + Math.floor(Math.max(0, t - INTRO) / T) * T, lt = Math.max(0, t - base);
        const n = stepStarts.find(s => s > lt + 0.01);
        t = n != null ? base + n + 0.25 : base + T + 0.25;
        renderAt(t);
      },
      prev() {
        if (!tour) return;
        const T = tour.duration, base = INTRO + Math.floor(Math.max(0, t - INTRO) / T) * T, lt = Math.max(0, t - base);
        const before = stepStarts.filter(s => s < lt - 0.3);
        t = before.length > 1 ? base + before[before.length - 2] + 0.25 : base + 0.25;
        renderAt(t);
      },
      jumpTo(id) {
        if (!tour) return false;
        const s = tour.segs.find(x => (x.type === 'node' || x.type === 'stub') && x.id === id);
        if (!s) return false;
        const T = tour.duration;
        t = INTRO + Math.floor(Math.max(0, t - INTRO) / T) * T + s.t0 + 0.25;
        renderAt(t);
        return true;
      },
      onStep(fn) { listeners.push(fn); },
      destroy() { cancelAnimationFrame(raf); listeners.length = 0; },
    };
  }

  SV.render = { toSVG, createPlayer, buildTour, cameraPose, THEMES };
};
SV.mod.render(SV);
