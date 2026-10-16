// 마크다운 → HTML 변환기. DOM에 의존하지 않는 순수 함수만 둔다.

const PLACEHOLDER = '\u0000';
const PLACEHOLDER_RE = /\u0000(\d+)\u0000/g;

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const TOP_FENCE_RE = /^(`{3,}|~{3,})/;
const HEADING_RE = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const HR_RE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^ {0,3}> ?/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?: +|$)/;
const TABLE_SEP_RE = /^ *\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/;
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * 마크다운 문자열을 HTML 문자열로 변환한다.
 * 본문 텍스트는 모두 이스케이프되므로 원시 HTML은 그대로 글자로 보인다.
 */
export function parse(markdown) {
  const lines = String(markdown)
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n');
  return parseBlocks(expandTabs(lines), false);
}

// 들여쓰기 계산을 위해 탭을 공백 네 칸으로 바꾼다.
// 단, 맨 앞에서 시작한 코드 블록 안의 탭은 원문 그대로 둔다(Makefile 예제 등).
function expandTabs(lines) {
  let marker = null;
  return lines.map((line) => {
    if (marker) {
      if (!isFenceClose(line, marker)) return line;
      marker = null;
    } else {
      marker = line.match(TOP_FENCE_RE)?.[1] ?? null;
    }
    return line.replace(/\t/g, '    ');
  });
}

/**
 * 문서 맨 위의 front matter(--- 사이의 key: value)를 분리한다.
 * 값이 [a, b] 형태면 배열로 바꾼다.
 */
export function parseFrontMatter(source) {
  const text = String(source).replace(/^﻿/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { data: {}, body: text };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (pair) data[pair[1]] = parseValue(pair[2].trim());
  }
  return { data, body: text.slice(match[0].length) };
}

function parseValue(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
  }
  return unquote(value);
}

function unquote(value) {
  return /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
}

// ---------------------------------------------------------------------------
// 블록 문법

function parseBlocks(lines, tight) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2].replace(/[^\w+-]/g, '');
      const code = [];
      i++;
      while (i < lines.length && !isFenceClose(lines[i], marker)) {
        code.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스 건너뛰기
      const cls = lang ? ` class="language-${lang}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${parseInline(heading[2] ?? '')}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quote = [];
      while (
        i < lines.length &&
        (QUOTE_RE.test(lines[i]) || (lines[i].trim() !== '' && !interruptsParagraph(lines[i])))
      ) {
        quote.push(lines[i].replace(QUOTE_RE, ''));
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(quote, false)}\n</blockquote>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      const rows = [];
      i += 2;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        lines[i].includes('|') &&
        !interruptsParagraph(lines[i])
      ) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, aligns, rows));
      continue;
    }

    if (LIST_RE.test(line)) {
      const [html, next] = parseList(lines, i);
      out.push(html);
      i = next;
      continue;
    }

    // 문단: 빈 줄이나 다른 블록이 시작될 때까지 이어진다.
    const para = [line.replace(/^ +/, '')];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !interruptsParagraph(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i].replace(/^ +/, ''));
      i++;
    }
    const html = parseInline(para.join('\n').trimEnd());
    out.push(tight ? html : `<p>${html}</p>`);
  }

  return out.join('\n');
}

// 닫는 펜스: 들여쓰기 세 칸 이하, 여는 펜스와 같은 문자, 같거나 더 긴 길이.
function isFenceClose(line, marker) {
  const close = line.match(FENCE_CLOSE_RE);
  return Boolean(close) && close[1][0] === marker[0] && close[1].length >= marker.length;
}

// 문단 중간에 나와도 새 블록으로 취급할 줄인지 확인한다.
// 순서 있는 목록은 "1."로 시작할 때만 문단을 끊는다("2026. 10월" 같은 문장 보호).
function interruptsParagraph(line) {
  if (FENCE_RE.test(line) || HEADING_RE.test(line) || HR_RE.test(line) || QUOTE_RE.test(line)) {
    return true;
  }
  const list = line.match(LIST_RE);
  return Boolean(list) && (!/\d/.test(list[2]) || parseInt(list[2], 10) === 1);
}

