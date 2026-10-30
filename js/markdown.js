// 마크다운 변환기 (직접 구현)
// 지원: 제목, 문단, 굵게·기울임, 인라인 코드, 코드 블록, 링크, 이미지, 목록, 인용, 구분선
// 안전: 글 안의 HTML은 모두 글자로 바꾼 뒤 변환하고, 링크·이미지 주소는 http(s)와 상대 경로만 허용한다.

const FENCE_RE = /^```\s*([\w-]*)\s*$/;
const FENCE_END_RE = /^```\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^>\s?/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

// javascript: 같은 위험한 주소를 막는다. 스킴이 없으면(상대 경로) 허용한다.
// 브라우저는 주소 앞의 제어문자를 지운 뒤 해석하므로 제어문자가 있으면 거부한다.
// \u0000은 떼어 둔 HTML 토큰 표시라, 주소 안에 있으면 HTML이 속성에 들어가므로 거부한다.
const isSafeUrl = (url) => {
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return true;
  return ['http', 'https'].includes(scheme[1].toLowerCase());
};

const emphasis = (html) =>
  html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');

// 한 줄 안의 문법을 바꾼다. 코드·링크·이미지는 먼저 떼어 두었다가 마지막에 되돌린다.
const inline = (text) => {
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;

  let result = String(text).replace(/\u0000/g, '');
  result = result.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  result = result.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, url) =>
    // alt는 속성이라 떼어 둔 HTML 토큰(인라인 코드)을 되돌리지 않고 지운다.
    isSafeUrl(url)
      ? stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt.replace(/\u0000\d+\u0000/g, ''))}" loading="lazy">`)
      : match,
  );
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) =>
    isSafeUrl(url) ? stash(`<a href="${escapeHtml(url)}">${emphasis(escapeHtml(label))}</a>`) : match,
  );
  result = emphasis(escapeHtml(result));

  // 링크 글자 안에 인라인 코드가 있으면 한 번 더 되돌려야 한다.
  while (/\u0000\d+\u0000/.test(result)) {
    result = result.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
  }
  return result;
};

const isBlockStart = (line) =>
  FENCE_RE.test(line) ||
  HEADING_RE.test(line) ||
  HR_RE.test(line) ||
  QUOTE_RE.test(line) ||
  UL_RE.test(line) ||
  OL_RE.test(line);

const parseBlocks = (lines) => {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const code = [];
      i += 1;
      while (i < lines.length && !FENCE_END_RE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      const lang = fence[1] ? ` class="language-${escapeHtml(fence[1].toLowerCase())}"` : '';
      blocks.push(`<pre><code${lang}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push('<hr>');
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i].replace(QUOTE_RE, ''));
        i += 1;
      }
      blocks.push(`<blockquote>\n${parseBlocks(inner).join('\n')}\n</blockquote>`);
      continue;
    }

    if (UL_RE.test(line) || OL_RE.test(line)) {
      const ordered = OL_RE.test(line);
      const itemRe = ordered ? OL_RE : UL_RE;
      const items = [];
      let start = 1;
      while (i < lines.length && itemRe.test(lines[i])) {
        const match = lines[i].match(itemRe);
        if (ordered && items.length === 0) start = Number(match[1]);
        items.push(`<li>${inline(ordered ? match[2] : match[1])}</li>`);
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
      blocks.push(`<${tag}${startAttr}>\n${items.join('\n')}\n</${tag}>`);
      continue;
    }

    // 문단: 빈 줄이나 다른 블록이 나올 때까지 이어진 줄. 줄 끝 공백 두 칸은 줄바꿈.
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    const html = paragraph
      .map((text, index) => {
        const lineBreak = / {2,}$/.test(text) && index < paragraph.length - 1 ? '<br>' : '';
        return inline(text.trim()) + lineBreak;
      })
      .join('\n');
    blocks.push(`<p>${html}</p>`);
  }

  return blocks;
};

// 마크다운 문자열을 HTML 문자열로 바꾼다.
export const parse = (markdown) => {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  return parseBlocks(lines).join('\n');
};

// 파일 맨 위 --- 사이의 "키: 값"을 읽는다. 값은 모두 문자열이다.
export const parseFrontMatter = (text) => {
  const source = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return { data: {}, content: source };

  const data = {};
  match[1].split('\n').forEach((line) => {
    const pair = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (pair) data[pair[1]] = pair[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  });
  return { data, content: source.slice(match[0].length) };
};
