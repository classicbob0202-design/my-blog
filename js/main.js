import { parse, parseFrontMatter } from './markdown.js';
import { initTheme } from './theme.js';

const SITE_NAME = 'My Blog';
const POSTS_DIR = 'posts';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'UTC' });

initTheme();

const page = document.body.dataset.page;
if (page === 'list') renderList();
if (page === 'post') renderPost();

// ---------------------------------------------------------------------------
// 페이지 렌더링

async function renderList() {
  const container = document.querySelector('#post-list');
  try {
    const slugs = JSON.parse(await fetchText(`${POSTS_DIR}/index.json`));
    const results = await Promise.allSettled(slugs.filter((slug) => SLUG_RE.test(slug)).map(loadPost));

    results
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.warn(result.reason));

    const posts = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!posts.length) {
      showMessage(container, '아직 작성된 글이 없습니다.');
      return;
    }

    const list = el('ul', 'post-list');
    list.append(...posts.map(createPostItem));
    container.replaceChildren(list);
  } catch (error) {
    console.error(error);
    showMessage(container, '글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

async function renderPost() {
  const container = document.querySelector('#post');
  const slug = new URLSearchParams(location.search).get('slug') ?? '';

  if (!SLUG_RE.test(slug)) {
    showMessage(container, '잘못된 주소입니다.');
    return;
  }

  try {
    const post = await loadPost(slug);
    document.title = `${post.title} · ${SITE_NAME}`;

    const header = el('header', 'post-header');
    header.append(el('h1', 'post-title', post.title), createMeta(post));

    const content = el('div', 'post-content');
    content.innerHTML = parse(post.body);

    container.replaceChildren(header, content);
  } catch (error) {
    console.error(error);
    showMessage(container, '글을 찾을 수 없습니다.');
  }
}

// ---------------------------------------------------------------------------
// 데이터

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} 요청 실패: ${response.status}`);
  return response.text();
}

async function loadPost(slug) {
  const { data, body } = parseFrontMatter(await fetchText(`${POSTS_DIR}/${slug}.md`));
  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
  return {
    slug,
    title: data.title || slug,
    date: data.date || '',
    description: data.description || '',
    tags,
    body,
  };
}

// ---------------------------------------------------------------------------
// DOM 조각

function createPostItem(post) {
  const item = el('li', 'post-item');
  const article = el('article');

  const title = el('h3', 'post-item-title');
  const link = el('a', '', post.title);
  link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  title.append(link);

  article.append(title, createMeta(post));
  if (post.description) article.append(el('p', 'post-item-description', post.description));

  item.append(article);
  return item;
}

function createMeta(post) {
  const meta = el('div', 'post-meta');

  if (post.date) {
    const time = el('time', '', formatDate(post.date));
    time.dateTime = post.date;
    meta.append(time);
  }

  if (post.tags.length) {
    const tags = el('ul', 'tag-list');
    tags.setAttribute('aria-label', '태그');
    tags.append(...post.tags.map((tag) => el('li', 'tag', tag)));
    meta.append(tags);
  }

  return meta;
}

function showMessage(container, text) {
  container.replaceChildren(el('p', 'status-message', text));
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, year, month, day] = match.map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}
