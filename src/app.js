/* 界面：列表、导入、播放、缩放、详情 / 结构面板、导出 */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = SV.md.esc;
  const params = new URLSearchParams(location.search);
  const RECORD = params.has('record');
  const motionSetting = value => ['3d', 'flat', 'minimal'].includes(value) ? value : '3d';

  const store = {
    get(k, d) { try { const v = localStorage.getItem('sv.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sv.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  const t = (k, ...a) => SV.i18n.t(k, ...a);
  const iconSvg = (name, size) => `<svg viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SV.ICONS[name] || ''}</svg>`;
  const hydrate = root => (root || document).querySelectorAll('i[data-icon]').forEach(el => { el.outerHTML = iconSvg(el.dataset.icon, +el.dataset.size || 16); });

  const state = {
    skills: [], currentId: null, spec: null, autoSpec: null, G: null, player: null, svg: null,
    zoom: 'fit', cols: +(params.get('cols') || store.get('cols', 4)), theme: params.get('theme') || store.get('theme3', 'light'),
    speed: 1, playing: true, selected: null, collapsed: store.get('collapsed', {}), overrides: store.get('overrides', {}),
    query: '', server: false, panel: store.get('panel', true),
    web: { q: '', items: null, busy: false, error: '' }, official: [], officialBusy: false,
    lang: params.get('lang') || store.get('lang2', 'zh'),
    motion: RECORD ? (params.get('motion') === 'flat' || params.get('motion') === 'minimal' ? 'flat' : '3d') : motionSetting(store.get('motion', '3d')), panning: false,
    translate: store.get('translate', true), rawSpec: null, trInfo: { any: false, missing: 0, busy: false, error: '' }, showOrig: false,
  };
  SV.i18n.set(state.lang);

  const ZH_GROUP_ARG = {
    'Claude Code': '克劳德代码',
    'Codex': '代码助手',
    '~/.agents': '全局智能体',
    'GitHub Copilot': '代码副驾',
    'Antigravity': '反重力助手',
    'Grok': '格罗克助手',
    'mimocode': '米莫代码',
    'claude-science': '科研智能体',
    'Gemini CLI': '双子星终端',
    'OpenCode': '开源代码助手',
    'Kiro': '奇罗智能体',
    'OpenClaw': '开源利爪助手',
    'Qwen Code': '通义千问代码',
    'Lingma': '通义灵码',
    'Vibe': '氛围编程助手',
    'Cursor': '游标编辑器',
    'Windsurf': '乘风编辑器',
    'Cline': '克莱恩助手',
    'Roo Code': '袋鼠代码助手',
    'Trae': '萃伊编辑器',
    'Continue': '续写助手',
    'Amp': '安普助手',
    'Aider': '艾德助手',
    'Zed': '极速编辑器',
    'Goose': '飞鹅智能体',
    '26年英伟达黑客松比赛': '26年英伟达黑客松比赛',
    'AI_video': '智能视频项目',
    'MetalMax': '重装机兵项目',
    'MetalMax_backup': '重装机兵备份',
    'nexa': '奈克萨项目',
    'speak_plainly': '直白表达项目',
    'xiaohongshu': '小红书项目',
    '个人的bot': '个人机器人',
    '这辈子': '这辈子项目',
    'anthropics/skills': '官方技能集（安索匹克）',
    'openai/skills': '官方技能集（开放智能）',
    'anthropics/claude-plugins-official': '官方插件集',
  };
  const zhGroupArg = a => (state.lang === 'zh' && a ? (ZH_GROUP_ARG[a] || a) : (a || ''));

  /* 把页面上带 data-t 的静态文字换成当前语言 */
  function applyLang() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    $$('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    $$('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
    $$('[data-t-title]').forEach(el => { el.title = t(el.dataset.tTitle); });
    $$('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
    $$('#selCols option').forEach(o => { o.textContent = t('cols.n', o.value); });
    $$('#selTheme option').forEach(o => { o.textContent = t('theme.' + o.value); });
    $$('#selMotion option').forEach(o => { o.textContent = t('motion.' + o.value); });
    $('#btnLang').textContent = state.lang === 'zh' ? '中文' : 'EN';
    setPlaying(state.playing);
  }
  function setLang(lang) {
    state.lang = SV.i18n.set(lang);
    store.set('lang2', state.lang);
    applyLang();
    renderList();
    if (state.currentId) select(state.currentId, true); else renderHeader();
  }
  const groupName = s => s.groupKey ? t('group.' + s.groupKey, zhGroupArg(s.groupArg)) : (s.group || t('group.other'));
  const whereName = w => w.key ? t('group.' + w.key, zhGroupArg(w.arg)) : (w.label || t('group.other'));
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

  const ZH_SKILL_NAMES = {
    'skilllens': '技能图解',
    'review-loop': '代码审查循环',
    'faceless-explainer': '无出镜讲解视频',
    'general-video': '通用视频制作',
    'hyperframes-animation': '超帧动画设计',
    'hyperframes-audio': '超帧音频混音',
    'hyperframes-cli': '超帧命令行流程',
    'hyperframes-core': '超帧核心合成',
    'hyperframes-creative': '超帧创意指导',
    'hyperframes-keyframes': '超帧关键帧运镜',
    'hyperframes-registry': '超帧组件仓库',
    'hyperframes-studio': '超帧工作室协作',
    'hyperframes': '超帧视频总入口',
    'media-use': '媒体素材调用',
    'product-launch-video': '产品发布视频',
    'built-in-browser': '内置浏览器控制',
    'chrome-browser': '谷歌浏览器协同',
    'computer-use': '电脑桌面操控',
    'deep-research': '深度研究工作流',
    'docs': '在线协作文档',
    'docx': '文字文档处理',
    'import-memory': '历史记忆导入',
    'morning': '晨间简报生成',
    'pdf': '便携文档处理',
    'pptx': '演示文稿制作',
    'skill-creator': '技能构建助手',
    'xlsx': '电子表格处理',
    'chibi-character': 'Q版角色设计',
    'concept-sheet': '角色概念设定图',
    'codex-delegate': '代码助手委派',
    'dgx-comfyui': '算力节点生图工作流',
    'imagegen': '智能图像生成',
    'openai-docs': '开放智能文档查询',
    'review-agent': '代码审查代理',
    'skill-installer': '技能安装工具',
    'apply-gpt-5p6-guidance': '高阶提示词规范',
    'codex-output-polish': '输出内容润色',
    'create-plan': '实施方案规划',
    'design-taste-frontend': '前端审美设计',
    'easyeda-api': '立创电路板接口',
    'figma-implement-design': '设计稿转前端代码',
    'frontend-skill': '前端工程开发',
    'i-have-adhd': '专注力分步辅助',
    'img2threejs': '图片转三维场景',
    'nostalgic-emotion-story': '怀旧情感故事生成',
    'project-weekly-report': '项目周报生成',
    'remotion-best-practices': '编程视频最佳实践',
    'remotion-captions': '编程视频字幕生成',
    'remotion-create': '编程视频工程创建',
    'remotion-docs': '编程视频文档查阅',
    'remotion-markup': '编程视频画面排版',
    'remotion-multimedia': '编程视频多媒体合成',
    'remotion-render': '编程视频渲染导出',
    'remotion-studio': '编程视频预览工作台',
    'setup-api-key': '接口密钥配置',
    'speech-to-text': '语音转文字',
    'text-to-speech': '文字转语音',
    'wechat-sticker': '微信表情包制作',
    'control-in-app-browser': '应用内浏览器控制',
    'control-chrome': '浏览器自动化控制',
    'visualize': '数据图表可视化',
    'google-docs': '云端文字文档',
    'google-drive-comments': '云盘评论管理',
    'google-drive': '云端硬盘管理',
    'google-sheets': '云端电子表格',
    'google-slides': '云端演示文稿',
  };
  const ZH_SLUG_WORDS = {
    artifact: '成品', template: '模板', analytics: '分析', dashboard: '看板', annual: '年度', impact: '影响', report: '报告',
    brand: '品牌', guidelines: '规范', business: '业务', review: '评审', calder: '架构', architecture: '架构',
    creative: '创意', campaign: '活动', brief: '简报', design: '设计', experiment: '实验', analysis: '分析',
    financial: '财务', budget: '预算', growth: '增长', strategy: '策略', investment: '投资', committee: '委员会',
    memo: '备忘录', legal: '法务', memorandum: '备忘录', market: '市场', trends: '趋势', minimal: '极简',
    letterhead: '信头', next: '新一代', generation: '世代', os: '系统', operating: '运营', calendar: '日历',
    photography: '摄影', portfolio: '作品集', product: '产品', pitch: '路演', project: '项目', kickoff: '启动会',
    tracker: '追踪', sales: '销售', pipeline: '管线', state: '前沿', of: '', art: '技术', system: '系统',
    three: '三表', statement: '财务', forecast: '预测', weekly: '周度', maintain: '维护', space: '空间',
    manage: '管理', schedules: '日程', organize: '整理', write: '撰写', page: '页面', plugin: '插件',
    management: '管理', sites: '站点', create: '创建', pet: '桌宠', pets: '桌宠', update: '更新',
    gh: '代码库', address: '处理', comments: '评论', fix: '修复', ci: '持续集成', github: '代码托管',
    documents: '文档', presentations: '演示文稿', excel: '表格', live: '实时', control: '控制',
    spreadsheets: '电子表格', creator: '生成器', agent: '智能体', reach: '触达', reverse: '逆向',
    engineer: '工程', anything: '万物', compute: '算力', env: '环境', setup: '配置', customize: '定制',
    figure: '图表', composer: '排版', style: '样式', literature: '文献', managed: '托管', model: '模型',
    endpoints: '端点', endpoint: '端点', paper: '论文', narrative: '叙事', explore: '探索', self: '自我',
    knowledge: '知识', remote: '远程', modal: '云容器', ssh: '远程连接', tools: '工具', awareness: '感知',
    using: '调用', amap: '高德地图', threejs: '三维渲染', event: '事件', landmark: '地标', refinement: '精修',
    life: '生活', butler: '管家', liquid: '流光', glass: '玻璃质感', map: '地图', scene: '场景',
    styling: '样式', memory: '记忆', film: '胶片', identity: '身份', storytelling: '叙事', photo: '照片',
    card: '卡片', context: '语境', cull: '筛选', spacetime: '时空', modeling: '建模', stepfun: '阶跃星辰',
    api: '接口', story: '故事', understanding: '理解', high: '高', quality: '品质', explainer: '讲解',
    video: '视频', game: '游戏', '3d': '三维', assets: '资产', native: '原生', optimization: '优化',
    unreal: '虚幻引擎', dialogue: '对话', changelog: '更新日志', tool: '工具', flutter: '跨端界面',
    ui: '界面', director: '导演', evidence: '循证', article: '文章', codex: '代码', image: '图像',
    qc: '质检', skills: '技能集', workflow: '工作流', translate: '翻译', docs: '文档', add: '添加',
    release: '发布', highlights: '亮点', retrospective: '复盘', team: '团队', browser: '浏览器',
    ask: '提问', code: '代码', codebase: '代码库', diagnosing: '诊断', bugs: '缺陷', domain: '领域',
    frontend: '前端', grill: '深度追问', me: '我', with: '结合', grilling: '深度追问', handoff: '交接',
    implement: '实现', improve: '优化', pr: '合并请求', ai: '智能', loop: '循环', prototype: '原型',
    research: '研究', resolving: '解决', merge: '合并', conflicts: '冲突', tdd: '测试驱动开发',
    teach: '教学', to: '转为', questionnaire: '问卷', spec: '规范', tickets: '工单', triage: '分诊',
    vercel: '云端', react: '前端框架', best: '最佳', practices: '实践', wait: '等等', what: '核对',
    wayfinder: '路径导航', web: '网页', wizard: '向导', writing: '写作', for: '面向', agents: '智能体',
    joy: '悦享', phone: '手机', diagnostics: '诊断',
  };
  function skillDisplayName(s) {
    if (!s) return '';
    const raw = String(s.name || '');
    if (state.lang !== 'zh' || !state.translate) return raw;
    if (ZH_SKILL_NAMES[raw]) return ZH_SKILL_NAMES[raw];
    const low = raw.toLowerCase();
    if (ZH_SKILL_NAMES[low]) return ZH_SKILL_NAMES[low];
    if (/[\u3400-\u9fff]/.test(raw)) return raw;
    const parts = low.split(/[-_\s]+/).filter(Boolean);
    const mapped = parts.map(p => ZH_SLUG_WORDS[p]).filter(x => x !== undefined);
    if (mapped.length === parts.length && mapped.join('')) return mapped.join('');
    return raw;
  }
  function zhPolishText(str) {
    if (typeof str !== 'string' || state.lang !== 'zh' || !state.translate) return str;
    return str
      .replace(/SkillLens example\s*·\s*icons Lucide \(ISC\)/gi, '技能图解示例 · 开源矢量图标库')
      .replace(/SkillLens/g, '技能图解')
      .replace(/SKILL\.md/g, '技能文档')
      .replace(/skillflow/gi, '预设流程')
      .replace(/HyperFrames/g, '超帧框架')
      .replace(/BRIEF\.md/g, '简报文档')
      .replace(/STORYBOARD\.md/g, '分镜文档')
      .replace(/SCRIPT\.md/g, '旁白脚本')
      .replace(/frame\.md/g, '画面规范')
      .replace(/\/product-launch-video/g, '「产品发布视频」')
      .replace(/\/hyperframes/g, '「超帧视频总入口」')
      .replace(/Claude in Chrome/g, '谷歌浏览器协同')
      .replace(/Claude Code/g, '克劳德代码')
      .replace(/Claude/g, '克劳德')
      .replace(/HTML\s*\/\s*SVG\s*\/\s*PNG/g, '网页 · 矢量图 · 高清图')
      .replace(/\bHTML\b/g, '网页')
      .replace(/\bMP4\b|\bmp4\b/g, '视频')
      .replace(/\bPR\b/g, '合并请求')
      .replace(/\bAI\b/g, '智能')
      .replace(/\bLint\b/g, '代码检查')
      .replace(/\bCLI\b/g, '命令行')
      .replace(/\bURL\b/g, '网址')
      .replace(/\bPDF\b/g, '便携文档')
      .replace(/\bPPTX\b|\b\.pptx\b|\b\.potx\b/g, '演示文稿')
      .replace(/\bDOCX\b|\bWord\b/g, '文字文档')
      .replace(/\binit\b/g, '初始化')
      .replace(/\badd\b/g, '添加组件');
  }

  /* 列表里的一行描述也跟随界面语言（服务模式下自动翻译并缓存） */
  let descAsked = false;
  function listDesc(s) {
    const d = s.description || s.path || '';
    if (!state.translate) return d;
    if (!needsTr(d, state.lang)) return state.lang === 'zh' ? zhPolishText(d) : d;
    const hit = TR.cache[trKey(state.lang, d)];
    const out = hit != null ? hit : d;
    return state.lang === 'zh' ? zhPolishText(out) : out;
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
      <div class="name"><span>${esc(skillDisplayName(s))}</span>${flow ? `<i class="badge flow">${t('badge.flow')}</i>` : ''}${edited ? `<i class="badge edit">${t('badge.edited')}</i>` : ''}${also}</div>
      <div class="desc">${esc(listDesc(s))}</div>
      ${removable ? `<span class="del" data-del="${esc(s.id)}" title="${t('list.remove')}">${iconSvg('x', 14)}</span>` : ''}
    </button>`;
  }

  function renderList() {
    const q = state.query.trim().toLowerCase();
    const list = state.skills.filter(s => !q || (s.name + ' ' + skillDisplayName(s) + ' ' + s.description + ' ' + (s.path || '')).toLowerCase().includes(q));
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
  const ZH_TERMS = {
    'SkillLens': '技能图解',
    'SKILL.md in · auto-extracted · animated flowchart out': '读取技能文档 · 自动解析结构 · 生成3D动态流程图',
    'Open SkillLens': '启动技能图解',
    'folders, .md files': '文件夹、文档文件',
    'skillflow block?': '含预设流程块？',
    'Tweak in Structure': '在结构面板微调',
    'HTML / SVG / PNG': '网页 · 矢量图 · 高清图',
    'record an mp4': '录制高清演示视频',
    'When': '触发时机',
    'Trigger': '触发条件',
    'import': '导入阶段',
    'extract': '解析阶段',
    'export': '导出阶段',
    'start.bat': '启动脚本',
    'drop': '拖放粘贴',
    'skillflow?': '预设流程？',
    'auto': '自动提炼',
    'review': '核对审查',
    'edit': '编辑微调',
    'render': '渲染画布',
    'PR Review Loop': '代码合并审查循环',
    'Checks run first · AI reviews the diff · a human makes the call': '先跑自动检查 · 智能审查差异 · 人工最终拍板',
    'checks · AI review · human gate': '自动检查 · 智能审查 · 人工把关',
    'pull_request': '合并请求',
    'CI': '自动构建',
    'ci': '构建测试',
    'checks?': '通过检查？',
    'AI review': '智能代码审查',
    'AI': '智能代理',
    'diff': '代码差异',
    'risk': '风险评估',
    'you': '人工把关',
    'panel': '审查面板',
    'approve?': '是否批准？',
    'merge': '合并发布',
    'Lint and test': '代码检查与测试',
    'one screen per PR': '每个合并请求一屏总览',
    'Reviewer asks for changes → back to the AI pass': '审查者要求修改 → 返回智能审查',
    'next PR': '下一单请求',
    'Faceless Explainer to HyperFrames': '无出镜讲解视频制作流程',
    'faceless-explainer': '无出镜讲解视频',
    'Audio': '音频与配音合成',
    'brief-contract.md': '简报契约规范',
    'story-spine.md': '故事主线规范',
    'frame-presets/': '画面预设目录',
    'design-spec.md': '视觉设计规范',
    'story-design.md': '故事编排指南',
    'blueprints-index.md': '镜头蓝图索引',
    'storyboard-format.md': '分镜脚本格式',
    'script-format.md · tts.md · visual-design.md · motion-language.md · cut-catalog.md · rules-index.md + rules/ · frame-worker-core.md · frame-worker.md · subagent-dispatch.md': '旁白格式 · 语音合成 · 视觉设计 · 动效语言 · 转场目录 · 动效规则集 · 画面核心 · 画面子代理 · 子代理调度',
    'SkillLens example · icons Lucide (ISC)': '技能图解示例 · 开源矢量图标库',
    'skills / review-loop / SKILL.md': '技能库 / 代码审查循环 / 技能文档',
  };
  function buildTrCache() {
    const base = Object.assign({}, window.SV_TRANS || {});
    for (const [k, v] of Object.entries(base)) {
      if (k.startsWith('zh\u0001')) {
        const raw = k.slice(3);
        const stripped = raw.replace(/^(?:(?:Step|Phase|Stage)\s+\d+(?:\.\d+)?(?:\s*[–—-]\s*\d+(?:\.\d+)?|\s+to\s+\d+(?:\.\d+)?)?|\d+(?:\.\d+)?)\s*[:：\-—]\s*/i, '');
        if (stripped && stripped !== raw && !base['zh\u0001' + stripped]) {
          base['zh\u0001' + stripped] = String(v).replace(/^(?:(?:步骤|阶段|第)\s*\d+(?:\.\d+)?\s*(?:步|阶段)?|\d+(?:\.\d+)?)\s*[:：\-—]\s*/, '');
        }
      }
    }
    for (const [k, v] of Object.entries(ZH_TERMS)) base['zh\u0001' + k] = v;
    return base;
  }
  const TR = { cache: buildTrCache(), backend: undefined, inflight: new Set() };
  const trKey = (lang, s) => lang + '\u0001' + s;
  function needsTr(s, lang) {
    if (typeof s !== 'string') return false;
    const x = s.trim();
    if (!x || /^(yes|no)$/i.test(x)) return false;
    if (lang === 'zh') {
      if (ZH_TERMS[x]) return true;
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
    field(spec, 'title'); field(spec, 'subtitle'); field(spec, 'window'); field(spec, 'footer');
    if (spec.hero) { field(spec.hero, 'title'); field(spec.hero, 'sub'); }
    if (spec.trigger) { field(spec.trigger, 'title'); field(spec.trigger, 'tag'); lines(spec.trigger); }
    for (const l of spec.lanes || []) {
      field(l, 'title'); field(l, 'tag');
      (l.nodes || []).forEach(n => { field(n, 'title'); field(n, 'tag'); lines(n); });
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
      if (lang === 'zh' && state.translate && ZH_TERMS[s]) { any = true; return ZH_TERMS[s]; }
      if (!needsTr(s, lang)) return lang === 'zh' && state.translate ? zhPolishText(s) : undefined;
      any = true;
      if (!state.translate) return undefined;
      const hit = TR.cache[trKey(lang, s)];
      if (hit != null) return lang === 'zh' ? zhPolishText(hit) : hit;
      missing.add(s);
      return lang === 'zh' ? zhPolishText(s) : undefined;
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
    const jobs = ['400 14px', '500 14px', '700 18px', '800 40px'].flatMap(w => [document.fonts.load(`${w} "Noto Sans SC"`, text), document.fonts.load(`${w} Inter`, text)])
      .concat([document.fonts.load('500 11px "JetBrains Mono"', text), document.fonts.load('400 13px "JetBrains Mono"', text)]);
    return Promise.race([Promise.all(jobs).catch(() => {}), new Promise(r => setTimeout(r, timeout || 2500))]);
  }

  function draw(keepTime) {
    if (state.lang && SV.i18n.lang !== state.lang) SV.i18n.set(state.lang);
    state.drawnEpoch = fontEpoch;
    const t0 = keepTime && state.player ? state.player.time : 0;
    if (state.player) state.player.destroy();
    const G = SV.layout(state.spec, { cols: state.cols });
    state.G = G;
    const canvas = $('#canvas');
    canvas.innerHTML = '<div class="sv-cam">' + SV.render.toSVG(G, { theme: state.theme }) + '</div>';
    state.svg = canvas.querySelector('svg');
    state.player = SV.render.createPlayer(state.svg, G, { loop: !RECORD, reducedMotion: state.motion === 'minimal', camera: { el: canvas.querySelector('.sv-cam'), strength: cameraStrength() } });
    state.player.setSpeed(state.speed);
    if (!state.playing || RECORD) state.player.pause();
    if (t0) state.player.seek(t0);
    if (!RECORD && readPin) state.player.setPin(readPin);
    if (state.selected) markSelected(state.selected);
    applyZoom();
  }

  const ZH_FM_KEYS = {
    license: '许可协议',
    'allowed-tools': '可用工具',
    compatibility: '兼容环境',
    metadata: '附加信息',
    version: '版本号',
    author: '作者',
  };
  function zhPathText(p, s) {
    if (!p || state.lang !== 'zh' || !state.translate) return p;
    return String(p)
      .replace(/UserData/g, '用户数据')
      .replace(/\.claude/g, '克劳德配置')
      .replace(/\bskills\b/gi, '技能库')
      .replace(/\bexamples\b/gi, '示例库')
      .replace(/SKILL\.md/gi, '技能文档')
      .replace(s && s.name ? s.name : '\u0000', s ? skillDisplayName(s) : '');
  }
  const ZH_FILE_NAMES = {
    'cut-catalog': '转场目录',
    'motion-language': '动效语言',
    'story-design': '故事编排指南',
    'visual-design': '视觉设计规范',
    'assemble-index': '索引组装',
    'audio': '音频与配音合成',
    'build-frame': '画面预设构建',
    'captions': '字幕生成',
    'frame-packets': '画面数据包',
    'transitions': '转场注入与校验',
    'frame-worker': '画面构建子代理',
  };
  function zhFileItem(f) {
    if (!f || state.lang !== 'zh' || !state.translate) return f;
    let out = String(f)
      .replace(/^references\//, '参考资料 / ')
      .replace(/^scripts\//, '脚本工具 / ')
      .replace(/^sub-agents\//, '子代理 / ')
      .replace(/^templates\//, '模板 / ')
      .replace(/^assets\//, '素材 / ')
      .replace(/\.test\.(mjs|js|ts)$/, '（测试脚本）')
      .replace(/\.(mjs|js|ts|py|sh)$/, '（脚本）')
      .replace(/\.md$/, '（文档）')
      .replace(/\.json$/, '（配置）');
    for (const [k, v] of Object.entries(ZH_FILE_NAMES)) out = out.replace(k, v);
    return out;
  }

  function renderHeader() {
    const s = findSkill(state.currentId);
    const spec = state.spec;
    const dispName = s ? skillDisplayName(s) : '';
    const subPath = s ? zhPathText(s.path || s.name, s) : '';
    $('#current').innerHTML = s && spec ? `<b>${esc(spec.title || dispName)}</b><span>${esc(subPath)}</span>` : `<b>${t('current.none')}</b>`;
    document.title = s ? `${dispName} · ${t('app.title')}` : t('app.title');
  }

  /* —— 缩放与平移 —— */
  function cameraStrength() {
    return state.motion !== '3d' ? 0 : RECORD || document.body.classList.contains('present') ? 1 : state.zoom === 'fit' && !state.panning ? .5 : 0;
  }
  function setMotion(value) {
    state.motion = RECORD && value === 'minimal' ? 'flat' : motionSetting(value);
    store.set('motion', state.motion);
    $('#selMotion').value = state.motion;
    if (state.spec) draw(true);
  }
  /* 「适应」= 宽和高都放进画布，整张图一屏看完，不用上下滚；减 1px 防止取整后冒出滚动条 */
  function fitZoom() {
    const stage = $('#stage');
    const present = document.body.classList.contains('present');
    const pad = (present ? 0 : 16) + 1;
    const z = Math.min((stage.clientWidth - pad) / state.G.W, (stage.clientHeight - pad) / state.G.H);
    return Math.max(0.2, Math.min(present ? 2.5 : 1.5, z));
  }
  function currentZoom() { return state.zoom === 'fit' ? fitZoom() : state.zoom; }
  function applyZoom() {
    if (!state.svg || !state.G) return;
    const z = RECORD ? 1 : currentZoom();
    const width = state.G.W * z + 'px', height = state.G.H * z + 'px';
    if (state.svg.style.width !== width) state.svg.style.width = width;
    if (state.svg.style.height !== height) state.svg.style.height = height;
    state.player.setCamera({ strength: cameraStrength(), width: state.G.W * z, height: state.G.H * z, ease: !RECORD && !document.body.classList.contains('present') });
    $('#btnZoomFit').textContent = Math.round(z * 100) + '%';
  }
  function zoomBy(f, cx, cy) {
    if (RECORD || document.body.classList.contains('present')) return;
    const stage = $('#stage');
    const z0 = currentZoom();
    const z1 = Math.max(0.2, Math.min(3, z0 * f));
    const rect = stage.getBoundingClientRect();
    const px = (cx == null ? rect.width / 2 : cx - rect.left) + stage.scrollLeft;
    const py = (cy == null ? rect.height / 2 : cy - rect.top) + stage.scrollTop;
    state.player && state.player.setCamera({ strength: 0, ease: true, onSettled() {
      state.zoom = z1;
      applyZoom();
      stage.scrollLeft = px * z1 / z0 - (px - stage.scrollLeft);
      stage.scrollTop = py * z1 / z0 - (py - stage.scrollTop);
    } });
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

  const SKILL_TEST_CASES = {
    'skilllens': {
      input: '把 skills/skilllens/SKILL.md 拖入页面，检查各步骤连线并点击「导出 → 独立网页」',
      before: '只能阅读数百行纯文本 Markdown，步骤跳转、判断分支与参考文件依赖需人工逐段脑补。',
      after: '自动提取为分泳道 3D 交互流程图，直观展示判断菱形、回环虚线与文件读取关系，支持一键导出。',
    },
    'review-loop': {
      input: '审查当前仓库的新合并请求（#42），跑完测试套件并对高风险改动给出行内修改意见',
      before: '仅凭肉眼扫代码给笼统建议，容易漏跑单测，也不会在修复推送后自动触发复审闭环。',
      after: '严格按「自动跑测试 → 仅读变更上下文 → 评估缺陷与安全风险 → 人工拍板合并」闭环执行。',
    },
    'faceless-explainer': {
      input: '把这段 200 字的「番茄工作法」笔记做成一条 30 秒无出镜知识讲解视频',
      before: '只输出一段纯文字口播稿，没有统一视觉规范、分镜脚本、词级字幕时间轴与动态画面代码。',
      after: '按「简报→视觉规范→分镜脚本→配音合成→逐镜网页画面构建」全链路产出可渲染视频工程。',
    },
    'general-video': {
      input: '为新款降噪耳机做一条 15 秒功能亮点短片，包含人声旁白、背景音乐闪避与节奏卡点',
      before: '只给文字分镜设想，无法落盘工程目录、合成音轨或校验每个镜头的画面排版质量。',
      after: '自动初始化视频工程，完成「分镜脚本→配音混音→逐镜画面合成→逐帧质检→导出视频」闭环。',
    },
    'product-launch-video': {
      input: '为刚上线的「极速笔记 2.0」制作一条 45 秒产品发布宣传片，突出三项核心新功能',
      before: '平铺直叙罗列功能点，缺乏痛点开场钩子、界面特写推拉运镜与情绪高潮节奏。',
      after: '按发布会叙事弧线编排「痛点钩子→真实界面特写运镜→节奏卡点展示→品牌收尾」并输出合成工程。',
    },
    'hyperframes': {
      input: '我想用代码做一个带配音和丝滑转场的 20 秒产品介绍视频，帮我规划并启动超帧工程',
      before: '不清楚该选哪种工作流与子工具，手写网页动画容易出现音画不同步与录屏掉帧。',
      after: '自动匹配最佳视频工作流，串联创意指导、关键帧运镜、音频混音与命令行无损渲染。',
    },
    'hyperframes-animation': {
      input: '给标题卡片写一段入场动效：先弹性放大，停顿 0.8 秒后平滑上移并淡出副标题',
      before: '用普通 CSS 过渡糊弄，缓动生硬，且在视频录制跳帧采样时动画时间轴会错乱。',
      after: '基于确定性帧率时间轴与物理弹簧/贝塞尔曲线编写动效，任意时间点定点采样完全一致。',
    },
    'hyperframes-audio': {
      input: '把旁白 voice.mp3 和背景乐 bgm.mp3 混音，有人声时背景乐自动压低 12dB，首尾淡入淡出',
      before: '背景音乐与人声直接叠加互相打架，音量忽大忽小，结尾生硬切断。',
      after: '自动计算人声包络实现背景乐平滑闪避（Ducking）、响度标准化与首尾自然淡入淡出。',
    },
    'hyperframes-cli': {
      input: '初始化一个 1080p 60帧的超帧视频工程，跑通画面校验并导出为高清 MP4',
      before: '手动拼凑构建脚本与编码参数，常因缺依赖、尺寸不对或编码格式不兼容而中途报错。',
      after: '按标准命令行循环完成「工程初始化 → 组件挂载 → 逐帧体检 → 硬件加速导出高清视频」。',
    },
    'hyperframes-core': {
      input: '构建一个由 3 个分镜组成的合成序列，总长 12 秒，镜头之间带 0.5 秒叠化转场',
      before: '各镜头独立写死绝对时间，修改第一个镜头时长后，后续所有镜头时间轴全部错位。',
      after: '用声明式合成契约管理镜头树与相对时间轴，修改任一镜头自动重排全局转场与总时长。',
    },
    'hyperframes-creative': {
      input: '我要做一期讲「量子计算原理」的科普短片，帮我定一套不俗套的视觉配色与排版规范',
      before: '默认做成千篇一律的蓝紫渐变科技风模板，信息堆砌、缺乏视觉层级与留白。',
      after: '输出完整的《视觉创意指导书》（色彩令牌、字体阶梯、构图网格与情绪板），统一全片审美。',
    },
    'hyperframes-keyframes': {
      input: '在 3 秒内将镜头从全景 100% 推近到左上角按钮（放大 2.4 倍），带微妙三维俯仰角',
      before: '简单粗暴地缩放整个画面容器，边缘模糊锯齿且运动起止生硬卡顿。',
      after: '通过三维摄像机矩阵关键帧插值实现电影级推拉摇移，运动自带物理惯性与丝滑阻尼。',
    },
    'hyperframes-registry': {
      input: '在当前视频工程中引入「终端打字机」与「代码高亮对比」两个预设画面组件',
      before: '每次都从零手写复杂的终端窗口与代码高亮样式，耗时且容易出现排版错位。',
      after: '直接从组件仓库检索并注入经过验证的标准化高颜值视觉组件，即插即用。',
    },
    'hyperframes-studio': {
      input: '打开超帧预览工作台，定位到第 04 号分镜第 2.5 秒检查字幕遮挡问题并实时微调',
      before: '每次改一行样式都要重新渲染整条视频才能看效果，调试反馈周期极长。',
      after: '启动可视化预览工作台，支持时间轴逐帧拖拽、单帧定格审查与热更新微调。',
    },
    'media-use': {
      input: '把素材库里的 demo.mov 截取前 5 秒静音片段，转为 1080p 标准格式挂载到第 2 分镜',
      before: '直接塞入原始大体积视频导致页面卡顿、宽高比拉伸变形或音轨冲突。',
      after: '先探测媒体元数据，自动完成裁剪、转码、抽帧或抠像预处理后再安全接入工程。',
    },
    'built-in-browser': {
      input: '在内置浏览器打开 http://localhost:3000，点击登录按钮并截图检查页面布局与报错',
      before: '只能静态阅读源码猜测界面效果，看不到真实的样式错位与控制台运行时报错。',
      after: '驱动内置浏览器真实渲染页面，自动完成点击交互、控制台日志捕获与视觉截图核验。',
    },
    'control-in-app-browser': {
      input: '在应用内浏览器打开本地开发页，模拟移动端视口并检查导航菜单展开效果',
      before: '脱离真实渲染环境盲改 CSS，响应式断点与交互状态经常漏测。',
      after: '直接在应用内浏览器加载目标网址，实时操控 DOM 并通过截图闭环验证视觉效果。',
    },
    'chrome-browser': {
      input: '协同我当前已打开的谷歌浏览器标签页，提取后台报表页前 20 条异常订单记录',
      before: '新建无头浏览器没有登录态，遇到扫码登录或双因素认证直接卡死无法继续。',
      after: '直接复用当前已登录的真实浏览器会话，安全读取页面数据并执行自动化填表点击。',
    },
    'control-chrome': {
      input: '控制当前 Chrome 浏览器打开测试后台，自动填写筛选条件并导出校验结果',
      before: '手工重复点击几十次表单项，繁琐易错且无法自动记录每步截图证据。',
      after: '自动接管浏览器标签页完成定位、输入、点击与结果断言，全程高效零失误。',
    },
    'computer-use': {
      input: '把桌面上「待整理」文件夹里的发票图片按画面中的开票日期重命名并归档',
      before: '受限于命令行沙箱，无法操作桌面图形软件或查看非文本文件内容。',
      after: '通过屏幕视觉感知与键鼠操控闭环，像真人一样观察窗口、执行操作并逐一核对结果。',
    },
    'deep-research': {
      input: '深度调研 2026 年主流端侧小模型推理框架的性能实测对比，要求附带一手评测出处',
      before: '泛泛罗列几个常见框架名称，数据过时笼统且没有可核查的真实来源链接。',
      after: '拆解多维检索计划，交叉比对官方文档与基准测试，输出带精确引用的结构化深度报告。',
    },
    'docx': {
      input: '把这份 Markdown 技术方案转换为带封面、自动目录、三级标题样式和表格边框的 Word 文档',
      before: '直接复制粘贴导致格式错乱、标题没有大纲层级、表格跨页断行难看。',
      after: '按文档工程规范生成带标准样式表、页眉页脚、自动目录与对齐表格的 .docx 文件。',
    },
    'docs': {
      input: '读取团队在线协作文档中的需求变更记录，整理出今日待开发接口清单并回写状态',
      before: '手动在浏览器复制粘贴文档内容，格式丢失且改完代码后忘了同步更新文档状态。',
      after: '直接连接在线文档接口结构化读取章节与表格，完成后自动回写最新进度。',
    },
    'pdf': {
      input: '提取这份 30 页财报 PDF 第 5–8 页的合并利润表数据，并将两份补充协议合并到末尾',
      before: '纯文本抽取把双栏排版与表格列完全打乱，跨行数字错位无法使用。',
      after: '精准解析 PDF 版面结构提取表格行列，支持无损页面拆分、合并、表单填写与水印处理。',
    },
    'pptx': {
      input: '根据这份季度复盘提纲生成一套 8 页汇报演示文稿，包含核心指标卡片页与下季路线图',
      before: '每页塞满密密麻麻的项目符号列表，字号过小、缺乏视觉重心与版式变化。',
      after: '按演示设计规范自动排版封面、大字结论页、三栏数据对比页与时间轴页，导出标准 .pptx。',
    },
    'xlsx': {
      input: '生成一份月度销售明细电子表格，自动用公式计算环比增长率，并对负增长标红高亮',
      before: '只导出死板的纯文本 CSV 数字，没有动态计算公式、千分位格式或条件高亮。',
      after: '构建带冻结首行、动态公式（SUM/IF）、货币百分比格式与条件高亮规则的标准 .xlsx 表格。',
    },
    'skill-creator': {
      input: '把这套「每周自动抓取竞品更新并生成日报」的操作流程打包为一个标准可复用技能',
      before: '随便写一段零散提示词，触发时机模糊，换个对话窗口就不按步骤执行。',
      after: '按标准技能架构生成元数据触发条件、分阶段工作流、配套参考脚本与自检用例。',
    },
    'chibi-character': {
      input: '把这张写实风格的程序员照片转成二头身 Q 版卡通立绘，保留黑框眼镜与格子衫特征',
      before: '头身比例飘忽不定，五官过于写实或丢失原人物标志性的穿搭细节。',
      after: '严格锁定二头身大头萌系比例，精准提炼服饰特征并输出干净轮廓线的 Q 版角色图。',
    },
    'concept-sheet': {
      input: '为一位穿赛博机能风斗篷的角色生成包含正、侧、背三视图与面部表情的角色设定图',
      before: '不同角度的人物服装结构、配色与身高比例前后不一致，无法直接用于下游建模。',
      after: '在同一张设定板上对齐绘制标准正/侧/背正交三视图、局部配饰拆解与标准色卡。',
    },
    'imagegen': {
      input: '生成一张奶白3D卡通积木风格的「智能工厂流水线」等轴测插画，16:9 宽屏，柔和暖光',
      before: '提示词过于简略导致画面构图杂乱、光影塑料感重，分辨率与比例不合要求。',
      after: '自动扩充材质、镜头焦段与布光提示词，调用生图工具落盘高清原图并校验画面细节。',
    },
    'review-agent': {
      input: '对当前未提交的 Git 改动做一次严格代码审查，重点排查空指针、并发竞态与安全隐患',
      before: '只挑变量命名或缩进等表面毛病，漏掉真正会导致线上崩溃的边界逻辑漏洞。',
      after: '逐文件追踪调用链与边界条件，按「严重等级 + 触发条件 + 修复代码」输出结构化审查报告。',
    },
    'create-plan': {
      input: '我们要给现有系统接入扫码登录与权限分级，先不要改代码，帮我制定一份可执行的实施方案',
      before: '一上来就盲目修改源码，改到一半发现数据表字段与现有鉴权中间件全冲突。',
      after: '先扫描代码库上下文，输出「架构影响面、数据迁移步骤、分步里程碑与验证清单」供确认。',
    },
    'design-taste-frontend': {
      input: '设计并实现一个独立播客订阅主页，要求温暖奶油杂志质感、立体卡片微交互与自适应布局',
      before: '做出千篇一律的紫蓝渐变模板页，间距死板、字体缺乏层级、审美廉价。',
      after: '运用高阶前端审美规范定制色彩令牌、字体阶梯、细腻阴影与物理感微交互，交付精品界面。',
    },
    'frontend-skill': {
      input: '实现一个支持拖拽排序、状态筛选与空状态动画的看板页面，要求零控制台报错',
      before: '只写静态骨架，缺少加载态、空状态、键盘无障碍支持与移动端响应式适配。',
      after: '按完整前端工程标准交付组件拆分、完备交互状态、响应式布局并通过浏览器实测校验。',
    },
    'figma-implement-design': {
      input: '读取这个 Figma 设计稿节点，1:1 还原为响应式组件代码并对齐所有间距与颜色变量',
      before: '靠肉眼看图估测像素尺寸与色值，做出来的页面与设计稿偏差明显。',
      after: '直接提取设计稿精确图层参数、自动布局约束与设计令牌，像素级还原为干净前端代码。',
    },
    'i-have-adhd': {
      input: '我手头积压了 5 个需求外加一堆报错完全不知道从哪开始，帮我拆解并带着我一步步做完',
      before: '一次性抛出长篇大论的 20 条规划建议，产生信息过载，看得更加焦虑无从下手。',
      after: '屏蔽干扰，每次只给「当前唯一一个 5 分钟内可完成的小动作」，做完一步再解锁下一步。',
    },
    'img2threejs': {
      input: '把这张复古书房插画转换成可在网页中拖动旋转查看的 Three.js 三维立体场景',
      before: '只贴一张平面图或随便摆几个毫无关联的几何体，缺乏空间纵深与光影还原。',
      after: '拆解画面前景/中景/背景层次，构建三维网格、材质贴图、环境灯光与交互相机控制器。',
    },
    'project-weekly-report': {
      input: '汇总本周 Git 提交记录与已完成任务，生成一份面向管理层的项目周报',
      before: '直接把枯燥的 git commit 流水账贴出来，看不出业务进展、核心成果与潜在风险。',
      after: '自动提炼为「本周核心成果、关键指标进展、下周计划与需协调风险」四维结构化周报。',
    },
    'wechat-sticker': {
      input: '用这只橘猫角色做一套 6 张「打工人日常（收到、下班、汗流浃背）」微信透明底表情包',
      before: '生成的图片带杂色背景、画风前后不一、文字太小在手机聊天窗口里根本看不清。',
      after: '固定角色特征生成系列动作，自动抠除透明背景、叠加醒目描边大字并裁切为 240×240 规范尺寸。',
    },
    'speech-to-text': {
      input: '把这段 10 分钟的录音文件 meeting.m4a 转写为带时间戳与分段标点的会议纪要',
      before: '输出一大段没有标点分段的原始语音识别流水账，口语废话多且难以阅读。',
      after: '高精度转写语音并自动断句分段、标记关键时间节点，同步提炼结构化结论与待办清单。',
    },
    'text-to-speech': {
      input: '把这段 300 字的产品解说词合成为温和自然的中文配音音频，并输出字幕对齐时间轴',
      before: '机械朗读感重，数字与专有名词读音生硬，且没有配套的词句时间轴文件。',
      after: '优化多音字与气口停顿，生成自然流畅的人声配音，同步输出精确对齐的字幕时间轴。',
    },
    'visualize': {
      input: '把这份各渠道月度获客成本与留存率数据做成一张直观的交互式对比图表',
      before: '随便画一张默认柱状图，双轴量纲混乱、配色刺眼，一眼看不出核心业务结论。',
      after: '根据数据特征匹配最佳图表形态，高亮极值拐点与核心结论，输出高可读性交互图表。',
    },
    'morning': {
      input: '生成我今天的晨间简报：汇总今日会议日程、高优待办与需要关注的重点事项',
      before: '早上要在日历、消息和待办软件之间来回切换翻找，容易漏掉时间冲突。',
      after: '自动聚合多源日程与待办，按时间线与优先级浓缩为 1 分钟可读完的今日行动指南。',
    },
    'import-memory': {
      input: '把我之前整理的个人技术栈偏好与项目约定笔记导入到当前智能体的长期记忆中',
      before: '开启新对话后一切归零，每次都要重复交代代码规范、目录结构与个人偏好。',
      after: '清洗并结构化提炼历史偏好条目，持久化写入本地记忆库，后续对话自动生效。',
    },
    'tdd': {
      input: '用测试驱动开发（TDD）实现一个支持阶梯满减与封顶折扣的订单金额计算函数',
      before: '先写完业务代码再补测试，测试往往迁就已有实现，漏掉金额为负或临界值等边界情况。',
      after: '严格执行「先写失败红灯测试 → 写最简代码变绿 → 重构优化」循环，边界条件 100% 覆盖。',
    },
    'grill-me': {
      input: '我想做一个「自动帮用户回复工作消息」的工具，先别写代码，用深度追问帮我把漏洞问透',
      before: 'AI 顺着你的想法一通夸赞并直接开写，完全忽略误发兜底、权限边界与隐私风险。',
      after: '像资深架构师一样逐轮犀利追问核心假设、极端异常与回滚方案，把模糊想法打磨成严密方案。',
    },
    'diagnosing-bugs': {
      input: '列表页在快速切换筛选条件时偶发数据串行闪烁，帮我科学排查根因并修复',
      before: '靠猜乱加防抖或延时掩盖表面症状，没有验证根因，过几天换个网络环境依然复现。',
      after: '按「稳定复现 → 二分缩小范围 → 埋点验证假设 → 锁定异步竞态根因并补回归测试」闭环排障。',
    },
    'resolving-merge-conflicts': {
      input: '当前分支合并 main 时在订单模块出现了 4 处冲突，帮我结合两边提交意图安全解决',
      before: '机械保留某一边代码，不小心把队友刚修好的安全补丁或新字段直接覆盖丢了。',
      after: '先追溯双方分支的 commit 意图与上下文，精准融合两边逻辑并通过编译与单测验证。',
    },
    'photo-cull': {
      input: '从这组连拍的 12 张聚会合照里挑出最佳的 2 张，剔除闭眼、手抖模糊和表情崩坏的废片',
      before: '人工一张张放大对比眼睛和清晰度，耗时眼花，或者随机乱选留了闭眼照。',
      after: '逐张检测清晰度、人物睁眼状态、表情自然度与构图评分，输出最佳推荐照片与淘汰原因。',
    },
    'photo-card': {
      input: '为这张旅行照片生成结构化照片信息卡：提取画面细节、图中文字及时间地点线索',
      before: '只给一句笼统的「这是一张风景照」，丢失招牌文字、地标建筑与事件上下文线索。',
      after: '输出包含客观画面描述、OCR 文字、带置信度的地点/时间/事件推断与待确认项的标准信息卡。',
    },
    'life-butler': {
      input: '问人生管家：「我去年秋天和谁一起去过杭州？当时拍了哪些有意思的照片？」',
      before: '普通 AI 没有个人真实经历记忆，只能回答「我不知道你的私人行程」或胡乱编造。',
      after: '检索个人世界模型中的事件、城市、人物关系与照片卡，给出有真实照片依据的温暖回答。',
    },
    'evidence-article-pipeline': {
      input: '围绕「端侧 AI 芯片能耗拐点」写一篇深度公众号文章，要求所有论据都有交叉核实的一手来源',
      before: '直接用大模型记忆生成充满套话的营销味水文，数据张冠李戴且经不起事实核查。',
      after: '先执行多轮全网搜集、事实清洗与信息饱和判断，再基于真实证据链撰写严谨深度长文。',
    },
    'image-to-3d': {
      input: '根据这张卡通人物的正/侧/背三视图，生成与原画剪影和配色一致的低多边形 3D 角色模型',
      before: '直接单图生成的 3D 模型背面糊成一团、身材比例走样、贴图颜色脏乱。',
      after: '按「生成基模 → 剪影拟合校正 → 按原画分部件精细上色 → 多角度质检」产出还原度极高的 3D 模型。',
    },
    'video-qc': {
      input: '对刚生成的 15 秒人物短片做全片质检，排查手部变形、画面卡顿与前后人物穿帮并自动修复',
      before: '带着画面崩坏或闪烁硬伤直接发布，或者因为局部 1 秒瑕疵把整条视频全部重做。',
      after: '逐帧扫描定位变形、模糊与不连贯片段，用局部插帧、重绘或剪辑替换精准修复成片。',
    },
  };

  const tcCache = Object.assign({}, window.SV_TESTCASES || {});
  const tcInflight = new Set();
  async function requestTestCase(s, key) {
    if (!state.server || !s || tcInflight.has(key) || tcCache[key]) return;
    tcInflight.add(key);
    try {
      const r = await fetch('api/testcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, name: s.name, description: s.description, text: (s.text || '').slice(0, 3200) }),
      });
      const j = await r.json();
      if (j && j.ok && j.tc && j.tc.input) {
        tcCache[key] = j.tc;
        if (state.currentId === s.id && !state.selected) renderDetail();
      }
    } catch { /* ignore when Ollama is offline */ }
    finally { tcInflight.delete(key); }
  }

  function buildSkillTestCase(s, sp) {
    const rawName = String((s && s.name) || (sp && sp.name) || '').toLowerCase();
    const dispName = (sp && sp.title) || skillDisplayName(s) || rawName;
    if (state.lang === 'en') {
      const flowNodes = (sp && sp.lanes ? sp.lanes : []).filter(l => l.kind !== 'ref').flatMap(l => l.nodes || []);
      const first = flowNodes[0] ? flowNodes[0].title : 'initial check';
      const last = flowNodes.length > 1 ? flowNodes[flowNodes.length - 1].title : 'final output';
      return {
        input: `Run "${dispName}" on a minimal sample input and walk through "${first}" to "${last}".`,
        before: `Ad-hoc one-shot response that skips "${first}" validation and produces unstructured output.`,
        after: `Follows the ${flowNodes.length || 3}-step workflow (${first} → … → ${last}) to deliver verified, structured results.`,
      };
    }
    if (tcCache[rawName]) return tcCache[rawName];
    if (SKILL_TEST_CASES[rawName]) return SKILL_TEST_CASES[rawName];
    const slug = rawName.replace(/[^a-z0-9]+/g, '-');
    if (tcCache[slug]) return tcCache[slug];
    if (SKILL_TEST_CASES[slug]) return SKILL_TEST_CASES[slug];
    if (s && state.server) requestTestCase(s, rawName);

    const flowNodes = (sp && sp.lanes ? sp.lanes : []).filter(l => l.kind !== 'ref').flatMap(l => l.nodes || []);
    const stepTitles = flowNodes.map(n => n.title).filter(Boolean);
    const firstStep = stepTitles[0] || '环境预检与输入解析';
    const midStep = stepTitles[Math.floor(stepTitles.length / 2)] || '核心处理';
    const lastStep = stepTitles[stepTitles.length - 1] || '结构化交付';
    const decNode = flowNodes.find(n => n.type === 'decision');
    const chain = stepTitles.length >= 3
      ? `${firstStep} → ${midStep} → ${lastStep}`
      : stepTitles.length === 2
        ? `${firstStep} → ${lastStep}`
        : firstStep;
    const hay = `${rawName} ${dispName} ${(s && s.description) || ''} ${(sp && sp.description) || ''}`.toLowerCase();

    if (/video|film|animat|remotion|clip|caption|audio|voice|speech|配音|视频|动画|分镜|字幕/.test(hay)) {
      return {
        input: `用「${dispName}」处理一段 15 秒的测试素材，按流程跑通「${firstStep}」到「${lastStep}」并输出预览`,
        before: `仅输出零散文字脚本或粗糙参数，缺少「${firstStep}」把关，容易出现音画不同步或排版错位。`,
        after: `严格遵循「${chain}」标准流水线，完成时间轴对齐与质量核验，直接产出可播放的规范成品。`,
      };
    }
    if (/review|bug|debug|test|tdd|qc|security|audit|diagnos|fix|conflict|审查|测试|缺陷|诊断|冲突|安全/.test(hay)) {
      return {
        input: `针对当前改动或最小复现用例运行「${dispName}」，完成「${firstStep}」并输出验证结论`,
        before: `凭直觉扫一眼代码直接猜结论，跳过「${firstStep}」与边界验证，极易漏掉深层隐患。`,
        after: `按「${chain}」闭环排查${decNode ? `，通过「${decNode.title}」严格把关` : ''}，给出带根因证据的可验证修复方案。`,
      };
    }
    if (/doc|pdf|ppt|slide|xls|sheet|excel|report|memo|article|write|readme|changelog|文档|报告|周报|文章|表格|演示/.test(hay)) {
      return {
        input: `给出一份 3 条要点的测试提纲，用「${dispName}」生成排版规范的成品文件`,
        before: `直接生成一段纯文本大纲，格式简陋、层级混乱，还需要人工花大量时间重新排版。`,
        after: `经过「${chain}」规范化处理，自动套用专业版式、结构层级与校验规则，输出可直接交付的文档。`,
      };
    }
    if (/design|ui|frontend|figma|3d|image|photo|chibi|sticker|style|glass|map|scene|设计|前端|界面|照片|图像|三维|建模/.test(hay)) {
      return {
        input: `提供一张测试参考图或一句话需求，调用「${dispName}」完成从「${firstStep}」到「${lastStep}」的生成`,
        before: `直接用笼统提示词一步直出，比例失调、细节粗糙且风格前后不一致。`,
        after: `严格执行「${chain}」精修流程，统一设计令牌与空间结构，交付高还原度、高审美的视觉成品。`,
      };
    }
    if (/deploy|cloud|vercel|netlify|render|docker|mcp|server|cli|setup|config|env|插件|部署|配置|服务|接口/.test(hay)) {
      return {
        input: `在当前测试目录启用「${dispName}」，按步骤完成「${firstStep}」并跑通连通性验证`,
        before: `手动翻文档拼凑配置与命令，常因环境变量缺失、端口冲突或权限格式错误而反复报错。`,
        after: `按「${chain}」自动化完成环境预检、配置写入与端到端健康检查，确保一次跑通。`,
      };
    }
    return {
      input: `给一个最小测试任务：「用【${dispName}】跑通从“${firstStep}”到“${lastStep}”并展示结果」`,
      before: `未加载技能时仅靠通用回答一步直出，跳过「${firstStep}」等关键约束，结果笼统且不可控。`,
      after: `启用技能后严格按「${chain}」共 ${flowNodes.length || 1} 个核心步骤推进${decNode ? `，并经「${decNode.title}」校验` : ''}，产出标准可复现结果。`,
    };
  }

  function renderTestCaseCard(s, sp) {
    const tc = buildSkillTestCase(s, sp);
    return `
      <div class="tc-card">
        <div class="tc-head">
          <span class="tc-title">${iconSvg('sparkles', 14)}<span>${t('tc.title')}</span></span>
          <button class="tc-copy" type="button" data-copy-prompt="${esc(tc.input)}">${iconSvg('clipboard-copy', 12)}<span>${t('tc.copy')}</span></button>
        </div>
        <div class="tc-prompt">${esc(tc.input)}</div>
        <div class="tc-diff">
          <div class="tc-box tc-before">
            <div class="tc-tag">${t('tc.before')}</div>
            <p>${esc(tc.before)}</p>
          </div>
          <div class="tc-box tc-after">
            <div class="tc-tag">${t('tc.after')}</div>
            <p>${esc(tc.after)}</p>
          </div>
        </div>
      </div>`;
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
        ${isRef && n.path ? `<dl class="kv"><dt>${t('detail.path')}</dt><dd>${esc(zhPathText(n.path, s))}</dd></dl>` : ''}
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
    const dispName = skillDisplayName(s);
    const dispPath = zhPathText(s.full || s.path || t('detail.pasted'), s);
    el.innerHTML = `
      <h3>${esc(sp.title || dispName)}</h3>
      <div class="meta"><span class="badge ${sp.source === 'auto' ? '' : 'flow'}">${srcName}</span><span>${esc(groupName(s))}</span></div>
      ${renderTestCaseCard(s, sp)}
      <div class="md"><p>${esc(listDesc(s) || sp.description || t('detail.noDesc'))}</p></div>
      <div class="stats">
        <div class="stat"><b>${sp.lanes.length}</b><span>${t('detail.lanes')}</span></div>
        <div class="stat"><b>${sp.lanes.filter(l => l.kind === 'flow' || l.kind === 'bare').reduce((a, l) => a + l.nodes.length, 0)}</b><span>${t('detail.steps')}</span></div>
        <div class="stat"><b>${sp.edges.length + (sp.stubs || []).length}</b><span>${t('detail.edges')}</span></div>
      </div>
      ${warnings.length ? `<div class="section-title">${t('detail.notes')}</div>${warnings.map(w => `<div class="warn">${esc(w)}</div>`).join('')}` : ''}
      <div class="section-title">${t('detail.file')}</div>
      <dl class="kv"><dt>${t('detail.name')}</dt><dd>${esc(dispName)}</dd><dt>${t('detail.path')}</dt><dd>${esc(dispPath)}</dd>${s.url ? `<dt>${t('detail.source')}</dt><dd><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\/github\.com\//, ''))}</a></dd>` : ''}${s.alsoIn && s.alsoIn.length ? `<dt>${t('detail.alsoIn')}</dt><dd>${esc(s.alsoIn.map(whereName).join(t('list.sep')))}</dd>` : ''}${extra.map(k => `<dt>${esc(state.lang === 'zh' ? (ZH_FM_KEYS[k] || k) : k)}</dt><dd>${esc(Array.isArray(fm[k]) ? fm[k].join(', ') : fm[k])}</dd>`).join('')}</dl>
      ${s.files && s.files.length ? `<div class="section-title">${t('detail.files', s.files.length)}</div><div class="files">${s.files.slice(0, 40).map(f => esc(zhFileItem(f))).join('<br>')}${s.files.length > 40 ? '<br>…' : ''}</div>` : ''}
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
<html lang="${state.lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title || spec.name)} · ${t('app.title')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500&amp;family=Noto+Sans+SC:wght@400;500;700;800&amp;display=swap">
<style>
html,body{margin:0;background:${{ blueprint: '#041626', dark: '#06080c', light: '#e0daf3' }[state.theme]};background-image:linear-gradient(color-mix(in srgb, ${P.text3} 6%, transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb, ${P.text3} 6%, transparent) 1px,transparent 1px);background-size:40px 40px}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sv-cam{transform-origin:50% 50%;box-shadow:0 30px 80px ${state.theme === 'light' ? 'rgba(80,60,140,.22)' : 'rgba(0,0,0,.45)'};width:min(100vw, ${state.G.W}px, calc(100vh * ${state.G.W / state.G.H}))}
#stage svg{display:block;width:100%;height:auto}
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
    ['400 14px', '500 14px', '700 18px', '800 40px'].forEach(function (w) { jobs.push(document.fonts.load(w + ' "Noto Sans SC"', text), document.fonts.load(w + ' Inter', text)); });
    jobs.push(document.fonts.load('500 11px "JetBrains Mono"', text));
    await Promise.race([Promise.all(jobs).catch(function () {}), new Promise(function (r) { setTimeout(r, 6000); })]);
  }
  var G = SV.layout(spec, { cols: ${state.cols} });
  var stage = document.getElementById('stage');
  stage.innerHTML = '<div class="sv-cam">' + SV.render.toSVG(G, { theme: '${state.theme}' }) + '</div>';
  var query = new URLSearchParams(location.search), recording = query.has('record');
  var motion = recording ? (query.get('motion') === 'flat' || query.get('motion') === 'minimal' ? 'flat' : '3d') : '${state.motion}';
  var cam = stage.querySelector('.sv-cam');
  var p = SV.render.createPlayer(stage.querySelector('svg'), G, { loop: !recording, reducedMotion: motion === 'minimal', camera: { el: cam, strength: motion === '3d' ? 1 : 0 } });
  function resizeCamera() { p.setCamera({ width: cam.clientWidth || G.W, height: cam.clientHeight || G.H }); }
  resizeCamera();
  window.addEventListener('resize', resizeCamera);
  if (window.ResizeObserver) new ResizeObserver(resizeCamera).observe(cam);
  stage.addEventListener('click', function () { p.toggle(); });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { p.toggle(); e.preventDefault(); }
    if (e.key === 'ArrowRight') p.next();
    if (e.key === 'ArrowLeft') p.prev();
  });
  var round0 = p.tour ? p.tour.segs.filter(function (s) { return s.round === 0; }).pop() : null;
  window.SVRec = { info: function () { return { W: G.W, H: G.H, duration: p.intro + p.duration, round0: p.intro + (round0 ? round0.t1 : p.duration) }; }, seek: function (t) { p.pause(); p.seek(t); } };
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
        body: JSON.stringify({ name: safeName(state.spec.name), html: standaloneHtml(), motion: state.motion === 'minimal' ? 'flat' : state.motion, seconds: secs ? +secs : null }),
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
    $('#selMotion').value = state.motion;
    $('#selMotion').onchange = e => setMotion(e.target.value);
    $('#selTheme').onchange = e => {
      state.theme = e.target.value;
      store.set('theme3', state.theme);
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
      const cp = e.target.closest('[data-copy-prompt]');
      if (cp) { copy(cp.dataset.copyPrompt); toast(t('tc.copied')); return; }
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
      if (!pan.moved && Math.hypot(dx, dy) > 4) {
        pan.moved = true; state.panning = true; stage.classList.add('panning');
        state.player && state.player.setCamera({ strength: 0, ease: true, onSettled() { if (pan) pan.flat = true; } });
      }
      if (pan.moved && pan.flat) { stage.scrollLeft = pan.sl - dx; stage.scrollTop = pan.st - dy; }
    });
    window.addEventListener('mouseup', e => {
      if (!pan) return;
      const moved = pan.moved;
      pan = null;
      state.panning = false;
      if (moved && state.player) state.player.setCamera({ strength: cameraStrength(), ease: true });
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
      else if (e.key === 'd' || e.key === 'D') setMotion(state.motion === '3d' ? 'flat' : '3d');
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
      const round0 = () => { const p = state.player; const r = p && p.tour ? p.tour.segs.filter(s => s.round === 0).pop() : null; return p.intro + (r ? r.t1 : p.duration); };
      window.SVRec = {
        info: () => ({ W: state.G.W, H: state.G.H, duration: state.player.intro + state.player.duration, round0: round0(), name: state.spec.name }),
        seek: t => { state.player.pause(); state.player.seek(t); },
      };
    }
  }
  boot();
})();
