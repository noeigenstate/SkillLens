/* SKILL.md → 流程图规格（spec）。有 ```skillflow 块就按块来，否则启发式提取 */
SV.mod.extract = function (SV) {
  const md = SV.md;
  const CJK = /[⺀-鿿豈-﫿　-〿＀-￯]/;

  const units = s => { let u = 0; for (const ch of String(s)) u += CJK.test(ch) ? 2 : 1; return u; };
  const cjkRatio = s => {
    const t = String(s).replace(/[\s\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]/g, '');
    if (!t) return 0;
    let n = 0;
    for (const ch of t) if (CJK.test(ch)) n++;
    return n / t.length;
  };

  /* 拼接用的冒号、分号跟随被拼接文字：有汉字用全角，否则半角，避免英文里冒出「：」「；」 */
  const hasHan = s => /[㐀-鿿豈-﫿]/.test(String(s));
  const colonFor = s => hasHan(s) ? '：' : ': ';
  const joinFor = (parts, zh, en) => parts.join(parts.some(hasHan) ? zh : en);

  /* 按显示宽度截断，拉丁文尽量停在词边界 */
  function cut(s, max) {
    s = String(s || '').trim();
    if (units(s) <= max) return s;
    let u = 0, out = '';
    for (const ch of s) {
      const w = CJK.test(ch) ? 2 : 1;
      if (u + w > max - 1) break;
      out += ch;
      u += w;
    }
    if (!CJK.test(out.slice(-1))) {
      const m = out.match(/^(.*\S)\s+\S*$/);
      if (m && units(m[1]) > max * 0.55) out = m[1];
    }
    return out.replace(/[\s,，、;；:：(（\[\-–—/]+$/, '') + '…';
  }

  const firstSentence = s => {
    const m = String(s || '').match(/^(.+?)(?:[。！？!?；;]|\.(?=\s|$)|$)/);
    return m ? m[1].trim() : '';
  };

  const NUM_RE = /^\s*(?:(?:step|phase|stage|part)\s*\d+(?:\.\d+)*\s*[:：.)\-–—]?\s*|第\s*[0-9一二三四五六七八九十]+\s*[步章节阶段部分]\s*[:：.、\-–—]?\s*|\d{1,2}(?:\.\d+)*(?:\s*[.)、:：]\s*|\s+(?=\S)))/i;
  const stripNum = t => { const s = t.replace(NUM_RE, '').trim(); return s || t; };
  const numTextOf = t => {
    const m = String(t).match(/^\s*(?:(?:step|phase|stage|part)\s*(\d+(?:\.\d+)*)|第\s*([0-9一二三四五六七八九十]+)|(\d{1,2}(?:\.\d+)*))/i);
    if (!m) return null;
    return m[1] || m[3] || String(cnNum(m[2]));
  };
  const numOf = t => { const n = numTextOf(t); return n == null ? null : cnNum(n.split('.')[0]); };
  function cnNum(s) {
    if (/^\d+$/.test(s)) return +s;
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    if (s.length === 1) return map[s] || null;
    if (s[0] === '十') return 10 + (map[s[1]] || 0);
    if (s[1] === '十') return map[s[0]] * 10 + (map[s[2]] || 0);
    return null;
  }

  /* 参考表里的步骤编号：小节保留原样，整数区间展开 */
  function stepRefs(text) {
    const n = '\\d+(?:\\.\\d+)*', span = n + '(?:\\s*(?:[-–—]|to)\\s*' + n + ')?';
    const list = span + '(?:\\s*(?:,\\s*(?:and\\s+)?|and\\s+|&|、)\\s*' + span + ')*';
    const re = new RegExp('\\b(?:steps?|phase)\\s*(' + list + ')|第\\s*(' + list + ')\\s*步|步骤\\s*(' + list + ')', 'gi');
    const out = [];
    for (const m of text.matchAll(re)) {
      const parts = (m[1] || m[2] || m[3]).match(new RegExp(span, 'gi')) || [];
      parts.forEach(p => {
        const range = p.match(/^(\d+)\s*(?:[-–—]|to)\s*(\d+)$/i);
        if (range) { for (let i = +range[1]; i <= +range[2]; i++) out.push(String(i)); }
        else out.push(p.trim());
      });
    }
    return [...new Set(out)];
  }

  const RE_TRIGGER = /(when (not )?to use|use this skill|何时(不)?(使用|用)|什么时候|触发|适用(场景|范围)?|使用场景|trigger)/i;
  const RE_NOT = /\b(?:not|don'?t)\b|不|别/i;
  const RE_BACKGROUND = /^(?:when\s+not\s+to\s+use\b|limitations?\b|modes?\b|costs?\b|budget\b|cach(?:e|ing)\b|performance\b|troubleshoot\w*\b|faq\b|notes?\b|注意|限制|成本|预算|缓存|性能|常见问题|故障排查|何时不用|不适用|不宜使用)/i;
  const RE_ROUTER = /^(?:which\b|choosing\b|when to use which\b|选择|用哪个)/i;
  const RE_ALTERNATIVE = /^(recipe|option|approach|strategy|method|variant|alternative|pattern)\b|^(方案|方法|做法|选项|模式)/i;
  const RE_RULES = /(rules?\b|规则|注意|须知|notes?\b|gotchas?|pitfalls?|caveats?|坑|warnings?|caution|don'?ts?\b|never|禁止|红线|safety|安全|important|重要|tips?\b|提示|principles?|原则|constraints?|约束|guardrails?|best practices?|最佳实践|anti-?patterns?|mistakes|常见错误|守则|要点|铁律)/i;
  const RE_REF = /(reference|参考|appendix|附录|examples?|示例|例子|faq|troubleshoot|排错|排查|background|背景|overview|概述|概览|简介|about|关于|files?\b|文件|structure|结构|目录|\bapi\b|options?|选项|parameters?|参数|config(uration)?|glossary|术语|resources?|资源|links?\b|链接|see also|另见|related|相关|license|credits?|致谢|分工|scope|另一条路|alternatives?|备选|清单|checklist|cheat ?sheet|速查|terminology|concepts?|概念|your role|角色|what is|是什么)/i;
  const RE_FLOW = /(workflow|流程|步骤|steps?\b|process|procedure|pipeline|phases?|stages?|阶段|how to|usage|用法|怎么|如何|quick ?start|快速|getting started|开始|instructions?|做法|方法|run(ning)?\b|运行|执行|build|构建|create|创建|generat|生成|deliver|交付|收尾|之后|交回|review|检查|验收|verify|验证|install|安装|set ?up|publish|发布|output|输出|route|路由|enter|进入|start|启动|plan|规划|draft|起草|write|撰写|edit|编辑|test|测试|debug|调试|fix|修复|export|导出|render|渲染|import|导入|launch|循环|loop|iterate|迭代|对照|还原|命令|commands?|load|加载|resolve|choose|select|选择|decide|判断|ask|询问|confirm|确认|collect|收集|gather|search|搜索|research|调研|analy|分析|compose|合成|record|录制|capture|save|保存|send|发送|share|分享|deploy|部署|update|更新|clean|清理|handoff|交接|finish|完成)/i;
  const RE_STRONG_FLOW = /(workflow|流程|步骤|steps?\b|process|procedure|pipeline|做法)/i;
  const RE_COND = /^(?:if|when|whether|unless|in case|is there|are there|does|do|has|have|can|should|如果|若|假如|要是|是否|有没有|当|一旦|万一|没有|如)\b|^(?:如果|若|假如|要是|是否|有没有|一旦|万一)/i;
  const RE_OPT = /^\s*[\[(（【]\s*(?:if necessary|if needed|optional|if absolutely necessary|可选|按需|必要时|如有必要)[^\])）】]*[\])）】]\s*/i;
  const RE_TABLE_COND = /(state|condition|\bif\b|when|case|situation|scenario|input|request|signal|情况|条件|状态|场景|输入|请求|信号)/i;
  const RE_TABLE_ACT = /(action|\bdo\b|route|then|use|skill|workflow|result|go to|处理|动作|做法|路由|去向|结果|用|操作|执行)/i;

  const ICON_RULES = [
    ['bot', /agent|codex|claude|\bai\b|\bllm\b|delegate|委托|交给|\bgpt/i],
    ['bug', /\bbug|debug|调试|排错|报错|\berror|故障/i],
    ['git-pull-request', /pull request|\bPRs?\b|合并请求/i],
    ['git-branch', /\bgit\b|branch|分支|worktree|commit|提交/i],
    ['search', /search|\bfind\b|look ?up|查找|搜索|检索|调研|research|explore|探索|\bgrep\b|定位/i],
    ['scan-eye', /review|审查|审阅|对照|compare|比对|核对|inspect|检视/i],
    ['circle-check', /verify|验证|验收|\bcheck|检查|确认|confirm|\btest|测试|\bpass\b|通过|\bdone\b|完成/i],
    ['eye', /preview|预览|\bview\b|查看|看一遍|观察|\bshow\b|展示/i],
    ['terminal', /command|命令|\bcli\b|bash|shell|powershell|\bnpm\b|\bnpx\b|python|script|脚本|\bexec\b|运行|\brun\b|执行/i],
    ['download', /install|安装|download|下载|\bfetch\b|拉取/i],
    ['settings', /config|配置|设置|settings?|set ?up|环境|\benv\b/i],
    ['message-square', /\bask\b|询问|follow.?up|clarif|追问|\buser\b|用户|reply|回复|\bchat\b|对话|comment|评论|feedback|反馈/i],
    ['file-text', /write|撰写|写|draft|起草|\bdoc\b|文档|report|报告|markdown|readme|描述|说明|summary|总结/i],
    ['wrench', /\bfix\b|修复|repair|修|patch|补丁/i],
    ['pencil', /\bedit|编辑|修改|改|modify|update|更新|tweak|调整|refine|润色/i],
    ['image', /image|图片|出图|picture|photo|\bpng\b|jpe?g|illustrat|插画|原画|concept|三视图/i],
    ['film', /video|视频|render|渲染|animation|动画|\bclip|剪辑|movie|footage/i],
    ['mic', /voice|配音|narrat|旁白|\btts\b|speech|录音/i],
    ['music', /audio|音频|music|音乐|sound|声音|\bbgm\b|\bsfx\b/i],
    ['palette', /design|设计|color|配色|颜色|\bstyle|风格|theme|主题|visual|视觉|brand|品牌/i],
    ['box', /model|模型|建模|\b3d\b|blender|mesh|网格/i],
    ['package', /build|构建|package|打包|bundle|compile|编译|export|导出/i],
    ['send', /publish|发布|deliver|交付|\bsend\b|发送|share|分享|\bpost\b|推送|\bpush\b|deploy|部署|上线|汇报|给用户/i],
    ['list-checks', /checklist|清单|\btodo|待办|\blist\b|列表|\bplan\b|计划|规划|outline|大纲|storyboard|分镜|decompos|拆解/i],
    ['route', /route|路由|routing|dispatch|分发|选择|choose|select|\bpick\b|decide|决定|判断/i],
    ['shield-check', /\brules?\b|规则|safe|安全|permission|权限|secur|guard|保护|never|禁止|不要|\bmust\b|必须/i],
    ['book-open', /reference|参考|\bread\b|阅读|读|learn|学习|guide|指南|manual|手册|\bdocs\b/i],
    ['database', /\bdata\b|数据|\bstore|存储|memory|记忆|cache|缓存|\bsave\b|保存|\bdb\b|database|ledger|记录/i],
    ['globe', /\bweb\b|browser|浏览器|\burl\b|\bsite\b|网站|网页|https?:|\bpage\b|页面/i],
    ['folder', /\bfiles?\b|文件|folder|目录|director|project|项目|\brepo\b|仓库|\bpath\b|路径/i],
    ['table', /\btable\b|表格|spreadsheet|xlsx|\bcsv\b|excel/i],
    ['presentation', /slide|幻灯|\bppt|\bdeck\b|演示/i],
    ['clock', /\bwait|等待|schedule|定时|\bcron\b|\btime\b|时间|timer|delay|延迟/i],
    ['refresh-cw', /repeat|重复|\bloop|循环|iterate|迭代|\bagain\b|再次|retry|重试|回到/i],
    ['sparkles', /generat|生成|create|创建|\bnew\b|新建|\bmake\b|制作|compose|合成/i],
    ['layers', /layer|图层|structure|结构|stack|叠/i],
    ['cpu', /server|服务器|\bgpu\b|compute|算力|\bdgx\b|cluster|集群|comfyui/i],
    ['link', /\blink|链接|connect|连接|integrat|接入|接进|\bhook/i],
    ['upload', /upload|上传|import|导入/i],
    ['zap', /trigger|触发|event|事件|webhook|快速|quick|\bfast\b/i],
    ['puzzle', /plugin|插件|\bskills?\b|技能|extension|扩展/i],
    ['type', /\btext\b|文字|\bfont|字体|caption|字幕|title|标题|typograph/i],
    ['monitor', /screen|屏幕|desktop|桌面|\bapp\b|应用|window|窗口|\bui\b|界面/i],
    ['key', /\bkey\b|密钥|token|\bauth|登录|login|credential|凭据|account|账号/i],
    ['users', /\bteam|团队|分工|\brole|角色|collab|协作|subagent/i],
    ['lightbulb', /\bidea|想法|\btips?\b|insight|\bwhy\b|原因|思路|principle|原则/i],
  ];
  function pickIcon(title, rest, fallback) {
    for (const src of [title, rest]) {
      if (!src) continue;
      for (const [icon, re] of ICON_RULES) if (re.test(src)) return icon;
    }
    return fallback;
  }

  const firstCode = s => { const m = String(s || '').match(/`([^`\n]{1,40})`/); return m ? m[1].trim() : ''; };
  const pathParts = s => {
    const parts = s.split(/\s+\+\s+/);
    return parts.every(p => p && !/\s/.test(p) && (/\//.test(p) || /\.[a-z0-9]+$/i.test(p))) ? parts : null;
  };

  /* 一条文字 → 标题 + 说明 */
  function splitLead(text) {
    const t = String(text || '').trim();
    let m = t.match(/^(?:\*\*|__)([\s\S]+?)(?:\*\*|__)\s*([:：—–\-.。]?)\s*([\s\S]*)$/);
    if (m && units(md.strip(m[1])) <= 44) {
      return { title: md.strip(m[1]).replace(/[:：。.]+$/, ''), rest: md.strip(m[3]).replace(/^[，,、；;：:。.\s]+/, '') };
    }
    m = t.match(/^`([^`]{1,40})`\s*(?:[:：—–]|\s-\s)\s*([\s\S]*)$/);
    if (m) return { title: m[1], rest: md.strip(m[2]) };
    const c = md.strip(t);
    m = c.match(/^(.{1,40}?)\s*(?:[:：]\s*|\s[—–-]\s|——)\s*(.+)$/);
    if (m && units(m[1]) <= 32) return { title: m[1].trim(), rest: m[2].trim() };
    m = c.match(/^(.+?)([，,；;。！!？?]|\.(?=\s|$)|$)/);
    let title = (m ? m[1] : c).trim();
    let rest = m ? c.slice(m[0].length).trim() : '';
    if (m && /[？?]/.test(m[2])) title += '?';
    if (units(title) > 30) {
      const short = cut(title, 26).replace(/…$/, '');
      rest = (title.slice(short.length).trim() + (m && m[2] && !/[？?]/.test(m[2]) ? m[2] : '') + ' ' + rest).trim();
      title = short + '…';
    }
    return { title, rest };
  }

  function firstText(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'paragraph') return md.strip(b.text);
      if (b.type === 'list') return joinFor(b.items.slice(0, 3).map(it => md.strip(it.text)), '；', '; ');
      if (b.type === 'table') return joinFor(b.rows.slice(0, 2).map(r => md.strip(r[0])), '；', '; ');
      if (b.type === 'quote') return md.strip(b.text);
    }
    return '';
  }

  function tableKind(tb) {
    if (!tb.header || tb.header.length < 2) return 'rows';
    return RE_TABLE_COND.test(md.strip(tb.header[0])) && RE_TABLE_ACT.test(md.strip(tb.header.slice(1).join(' '))) ? 'decide' : 'rows';
  }

  /* 同级且相邻才归组；步骤编号不算选项编号 */
  function alternativeLabel(title) {
    const t = md.strip(title);
    if (NUM_RE.test(t)) return '';
    const known = t.match(RE_ALTERNATIVE);
    if (known) return (known[1] || known[2]).toLowerCase();
    if (/^modes?\s*(?:[A-Z0-9]+\b|[—–:：]|\s-\s)/i.test(t)) return 'mode';
    if (RE_BACKGROUND.test(t)) return '';
    const split = t.match(/^(.{1,32}?)\s*(?:[—–:：]|\s-\s)\s*\S/);
    if (!split) return '';
    const label = split[1].replace(/\s+(?:\d+|[A-Z]|[一二三四五六七八九十]+)$/i, '').trim().toLowerCase();
    if (!/^[a-z㐀-鿿][a-z㐀-鿿\s]*$/i.test(label) || RE_REF.test(label) || RE_RULES.test(label) || RE_BACKGROUND.test(label) || /requirements?|amendments?|修订|要求/.test(label) || /^(?:step|phase|stage|part|section|turn|move|tier|tab|level|check|gate|workstream|issue|mandatory|critical|export)\b/i.test(label)) return '';
    return label;
  }

  function routerTable(section) {
    for (const b of section.blocks || []) {
      if (b.type !== 'table' || !b.rows.length) continue;
      const h = b.header.map(md.strip);
      const condition = h.findIndex(c => RE_TABLE_COND.test(c));
      if (condition < 0) continue;
      let action = h.findIndex((c, i) => i !== condition && /action|tool|approach|method|helper|use|用法|工具|做法|方法|选项/i.test(c));
      if (action < 0 && h.some(c => /returns?|结果|返回/i.test(c))) action = h.findIndex((c, i) => i !== condition && !/returns?|结果|返回/i.test(c));
      if (action >= 0) return { table: b, condition, action };
    }
    return null;
  }

  function choiceSections(sections, lead = '') {
    const out = [];
    const sequential = /(?:methods?|approaches?|options?)\s+(?:are\s+)?(?:tried|run|executed|performed)\s+in order|(?:run|execute|perform|complete)\s+(?:all|each)\s+(?:methods?|approaches?|options?)|依次执行|按顺序执行|全部执行/i.test(lead) || sections.some(s => /always\s+(?:runs?|executes?)\s+first|必须先执行/i.test(md.strip(s.title)));
    for (let i = 0; i < sections.length;) {
      const label = alternativeLabel(sections[i].title);
      let end = i + 1;
      while (label && end < sections.length && sections[end].level === sections[i].level && alternativeLabel(sections[end].title) === label) end++;
      if (label && end - i >= 2 && !sequential) {
        const previous = out[out.length - 1];
        const router = previous && previous.level === sections[i].level && !previous.choice && (RE_ROUTER.test(md.strip(previous.title)) || routerTable(previous)) ? out.pop() : null;
        out.push({ title: '', level: sections[i].level, blocks: [], subs: [], choice: { sections: sections.slice(i, end), router } });
        i = end;
      } else {
        const s = sections[i++];
        const background = RE_BACKGROUND.test(md.strip(s.title)) || RE_RULES.test(md.strip(s.title)) || /\b(?:examples?|appendix|reference)\b|示例|附录|参考/.test(md.strip(s.title).toLowerCase());
        const children = background ? [] : md.sectionize(s.blocks).sections;
        const nested = children.length ? choiceSections(children, md.blocksToText(s.lead || [])) : [];
        if (nested.some(c => c.choice)) {
          // 有选择的父节展开为片段，保留前置说明和后续步骤。
          if ((s.lead || []).length) out.push({ ...s, blocks: s.lead, subs: [] });
          out.push(...nested);
        } else out.push(s);
      }
    }
    return out;
  }

  /* 章节里能当节点的条目 */
  function sectionItems(sec) {
    if (sec.subs && sec.subs.length >= 2) {
      return { kind: 'subs', ordered: true, items: sec.subs.map(s => ({ kind: 'sub', title: s.title, blocks: s.blocks, number: numOf(md.strip(s.title)) })) };
    }
    const blocks = sec.blocks;
    for (const b of blocks) {
      if (b.type === 'list' && b.ordered && b.items.length >= 2) {
        return { kind: 'ol', ordered: true, items: b.items.map(it => ({ kind: 'item', text: it.text, blocks: it.blocks, number: it.number })) };
      }
      if (b.type === 'table' && b.rows.length >= 2) {
        const tk = tableKind(b);
        return { kind: tk === 'decide' ? 'decide' : 'table', ordered: tk === 'decide', header: b.header, items: b.rows.map(r => ({ kind: tk === 'decide' ? 'rule' : 'row', cells: r, header: b.header })) };
      }
      if (b.type === 'list' && !b.ordered && b.items.length >= 2) {
        return { kind: 'ul', ordered: false, items: b.items.map(it => ({ kind: 'item', text: it.text, blocks: it.blocks })) };
      }
    }
    return { kind: 'none', ordered: false, items: [] };
  }

  function makeAuto(fm, body, opts) {
    const blocks = md.parseBlocks(body);
    const doc = md.sectionize(blocks);
    const data = fm.data || {};
    const name = String(data.name || opts.fallbackName || 'skill');
    const desc = md.strip(Array.isArray(data.description) ? data.description.join(' ') : (data.description || ''));
    const zh = cjkRatio(desc + ' ' + body.slice(0, 4000)) > 0.12;
    /* 生成的标签跟随界面语言；「直到 / until」引用的是原文，跟随原文语言 */
    const T = (k, ...a) => SV.i18n.t(k, ...a);
    const L = {
      trigger: T('x.trigger'), flow: T('x.flow'), ref: T('x.ref'), rules: T('x.rules'), more: n => T('x.more', n),
      steps: n => T('x.steps', n), stages: n => T('x.stages', n), items: n => T('x.items', n), optional: T('x.optional'),
      notUse: T('x.notUse'), back: n => T('x.back', n), body: T('x.body'), until: zh ? '直到' : 'until',
    };

    let seq = 0;
    const nid = () => 'n' + (++seq);
    const lanes = [];
    const edges = [];
    const reads = [];
    const refSteps = new Map();
    const stubs = [];
    const notes = [];
    let triggerText = '';
    let triggerDetail = '';

    /* 条目 → 节点 */
    function nodeFrom(item, ctx) {
      let title, rest, detail, tag = '', number = item.number == null ? null : item.number, raw = '';
      if (item.kind === 'sub') {
        const plain = md.strip(item.title);
        title = stripNum(plain);
        rest = firstText(item.blocks);
        detail = '### ' + item.title + '\n\n' + md.blocksToMd(item.blocks);
        raw = plain + ' ' + md.blocksToText(item.blocks);
        if (number == null) number = numOf(plain);
      } else if (item.kind === 'row' || item.kind === 'rule') {
        const cells = item.cells.map(c => md.strip(c));
        title = cells[0] || '';
        rest = cells.slice(1).filter(Boolean).join(' · ');
        detail = item.header.map((h, i) => `**${md.strip(h)}**${colonFor(h + (item.cells[i] || ''))}${item.cells[i] || ''}`).join('\n\n');
        raw = cells.join(' ');
        tag = firstCode(item.cells[0]);
      } else if (item.kind === 'section') {
        const plain = md.strip(item.title);
        title = stripNum(plain);
        rest = firstText(item.blocks);
        detail = '## ' + item.title + '\n\n' + md.blocksToMd(item.blocks);
        raw = plain + ' ' + md.blocksToText(item.blocks);
        if (number == null) number = numOf(plain);
      } else {
        const plain = md.strip(item.text);
        const lead = ctx.kind === 'ref' && plain.match(/^(\S+(?:\s+\+\s+\S+)*?)\s*[:：]\s+([\s\S]*)$/);
        const sl = ctx.kind === 'ref' && pathParts(plain) ? { title: plain, rest: '' } : lead && pathParts(lead[1]) ? { title: lead[1], rest: lead[2] } : splitLead(item.text);
        title = sl.title;
        rest = sl.rest;
        detail = item.text + (item.blocks && item.blocks.length ? '\n\n' + md.blocksToMd(item.blocks) : '');
        raw = md.strip(item.text) + ' ' + md.blocksToText(item.blocks);
        tag = firstCode(item.text);
        if (!rest && item.blocks) rest = firstText(item.blocks);
      }
      let optional = false;
      if (RE_OPT.test(title)) { optional = true; title = title.replace(RE_OPT, '').trim(); }
      if (/[(（](optional|可选)[)）]/i.test(title)) { optional = true; title = title.replace(/\s*[(（](optional|可选)[)）]/i, '').trim(); }
      const node = { id: nid(), type: 'step', title, lines: rest, tag: '', icon: '', detail, number, optional };
      if (ctx.kind === 'flow') node.numText = item.kind === 'sub' || item.kind === 'section' ? numTextOf(md.strip(item.title)) : number == null ? null : String(number);
      if (tag && units(tag) <= 18 && tag !== title) node.tag = tag;
      else if (optional) node.tag = L.optional;
      else if (ctx.ordered && number != null && ctx.kind !== 'ref') node.tag = T('x.stepTag', number);
      if (optional && node.tag !== L.optional) node.tag = L.optional;
      if (ctx.kind === 'ref') {
        const steps = stepRefs(title + '\n' + rest);
        refSteps.set(node.id, steps);
        const paths = pathParts(title);
        if (paths) {
          node.path = title;
          node.title = paths.map(p => p.replace(/\/$/, '').split('/').pop() + (p.endsWith('/') ? '/' : '')).join(' + ');
        }
        if (steps.length) {
          node.lines = rest.replace(/^\s*(?:Step\s*\d+(?:\.\d+)*(?:\s*(?:[-–—]|to)\s*\d+(?:\.\d+)*)?|第\s*\d+(?:\.\d+)*(?:\s*[-–—]\s*\d+)?\s*步)\s*[:：]\s*/i, '');
        }
      }
      node.icon = pickIcon(title, rest, ctx.kind === 'ref' ? 'book-open' : 'circle-dot');

      if (item.kind === 'rule' || (ctx.kind !== 'ref' && RE_COND.test(title))) {
        node.type = 'decision';
        let q = title.replace(/^(?:if|when|whether|unless|in case|如果|若|假如|要是|当|一旦|万一)\s*/i, '').replace(/[?？…]+$/, '').trim();
        if (item.kind === 'rule') q = title.replace(/[?？]+$/, '');
        node.title = (q || title) + '?';
        node.icon = '';
        const act = item.kind === 'rule' ? rest : firstSentence(rest);
        if (act) node.stub = act;
        node.lines = '';
      }

      const loop = raw.match(/(?:回到|返回|回|重复|重新执行|再做)\s*第\s*([0-9一二三四五六七八九十]+)\s*步|(?:go(?:ing)?|loop|jump|return|come)\s+back\s+to\s+step\s*(\d+)|(?:repeat|restart)\s+(?:from\s+)?step\s*(\d+)|back to step\s*(\d+)/i);
      const until = raw.match(/(?:直到|until)\s*([^，,。.;；\n]{2,40})/i);
      const untilLabel = until ? L.until + (zh ? '' : ' ') + until[1].trim() : '';
      if (loop) node.loopTo = { number: cnNum(loop[1] || loop[2] || loop[3] || loop[4]), label: untilLabel || L.back(cnNum(loop[1] || loop[2] || loop[3] || loop[4])) };
      else if (until && /(重复|循环|反复|迭代|repeat|iterate|loop|again)/i.test(raw)) node.loopTo = { number: null, label: untilLabel };
      return node;
    }

    function capNodes(nodes, ctx) {
      const MAX = 8;
      if (opts.cap === false) return nodes;
      if (nodes.length <= MAX) return nodes;
      const keep = nodes.slice(0, MAX - 1);
      const rest = nodes.slice(MAX - 1);
      keep.push({
        id: nid(), type: 'step', title: L.more(rest.length), tag: '', icon: 'list',
        lines: rest.map(n => n.title).join(' · '),
        detail: rest.map(n => n.detail).join('\n\n---\n\n'), more: true,
      });
      const more = keep[keep.length - 1];
      if (ctx.kind === 'flow') more.numText = null;
      if (ctx.kind === 'ref') {
        const steps = [...new Set(rest.flatMap(n => refSteps.get(n.id) || []))];
        refSteps.set(more.id, steps);
      }
      return keep;
    }

    /* —— 章节分类 —— */
    const secs = choiceSections(doc.sections, md.blocksToText(doc.intro)).map(s => {
      const plain = md.strip(s.title);
      const numbered = NUM_RE.test(plain) && numOf(plain) != null;
      const title = stripNum(plain);
      const its = sectionItems(s);
      let cls;
      if (s.choice) cls = 'flow';
      else if (RE_TRIGGER.test(title)) cls = RE_NOT.test(title) ? 'notuse' : 'trigger';
      else if (RE_BACKGROUND.test(title)) cls = 'ref';
      else if (RE_RULES.test(title) && !numbered) cls = 'rules';
      else if (numbered) cls = 'flow';
      else if (RE_REF.test(title)) cls = 'ref';
      else if (RE_FLOW.test(title)) cls = 'flow';
      else cls = its.ordered ? 'flow' : 'unknown';
      return { s, title, cls, its, numbered };
    });
    if (!secs.some(x => x.cls === 'flow')) secs.forEach(x => { if (x.cls === 'unknown') x.cls = 'flow'; });
    secs.forEach(x => { if (x.cls === 'unknown') x.cls = 'ref'; });

    /* 没有任何章节：正文本身当一个章节 */
    if (!secs.length) {
      const its = sectionItems({ blocks: doc.intro, subs: [] });
      secs.push({ s: { title: doc.title || name, blocks: doc.intro, subs: [] }, title: md.strip(doc.title || L.body), cls: 'flow', its, numbered: false });
    }

    /* —— 触发节点 —— */
    for (const x of secs.filter(x => x.cls === 'trigger')) {
      triggerText = triggerText || firstText(x.s.blocks.concat(...x.s.subs.map(s => s.blocks)));
      triggerDetail += '## ' + x.s.title + '\n\n' + md.blocksToMd(x.s.blocks) + '\n\n';
    }
    for (const x of secs.filter(x => x.cls === 'notuse')) {
      const its = x.its.items.length ? x.its.items : [{ kind: 'item', text: firstText(x.s.blocks), blocks: [] }];
      its.slice(0, 3).forEach(it => notes.push({ text: L.notUse + md.strip(it.text || (it.cells || []).join(' · ')), detail: md.blocksToMd(x.s.blocks) }));
    }
    if (!triggerText && desc) {
      const m = desc.match(/(?:use (?:this skill )?(?:when|whenever)\b|use (?:this skill )?for\b|trigger(?:s)? (?:on|when)\b|凡是|遇到|用于|适用于)[^.。;；]*/i);
      triggerText = m ? m[0] : firstSentence(desc);
    }

    /* —— 流程泳道 —— */
    const COLORS = ['green', 'blue', 'purple', 'teal', 'rose', 'amber'];
    let colorIdx = 0;
    let singles = null;
    const sourceOfSection = s => '#'.repeat(s.level || 2) + ' ' + s.title + '\n\n' + md.blocksToMd(s.blocks);
    const sectionSource = x => sourceOfSection(x.s);
    function choiceLane(choice) {
      const { sections, router } = choice;
      const alternatives = sections.map(s => {
        const node = nodeFrom({ kind: 'section', title: s.title, blocks: s.blocks }, { kind: 'ref' });
        node.type = 'step';
        node.alternative = true;
        node.detail = sourceOfSection(s);
        delete node.stub;
        delete node.loopTo;
        return node;
      });
      const table = router && routerTable(router);
      const nodes = [], links = [], exits = [];
      if (table) {
        const { table: tb, condition, action } = table;
        // 优先用代码中的首个工具调用匹配路由，避免正文提及别的做法时串线。
        const calls = s => [...String(s).matchAll(/([a-zA-Z_]\w*)\s*\(/g)].map(m => m[1]);
        const tools = new Set(tb.rows.flatMap(r => calls(r[action])));
        const params = s => [...String(s).matchAll(/(\w+)\s*=\s*["']([^"']+)["']/g)].map(m => m[1] + '=' + m[2]);
        const signatures = sections.map(s => {
          const code = s.blocks.find(b => b.type === 'code');
          const raw = code ? code.text.replace(/^\s*#.*$/gm, '') : md.blocksToMd(s.blocks);
          return { primary: calls(raw).find(c => tools.has(c)), params: params(raw), text: md.strip(s.title + ' ' + raw).toLowerCase() };
        });
        const covered = new Set();
        tb.rows.forEach(row => {
          const target = row[action], helper = calls(target)[0], args = params(target);
          const scores = signatures.map(sig => {
            if (helper) return sig.primary === helper ? 10 + args.reduce((n, p) => n + (sig.params.includes(p) ? 4 : -4), 0) : 0;
            const text = md.strip(target).toLowerCase();
            return text && sig.text.includes(text) ? 10 + text.length : 0;
          });
          const best = Math.max(...scores), matches = scores.map((v, i) => v === best && v > 0 ? i : -1).filter(i => i >= 0);
          const targetIndex = matches.length === 1 ? matches[0] : -1;
          const decision = { id: nid(), type: 'decision', title: md.strip(row[condition]).replace(/[?？]+$/, '') + '?', lines: '', icon: '', tag: '', detail: sourceOfSection(router) };
          nodes.push(decision);
          if (targetIndex >= 0) {
            covered.add(targetIndex);
            links.push({ from: decision.id, to: alternatives[targetIndex].id, kind: 'flow', label: 'Yes' });
          } else stubs.push({ from: decision.id, text: md.strip(target), label: 'Yes' });
        });
        nodes.forEach((n, i) => { if (nodes[i + 1]) links.push({ from: n.id, to: nodes[i + 1].id, kind: 'flow', label: 'No' }); });
        const remaining = alternatives.filter((n, i) => !covered.has(i));
        if (remaining.length) {
          const pick = { id: nid(), type: 'decision', title: T('x.whichApproach'), lines: '', tag: '', icon: '', detail: sections.map(sourceOfSection).join('\n\n') };
          links.push({ from: nodes[nodes.length - 1].id, to: pick.id, kind: 'flow', label: 'No' });
          nodes.push(pick);
          remaining.forEach(n => links.push({ from: pick.id, to: n.id, kind: 'flow', label: n.title }));
        } else exits.push({ id: nodes[nodes.length - 1].id, label: 'No' });
      } else {
        const pick = { id: nid(), type: 'decision', title: T('x.whichApproach'), lines: '', tag: '', icon: '', detail: router ? sourceOfSection(router) : sections.map(sourceOfSection).join('\n\n') };
        nodes.push(pick);
        alternatives.forEach(n => links.push({ from: pick.id, to: n.id, kind: 'flow', label: n.title }));
      }
      exits.push(...alternatives.map(n => ({ id: n.id, label: '' })));
      nodes.push(...alternatives);
      edges.push(...links);
      return {
        id: 'L' + (lanes.length + 1), kind: 'flow', color: COLORS[colorIdx++ % COLORS.length],
        title: T('x.pickApproach', alternatives.length), tag: table ? T('x.firstMatch') : '', nodes, notes: [],
        source: (router ? [router] : []).concat(sections).map(sourceOfSection).join('\n\n'),
        choice: { alternatives: alternatives.map(n => n.id), exits },
      };
    }
    /* 连续的单步章节合成一条「主流程」泳道；只有一个时不加框，像触发卡片那样单独一行 */
    const flushSingles = () => {
      if (!singles) return;
      const bare = singles.length === 1;
      lanes.push({
        id: 'L' + (lanes.length + 1), kind: bare ? 'bare' : 'flow', color: bare ? (lanes.filter(l => l.kind === 'flow').slice(-1)[0] || {}).color || COLORS[0] : COLORS[colorIdx++ % COLORS.length],
        title: bare ? singles[0].title : L.flow,
        tag: bare ? '' : L.stages(singles.length),
        nodes: capNodes(singles.map(x => x.node), { kind: 'flow' }), notes: [],
        source: singles.map(x => x.source).join('\n\n'),
      });
      singles = null;
    };

    for (const x of secs.filter(x => x.cls === 'flow')) {
      if (x.s.choice) {
        flushSingles();
        lanes.push(choiceLane(x.s.choice));
        continue;
      }
      const its = x.its;
      const chained = its.kind === 'subs' || its.kind === 'ol' || its.kind === 'decide' || (its.kind === 'ul' && RE_STRONG_FLOW.test(x.title));
      if (chained && its.items.length >= 2) {
        flushSingles();
        const ctx = { kind: 'flow', ordered: its.ordered };
        const nodes = capNodes(its.items.map(it => nodeFrom(it, ctx)), ctx);
        lanes.push({
          id: 'L' + (lanes.length + 1), kind: 'flow', color: COLORS[colorIdx++ % COLORS.length],
          title: x.title, tag: its.kind === 'decide' ? T('x.firstMatch') : L.steps(its.items.length), nodes, notes: [],
          num: x.numbered ? numOf(md.strip(x.s.title)) : null,
          source: sectionSource(x),
        });
      } else {
        const node = nodeFrom({ kind: 'section', title: x.s.title, blocks: x.s.blocks }, { kind: 'flow', ordered: x.numbered });
        if (x.numbered) node.tag = T('x.stageTag', numOf(md.strip(x.s.title)));
        (singles = singles || []).push({ title: x.title, node, source: sectionSource(x) });
      }
    }
    flushSingles();

    /* —— 参考泳道 —— */
    const refSecs = secs.filter(x => x.cls === 'ref');
    const refSingles = [];
    const refSources = [];
    let refLanes = 0;
    for (const x of refSecs) {
      if (x.its.items.length >= 2 && refLanes < 3) {
        refLanes++;
        const ctx = { kind: 'ref', ordered: false };
        lanes.push({
          id: 'L' + (lanes.length + 1), kind: 'ref', color: 'slate', title: x.title, tag: L.items(x.its.items.length),
          nodes: capNodes(x.its.items.map(it => nodeFrom(it, ctx)), ctx), notes: [],
          source: sectionSource(x),
        });
      } else {
        refSingles.push(nodeFrom({ kind: 'section', title: x.s.title, blocks: x.s.blocks }, { kind: 'ref' }));
        refSources.push(sectionSource(x));
      }
    }
    if (refSingles.length) {
      lanes.push({ id: 'L' + (lanes.length + 1), kind: 'ref', color: 'slate', title: L.ref, tag: L.items(refSingles.length), nodes: capNodes(refSingles, { kind: 'ref' }), notes: [], source: refSources.join('\n\n') });
    }

    /* —— 规则 → 注释 —— */
    for (const x of secs.filter(x => x.cls === 'rules')) {
      const its = x.its.items.length ? x.its.items : x.s.blocks.filter(b => b.type === 'paragraph').slice(0, 2).map(b => ({ kind: 'item', text: b.text, blocks: [] }));
      for (const it of its) {
        let text;
        if (it.kind === 'sub') { const ft = firstText(it.blocks), head = stripNum(md.strip(it.title)); text = ft ? head + colonFor(head + ft) + ft : head; }
        else if (it.kind === 'row' || it.kind === 'rule') text = joinFor(it.cells.map(c => md.strip(c)).filter(Boolean), '：', ': ');
        else { const sl = splitLead(it.text); text = sl.rest ? sl.title.replace(/…$/, '') + colonFor(sl.title + sl.rest) + sl.rest : sl.title; }
        notes.push({ text, detail: '## ' + x.s.title + '\n\n' + md.blocksToMd(x.s.blocks) });
      }
    }
    const flowLanes = lanes.filter(l => l.kind === 'flow' || l.kind === 'bare');
    const framed = lanes.filter(l => l.kind === 'flow');
    if (notes.length && notes.length <= 3 && framed.length) {
      framed[framed.length - 1].notes = notes.map(n => n.text);
      framed[framed.length - 1].source += '\n\n' + secs.filter(x => x.cls === 'rules' || x.cls === 'notuse').map(sectionSource).join('\n\n');
    } else if (notes.length) {
      const shown = (opts.cap === false ? notes : notes.slice(0, 7)).map(n => n.text);
      if (opts.cap !== false && notes.length > 7) shown.push(L.more(notes.length - 7));
      lanes.push({ id: 'L' + (lanes.length + 1), kind: 'notes', color: 'amber', title: L.rules, tag: L.items(notes.length), nodes: [], notes: shown, source: secs.filter(x => x.cls === 'rules' || x.cls === 'notuse').map(sectionSource).join('\n\n') });
    }

    /* —— 连线 —— */
    const trigger = (triggerText || desc) ? {
      id: 'start', type: 'trigger', title: L.trigger, tag: 'Trigger', icon: 'bell', lines: triggerText || firstSentence(desc),
      detail: (desc ? '**description**' + colonFor(desc) + desc + '\n\n' : '') + triggerDetail,
    } : null;
    const chain = [];
    flowLanes.forEach(l => l.nodes.forEach(n => chain.push(n)));
    lanes.filter(l => l.kind === 'ref').forEach(l => l.nodes.forEach(n => {
      (refSteps.get(n.id) || []).forEach(label => {
        const step = chain.find(s => s.numText === label) || chain.find(s => s.number === numOf(label) && s.numText != null && !s.numText.includes('.'));
        if (step && !reads.some(r => r.from === step.id && r.to === n.id)) reads.push({ from: step.id, to: n.id });
      });
    }));
    if (trigger && chain.length) edges.push({ from: 'start', to: chain[0].id, kind: 'flow' });
    flowLanes.forEach((lane, li) => {
      const next = flowLanes[li + 1]?.nodes[0];
      if (lane.choice) {
        lane.choice.exits.forEach(exit => {
          if (next) edges.push({ from: exit.id, to: next.id, kind: 'flow', label: exit.label });
          else if (exit.label) stubs.push({ from: exit.id, text: T('x.noApproach'), label: exit.label });
          else lane.nodes.find(n => n.id === exit.id).terminal = true;
        });
      } else lane.nodes.forEach((a, i) => {
        const b = lane.nodes[i + 1] || next;
        if (b) edges.push({ from: a.id, to: b.id, kind: 'flow', label: a.type === 'decision' && a.stub ? 'No' : '' });
        else a.terminal = true;
      });
    });
    chain.forEach(n => {
      if (n.type === 'decision' && n.stub) stubs.push({ from: n.id, text: n.stub, label: 'Yes' });
      delete n.stub;
    });
    flowLanes.forEach(l => {
      l.nodes.forEach((n, idx) => {
        if (!n.loopTo) return;
        let target = null;
        if (n.loopTo.number != null) target = l.nodes.find(m => m.number === n.loopTo.number) || chain.find(m => m.number === n.loopTo.number && m !== n);
        if (!target) target = idx > 0 ? l.nodes[Math.max(0, idx - 1)] : null;
        if (target && target !== n) edges.push({ from: n.id, to: target.id, kind: 'loop', label: cut(n.loopTo.label, 30) });
        delete n.loopTo;
      });
    });

    const h1 = doc.title ? md.strip(doc.title) : '';
    const title = h1 || name;
    const subtitle = cut(firstSentence(desc) || (h1 && h1 !== name ? name : ''), 92);
    return {
      source: 'auto', zh, name, description: desc,
      title, subtitle,
      window: `skills / ${name} / SKILL.md`,
      hero: { title: h1 && h1 !== name ? name : T('hero.default'), sub: '' },
      footer: T('footer.auto'),
      trigger, lanes, edges, reads, stubs,
      stats: { lanes: lanes.length, steps: chain.length, nodes: lanes.reduce((a, l) => a + l.nodes.length, 0) + (trigger ? 1 : 0) },
    };
  }

  function extract(text, opts) {
    opts = opts || {};
    const fm = md.parseFrontMatter(text);
    const m = fm.body.match(/(^|\n)\s*(`{3,}|~{3,})\s*skillflow[^\n]*\n([\s\S]*?)\n\s*\2/);
    let spec;
    if (m) {
      spec = SV.dsl.parse(m[3], { name: fm.data.name, description: fm.data.description });
      spec.source = 'skillflow';
    } else {
      spec = makeAuto(fm, fm.body, opts);
    }
    spec.frontMatter = fm.data;
    return spec;
  }

  Object.assign(SV, { extract, text: { units, cut, cjkRatio, firstSentence, pickIcon, CJK } });
};
SV.mod.extract(SV);
