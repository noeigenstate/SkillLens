/* spec → 几何：泳道、节点坐标、正交连线、标签 */
SV.mod.layout = function (SV) {
  const FONT = '"Inter","Noto Sans SC","Source Han Sans SC","Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Segoe UI",system-ui,sans-serif';
  const MONO = '"JetBrains Mono","Cascadia Mono",Consolas,ui-monospace,monospace';
  const K = {
    LANE_X: 88, RIGHT: 26, PAD: 18, CARD_W: 232, CARD_H: 134, TRIG_H: 150, GAP: 40,
    DW: 176, DH: 156, HEADER: 84, ROW_GAP: 66, STUB_EXT: 64, LANE_PAD_B: 46, LANE_GAP: 50,
    TOP: 156, TEXT_X: 75, TEXT_W: 143, MARGIN_X: 58, NOTE_H: 33,
  };

  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g2d = canvas && canvas.getContext('2d');
  const cache = new Map();
  function measure(text, size, weight, family) {
    const key = size + '|' + (weight || 400) + '|' + (family || '') + '|' + text;
    let w = cache.get(key);
    if (w == null) {
      if (g2d) { g2d.font = `${weight || 400} ${size}px ${family || FONT}`; w = g2d.measureText(text).width; }
      else w = SV.text.units(text) * size * 0.55;
      if (cache.size > 20000) cache.clear();
      cache.set(key, w);
    }
    return w;
  }

  const TOKEN_RE = /[⺀-鿿豈-﫿　-〿＀-￯]|[^\s⺀-鿿豈-﫿　-〿＀-￯]+|\s+/g;
  const NO_START = /^[，。、；：？！）」』》〉】,.;:!?)\]}%…]/;

  function fit(text, maxW, size, weight, family) {
    text = String(text || '');
    if (measure(text, size, weight, family) <= maxW) return text;
    const chars = Array.from(text);
    let lo = 0, hi = chars.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measure(chars.slice(0, mid).join('').trimEnd() + '…', size, weight, family) <= maxW) lo = mid; else hi = mid - 1;
    }
    return chars.slice(0, lo).join('').replace(/[\s,，、;；:：(（\-–—/]+$/, '') + '…';
  }

  /* 中英混排折行，超出行数时末行加省略号 */
  function wrap(text, maxW, size, weight, maxLines) {
    const toks = String(text || '').replace(/\s+/g, ' ').trim().match(TOKEN_RE) || [];
    const lines = [];
    let cur = '';
    let i = 0;
    let overflow = false;
    for (; i < toks.length; i++) {
      const t = toks[i];
      if (!cur && t === ' ') continue;
      const cand = cur + t;
      if (measure(cand.trimEnd(), size, weight) <= maxW || (NO_START.test(t) && t.length <= 2 && cur)) { cur = cand; continue; }
      if (!cur.trim()) {
        // 单个超长词：按字符硬切
        let part = '';
        for (const ch of Array.from(t)) {
          if (part && measure(part + ch, size, weight) > maxW) {
            if (lines.length === maxLines - 1) { overflow = true; break; }
            lines.push(part); part = '';
          }
          part += ch;
        }
        cur = part;
        if (overflow) break;
        continue;
      }
      if (lines.length === maxLines - 1) { overflow = true; break; }
      lines.push(cur.trimEnd());
      cur = '';
      if (t !== ' ') i--; // 这个词放到新的一行重新处理（太长的会被按字符切开）
    }
    if (overflow) {
      // 最后一行装不下：把剩下的拼起来按宽度截断
      lines.push(fit((cur + toks.slice(i).join('')).trim(), maxW, size, weight));
      if (!lines[lines.length - 1].endsWith('…')) lines[lines.length - 1] = fit(lines[lines.length - 1] + ' …', maxW, size, weight);
    } else if (cur.trim()) lines.push(cur.trimEnd());
    return lines;
  }

  const linesText = n => Array.isArray(n.lines) ? n.lines.filter(Boolean).join('\n') : String(n.lines || '');

  /* 中间省略保留扩展名及末尾三个字符，优先在分隔符后截断 */
  function shortFile(title, maxW, size) {
    if (measure(title, size, 700) <= maxW) return title;
    const ext = (title.match(/\.\w{1,5}$/) || [''])[0];
    const stem = ext ? title.slice(0, -ext.length) : title;
    const tail = stem.slice(-3) + ext;
    let cut = Math.max(0, stem.length - 3);
    while (cut > 0 && measure(stem.slice(0, cut) + '…' + tail, size, 700) > maxW) cut--;
    for (let i = cut; i >= Math.max(1, cut - 3); i--) {
      if (/[-_]/.test(stem[i - 1])) { cut = i; break; }
    }
    return stem.slice(0, cut) + '…' + tail;
  }

  /* 节点文字排版 */
  function prepNode(sp, kind, hasReads) {
    const n = {
      id: sp.id, type: sp.type === 'trigger' ? 'trigger' : (sp.type || 'step'), spec: sp,
      icon: sp.icon || '', tag: sp.tag || '', terminal: !!sp.terminal, optional: !!sp.optional, more: !!sp.more,
    };
    if (n.type === 'decision') {
      n.w = K.DW; n.h = K.DH;
      let size = 15.5;
      let tl = wrap(sp.title, 112, size, 700, 2);
      if (tl.length > 1) { size = 14.5; tl = wrap(sp.title, 116, size, 700, 2); }
      n.titleLines = tl; n.titleSize = size;
      n.sub = n.tag ? fit(n.tag, 100, 12, 400) : '';
      return n;
    }
    n.w = K.CARD_W;
    n.h = kind === 'trigger' ? K.TRIG_H : K.CARD_H;
    const title = String(sp.title || '');
    let size = 18, titleLines;
    if (hasReads && kind === 'ref' && title.split(' + ').every(p => /^[\w.@~/-]+\.\w{1,5}$/.test(p) || p.endsWith('/'))) {
      // 文件名不折行：先缩字号，再收短前缀
      size = [18, 16, 14.5, 13.5].find(s => measure(title, s, 700) <= K.TEXT_W) || 13.5;
      titleLines = [shortFile(title, K.TEXT_W, size)];
    }
    else if (measure(title, 18, 700) <= K.TEXT_W) titleLines = [title];
    else if (measure(title, 16, 700) <= K.TEXT_W) { size = 16; titleLines = [title]; }
    else { size = 16; titleLines = wrap(title, K.TEXT_W, 16, 700, 2); }
    n.titleLines = titleLines; n.titleSize = size;
    const lastW = measure(titleLines[titleLines.length - 1], size, 700);
    const tagW = n.tag ? measure(n.tag, 10.5, 500, MONO) + 12 : 0;
    n.tagInline = !!n.tag && titleLines.length === 1 && lastW + 8 + tagW <= K.TEXT_W + 6;
    n.tagBelow = !!n.tag && !n.tagInline && kind === 'trigger';
    const maxBody = kind === 'trigger' ? (n.tagBelow ? 2 : 3) : (titleLines.length > 1 ? 2 : 2);
    const raw = linesText(sp);
    const parts = raw.split('\n').filter(Boolean);
    let body = [];
    if (parts.length > 1) {
      for (const p of parts) {
        if (body.length >= maxBody) break;
        body.push(...wrap(p, K.TEXT_W, 14, 400, 1));
      }
      if (parts.length > maxBody && body.length) body[body.length - 1] = fit(body[body.length - 1] + ' …', K.TEXT_W, 14, 400);
    } else body = wrap(raw, K.TEXT_W, 14, 400, maxBody);
    n.body = body;
    return n;
  }

  function layout(spec, opt) {
    opt = opt || {};
    const cols = Math.max(2, Math.min(6, opt.cols || spec.cols || 4));
    const nodeIds = new Set(spec.lanes.flatMap(l => (l.nodes || []).map(n => n.id)).concat(spec.trigger ? [spec.trigger.id] : []));
    const hasReads = (spec.reads || []).some(r => nodeIds.has(r.from) && nodeIds.has(r.to));
    const W = K.LANE_X + K.PAD * 2 + cols * K.CARD_W + (cols - 1) * K.GAP + K.RIGHT;
    const colX = c => K.LANE_X + K.PAD + c * (K.CARD_W + K.GAP);
    const G = { W, H: 0, cols, K, FONT, MONO, nodes: {}, lanes: [], rows: [], edges: [], stubs: [], labels: [], notes: [], spec, warnings: [] };
    G.header = { window: spec.window || '', title: spec.title || '', subtitle: spec.subtitle || '' };
    G.header.titleText = fit(G.header.title, W - K.LANE_X - K.RIGHT - 10, 36, 800);
    G.header.subText = fit(G.header.subtitle, W - K.LANE_X - K.RIGHT - 10, 17, 400);
    G.header.window = fit(G.header.window, W - K.LANE_X - 80, 12.5, 400, MONO);

    const stubFrom = {};
    (spec.stubs || []).forEach(s => { (stubFrom[s.from] = stubFrom[s.from] || []).push(s); });

    let y = K.TOP;
    const rows = G.rows;
    const place = (n, x, yTop, col, row) => {
      n.col = col; n.row = row;
      if (n.type === 'decision') {
        n.cx = x + K.CARD_W / 2; n.cy = yTop + K.CARD_H / 2;
        n.x = n.cx - n.w / 2; n.y = n.cy - n.h / 2;
      } else {
        n.x = x; n.y = yTop; n.cx = x + n.w / 2; n.cy = yTop + n.h / 2;
      }
      G.nodes[n.id] = n;
    };

    if (spec.trigger) {
      const n = prepNode(spec.trigger, 'trigger');
      const row = { g: rows.length, lane: -1, r: 0, top: y, bottom: y + n.h, nodes: [n], dir: 1, hasStub: false, laneFirst: true };
      place(n, colX(0), y, 0, row);
      n.lane = -1;
      rows.push(row);
      G.trigger = n;
      y += n.h + K.LANE_GAP;
    }

    let prevCol = spec.trigger ? 0 : null;
    spec.lanes.forEach((lane, li) => {
      const L = { id: lane.id, title: lane.title || '', tag: lane.tag || '', color: lane.color || ['green', 'blue', 'purple', 'teal', 'rose', 'amber'][li % 6], kind: lane.kind || 'flow', x: K.LANE_X, y, w: W - K.LANE_X - K.RIGHT, rows: [], notes: [] };
      L.titleText = fit(L.title, L.w - 60, 20, 700);
      L.titleW = measure(L.titleText, 20, 700);
      L.tagText = L.tag ? fit(L.tag, Math.max(0, L.w - L.titleW - 70), 14.5, 400) : '';
      const nodes = lane.nodes || [];
      const chunks = [];
      for (let i = 0; i < nodes.length; i += cols) chunks.push(nodes.slice(i, i + cols));
      const chained = L.kind === 'flow' || L.kind === 'bare';
      let dir = 1;
      if (chained && prevCol != null && chunks.length) dir = Math.abs(prevCol - (cols - 1)) < Math.abs(prevCol) ? -1 : 1;
      let cursor = y + (L.kind === 'bare' ? 0 : K.HEADER);
      chunks.forEach((chunk, r) => {
        const rowDir = chained ? (r % 2 === 0 ? dir : -dir) : 1;
        const row = { g: rows.length, lane: li, r, top: cursor, bottom: cursor + K.CARD_H, nodes: [], dir: rowDir, hasStub: false, laneFirst: r === 0 };
        chunk.forEach((sp, i) => {
          const n = prepNode(sp, L.kind === 'ref' ? 'ref' : 'node', hasReads);
          const col = rowDir === 1 ? i : cols - 1 - i;
          place(n, colX(col), cursor, col, row);
          n.lane = li; n.laneKind = L.kind; n.color = L.color;
          row.nodes.push(n);
          if (stubFrom[n.id]) row.hasStub = true;
        });
        rows.push(row);
        L.rows.push(row);
        cursor += K.CARD_H + (row.hasStub ? K.STUB_EXT : 0);
        if (r < chunks.length - 1) cursor += K.ROW_GAP;
      });
      if (!chunks.length) cursor = y + 64;
      if (lane.notes && lane.notes.length) {
        cursor += chunks.length ? 44 : 0;
        L.notesRaw = lane.notes.slice();
        L.notes = lane.notes.map((t, i) => ({ x: L.x + 56, y: cursor + i * K.NOTE_H + 18, text: fit(t, L.w - 110, 15.5, 400) }));
        cursor += lane.notes.length * K.NOTE_H;
        L.h = cursor + 22 - y;
      } else {
        L.h = cursor + (L.kind === 'bare' ? 0 : K.LANE_PAD_B) - y;
      }
      if (chained && chunks.length) {
        const lastRow = L.rows[L.rows.length - 1];
        prevCol = lastRow.nodes[lastRow.nodes.length - 1].col;
      }
      G.lanes.push(L);
      y += L.h + K.LANE_GAP;
    });
    G.lanesBottom = y - K.LANE_GAP;

    /* 每一行的上下通道 */
    rows.forEach((row, i) => {
      const prev = rows[i - 1];
      if (!prev) row.aboveY = row.top - 26;
      else if (row.laneFirst && row.lane >= 0) {
        const L = G.lanes[row.lane];
        const prevBottom = prev.lane === -1 ? prev.bottom : G.lanes[prev.lane].y + G.lanes[prev.lane].h;
        row.aboveY = (prevBottom + L.y) / 2;
      } else row.aboveY = ((prev.bottom + (prev.hasStub ? K.STUB_EXT : 0)) + row.top) / 2;
      row.belowY = row.bottom + (row.hasStub ? K.STUB_EXT + 10 : 24);
      row.headerY = row.top - 22;
    });

    /* 主角区（显示当前步骤）：首条流程泳道第一行的空列，否则放在触发行右侧 */
    const firstFlow = G.lanes.find(l => (l.kind === 'flow' || l.kind === 'bare') && l.rows.length);
    const r0 = firstFlow && firstFlow.rows[0];
    const free = r0 ? cols - r0.nodes.length : 0;
    if (r0 && free >= 2) {
      const usedCols = r0.nodes.map(n => n.col);
      const freeCols = [];
      for (let c = 0; c < cols; c++) if (!usedCols.includes(c)) freeCols.push(c);
      const x0 = colX(Math.min(...freeCols)) + (r0.dir === 1 ? 4 : 0);
      const x1 = colX(Math.max(...freeCols)) + K.CARD_W;
      G.hero = { x: x0, y: r0.top, w: x1 - x0, h: K.CARD_H, place: 'lane' };
    } else if (G.trigger) {
      const x0 = G.trigger.x + G.trigger.w + 48;
      G.hero = { x: x0, y: G.trigger.y + 46, w: W - K.RIGHT - x0, h: G.trigger.h - 46, place: 'trigger' };
    }
    if (G.trigger) {
      const x0 = G.trigger.x + G.trigger.w + 40;
      const ly = G.hero && G.hero.place === 'trigger' ? G.trigger.y + 22 : G.trigger.cy;
      const span = (W - K.RIGHT - x0) / (hasReads ? 4 : 3);
      G.legend = { y: ly, items: [{ x: x0, kind: 'solid', text: SV.i18n.t('legend.forward') }, { x: x0 + span, kind: 'dashed', text: SV.i18n.t('legend.loop') }, { x: x0 + span * 2, kind: 'dot', text: SV.i18n.t('legend.data') }] };
      if (hasReads) G.legend.items.push({ x: x0 + span * 3, kind: 'reads', text: SV.i18n.t('legend.reads') });
      if (hasReads) {
        const items = G.legend.items, width = W - K.RIGHT - x0;
        // 先均分余白；不足时固定最小间距，把宽度优先留给短文本
        const budget = Math.max(0, width - items.length * 48 - (items.length - 1) * 28);
        let lo = 0, hi = Math.max(...items.map(it => measure(it.text, 15.5)));
        for (let i = 0; i < 32; i++) {
          const mid = (lo + hi) / 2;
          if (items.reduce((sum, it) => sum + Math.min(measure(it.text, 15.5), mid), 0) <= budget) lo = mid; else hi = mid;
        }
        if (items.reduce((sum, it) => sum + measure(it.text, 15.5), 0) > budget) items.forEach(it => { it.text = fit(it.text, lo, 15.5); });
        const widths = items.map(it => 48 + measure(it.text, 15.5));
        const gap = Math.max(28, (width - widths.reduce((a, b) => a + b, 0)) / (items.length - 1));
        let x = x0;
        items.forEach((it, i) => { it.x = x; x += widths[i] + gap; });
      }
    }

    /* —— 连线 —— */
    const used = {};
    const OFF = [0, 9, -9, 18, -18, 27, -27];
    const chan = (key, v) => { const k = key + Math.round(v); const c = used[k] = (used[k] || 0) + 1; return v + OFF[Math.min(c - 1, OFF.length - 1)]; };
    let marginCount = 0;

    const port = (n, side) => {
      if (n.type === 'decision') {
        if (side === 'top') return [n.cx, n.cy - n.h / 2];
        if (side === 'bottom') return [n.cx, n.cy + n.h / 2];
        if (side === 'left') return [n.cx - n.w / 2, n.cy];
        return [n.cx + n.w / 2, n.cy];
      }
      if (side === 'top') return [n.cx, n.y];
      if (side === 'bottom') return [n.cx, n.y + n.h];
      if (side === 'left') return [n.x, n.cy];
      return [n.x + n.w, n.cy];
    };
    const leftmost = n => n.row.nodes.every(m => m === n || m.col > n.col);
    const nextRow = row => rows[row.g + 1];
    const blockedBetween = (s, t) => rows.some(r => r.g > Math.min(s.row.g, t.row.g) && r.g < Math.max(s.row.g, t.row.g) && r.nodes.some(m => m.col === s.col));

    /* 同一侧被占用时，第二条线错开出发点 */
    const portUse = {};
    function take(n, side, towardX) {
      const k = n.id + ':' + side;
      const c = portUse[k] || 0;
      portUse[k] = c + 1;
      const p = port(n, side);
      if (c === 0 || towardX == null || (side !== 'top' && side !== 'bottom')) return p;
      const sgn = Math.sign(towardX - n.cx) || 1;
      if (n.type === 'decision') return [n.cx + sgn * n.w / 4, side === 'top' ? n.cy - n.h / 4 : n.cy + n.h / 4];
      return [n.cx + sgn * Math.min(42, n.w / 2 - 22), p[1]];
    }
    const hasStub = n => !!stubFrom[n.id];

    function route(e, s, t) {
      const sr = s.row, tr = t.row, dashed = e.kind === 'loop';
      if (sr === tr) {
        const dc = t.col - s.col;
        if (Math.abs(dc) === 1 && !dashed && Math.sign(dc) === sr.dir) {
          const a = take(s, dc > 0 ? 'right' : 'left'), b = take(t, dc > 0 ? 'left' : 'right');
          return { pts: [a, b], lab: { seg: 0, side: 'above' } };
        }
        if (dashed || Math.sign(dc) !== sr.dir) {
          const yb = chan('h', sr.belowY);
          const a = take(s, 'bottom', t.cx), b = take(t, 'bottom', s.cx);
          return { pts: [a, [a[0], yb], [b[0], yb], b], lab: { seg: 1, side: 'below' } };
        }
        const yh = chan('h', sr.headerY);
        const a = take(s, 'top', t.cx), b = take(t, 'top', s.cx);
        return { pts: [a, [a[0], yh], [b[0], yh], b], lab: { seg: 1, side: 'above' } };
      }
      const dg = tr.g - sr.g;
      // 带出口的判断在行尾：往下走的线从外侧绕，底部留给出口
      if (dg >= 1 && hasStub(s) && (dg === 1 || leftmost(t) === false)) {
        const side = sr.dir === 1 ? 'right' : 'left';
        const p = take(s, side);
        if (tr.lane === sr.lane && dg === 1 && t.col === s.col) {
          const q = take(t, side);
          const bx = side === 'right' ? Math.max(p[0], q[0]) + 16 : Math.min(p[0], q[0]) - 16;
          return { pts: [p, [bx, p[1]], [bx, q[1]], q], lab: { seg: 1, side: side === 'right' ? 'left' : 'right' } };
        }
        const bx = p[0] + (side === 'right' ? 16 : -16);
        const yc = chan('h', tr.aboveY);
        const b = take(t, 'top', bx);
        const lab = Math.abs(b[0] - bx) > 50 ? { seg: 2, side: 'above' } : { seg: 1, side: side === 'right' ? 'left' : 'right' };
        return { pts: [p, [bx, p[1]], [bx, yc], [b[0], yc], b], lab };
      }
      if (dg === 1 || (dg > 1 && s.col === t.col && !blockedBetween(s, t))) {
        if (s.col === t.col && !portUse[s.id + ':bottom'] && !portUse[t.id + ':top']) return { pts: [take(s, 'bottom'), take(t, 'top')], lab: { seg: 0, side: 'right' } };
        const yc = chan('h', tr.aboveY);
        const a = take(s, 'bottom', t.cx), b = take(t, 'top', s.cx);
        return { pts: [a, [a[0], yc], [b[0], yc], b], lab: { seg: 1, side: 'above' } };
      }
      if (dg === -1 || (dg < -1 && s.col === t.col && !blockedBetween(s, t))) {
        if (s.col === t.col && !portUse[s.id + ':top'] && !portUse[t.id + ':bottom']) return { pts: [take(s, 'top'), take(t, 'bottom')], lab: { seg: 0, side: 'right' } };
        const yc = chan('h', sr.aboveY);
        const a = take(s, 'top', t.cx), b = take(t, 'bottom', s.cx);
        return { pts: [a, [a[0], yc], [b[0], yc], b], lab: { seg: 1, side: 'above' } };
      }
      // 跨多行：走左侧边沟
      const mx = K.MARGIN_X - 13 * (marginCount++);
      const pts = [];
      if (leftmost(s)) pts.push(take(s, 'left'), [mx, s.cy]);
      else {
        const yc = chan('h', dg > 0 ? (nextRow(sr) || sr).aboveY : sr.aboveY);
        const a = take(s, dg > 0 ? 'bottom' : 'top', mx);
        pts.push(a, [a[0], yc], [mx, yc]);
      }
      if (leftmost(t)) pts.push([mx, t.cy], take(t, 'left'));
      else {
        const yc = chan('h', dg > 0 ? tr.aboveY : (nextRow(tr) ? nextRow(tr).aboveY : tr.belowY));
        const b = take(t, dg > 0 ? 'top' : 'bottom', mx);
        pts.push([mx, yc], [b[0], yc], b);
      }
      const vi = pts.findIndex((p, i) => i > 0 && p[0] === mx && pts[i - 1][0] === mx);
      return { pts, lab: { seg: vi - 1, side: 'vertical' } };
    }

    // 先排实线，回环后排，这样回环会让出已占用的出发点
    // 能直连的（同行相邻、上下同列）最先排，其余实线其次
    const rank = e => {
      const s = G.nodes[e.from], t = G.nodes[e.to];
      if (e.kind === 'loop') return 2;
      if (!s || !t) return 1;
      const straight = (s.row === t.row && Math.abs(s.col - t.col) === 1) || (s.col === t.col && Math.abs(s.row.g - t.row.g) === 1);
      return straight ? 0 : 1;
    };
    (spec.edges || []).map((e, i) => ({ e, i, r: rank(e) })).sort((a, b) => a.r - b.r || a.i - b.i).forEach(({ e, i }) => {
      const s = G.nodes[e.from], t = G.nodes[e.to];
      if (!s || !t) { G.warnings.push(`连线 ${e.from} → ${e.to} 找不到节点`); return; }
      const r = route(e, s, t);
      const edge = { id: 'e' + i, from: e.from, to: e.to, kind: e.kind || 'flow', label: e.label || '', pts: dedupe(r.pts) };
      edge.d = roundedPath(edge.pts, 10);
      edge.len = polyLen(edge.pts);
      if (edge.label) edge.lab = placeLabel(edge, r.lab, s);
      G.edges.push(edge);
    });

    /* 阅读关系独立走线，不占用流程的端口或通道 */
    G.reads = [];
    (spec.reads || []).forEach((r, i) => {
      const s = G.nodes[r.from], t = G.nodes[r.to];
      if (!s || !t) return;
      const down = t.cy >= s.cy;
      const right = s.col === 0 || s.col !== cols - 1 && t.cx > s.cx;
      const x = right ? s.x + s.w : s.x, y0 = s.type === 'decision' ? s.cy : s.y + s.h - 26;
      const yT = down ? t.row.aboveY : t.row.belowY;
      const base = x + (right ? K.GAP / 2 : -K.GAP / 2);
      // 只读取既有流程线，绝不占用流程端口、通道或外边距
      const clear = xg => G.edges.every(e => e.pts.every((p, j) => {
        const q = e.pts[j - 1];
        return !q || p[0] !== q[0] || Math.max(p[1], q[1]) < Math.min(y0, yT) || Math.min(p[1], q[1]) > Math.max(y0, yT) || Math.abs(p[0] - xg) >= 12;
      }));
      const xg = [0, 12, -12].map(dx => base + dx).find(clear);
      const pts = [[x, y0], [xg == null ? base : xg, y0], [xg == null ? base : xg, yT], [t.cx, yT], [t.cx, down ? t.y : t.y + t.h]];
      G.reads.push({ id: 'r' + i, from: r.from, to: r.to, pts, d: roundedPath(pts, 8), len: polyLen(pts) });
    });

    /* 出口（判断的另一支，指向文字说明） */
    Object.keys(stubFrom).forEach(id => {
      const d = G.nodes[id];
      if (!d) return;
      stubFrom[id].slice(0, 1).forEach((s, k) => {
        const bp = port(d, 'bottom');
        const near = p => Math.abs(p[0] - bp[0]) < 1 && Math.abs(p[1] - bp[1]) < 1;
        const bottomTaken = G.edges.some(e => (e.from === id && near(e.pts[0])) || (e.to === id && near(e.pts[e.pts.length - 1])));
        const text = fit(s.text, 172, 12.5, 400);
        const tw = measure(text, 12.5, 400) + 24;
        const off = bottomTaken ? -d.row.dir * Math.max(64, tw / 2 + 20) : 0;
        const startX = bottomTaken ? d.cx - d.row.dir * d.w / 4 : d.cx;
        const startY = bottomTaken ? d.cy + d.h / 4 : d.cy + d.h / 2;
        const px = d.cx + off, py = d.cy + d.h / 2 + 22;
        const pts = bottomTaken ? [[startX, startY], [startX, py - 8], [px, py - 8], [px, py]] : [[startX, startY], [px, py]];
        const st = { id: 'st_' + id + '_' + k, from: id, text, full: s.text, label: s.label || '', x: px - tw / 2, y: py, w: tw, h: 26, cx: px, pts: dedupe(pts) };
        st.d = roundedPath(st.pts, 6);
        st.len = polyLen(st.pts);
        if (st.label) st.lab = { x: startX + 7, y: (startY + py) / 2 + 4, text: st.label, anchor: 'start', bg: null };
        G.stubs.push(st);
      });
    });

    /* 注释文字别压在穿过的竖线上 */
    G.lanes.forEach(L => {
      if (!L.notes.length) return;
      const top = L.notes[0].y - 16, bottom = L.notes[L.notes.length - 1].y + 6;
      const xs = G.edges.flatMap(e => e.pts.slice(1).map((p, i) => [e.pts[i], p]))
        .filter(([a, b]) => Math.abs(a[0] - b[0]) < 0.5 && Math.min(a[1], b[1]) < bottom && Math.max(a[1], b[1]) > top)
        .map(([a]) => a[0]).filter(x => x > L.x + 260);
      if (!xs.length) return;
      const maxW = Math.min(...xs) - 18 - (L.notes[0].x + 30);
      L.notes.forEach((nt, i) => { nt.text = fit(L.notesRaw[i], maxW, 15.5, 400); });
    });

    G.H = Math.max(G.lanesBottom, ...G.stubs.map(s => s.y + s.h)) + 52;
    G.footerY = G.H - 22;
    G.footer = spec.footer || '';

    G.bgAt = (x, y) => {
      const L = G.lanes.find(l => l.kind !== 'bare' && x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
      return L ? 'lane:' + L.color + (L.kind === 'flow' ? '' : ':' + L.kind) : 'page';
    };
    G.edges.forEach(e => { if (e.lab) e.lab.bg = G.bgAt(e.lab.x, e.lab.y - 4); });
    return G;

    function placeLabel(edge, lab, s) {
      const pts = edge.pts;
      const text = edge.label;
      const tw = measure(text, 13, 400);
      if (lab.side === 'vertical' && lab.seg >= 0) {
        const a = pts[lab.seg], b = pts[lab.seg + 1];
        return { x: a[0], y: (a[1] + b[1]) / 2, text, anchor: 'middle', rotate: -90, w: tw };
      }
      let seg = Math.max(0, Math.min(lab.seg, pts.length - 2));
      let a = pts[seg], b = pts[seg + 1];
      if (lab.side === 'left') return { x: a[0] - 9, y: a[1] + (b[1] - a[1]) * 0.7 + 4, text, anchor: 'end', w: tw };
      if (lab.side === 'right' || Math.abs(a[0] - b[0]) < 1) {
        return { x: a[0] + 9, y: (a[1] + b[1]) / 2 + 4, text, anchor: 'start', w: tw };
      }
      let x = (a[0] + b[0]) / 2;
      if (s.type === 'decision' && seg === 0 && pts.length === 2) x = a[0] + Math.sign(b[0] - a[0]) * Math.min(Math.abs(b[0] - a[0]) / 2, tw / 2 + 14);
      const y = lab.side === 'below' ? a[1] + 18 : a[1] - 9;
      return { x, y, text, anchor: 'middle', w: tw };
    }
  }

  function dedupe(pts) {
    const out = [];
    for (const p of pts) {
      const q = out[out.length - 1];
      if (q && Math.abs(q[0] - p[0]) < 0.5 && Math.abs(q[1] - p[1]) < 0.5) continue;
      out.push(p);
    }
    // 去掉共线的中间点
    for (let i = out.length - 2; i >= 1; i--) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      if ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)) out.splice(i, 1);
    }
    return out;
  }

  function polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  function roundedPath(pts, r) {
    if (pts.length < 2) return '';
    const f = v => Math.round(v * 10) / 10;
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const a = [p1[0] - (p1[0] - p0[0]) / l1 * rr, p1[1] - (p1[1] - p0[1]) / l1 * rr];
      const b = [p1[0] + (p2[0] - p1[0]) / l2 * rr, p1[1] + (p2[1] - p1[1]) / l2 * rr];
      d += ` L${f(a[0])},${f(a[1])} Q${f(p1[0])},${f(p1[1])} ${f(b[0])},${f(b[1])}`;
    }
    const last = pts[pts.length - 1];
    d += ` L${f(last[0])},${f(last[1])}`;
    return d;
  }

  SV.layout = layout;
  SV.layoutUtil = { measure, fit, wrap, shortFile, K, FONT, MONO, roundedPath, polyLen, clearCache: () => cache.clear() };
};
SV.mod.layout(SV);
