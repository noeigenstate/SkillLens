/* 极简 Markdown：front matter、块级结构、行内清洗与详情面板渲染 */
(window.SV = window.SV || {}).mod = SV.mod || {};
SV.mod.markdown = function (SV) {
  const LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;

  function normalize(text) {
    return String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  }

  function unquote(v) {
    v = v.trim();
    if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
    if (v.length >= 2 && v[0] === "'" && v[v.length - 1] === "'") return v.slice(1, -1).replace(/''/g, "'");
    return v;
  }

  function parseYamlLite(src) {
    const data = {};
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (/^[>|][+-]?\s*$/.test(val)) {
        const fold = val[0] === '>';
        const buf = [];
        while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) buf.push(lines[++i].trim());
        val = fold ? buf.join(' ').replace(/\s+/g, ' ').trim() : buf.join('\n').trim();
      } else if (val.trim() === '') {
        const buf = [];
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) buf.push(lines[++i].trim());
        val = buf.length && buf.every(b => b.startsWith('- ')) ? buf.map(b => unquote(b.slice(2))) : buf.join(' ');
      } else {
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]) && !/^\s*[A-Za-z0-9_.-]+:\s/.test(lines[i + 1])) val += ' ' + lines[++i].trim();
        val = unquote(val);
      }
      data[key] = val;
    }
    return data;
  }

  function parseFrontMatter(text) {
    text = normalize(text);
    const m = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (!m) return { data: {}, body: text };
    return { data: parseYamlLite(m[1]), body: text.slice(m[0].length) };
  }

  const indentOf = l => l.search(/\S|$/);
  const isFence = l => /^\s*(`{3,}|~{3,})/.test(l);
  const isHeading = l => /^\s{0,3}#{1,6}\s+/.test(l);
  const isHr = l => /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
  const isQuote = l => /^\s*>/.test(l);
  const isBlockStart = l => isFence(l) || isHeading(l) || isHr(l) || isQuote(l) || LIST_RE.test(l);

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = [];
    let cur = '', code = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '`') code = !code;
      if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (ch === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  function parseList(lines, i) {
    const first = lines[i].match(LIST_RE);
    const base = first[1].length;
    const ordered = /\d/.test(first[2]);
    const items = [];
    while (i < lines.length) {
      const m = lines[i].match(LIST_RE);
      if (!m || Math.abs(m[1].length - base) > 1 || /\d/.test(m[2]) !== ordered) break;
      const contentIndent = m[1].length + m[2].length + 1;
      const itemLines = [m[3]];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && indentOf(lines[j]) > base + 1) { itemLines.push(''); i++; continue; }
          break;
        }
        const ind = indentOf(l);
        if (ind > base + 1) { itemLines.push(l.slice(Math.min(ind, contentIndent))); i++; continue; }
        if (!isBlockStart(l) && itemLines[itemLines.length - 1].trim() !== '') { itemLines.push(l.trim()); i++; continue; }
        break;
      }
      const blocks = parseBlocks(itemLines);
      let text = '';
      if (blocks[0] && blocks[0].type === 'paragraph') text = blocks.shift().text;
      items.push({ number: ordered ? parseInt(m[2], 10) : null, text, blocks, raw: itemLines.join('\n') });
      let j = i;
      while (j < lines.length && !lines[j].trim()) j++;
      const mm = j < lines.length && lines[j].match(LIST_RE);
      if (mm && Math.abs(mm[1].length - base) <= 1 && /\d/.test(mm[2]) === ordered) { i = j; continue; }
      break;
    }
    return { block: { type: 'list', ordered, items }, next: i };
  }

  function parseBlocks(lines) {
    if (typeof lines === 'string') lines = normalize(lines).split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      let m = line.match(/^(\s*)(`{3,}|~{3,})\s*([^\s`]*)/);
      if (m) {
        const fence = m[2], ind = m[1].length, buf = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence)) {
          buf.push(lines[i].slice(Math.min(ind, indentOf(lines[i]))));
          i++;
        }
        i++;
        blocks.push({ type: 'code', lang: (m[3] || '').toLowerCase(), text: buf.join('\n') });
        continue;
      }
      m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (m) { blocks.push({ type: 'heading', level: m[1].length, text: m[2] }); i++; continue; }
      if (isHr(line)) { blocks.push({ type: 'hr' }); i++; continue; }
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const header = splitRow(line);
        const rows = [];
        i += 2;
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
        blocks.push({ type: 'table', header, rows });
        continue;
      }
      if (isQuote(line)) {
        const buf = [];
        while (i < lines.length && lines[i].trim() && (isQuote(lines[i]) || !isBlockStart(lines[i]))) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        blocks.push({ type: 'quote', blocks: parseBlocks(buf), text: buf.join('\n') });
        continue;
      }
      if (LIST_RE.test(line)) {
        const r = parseList(lines, i);
        blocks.push(r.block);
        i = r.next;
        continue;
      }
      const buf = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { buf.push(lines[i].trim()); i++; }
      blocks.push({ type: 'paragraph', text: buf.join('\n') });
    }
    return blocks;
  }

  /* 去掉行内 Markdown，只留文字 */
  function strip(md) {
    return String(md || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      .replace(/<(https?:\/\/[^>]+)>/g, '$1')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/`+([^`]+?)`+/g, '$1')
      .replace(/\*\*([^*]+?)\*\*/g, '$1')
      .replace(/__([^_]+?)__/g, '$1')
      .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?![\w*])/g, '$1$2')
      .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1$2')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function blocksToText(blocks) {
    const out = [];
    for (const b of blocks || []) {
      if (b.type === 'paragraph' || b.type === 'heading') out.push(b.text);
      else if (b.type === 'list') b.items.forEach(it => { out.push(it.text); out.push(blocksToText(it.blocks)); });
      else if (b.type === 'quote') out.push(blocksToText(b.blocks));
      else if (b.type === 'table') b.rows.forEach(r => out.push(r.join(' ')));
    }
    return out.filter(Boolean).join('\n');
  }

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function inlineHtml(md) {
    const codes = [];
    let s = String(md || '').replace(/`+([^`]+?)`+/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = esc(s)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)[^)]*\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '<u title="$2">$1</u>')
      .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>')
      .replace(/__([^_]+?)__/g, '<b>$1</b>')
      .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?![\w*])/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/\n/g, '<br>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, n) => '<code>' + esc(codes[+n]) + '</code>');
  }

  function toHtml(blocks) {
    if (typeof blocks === 'string') blocks = parseBlocks(blocks);
    return (blocks || []).map(b => {
      switch (b.type) {
        case 'heading': return `<h${Math.min(6, b.level + 1)}>${inlineHtml(b.text)}</h${Math.min(6, b.level + 1)}>`;
        case 'paragraph': return `<p>${inlineHtml(b.text)}</p>`;
        case 'code': return `<pre><code>${esc(b.text)}</code></pre>`;
        case 'hr': return '<hr>';
        case 'quote': return `<blockquote>${toHtml(b.blocks)}</blockquote>`;
        case 'table': return `<table><thead><tr>${b.header.map(h => `<th>${inlineHtml(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          const start = b.ordered && b.items[0] && b.items[0].number > 1 ? ` start="${b.items[0].number}"` : '';
          return `<${tag}${start}>${b.items.map(it => `<li>${inlineHtml(it.text)}${toHtml(it.blocks)}</li>`).join('')}</${tag}>`;
        }
        default: return '';
      }
    }).join('');
  }

  /* 把块序列按标题切成章节树 */
  function sectionize(blocks) {
    const heads = blocks.filter(b => b.type === 'heading');
    let title = null;
    let list = blocks;
    const h1s = heads.filter(h => h.level === 1);
    if (h1s.length === 1 && heads[0] === h1s[0]) {
      title = h1s[0].text;
      list = blocks.filter(b => b !== h1s[0]);
    }
    const levels = list.filter(b => b.type === 'heading').map(b => b.level);
    if (!levels.length) return { title, intro: list, sections: [], level: 0 };
    const counts = {};
    levels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    const minL = Math.min(...levels);
    let level = minL;
    if (counts[minL] === 1 && levels.length > 2) {
      const deeper = Object.keys(counts).map(Number).filter(l => l > minL && counts[l] >= 2).sort((a, b) => a - b)[0];
      if (deeper && list.findIndex(b => b.type === 'heading' && b.level === minL) === list.findIndex(b => b.type === 'heading')) level = minL;
    }
    const intro = [];
    const sections = [];
    let cur = null;
    for (const b of list) {
      if (b.type === 'heading' && b.level <= level) {
        cur = { title: b.text, level: b.level, blocks: [], subs: [] };
        sections.push(cur);
        continue;
      }
      if (!cur) { intro.push(b); continue; }
      cur.blocks.push(b);
    }
    for (const s of sections) {
      const subLevel = Math.min(...s.blocks.filter(b => b.type === 'heading').map(b => b.level).concat([99]));
      if (subLevel === 99) continue;
      const lead = [];
      let sub = null;
      for (const b of s.blocks) {
        if (b.type === 'heading' && b.level === subLevel) { sub = { title: b.text, blocks: [] }; s.subs.push(sub); continue; }
        (sub ? sub.blocks : lead).push(b);
      }
      s.lead = lead;
    }
    return { title, intro, sections, level };
  }

  /* 把一段块序列还原成 Markdown 文本（用于节点详情） */
  function blocksToMd(blocks, depth) {
    depth = depth || 0;
    const pad = '  '.repeat(depth);
    return (blocks || []).map(b => {
      switch (b.type) {
        case 'heading': return '#'.repeat(b.level) + ' ' + b.text;
        case 'paragraph': return b.text.split('\n').map(l => pad + l).join('\n');
        case 'code': return pad + '```' + b.lang + '\n' + b.text.split('\n').map(l => pad + l).join('\n') + '\n' + pad + '```';
        case 'hr': return '---';
        case 'quote': return b.text.split('\n').map(l => '> ' + l).join('\n');
        case 'table': return ['| ' + b.header.join(' | ') + ' |', '|' + b.header.map(() => ' --- ').join('|') + '|'].concat(b.rows.map(r => '| ' + r.join(' | ') + ' |')).join('\n');
        case 'list': return b.items.map((it, k) => pad + (b.ordered ? (it.number || k + 1) + '. ' : '- ') + it.text + (it.blocks.length ? '\n' + blocksToMd(it.blocks, depth + 1) : '')).join('\n');
        default: return '';
      }
    }).join('\n\n');
  }

  Object.assign(SV, { md: { parseFrontMatter, parseBlocks, sectionize, strip, blocksToText, blocksToMd, toHtml, inlineHtml, esc, normalize } });
};
SV.mod.markdown(SV);
