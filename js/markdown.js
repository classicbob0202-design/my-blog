// 마크다운 → HTML 변환기.
// DOM에 의존하지 않는 순수 함수만 둔다. 원문 HTML은 지원하지 않고 모두 이스케이프한다.

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/;
const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}> ?/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?:( +)(.*))?$/;
const PLACEHOLDER_RE = /\u0000(\d+)\u0000/g;
const SAFE_SCHEMES = ['http', 'https', 'mailto'];

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// 허용된 프로토콜(http, https, mailto)이나 상대 경로만 통과시킨다.
function safeUrl(url) {
  const normalized = url.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/);
  if (scheme && !SAFE_SCHEMES.includes(scheme[1])) {
    return null;
  }
  return url;
}

// front matter(--- 로 감싼 맨 위 블록)를 읽어 메타데이터와 본문으로 나눈다.
export function parseFrontMatter(text) {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = src.match(/^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/);
  if (!match) {
    return { meta: {}, body: src };
  }

  const meta = {};
  for (const line of (match[1] || '').split('\n')) {
    const pair = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!pair) {
      continue;
    }
    const raw = pair[2].trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      meta[pair[1]] = raw
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      meta[pair[1]] = unquote(raw);
    }
  }
  return { meta, body: src.slice(match[0].length) };
}

function unquote(value) {
  const quoted = value.match(/^(["'])(.*)\1$/);
  return quoted ? quoted[2] : value;
}

export function parse(markdown) {
  const lines = String(markdown)
    .replace(/\u0000/g, '�')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length)));
  return parseBlocks(lines);
}

// ---------- 블록 ----------

function leadingSpaces(line) {
  return line.match(/^ */)[0].length;
}

function isBlank(line) {
  return line.trim() === '';
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, i)
  );
}

// tight가 true면 문단을 <p>로 감싸지 않는다(빈 줄 없는 목록 항목).
function parseBlocks(lines, tight = false) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    let match;

    if (isBlank(line)) {
      i++;
      continue;
    }

    if ((match = line.match(FENCE_RE))) {
      const fence = match[1];
      const lang = match[2].replace(/[^\w#+-]/g, '');
      const indent = leadingSpaces(line);
      const closeRe = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
      const code = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        code.push(lines[i].slice(Math.min(indent, leadingSpaces(lines[i]))));
        i++;
      }
      i++; // 닫는 펜스. 없으면 문서 끝까지 코드로 본다.
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if ((match = line.match(HEADING_RE))) {
      const level = match[1].length;
      out.push(`<h${level}>${parseInline(match[2] || '')}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i].replace(QUOTE_RE, ''));
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(inner)}\n</blockquote>`);
      continue;
    }

    if (LIST_RE.test(line)) {
      const list = parseList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }

    if (isTableStart(lines, i)) {
      const table = parseTable(lines, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    const para = [];
    do {
      para.push(lines[i].replace(/^\s+/, ''));
      i++;
    } while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines, i));
    const html = parseInline(para.join('\n').replace(/\s+$/, ''));
    out.push(tight ? html : `<p>${html}</p>`);
  }

  return out.join('\n');
}

function listKey(marker) {
  // 순서 없는 목록은 기호(-, *, +), 순서 있는 목록은 구분자(., ))가 같아야 같은 목록이다.
  return /\d/.test(marker) ? marker.slice(-1) : marker;
}

