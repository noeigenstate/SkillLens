/* 界面：列表、导入、播放、缩放、详情 / 结构面板、导出 */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = SV.md.esc;
  const params = new URLSearchParams(location.search);
  const RECORD = params.has('record');

  const store = {
    get(k, d) { try { const v = localStorage.getItem('sv.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sv.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  const t = (k, ...a) => SV.i18n.t(k, ...a);
  const iconSvg = (name, size) => `<svg viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SV.ICONS[name] || ''}</svg>`;
  const hydrate = root => (root || document).querySelectorAll('i[data-icon]').forEach(el => { el.outerHTML = iconSvg(el.dataset.icon, +el.dataset.size || 16); });

  const state = {
    skills: [], currentId: null, spec: null, autoSpec: null, G: null, player: null, svg: null,
    zoom: 'fit', cols: +(params.get('cols') || store.get('cols', 4)), theme: params.get('theme') || store.get('theme2', 'blueprint'),
    speed: 1, playing: true, selected: null, collapsed: store.get('collapsed', {}), overrides: store.get('overrides', {}),
    query: '', server: false, panel: store.get('panel', true),
    web: { q: '', items: null, busy: false, error: '' }, official: [], officialBusy: false,
    lang: params.get('lang') || store.get('lang', 'en'),
    translate: store.get('translate', true), rawSpec: null, trInfo: { any: false, missing: 0, busy: false, error: '' }, showOrig: false,
  };
  SV.i18n.set(state.lang);

  /* 把页面上带 data-t 的静态文字换成当前语言 */
  function applyLang() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    $$('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    $$('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
    $$('[data-t-title]').forEach(el => { el.title = t(el.dataset.tTitle); });
    $$('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
    $$('#selCols option').forEach(o => { o.textContent = t('cols.n', o.value); });
    $$('#selTheme option').forEach(o => { o.textContent = t('theme.' + o.value); });
    $('#btnLang').textContent = state.lang === 'zh' ? 'EN' : '中';
    setPlaying(state.playing);
  }
  function setLang(lang) {
    state.lang = SV.i18n.set(lang);
    store.set('lang', state.lang);
    applyLang();
    renderList();
    if (state.currentId) select(state.currentId, true); else renderHeader();
  }
  const groupName = s => s.groupKey ? t('group.' + s.groupKey, s.groupArg || '') : (s.group || t('group.other'));
  const whereName = w => w.key ? t('group.' + w.key, w.arg || '') : (w.label || t('group.other'));
  /* 量大的分组（官方库、插件市场、软件自带的）默认折叠 */
  const FOLDED_KINDS = ['catalog', 'official'];

  /* —— 小工具 —— */
  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
  }
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    }
  }
  const safeName = s => String(s || 'skill').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);

  function metaOf(text, fallback) {
    const fm = SV.md.parseFrontMatter(text);
    const name = String(fm.data.name || fallback || 'skill');
    const desc = SV.md.strip(Array.isArray(fm.data.description) ? fm.data.description.join(' ') : (fm.data.description || ''));
    return { name, description: desc };
  }

  /* —— 数据来源 —— */
  async function loadSources() {
    let data = null;
    if (/^https?:$/.test(location.protocol)) {
      try {
        const r = await fetch('api/skills', { cache: 'no-store' });
        if (r.ok) { data = await r.json(); state.server = true; }
      } catch { /* 静态托管，没有接口 */ }
    }
    if (!data && window.SV_DATA) data = window.SV_DATA;
    const scanned = data && data.skills ? data.skills.map(s => Object.assign({ source: 'scan' }, s)) : [];
    // 顺序：本仓库 → 导入的 → 从网上取回的 → 各 agent / 项目 / 官方库 / 市场
    const head = scanned.filter(s => s.kind === 'project' || !s.kind);
    const tail = scanned.filter(s => !(s.kind === 'project' || !s.kind));
    const imported = store.get('imported', []).map(s => Object.assign({}, s, { source: 'import', group: 'imported', groupKey: 'imported' }));
    const online = store.get('online', []).map(s => Object.assign({}, s, { source: 'online', groupKey: 'online', kind: 'online' }));
    state.skills = head.concat(imported, online, tail);
  }

  function saveImported() {
    const imp = state.skills.filter(s => s.source === 'import').map(s => ({ id: s.id, name: s.name, description: s.description, path: s.path, text: s.text }));
    if (!store.set('imported', imp)) toast(t('toast.tooBig'), 4000);
  }
  function saveOnline() {
    const list = state.skills.filter(s => s.source === 'online').map(s => ({ id: s.id, name: s.name, description: s.description, path: s.path, text: s.text, url: s.url, files: s.files }));
    if (!store.set('online', list)) toast(t('toast.tooBig'), 4000);
  }

  function addImported(items) {
    if (!items.length) { toast(t('toast.noFiles')); return; }
    let firstId = null;
    for (const it of items) {
      const dirName = it.path.split('/').slice(-2, -1)[0];
      const m = metaOf(it.text, /^skill\.md$/i.test(it.path.split('/').pop()) ? dirName : it.path.split('/').pop().replace(/\.md$/i, ''));
      const id = 'import:' + it.path;
      const s = { id, group: 'imported', groupKey: 'imported', source: 'import', path: it.path, text: it.text, name: m.name, description: m.description };
      const k = state.skills.findIndex(x => x.id === id);
      if (k >= 0) state.skills[k] = s; else state.skills.push(s);
      firstId = firstId || id;
    }
    saveImported();
    renderList();
    select(firstId);
    toast(t('toast.imported', items.length));
  }

  async function readFiles(files) {
    const arr = Array.from(files);
    const rel = f => (f.webkitRelativePath || f.relPath || f.name).replace(/\\/g, '/');
    let picked = arr.filter(f => /(^|\/)skill\.md$/i.test(rel(f)));
    if (!picked.length) picked = arr.filter(f => /\.(md|markdown|txt)$/i.test(f.name));
    const out = [];
    for (const f of picked.slice(0, 400)) out.push({ path: rel(f), text: await f.text() });
    return out;
  }

  /* 拖进来的文件夹：递归找 SKILL.md */
  async function readEntries(entries) {
    const files = [];
    async function walk(entry, prefix, depth) {
      if (depth > 8 || files.length > 2000) return;
      if (entry.isFile) {
        const f = await new Promise((res, rej) => entry.file(res, rej));
        f.relPath = prefix + entry.name;
        files.push(f);
      } else if (entry.isDirectory) {
        if (/^(node_modules|\.git|output|dist)$/.test(entry.name)) return;
        const reader = entry.createReader();
        let batch;
        do {
          batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          for (const e of batch) await walk(e, prefix + entry.name + '/', depth + 1);
        } while (batch.length);
      }
    }
    for (const e of entries) if (e) await walk(e, '', 0);
    return readFiles(files);
  }

  /* —— 列表 —— */
  function groupsOf(list) {
    const order = [];
    const map = {};
    for (const s of list) {
      const g = groupName(s);
      if (!map[g]) { map[g] = []; order.push(g); }
      map[g].push(s);
    }
    return order.map(g => ({ name: g, items: map[g] }));
  }

  /* 列表里的一行描述也跟随界面语言（服务模式下自动翻译并缓存） */
  let descAsked = false;
  function listDesc(s) {
    const d = s.description || s.path || '';
    if (!state.translate || !needsTr(d, state.lang)) return d;
    const hit = TR.cache[trKey(state.lang, d)];
    return hit != null ? hit : d;
  }
  /* 只翻译看得见的（展开的分组、搜索结果），上千条描述不会一次全送去翻译 */
  function askDescTranslations(items) {
    if (descAsked || !state.translate) return;
    const lang = state.lang;
    const miss = items.map(s => s.description).filter(d => d && needsTr(d, lang) && TR.cache[trKey(lang, d)] == null);
    if (!miss.length) return;
    descAsked = true;
    requestTr(miss.slice(0, 200), false, () => { if (state.lang === lang) { renderList(); renderDetail(); } }).finally(() => { descAsked = false; });
  }

  const isFolded = g => g.name in state.collapsed ? state.collapsed[g.name] : FOLDED_KINDS.includes(g.items[0].kind) || g.items[0].groupKey === 'agentBuiltin';

  function itemHtml(s) {
    const flow = /```\s*skillflow/.test(s.text || '');
    const edited = !!state.overrides[s.id];
    const also = s.alsoIn && s.alsoIn.length ? `<i class="badge also" title="${esc(t('list.alsoIn', s.alsoIn.map(whereName).join(t('list.sep'))))}">+${s.alsoIn.length}</i>` : '';
    const removable = s.source === 'import' || s.source === 'online';
    return `<button class="item${s.id === state.currentId ? ' active' : ''}" data-id="${esc(s.id)}" title="${esc(s.full || s.path || '')}">
      <div class="name"><span>${esc(s.name)}</span>${flow ? '<i class="badge flow">skillflow</i>' : ''}${edited ? `<i class="badge edit">${t('badge.edited')}</i>` : ''}${also}</div>
      <div class="desc">${esc(listDesc(s))}</div>
      ${removable ? `<span class="del" data-del="${esc(s.id)}" title="${t('list.remove')}">${iconSvg('x', 14)}</span>` : ''}
    </button>`;
  }

  function renderList() {
    const q = state.query.trim().toLowerCase();
    const list = state.skills.filter(s => !q || (s.name + ' ' + s.description + ' ' + (s.path || '')).toLowerCase().includes(q));
    const groups = groupsOf(list);
    askDescTranslations(groups.filter(g => q || !isFolded(g)).flatMap(g => g.items));
    const el = $('#list');
    let html;
    if (!state.skills.length) html = `<div class="list-empty">${t('list.none')}</div>`;
    else if (!list.length) html = `<div class="list-empty">${t('list.noMatch')}</div>`;
    else html = groups.map(g => {
      const folded = isFolded(g);
      // 折叠的大分组不生成条目，上千个 skill 也不卡
      return `<div class="group${folded && !q ? ' collapsed' : ''}" data-group="${esc(g.name)}" data-folded="${folded ? 1 : 0}">
        <button class="group-head">${iconSvg('chevron-down', 14)}<span>${esc(g.name)}</span><span class="count">${g.items.length}</span></button>
        <div class="items">${folded && !q ? '' : g.items.map(itemHtml).join('')}</div>
      </div>`;
    }).join('');
    el.innerHTML = html + onlineHtml(q);
  }

  /* —— 网上的 skill：搜索公开目录、下载官方库（要本地服务） —— */
  function onlineHtml(q) {
    if (!state.server) return '';
    const w = state.web;
    let out = '<div class="online">';
    if (q.length >= 2) {
      if (w.q === q && w.items) {
        out += `<div class="group web"><div class="group-head static">${iconSvg('globe', 14)}<span>${t('online.results')}</span><span class="count">${w.items.length}</span></div><div class="items">`;
        out += w.items.length ? w.items.map((it, i) => {
          const meta = [it.repo, it.installs ? t('online.installs', it.installs.toLocaleString()) : '', it.stars ? '★ ' + it.stars.toLocaleString() : ''].filter(Boolean).join(' · ');
          return `<button class="item" data-web="${i}" title="${esc(it.repo + (it.path ? '/' + it.path : ''))}">
            <div class="name"><span>${esc(it.name)}</span>${w.picking === i ? `<i class="badge">${t('online.fetching')}</i>` : ''}</div>
            <div class="desc">${esc(meta)}</div>${it.description ? `<div class="desc">${esc(it.description)}</div>` : ''}
          </button>`;
        }).join('') : `<div class="list-empty">${t('online.none')}</div>`;
        out += '</div></div>';
      } else {
        out += `<button class="online-btn" data-web-search ${w.busy ? 'disabled' : ''}>${iconSvg('globe', 15)}<span>${w.busy ? t('online.searching') : t('online.search', state.query.trim())}</span></button>`;
        if (w.error && w.q === q) out += `<div class="list-empty">${esc(t('online.failed', w.error))}</div>`;
      }
    }
    const libs = state.official || [];
    const n = libs.reduce((a, l) => a + l.count, 0);
    out += `<div class="official"><div><b>${t('official.title')}</b><span>${libs.length ? esc(t('official.status', n, (libs[0].fetchedAt || '').slice(0, 10))) : t('official.desc')}</span></div>
      <button class="btn" data-official ${state.officialBusy ? 'disabled' : ''}>${iconSvg(libs.length ? 'refresh-cw' : 'download', 14)}<span>${state.officialBusy ? t('official.downloading') : libs.length ? t('official.update') : t('official.download')}</span></button></div>`;
    return out + '</div>';
  }

  async function webSearch() {
    const q = state.query.trim();
    if (q.length < 2 || state.web.busy) return;
    state.web = { q: q.toLowerCase(), items: null, busy: true, error: '' };
    renderList();
    try {
      const r = await (await fetch('api/online/search?q=' + encodeURIComponent(q))).json();
      state.web = r.ok ? { q: q.toLowerCase(), items: r.items, busy: false } : { q: q.toLowerCase(), items: null, busy: false, error: r.error };
    } catch (e) { state.web = { q: q.toLowerCase(), items: null, busy: false, error: e.message }; }
    renderList();
  }

  async function pickWeb(i) {
    const it = state.web.items && state.web.items[i];
    if (!it || state.web.picking != null) return;
    state.web.picking = i;
    renderList();
    try {
      const qs = new URLSearchParams({ repo: it.repo, name: it.name });
      if (it.path) qs.set('path', it.path);
      const r = await (await fetch('api/online/skill?' + qs)).json();
      if (!r.ok) throw new Error(/^(notFound|badRepo|badPath)$/.test(r.error) ? t('online.' + r.error, it.name, it.repo) : r.error);
      const m = metaOf(r.text, it.name);
      const s = { id: 'online:' + r.path, source: 'online', groupKey: 'online', kind: 'online', name: m.name, description: m.description || it.description || '', path: r.path, url: r.url, text: r.text, files: r.files || [] };
      const k = state.skills.findIndex(x => x.id === s.id);
      if (k >= 0) state.skills[k] = s;
      else { const at = state.skills.findIndex(x => x.kind && x.kind !== 'project' && x.source === 'scan'); state.skills.splice(at < 0 ? state.skills.length : at, 0, s); }
      saveOnline();
      toast(t('online.added', s.name));
      select(s.id);
    } catch (e) { toast(t('online.failed', e.message), 4000); }
    state.web.picking = null;
    renderList();
  }

  async function loadOfficialStatus() {
    if (!state.server) return;
    try { state.official = (await (await fetch('api/online/official', { cache: 'no-store' })).json()).libs || []; } catch { state.official = []; }
  }

  async function downloadOfficial() {
    if (state.officialBusy) return;
    state.officialBusy = true;
    renderList();
    toast(t('official.downloading'), 60000);
    try {
      const r = await (await fetch('api/online/official', { method: 'POST' })).json();
      state.official = r.libs || [];
      const bad = (r.results || []).filter(x => !x.ok);
      toast(bad.length ? t('online.failed', bad.map(x => x.repo + ': ' + x.error).join('; ')) : t('official.done', state.official.reduce((a, l) => a + l.count, 0)), 5000);
      await loadSources();
    } catch (e) { toast(t('online.failed', e.message), 5000); }
    state.officialBusy = false;
    renderList();
  }

  /* —— 选择与绘制 —— */
  const findSkill = id => state.skills.find(s => s.id === id);

  function mergeDetails(spec, from) {
    const map = {};
    const all = sp => [sp.trigger].concat(...(sp.lanes || []).map(l => l.nodes)).filter(Boolean);
    all(from).forEach(n => { map[n.id] = n; });
    all(spec).forEach(n => { if (!n.detail && map[n.id]) n.detail = map[n.id].detail; });
    spec.frontMatter = from.frontMatter;
    spec.description = spec.description || from.description;
    spec.name = from.name || spec.name;
    if (spec.zh == null) spec.zh = from.zh;
    return spec;
  }

  function buildSpec(s) {
    const auto = SV.extract(s.text, { fallbackName: s.name });
    state.autoSpec = auto;
    state.specError = '';
    const ov = state.overrides[s.id];
    if (ov) {
      try {
        const sp = SV.dsl.parse(ov, { name: auto.name, description: auto.description });
        sp.source = 'edited';
        state.rawSpec = mergeDetails(sp, auto);
        useTranslation();
        return;
      } catch (e) { state.specError = t('detail.parseWarn', e.message); }
    }
    state.rawSpec = auto;
    useTranslation();
  }

  /* —— 翻译：图里的文字跟随界面语言（中文界面看英文 skill 时显示中文，反之亦然） —— */
  const TR = { cache: Object.assign({}, window.SV_TRANS || {}), backend: undefined, inflight: new Set() };
  const trKey = (lang, s) => lang + '\u0001' + s;
  function needsTr(s, lang) {
    if (typeof s !== 'string') return false;
    const x = s.trim();
    if (!x || /^(yes|no)$/i.test(x)) return false;
    if (lang === 'zh') {
      if (!/[A-Za-z]{2,}/.test(x) || SV.text.cjkRatio(x) > 0.3) return false;
      if (!/\s/.test(x) && /[./\\_:@<>{}=#\d]/.test(x)) return false; // 文件名、路径、命令
      return true;
    }
    return /[\u3400-\u9fff]/.test(x);
  }
  /* 逐个处理图上会显示的文字；fn 返回新文字或 undefined（不改） */
  function eachText(spec, fn) {
    const one = v => { const r = fn(v); return r === undefined ? v : r; };
    const field = (o, k) => { if (o && typeof o[k] === 'string') o[k] = one(o[k]); };
    const lines = n => { if (Array.isArray(n.lines)) n.lines = n.lines.map(one); else field(n, 'lines'); };
    field(spec, 'title'); field(spec, 'subtitle');
    if (spec.hero) { field(spec.hero, 'title'); field(spec.hero, 'sub'); }
    if (spec.trigger) { field(spec.trigger, 'title'); lines(spec.trigger); }
    for (const l of spec.lanes || []) {
      field(l, 'title');
      (l.nodes || []).forEach(n => { field(n, 'title'); lines(n); });
      if (l.notes) l.notes = l.notes.map(one);
    }
    (spec.edges || []).forEach(e => field(e, 'label'));
    (spec.stubs || []).forEach(x => { field(x, 'text'); field(x, 'label'); });
  }
  function useTranslation() {
    const raw = state.rawSpec;
    if (!raw) return;
    const lang = state.lang;
    const spec = JSON.parse(JSON.stringify(raw));
    const missing = new Set();
    let any = false;
    eachText(spec, s => {
      if (!needsTr(s, lang)) return undefined;
      any = true;
      if (!state.translate) return undefined;
      const hit = TR.cache[trKey(lang, s)];
      if (hit != null) return hit;
      missing.add(s);
      return undefined;
    });
    state.spec = spec;
    state.trInfo.any = any;
    state.trInfo.missing = missing.size;
    if (missing.size) requestTr([...missing], false, () => {
      if (state.rawSpec !== raw || state.lang !== lang) return;
      useTranslation();
      draw(true);
      renderHeader();
      renderDetail();
    });
    renderTrUi();
  }
  async function trBackend() {
    if (TR.backend !== undefined) return TR.backend;
    if (!state.server) return (TR.backend = null);
    try { TR.backend = (await (await fetch('api/translate', { cache: 'no-store' })).json()).backend || null; } catch { TR.backend = null; }
    return TR.backend;
  }
  async function requestTr(items, markdown, done) {
    const lang = state.lang;
    const todo = items.filter(s => !TR.inflight.has(trKey(lang, s)));
    if (!todo.length) return;
    if (!(await trBackend())) { renderTrUi(); return; }
    if (todo.length > 500) todo.length = 500;
    todo.forEach(s => TR.inflight.add(trKey(lang, s)));
    state.trInfo.busy = true;
    state.trInfo.error = '';
    renderTrUi();
    try {
      const r = await fetch('api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: lang, items: todo, markdown: !!markdown }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || r.statusText);
      for (const [k, v] of Object.entries(j.map || {})) TR.cache[trKey(lang, k)] = v;
      done && done();
    } catch (e) {
      state.trInfo.error = e.message;
      toast(t('tr.fail', e.message), 6000);
    } finally {
      todo.forEach(s => TR.inflight.delete(trKey(lang, s)));
      state.trInfo.busy = TR.inflight.size > 0;
      renderTrUi();
    }
  }
  function renderTrUi() {
    const btn = $('#btnTrans'), chip = $('#trStatus');
    if (!btn || !chip) return;
    const info = state.trInfo;
    btn.hidden = !info.any;
    btn.setAttribute('aria-pressed', String(state.translate));
    let text = '', tip = '';
    if (info.any && state.translate) {
      if (info.busy) text = t('tr.busy');
      else if (info.missing) { text = t('tr.partial'); tip = info.error || (TR.backend === null ? t('tr.noBackend') : ''); }
      else text = t('tr.done');
    }
    chip.textContent = text;
    chip.title = tip;
    chip.hidden = !text;
    chip.classList.toggle('busy', !!info.busy);
  }

  function select(id, keepSel) {
    const s = findSkill(id);
    if (!s) return;
    clearReads();
    state.currentId = id;
    if (!keepSel) { state.selected = null; state.showOrig = false; }
    if (!RECORD) {
      store.set('last', id);
      history.replaceState(null, '', '#skill=' + encodeURIComponent(id));
    }
    try { buildSpec(s); } catch (e) { console.error(e); toast(t('toast.parseFail', e.message), 5000); return; }
    draw();
    ensureFonts(state.spec);
    renderList();
    renderHeader();
    renderDetail();
    renderStruct();
    $('#source').textContent = s.text;
    $('#empty').hidden = true;
  }

  /* —— 字体：网页字体加载完以后重新排版，否则量出来的文字宽度不准 —— */
  let fontEpoch = 0;
  let fontTimer = 0;
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => {
      fontEpoch++;
      clearTimeout(fontTimer);
      fontTimer = setTimeout(() => {
        if (!state.spec || state.frozen || state.drawnEpoch === fontEpoch) return;
        SV.layoutUtil.clearCache();
        draw(true);
      }, 120);
    });
  }
  const specChars = spec => JSON.stringify(spec, (k, v) => (k === 'detail' || k === 'frontMatter' ? undefined : v)).slice(0, 20000);
  function ensureFonts(spec, timeout) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const text = specChars(spec) + ' 0123456789 是否';
    const jobs = ['400 14px', '500 14px', '700 18px', '800 36px', 'italic 800 36px'].flatMap(w => [document.fonts.load(`${w} "Noto Sans SC"`, text), document.fonts.load(`${w} Inter`, text)])
      .concat([document.fonts.load('500 11px "JetBrains Mono"', text), document.fonts.load('400 13px "JetBrains Mono"', text)]);
    return Promise.race([Promise.all(jobs).catch(() => {}), new Promise(r => setTimeout(r, timeout || 2500))]);
  }

  function draw(keepTime) {
    state.drawnEpoch = fontEpoch;
    const t0 = keepTime && state.player ? state.player.time : 0;
    if (state.player) state.player.destroy();
    const G = SV.layout(state.spec, { cols: state.cols });
    state.G = G;
    const canvas = $('#canvas');
    canvas.innerHTML = SV.render.toSVG(G, { theme: state.theme });
    state.svg = canvas.querySelector('svg');
    state.player = SV.render.createPlayer(state.svg, G, { loop: !RECORD });
    state.player.setSpeed(state.speed);
    if (!state.playing || RECORD) state.player.pause();
    if (t0) state.player.seek(t0);
    if (!RECORD && readPin) state.player.setPin(readPin);
    if (state.selected) markSelected(state.selected);
    applyZoom();
  }

  function renderHeader() {
    const s = findSkill(state.currentId);
    const spec = state.spec;
    $('#current').innerHTML = s && spec ? `<b>${esc(spec.title || s.name)}</b><span>${esc(s.path || s.name)}</span>` : `<b>${t('current.none')}</b>`;
    document.title = s ? `${s.name} · ${t('app.title')}` : t('app.title');
  }

  /* —— 缩放与平移 —— */
  /* 「适应」= 宽和高都放进画布，整张图一屏看完，不用上下滚；减 1px 防止取整后冒出滚动条 */
  function fitZoom() {
    const stage = $('#stage');
    const present = document.body.classList.contains('present');
    const pad = (present ? 0 : 56) + 1;
    const z = Math.min((stage.clientWidth - pad) / state.G.W, (stage.clientHeight - pad) / state.G.H);
    return Math.max(0.2, Math.min(present ? 2.5 : 1.35, z));
  }
  function currentZoom() { return state.zoom === 'fit' ? fitZoom() : state.zoom; }
  function applyZoom() {
    if (!state.svg || !state.G) return;
    const z = RECORD ? 1 : currentZoom();
    state.svg.style.width = state.G.W * z + 'px';
    state.svg.style.height = state.G.H * z + 'px';
    $('#btnZoomFit').textContent = Math.round(z * 100) + '%';
  }
  function zoomBy(f, cx, cy) {
    const stage = $('#stage');
    const z0 = currentZoom();
    const z1 = Math.max(0.2, Math.min(3, z0 * f));
    const rect = stage.getBoundingClientRect();
    const px = (cx == null ? rect.width / 2 : cx - rect.left) + stage.scrollLeft;
    const py = (cy == null ? rect.height / 2 : cy - rect.top) + stage.scrollTop;
    state.zoom = z1;
    applyZoom();
    stage.scrollLeft = px * z1 / z0 - (px - stage.scrollLeft);
    stage.scrollTop = py * z1 / z0 - (py - stage.scrollTop);
  }

  /* —— 播放控制 —— */
  function setPlaying(v) {
    if (v) clearReads();
    state.playing = v;
    if (state.player) v ? state.player.play() : state.player.pause();
    $('#btnPlay').innerHTML = v ? `${iconSvg('pause')}<span>${t('btn.pause')}</span>` : `${iconSvg('play')}<span>${t('btn.play')}</span>`;
  }

  /* —— 节点选择 —— */
  let readPin = null, readTimer = 0;
  function clearReads() {
    clearTimeout(readTimer);
    readPin = null;
    if (!RECORD && state.player) state.player.setPin(null);
  }
  function nodeSpec(id) {
    const sp = state.spec;
    if (!sp) return null;
    if (sp.trigger && sp.trigger.id === id) return { n: sp.trigger, lane: null };
    for (const l of sp.lanes) { const n = l.nodes.find(x => x.id === id); if (n) return { n, lane: l }; }
    return null;
  }
  function markSelected(id) {
    if (!state.svg) return;
    state.svg.querySelectorAll('.sv-node.selected').forEach(el => el.classList.remove('selected'));
    if (id) { const el = state.svg.querySelector(`.sv-node[data-node="${CSS.escape(id)}"]`); if (el) el.classList.add('selected'); }
  }
  function selectNode(id) {
    clearReads();
    state.selected = id;
    markSelected(id);
    if (!RECORD && state.player) {
      const n = state.G.nodes[id], reads = state.G.reads || [];
      if (reads.length && n && n.laneKind === 'ref') readPin = { ref: id };
      else if (reads.length && n && ['flow', 'bare'].includes(n.laneKind)) readPin = { step: id };
      if (readPin) setPlaying(false);
      state.player.setPin(readPin);
    }
    if (id && state.player) state.player.jumpTo(id);
    showTab('detail');
    if (!state.panel) togglePanel(true);
    renderDetail();
  }

  function renderDetail() {
    const el = $('#detail');
    const s = findSkill(state.currentId);
    const sp = state.spec;
    if (!s || !sp) { el.innerHTML = `<p class="hint">${t('detail.pick')}</p>`; return; }
    const hit = state.selected && nodeSpec(state.selected);
    if (hit) {
      const { n, lane } = hit;
      const ins = sp.edges.filter(e => e.to === n.id), outs = sp.edges.filter(e => e.from === n.id);
      const stubs = (sp.stubs || []).filter(x => x.from === n.id);
      const isRef = lane && lane.kind === 'ref';
      const reads = (sp.reads || []).filter(r => isRef ? r.to === n.id : lane && (lane.kind === 'flow' || lane.kind === 'bare') && r.from === n.id);
      const title = id => { const h = nodeSpec(id); return h ? h.n.title : id; };
      const link = (id, label, dir) => `<button data-goto="${esc(id)}">${iconSvg(dir === 'in' ? 'chevron-left' : 'chevron-right', 14)}${esc(title(id))}<small>${esc(label || '')}</small></button>`;
      const nodeNo = {};
      let no = 0;
      sp.lanes.forEach(l => l.nodes.forEach(n => { nodeNo[n.id] = ++no; }));
      const readColor = (SV.render.THEMES[state.theme] || SV.render.THEMES.dark).reads;
      const readGlyph = '<svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true"><path d="M1 5H13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="0.1 4" stroke-linecap="round"/></svg>';
      const readLink = r => {
        const id = isRef ? r.from : r.to, edge = (state.G.reads || []).find(e => e.from === r.from && e.to === r.to);
        const target = nodeSpec(id), more = !isRef && target && target.n.more;
        const folded = more ? (Array.isArray(target.n.lines) ? target.n.lines.join(' · ') : target.n.lines || '') : '';
        return `<button data-goto="${esc(id)}" data-read-row="${edge ? edge.id : ''}"><span class="read-dot" aria-hidden="true"></span><span class="read-copy">${esc(title(id))}${folded ? `<span class="read-files">${esc(folded)}</span>` : ''}</span>${isRef ? `<small class="read-no">${String(nodeNo[id]).padStart(2, '0')}</small>` : ''}</button>`;
      };
      const lines = Array.isArray(n.lines) ? n.lines.join('\n') : (n.lines || '');
      el.innerHTML = `
        <button class="btn ghost" data-goto="" style="margin:-6px 0 8px -8px">${iconSvg('chevron-left', 14)}${t('detail.back')}</button>
        <h3>${esc(n.title)}</h3>
        <div class="meta"><span class="badge">${t('type.' + (n.type || 'step'))}</span>${n.optional ? `<span class="badge">${t('detail.optional')}</span>` : ''}${n.tag ? `<span>${esc(n.tag)}</span>` : ''}${lane ? `<span>· ${esc(lane.title)}</span>` : ''}</div>
        ${isRef && n.path ? `<dl class="kv"><dt>${t('detail.path')}</dt><dd>${esc(n.path)}</dd></dl>` : ''}
        ${lines ? `<div class="md"><p>${esc(lines).replace(/\n/g, '<br>')}</p></div>` : ''}
        ${ins.length ? `<div class="section-title">${t('detail.from')}</div><div class="links">${ins.map(e => link(e.from, (e.kind === 'loop' ? t('detail.loop') + ' ' : '') + (e.label || ''), 'in')).join('')}</div>` : ''}
        ${outs.length || stubs.length ? `<div class="section-title">${t('detail.to')}</div><div class="links">${outs.map(e => link(e.to, (e.kind === 'loop' ? t('detail.loop') + ' ' : '') + (e.label || ''), 'out')).join('')}${stubs.map(x => `<button disabled>${iconSvg('chevron-right', 14)}${esc(x.text)}<small>${esc(x.label || t('detail.exit'))}</small></button>`).join('')}</div>` : ''}
        ${reads.length ? `<div class="section-title read-title" style="--read-color:${readColor}">${readGlyph}${t(isRef ? 'detail.usedBy' : 'detail.reads')}</div><div class="links read-links" style="--read-color:${readColor}">${reads.map(readLink).join('')}</div>` : ''}
        ${n.detail ? `<div class="section-title">${t('detail.original')}${trToggle(n.detail)}</div><div class="md">${detailHtml(n.detail)}</div>` : ''}`;
      return;
    }
    const fm = sp.frontMatter || {};
    const extra = Object.keys(fm).filter(k => k !== 'name' && k !== 'description');
    const srcName = t('src.' + (sp.source || 'auto'));
    const warnings = (sp.warnings || []).concat(state.G ? state.G.warnings : []).concat(state.specError ? [state.specError] : []);
    el.innerHTML = `
      <h3>${esc(sp.title || s.name)}</h3>
      <div class="meta"><span class="badge ${sp.source === 'auto' ? '' : 'flow'}">${srcName}</span><span>${esc(groupName(s))}</span></div>
      <div class="md"><p>${esc(listDesc(s) || sp.description || t('detail.noDesc'))}</p></div>
      <div class="stats">
        <div class="stat"><b>${sp.lanes.length}</b><span>${t('detail.lanes')}</span></div>
        <div class="stat"><b>${sp.lanes.filter(l => l.kind === 'flow' || l.kind === 'bare').reduce((a, l) => a + l.nodes.length, 0)}</b><span>${t('detail.steps')}</span></div>
        <div class="stat"><b>${sp.edges.length + (sp.stubs || []).length}</b><span>${t('detail.edges')}</span></div>
      </div>
      ${warnings.length ? `<div class="section-title">${t('detail.notes')}</div>${warnings.map(w => `<div class="warn">${esc(w)}</div>`).join('')}` : ''}
      <div class="section-title">${t('detail.file')}</div>
      <dl class="kv"><dt>${t('detail.name')}</dt><dd>${esc(s.name)}</dd><dt>${t('detail.path')}</dt><dd>${esc(s.full || s.path || t('detail.pasted'))}</dd>${s.url ? `<dt>${t('detail.source')}</dt><dd><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\/github\.com\//, ''))}</a></dd>` : ''}${s.alsoIn && s.alsoIn.length ? `<dt>${t('detail.alsoIn')}</dt><dd>${esc(s.alsoIn.map(whereName).join(t('list.sep')))}</dd>` : ''}${extra.map(k => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(fm[k]) ? fm[k].join(', ') : fm[k])}</dd>`).join('')}</dl>
      ${s.files && s.files.length ? `<div class="section-title">${t('detail.files', s.files.length)}</div><div class="files">${s.files.slice(0, 40).map(f => esc(f)).join('<br>')}${s.files.length > 40 ? '<br>…' : ''}</div>` : ''}
      <div class="section-title">${t('detail.howto')}</div>
      <div class="hint">${t('detail.howtoText')}</div>`;
  }

  /* 详情原文：开着翻译时显示译文，没有就去要 */
  function detailNeedsTr(md) { return state.translate && needsTr(SV.md.strip(md).slice(0, 400), state.lang); }
  function trToggle(md) {
    if (!detailNeedsTr(md)) return '';
    return ` <button class="link-btn" data-orig="1">${state.showOrig ? t('tr.showTr') : t('tr.showOrig')}</button>`;
  }
  function detailHtml(md) {
    // 只给行内代码路径加断点，代码块保留原文
    const html = text => SV.md.toHtml(text).replace(/<pre\b[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>/g, part => part.startsWith('<pre') ? part : part.replace(/>([^<]*)<\/code>/, (_, code) => '>' + code.replace(/\//g, '/<wbr>') + '</code>'));
    if (!detailNeedsTr(md) || state.showOrig) return html(md);
    const hit = TR.cache[trKey(state.lang, md)];
    if (hit != null) return html(hit);
    const sel = state.selected;
    requestTr([md], true, () => { if (state.selected === sel) renderDetail(); });
    return `<p class="hint">${t('tr.translating')}</p>` + html(md);
  }

  function renderStruct() {
    const s = findSkill(state.currentId);
    if (!s || !state.rawSpec) return;
    $('#editor').value = state.overrides[s.id] || SV.dsl.serialize(state.rawSpec);
    $('#editorWarn').textContent = '';
  }

  function showTab(name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.tab-body').forEach(b => { b.hidden = b.dataset.body !== name; });
  }
  function togglePanel(v) {
    state.panel = v == null ? !state.panel : v;
    $('#panel').hidden = !state.panel;
    $('#btnPanel').setAttribute('aria-pressed', String(state.panel));
    store.set('panel', state.panel);
    requestAnimationFrame(applyZoom);
  }

  /* —— 导出 —— */
  function svgString() {
    const clone = state.svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  async function exportPng() {
    const G = state.G, scale = 2;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString()], { type: 'image/svg+xml' }));
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = G.W * scale; c.height = G.H * scale;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => download(safeName(state.spec.name) + '.png', b), 'image/png');
  }
  function cleanSpec(spec) {
    return JSON.parse(JSON.stringify(spec, (k, v) => (k === 'detail' || k === 'frontMatter' ? undefined : v)));
  }
  function standaloneHtml() {
    const spec = cleanSpec(state.spec);
    const P = SV.render.THEMES[state.theme] || SV.render.THEMES.dark;
    const mods = ['i18n', 'markdown', 'extract', 'layout', 'render'].map(k => `SV.mod.${k} = ${SV.mod[k].toString()};\nSV.mod.${k}(SV);`).join('\n').replace(/<\/script/gi, '<\\/script');
    const json = JSON.stringify(spec).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title || spec.name)} · ${t('app.title')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,800&amp;family=JetBrains+Mono:wght@400;500&amp;family=Noto+Sans+SC:wght@400;500;700;800&amp;display=swap">
<style>
html,body{margin:0;background:${P.page}}
body{min-height:100vh;display:flex;align-items:center;justify-content:center}
#stage svg{display:block;width:min(100vw, ${state.G.W}px, calc(100vh * ${(state.G.W / state.G.H).toFixed(4)}));height:auto}
</style>
</head>
<body>
<div id="stage"></div>
<script>
window.SV = { mod: {} };
SV.ICONS = ${JSON.stringify(SV.ICONS)};
${mods}
SV.i18n.set('${state.lang}');
</script>
<script>
(async function () {
  var spec = ${json};
  if (document.fonts && document.fonts.load) {
    var text = JSON.stringify(spec) + ' 0123456789 是否';
    var jobs = [];
    ['400 14px', '500 14px', '700 18px', '800 36px', 'italic 800 36px'].forEach(function (w) { jobs.push(document.fonts.load(w + ' "Noto Sans SC"', text), document.fonts.load(w + ' Inter', text)); });
    jobs.push(document.fonts.load('500 11px "JetBrains Mono"', text));
    await Promise.race([Promise.all(jobs).catch(function () {}), new Promise(function (r) { setTimeout(r, 6000); })]);
  }
  var G = SV.layout(spec, { cols: ${state.cols} });
  var stage = document.getElementById('stage');
  stage.innerHTML = SV.render.toSVG(G, { theme: '${state.theme}' });
  var p = SV.render.createPlayer(stage.querySelector('svg'), G, { loop: !/[?&]record/.test(location.search) });
  stage.addEventListener('click', function () { p.toggle(); });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { p.toggle(); e.preventDefault(); }
    if (e.key === 'ArrowRight') p.next();
    if (e.key === 'ArrowLeft') p.prev();
  });
  var round0 = p.tour ? p.tour.segs.filter(function (s) { return s.round === 0; }).pop() : null;
  window.SVRec = { info: function () { return { W: G.W, H: G.H, duration: p.duration, round0: round0 ? round0.t1 : p.duration }; }, seek: function (t) { p.pause(); p.seek(t); } };
  window.seek = window.SVRec.seek;
})();
</script>
</body>
</html>`;
  }

  async function exportVideo() {
    if (!state.server) {
      const s = findSkill(state.currentId);
      toast(t('toast.videoNeedServer', s ? s.name : 'skill'), 6500);
      return;
    }
    const secs = prompt(t('toast.videoAsk'), '');
    if (secs === null) return;
    toast(t('toast.recording'), 600000);
    try {
      const r = await fetch('api/record', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: safeName(state.spec.name), html: standaloneHtml(), seconds: secs ? +secs : null }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || r.statusText);
      toast(t('toast.videoDone', j.file), 8000);
      window.open(j.url, '_blank');
    } catch (e) { toast(t('toast.videoFail', e.message), 8000); }
  }

  async function doExport(kind) {
    if (!state.svg) return;
    const base = safeName(state.spec.name);
    if (kind === 'svg') download(base + '.svg', svgString(), 'image/svg+xml');
    else if (kind === 'png') await exportPng();
    else if (kind === 'html') download(base + '.html', standaloneHtml(), 'text/html;charset=utf-8');
    else if (kind === 'video') await exportVideo();
    else if (kind === 'spec') download(base + '.skillflow.json', JSON.stringify(cleanSpec(state.spec), null, 2), 'application/json');
    else if (kind === 'flow') { await copy('```skillflow\n' + $('#editor').value + '\n```'); toast(t('toast.copied')); }
  }

  /* —— 演示模式 —— */
  function setPresent(v) {
    document.body.classList.toggle('present', v);
    state.zoom = 'fit';
    requestAnimationFrame(applyZoom);
  }

  /* —— 事件 —— */
  function bind() {
    $('#list').addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        const id = del.dataset.del;
        const gone = findSkill(id);
        state.skills = state.skills.filter(s => s.id !== id);
        if (gone && gone.source === 'online') saveOnline(); else saveImported();
        if (state.currentId === id) { state.currentId = null; if (state.skills[0]) select(state.skills[0].id); else showEmpty(); }
        renderList();
        return;
      }
      if (e.target.closest('[data-web-search]')) { webSearch(); return; }
      if (e.target.closest('[data-official]')) { downloadOfficial(); return; }
      const web = e.target.closest('[data-web]');
      if (web) { pickWeb(+web.dataset.web); return; }
      const head = e.target.closest('.group-head:not(.static)');
      if (head) {
        const box = head.parentElement;
        state.collapsed[box.dataset.group] = box.dataset.folded !== '1';
        store.set('collapsed', state.collapsed);
        renderList();
        return;
      }
      const item = e.target.closest('.item');
      if (item) select(item.dataset.id);
    });
    $('#search').addEventListener('input', e => { state.query = e.target.value; renderList(); });
    // 回车：本机没搜到时直接去网上搜
    $('#search').addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !state.server) return;
      const q = state.query.trim().toLowerCase();
      if (q.length >= 2 && !(state.web.q === q && state.web.items)) webSearch();
    });

    $('#btnPlay').onclick = () => setPlaying(!state.playing);
    $('#btnNext').onclick = () => { setPlaying(false); state.player && state.player.next(); };
    $('#btnPrev').onclick = () => { setPlaying(false); state.player && state.player.prev(); };
    $('#selSpeed').onchange = e => { state.speed = +e.target.value; state.player && state.player.setSpeed(state.speed); };
    $('#btnZoomIn').onclick = () => zoomBy(1.15);
    $('#btnZoomOut').onclick = () => zoomBy(1 / 1.15);
    $('#btnZoomFit').onclick = () => { state.zoom = 'fit'; applyZoom(); };
    $('#selCols').value = String(state.cols);
    $('#selCols').onchange = e => { state.cols = +e.target.value; store.set('cols', state.cols); if (state.spec) draw(); };
    $('#selTheme').value = state.theme;
    $('#selTheme').onchange = e => {
      state.theme = e.target.value;
      store.set('theme2', state.theme);
      document.documentElement.dataset.ui = state.theme;
      if (state.spec) draw(true);
    };
    $('#btnPresent').onclick = () => setPresent(true);
    $('#btnLang').onclick = () => setLang(state.lang === 'zh' ? 'en' : 'zh');
    $('#btnTrans').onclick = () => {
      state.translate = !state.translate;
      store.set('translate', state.translate);
      useTranslation();
      draw(true);
      renderHeader();
      renderDetail();
    };
    $('#btnExitPresent').onclick = () => setPresent(false);
    $('#btnPanel').onclick = () => togglePanel();

    const menu = $('#exportMenu');
    $('#btnExport').onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    menu.querySelectorAll('[data-export]').forEach(b => { b.onclick = () => { menu.classList.remove('open'); doExport(b.dataset.export); }; });

    $$('.tab').forEach(t => { t.onclick = () => showTab(t.dataset.tab); });
    $('#detail').addEventListener('click', e => {
      if (e.target.closest('[data-orig]')) { state.showOrig = !state.showOrig; renderDetail(); return; }
      const g = e.target.closest('[data-goto]');
      if (!g) return;
      if (g.dataset.goto) selectNode(g.dataset.goto); else { clearReads(); state.selected = null; markSelected(null); renderDetail(); }
    });
    $('#detail').addEventListener('mouseover', e => {
      const row = e.target.closest('[data-read-row]');
      if (!RECORD && row && !row.contains(e.relatedTarget) && state.player) state.player.setHover(row.dataset.readRow, 1);
    });
    $('#detail').addEventListener('mouseout', e => {
      const row = e.target.closest('[data-read-row]');
      if (!RECORD && row && !row.contains(e.relatedTarget) && state.player) state.player.setHover(null);
    });

    $('#btnApply').onclick = () => {
      const s = findSkill(state.currentId);
      if (!s) return;
      const text = $('#editor').value;
      try {
        const sp = SV.dsl.parse(text, { name: state.autoSpec.name, description: state.autoSpec.description });
        state.overrides[s.id] = text;
        store.set('overrides', state.overrides);
        sp.source = 'edited';
        state.rawSpec = mergeDetails(sp, state.autoSpec);
        useTranslation();
        draw();
        renderDetail();
        renderList();
        $('#editorWarn').textContent = (sp.warnings || []).join('；');
        toast(t('toast.applied'));
      } catch (e) { $('#editorWarn').textContent = t('toast.parseFail', e.message); }
    };
    $('#btnReset').onclick = () => {
      const s = findSkill(state.currentId);
      if (!s) return;
      delete state.overrides[s.id];
      store.set('overrides', state.overrides);
      select(s.id, true);
      toast(t('toast.reset'));
    };
    $('#btnCopyFlow').onclick = () => doExport('flow');

    // 导入
    const openDir = () => $('#inDir').click();
    const openPaste = () => { $('#pasteModal').hidden = false; $('#pasteText').focus(); };
    $('#btnOpenDir').onclick = openDir;
    $('#btnOpenFile').onclick = () => $('#inFile').click();
    $('#btnPaste').onclick = openPaste;
    $$('[data-act="openDir"]').forEach(b => { b.onclick = openDir; });
    $$('[data-act="paste"]').forEach(b => { b.onclick = openPaste; });
    $('#inDir').onchange = async e => { addImported(await readFiles(e.target.files)); e.target.value = ''; };
    $('#inFile').onchange = async e => { addImported(await readFiles(e.target.files)); e.target.value = ''; };
    $('#pasteModal').addEventListener('click', e => { if (e.target.id === 'pasteModal' || e.target.closest('[data-close]')) $('#pasteModal').hidden = true; });
    $('#btnPasteOk').onclick = () => {
      const text = $('#pasteText').value.trim();
      if (!text) return;
      const m = metaOf(text, 'pasted-skill');
      addImported([{ path: 'paste/' + safeName(m.name) + '/SKILL.md', text }]);
      $('#pasteModal').hidden = true;
      $('#pasteText').value = '';
    };

    // 拖放
    let dragDepth = 0;
    window.addEventListener('dragenter', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { dragDepth++; document.body.classList.add('dragging'); e.preventDefault(); } });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
    window.addEventListener('drop', async e => {
      e.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('dragging');
      const items = Array.from(e.dataTransfer.items || []);
      const entries = items.map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
      addImported(entries.length ? await readEntries(entries) : await readFiles(e.dataTransfer.files));
    });

    // 画布：点击节点、拖动平移、Ctrl+滚轮缩放
    const stage = $('#stage');
    let pan = null;
    stage.addEventListener('mousedown', e => {
      if (e.button !== 0 || document.body.classList.contains('present')) return;
      pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, moved: false };
    });
    window.addEventListener('mousemove', e => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) > 4) { pan.moved = true; stage.classList.add('panning'); }
      if (pan.moved) { stage.scrollLeft = pan.sl - dx; stage.scrollTop = pan.st - dy; }
    });
    window.addEventListener('mouseup', e => {
      if (!pan) return;
      const moved = pan.moved;
      pan = null;
      stage.classList.remove('panning');
      if (moved) return;
      const node = e.target.closest && e.target.closest('.sv-node');
      if (node) selectNode(node.dataset.node);
      else {
        clearReads();
        if (e.target.closest && e.target.closest('svg')) { state.selected = null; markSelected(null); renderDetail(); }
      }
    });
    stage.addEventListener('mouseover', e => {
      const node = e.target.closest('.sv-node');
      if (RECORD || !node || node.contains(e.relatedTarget) || state.playing || readPin) return;
      const n = state.G.nodes[node.dataset.node], read = (state.G.reads || []).find(r => r.from === n.id);
      if (!read || !['flow', 'bare'].includes(n.laneKind)) return;
      clearTimeout(readTimer);
      readTimer = setTimeout(() => { if (!state.playing && !readPin && state.player) state.player.setPreview(n.id); }, 120);
    });
    stage.addEventListener('mouseout', e => {
      const node = e.target.closest('.sv-node');
      if (RECORD || !node || node.contains(e.relatedTarget)) return;
      clearTimeout(readTimer);
      if (!readPin && state.player) state.player.setPreview(null);
    });
    stage.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener('resize', () => { if (state.zoom === 'fit') applyZoom(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') clearReads();
      if (e.target.closest('input, textarea, select')) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
      else if (e.key === 'ArrowRight') { setPlaying(false); state.player && state.player.next(); }
      else if (e.key === 'ArrowLeft') { setPlaying(false); state.player && state.player.prev(); }
      else if (e.key === '+' || e.key === '=') zoomBy(1.15);
      else if (e.key === '-') zoomBy(1 / 1.15);
      else if (e.key === '0') { state.zoom = 'fit'; applyZoom(); }
      else if (e.key === 'f' || e.key === 'F') setPresent(!document.body.classList.contains('present'));
      else if (e.key === 'Escape') { setPresent(false); $('#pasteModal').hidden = true; }
    });
  }

  function showEmpty() {
    clearReads();
    $('#empty').hidden = false;
    $('#canvas').innerHTML = '';
    $('#detail').innerHTML = '';
    renderHeader();
  }

  /* —— 本地服务模式：SKILL.md 改了自动刷新 —— */
  function watch() {
    if (!state.server || RECORD) return;
    let ver = null;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const v = await (await fetch('api/version', { cache: 'no-store' })).text();
          if (ver && v !== ver) await refresh();
          ver = v;
        } catch { /* 服务已停 */ }
      }
      setTimeout(tick, 2000);
    };
    tick();
  }
  async function refresh() {
    const cur = findSkill(state.currentId);
    const oldText = cur && cur.text;
    await loadSources();
    renderList();
    const now = findSkill(state.currentId);
    if (now && now.text !== oldText) { select(now.id, true); toast(t('toast.updated', now.name)); }
  }

  /* —— 启动 —— */
  async function boot() {
    hydrate();
    applyLang();
    document.documentElement.dataset.ui = state.theme;
    togglePanel(state.panel && !RECORD);
    bind();
    await loadSources();
    await loadOfficialStatus();
    renderList();
    const want = params.get('skill') || decodeURIComponent((location.hash.match(/skill=([^&]+)/) || [])[1] || '') || store.get('last', '');
    const pick = state.skills.find(s => s.id === want) || state.skills.find(s => s.name === want) || state.skills.find(s => s.id.endsWith(want) && want) || state.skills[0];
    if (params.has('present') || RECORD) setPresent(true);
    if (RECORD) document.body.classList.add('recording');
    if (pick) select(pick.id); else showEmpty();
    watch();
    // 给自动化脚本用（录制、测试）
    window.SVApp = { state, select, exportHtml: standaloneHtml, setLang };
    if (RECORD && state.spec) {
      await ensureFonts(state.spec, 8000);
      await new Promise(r => setTimeout(r, 300));
      SV.layoutUtil.clearCache();
      draw();
      state.frozen = true; // 开始录制后不再因字体加载而重排，保证每一帧画面一致
      const round0 = () => { const p = state.player; const r = p && p.tour ? p.tour.segs.filter(s => s.round === 0).pop() : null; return r ? r.t1 : p.duration; };
      window.SVRec = {
        info: () => ({ W: state.G.W, H: state.G.H, duration: state.player.duration, round0: round0(), name: state.spec.name }),
        seek: t => { state.player.pause(); state.player.seek(t); },
      };
    }
  }
  boot();
})();