function parseList(lines, i) {
  const first = lines[i].match(LIST_RE);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let loose = false;

  const isSibling = (line) => {
    const m = line?.match(LIST_RE);
    return Boolean(m) && m[1].length === indent && /\d/.test(m[2]) === ordered && !HR_RE.test(line);
  };

  while (i < lines.length && isSibling(lines[i])) {
    const marker = lines[i].match(LIST_RE);
    const contentIndent = marker[0].length;
    const body = [lines[i].slice(contentIndent)];
    i++;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') {
        body.push('');
        i++;
        continue;
      }
      const lead = line.length - line.trimStart().length;
      if (lead > indent) {
        // 들여쓴 줄은 이 항목의 내용(중첩 목록 포함)이다.
        body.push(line.slice(Math.min(lead, contentIndent)));
        i++;
        continue;
      }
      if (body[body.length - 1] !== '' && !LIST_RE.test(line) && !interruptsParagraph(line)) {
        // 들여쓰지 않고 이어 쓴 문장
        body.push(line.trimStart());
        i++;
        continue;
      }
      break;
    }

    let trailingBlank = false;
    while (body.length && body[body.length - 1] === '') {
      body.pop();
      trailingBlank = true;
    }
    if (body.includes('')) loose = true;
    items.push(body);

    if (trailingBlank) {
      if (i < lines.length && isSibling(lines[i])) loose = true;
      else break;
    }
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNumber = parseInt(first[2], 10);
  const start = ordered && startNumber !== 1 ? ` start="${startNumber}"` : '';
  const html = items.map((body) => `<li>${parseBlocks(body, !loose)}</li>`).join('\n');
  return [`<${tag}${start}>\n${html}\n</${tag}>`, i];
}

function isTableStart(lines, i) {
  const next = lines[i + 1];
  return (
    lines[i].includes('|') &&
    next !== undefined &&
    next.includes('-') &&
    TABLE_SEP_RE.test(next) &&
    splitRow(next).length === splitRow(lines[i]).length
  );
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function alignOf(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

function renderTable(header, aligns, rows) {
  const cell = (tag, text, index) => {
    const align = aligns[index] ? ` style="text-align: ${aligns[index]}"` : '';
    return `<${tag}${align}>${parseInline(text ?? '')}</${tag}>`;
  };
  const head = `<tr>${header.map((text, index) => cell('th', text, index)).join('')}</tr>`;
  const body = rows
    .map((row) => `<tr>${header.map((_, index) => cell('td', row[index], index)).join('')}</tr>`)
    .join('\n');
  const tbody = rows.length ? `<tbody>\n${body}\n</tbody>\n` : '';
  return `<div class="table-wrap"><table>\n<thead>${head}</thead>\n${tbody}</table></div>`;
}

// ---------------------------------------------------------------------------
// 인라인 문법

function parseInline(text) {
  const stash = [];
  const keep = (html) => `${PLACEHOLDER}${stash.push(html) - 1}${PLACEHOLDER}`;
  const restore = (value) => {
    let result = value;
    while (PLACEHOLDER_RE.test(result)) {
      result = result.replace(PLACEHOLDER_RE, (_, n) => stash[n]);
    }
    return result;
  };

  // 속성값(alt, title)에는 보관해 둔 태그 없이 글자만 넣는다.
  const plain = (value) => restore(value).replace(/<[^>]*>/g, '');

  // 1~2. 백슬래시 이스케이프(\*, \` 등)와 인라인 코드를 왼쪽부터 함께 처리한다.
  //      이스케이프한 백틱은 코드를 열지 않고, 코드 안에는 다른 문법을 적용하지 않는다.
  let s = text.replace(
    /\\([\\`*_{}[\]()#+\-.!~|>])|(`+)([\s\S]*?[^`])\2(?!`)/g,
    (_, ch, __, code) =>
      keep(ch ? escapeHtml(ch) : `<code>${escapeHtml(trimCode(code))}</code>`),
  );

  // 3. 나머지 텍스트 HTML 이스케이프
  s = escapeHtml(s);

  // 4. 이미지와 링크 (주소 안의 _ 나 * 가 강조로 바뀌지 않도록 태그를 보관해 둔다)
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]*)(?:\s+&quot;(.*?)&quot;)?\)/g,
    (_, alt, url, title) => {
      const titleAttr = title ? ` title="${plain(title)}"` : '';
      return keep(`<img src="${safeUrl(restore(url))}" alt="${plain(alt)}"${titleAttr} loading="lazy">`);
    },
  );
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]*)(?:\s+&quot;(.*?)&quot;)?\)/g,
    (_, label, url, title) => {
      const titleAttr = title ? ` title="${plain(title)}"` : '';
      return keep(`<a href="${safeUrl(restore(url))}"${titleAttr}>`) + label + keep('</a>');
    },
  );

  // 5. 강조. 밑줄(_)은 단어 중간(예: snake_case, 한글_이름)에서는 무시한다.
  s = s.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>');
  s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

  // 6. 줄 끝 공백 두 칸 또는 백슬래시는 줄바꿈
  s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');

  return restore(s);
}

// 인라인 코드: 줄바꿈은 공백으로, 양끝이 모두 공백이면 한 칸씩만 벗긴다. 공백뿐이면 그대로 둔다.
function trimCode(code) {
  const flat = code.replace(/\n/g, ' ');
  return /^ [\s\S]*[^ ][\s\S]* $/.test(flat) ? flat.slice(1, -1) : flat;
}

// javascript: 같은 위험한 프로토콜은 막고, 허용된 스킴과 상대 경로만 통과시킨다.
function safeUrl(url) {
  const compact = url.replace(/[\u0000- \u007f]/g, '');
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !ALLOWED_SCHEMES.includes(scheme[1].toLowerCase())) return '#';
  return url;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