function parseList(lines, start) {
  const first = lines[start].match(LIST_RE);
  const ordered = /\d/.test(first[2]);
  const key = listKey(first[2]);
  const items = [];
  let loose = false;
  let i = start;

  while (i < lines.length) {
    const match = lines[i].match(LIST_RE);
    if (!match || listKey(match[2]) !== key) {
      break;
    }

    const indent = match[1].length;
    const spaces = match[3] ? match[3].length : 1;
    const contentIndent = indent + match[2].length + (spaces <= 4 ? spaces : 1);
    const body = [match[4] || ''];
    i++;

    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) {
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) {
          j++;
        }
        if (j < lines.length && leadingSpaces(lines[j]) >= contentIndent) {
          for (; i < j; i++) {
            body.push('');
          }
          loose = true;
          continue;
        }
        break;
      }

      const lead = leadingSpaces(line);
      if (lead > indent) {
        body.push(line.slice(Math.min(lead, contentIndent)));
        i++;
        continue;
      }
      // 들여쓰지 않은 줄이 바로 이어지면 앞 문단의 연속으로 본다.
      if (!isBlank(body[body.length - 1]) && !isBlockStart(lines, i)) {
        body.push(line);
        i++;
        continue;
      }
      break;
    }

    items.push(body);

    let j = i;
    while (j < lines.length && isBlank(lines[j])) {
      j++;
    }
    const next = j < lines.length ? lines[j].match(LIST_RE) : null;
    if (!next || listKey(next[2]) !== key) {
      break;
    }
    if (j > i) {
      loose = true;
    }
    i = j;
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const startAttr = startNum !== 1 ? ` start="${startNum}"` : '';
  const lis = items.map((body) => `<li>${parseBlocks(body, !loose)}</li>`).join('\n');
  return { html: `<${tag}${startAttr}>\n${lis}\n</${tag}>`, next: i };
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) {
    row = row.slice(1);
  }
  if (row.endsWith('|') && !row.endsWith('\\|')) {
    row = row.slice(0, -1);
  }
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isTableStart(lines, i) {
  if (i + 1 >= lines.length || !lines[i].includes('|') || !lines[i + 1].includes('|')) {
    return false;
  }
  const separator = splitRow(lines[i + 1]);
  return (
    separator.every((cell) => /^:?-+:?$/.test(cell)) &&
    splitRow(lines[i]).length === separator.length
  );
}

function parseTable(lines, start) {
  const header = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    if (cell.startsWith(':')) return 'left';
    return '';
  });
  const rows = [];
  let i = start + 2;
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    rows.push(splitRow(lines[i]));
    i++;
  }

  const cell = (tag, text, k) => {
    const style = aligns[k] ? ` style="text-align: ${aligns[k]}"` : '';
    return `<${tag}${style}>${parseInline(text || '')}</${tag}>`;
  };
  const head = `<tr>${header.map((text, k) => cell('th', text, k)).join('')}</tr>`;
  const body = rows
    .map((row) => `<tr>${header.map((_, k) => cell('td', row[k], k)).join('')}</tr>`)
    .join('\n');

  const html =
    '<div class="table-wrap"><table>\n' +
    `<thead>\n${head}\n</thead>\n` +
    (rows.length ? `<tbody>\n${body}\n</tbody>\n` : '') +
    '</table></div>';
  return { html, next: i };
}

// ---------- 인라인 ----------

function parseInline(text) {
  const tokens = [];
  // 변환이 끝난 HTML 조각은 자리표시자로 빼 두어 이후 규칙이 건드리지 못하게 한다.
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  // 속성 값에 넣을 때는 자리표시자를 태그 없는 글자로 되돌린다.
  const plain = (str) => str.replace(PLACEHOLDER_RE, (_, n) => tokens[n].replace(/<[^>]*>/g, ''));

  let s = escapeHtml(text);

  s = s.replace(/(`+)([\s\S]+?)\1(?!`)/g, (_, ticks, code) => {
    const trimmed = /^ [\s\S]* $/.test(code) && code.trim() ? code.slice(1, -1) : code;
    return stash(`<code>${trimmed}</code>`);
  });

  s = s.replace(/\\\n/g, () => stash('<br>\n'));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~|])/g, (_, ch) => stash(ch));

  // 주소 안의 짝 맞는 괄호 한 단계는 허용한다(예: https://ko.wikipedia.org/wiki/A_(B)).
  s = s.replace(
    /!\[([^\]]*)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g,
    (_, alt, src, title) => {
      const url = safeUrl(plain(src));
      if (!url) {
        return stash(plain(alt));
      }
      const titleAttr = title ? ` title="${plain(title)}"` : '';
      return stash(`<img src="${url}" alt="${plain(alt)}"${titleAttr} loading="lazy">`);
    },
  );

  s = s.replace(
    /\[([^\]]+)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g,
    (_, label, href, title) => {
      const url = safeUrl(plain(href));
      if (!url) {
        return label;
      }
      const titleAttr = title ? ` title="${plain(title)}"` : '';
      const rel = /^https?:/i.test(url) ? ' rel="noopener noreferrer"' : '';
      return `${stash(`<a href="${url}"${titleAttr}${rel}>`)}${label}${stash('</a>')}`;
    },
  );

  s = s.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');

  s = s.replace(/ {2,}\n/g, '<br>\n');

  return s.replace(PLACEHOLDER_RE, (_, n) => tokens[n]);
}
