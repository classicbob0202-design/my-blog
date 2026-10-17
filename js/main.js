import { parse, parseFrontMatter } from './markdown.js';
import { initThemeToggle } from './theme.js';

const SITE_NAME = '내 블로그';
const SLUG_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

class LoadError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'text') {
      node.textContent = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child) {
      node.append(child);
    }
  }
  return node;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new LoadError(res.status);
  }
  return res.text();
}

async function loadPost(slug) {
  const { meta, body } = parseFrontMatter(await fetchText(`posts/${slug}.md`));
  return {
    slug,
    title: meta.title || slug,
    date: typeof meta.date === 'string' ? meta.date : '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    description: typeof meta.description === 'string' ? meta.description : '',
    body,
  };
}

function formatDate(date) {
  const match = date.match(DATE_RE);
  if (!match) {
    return date;
  }
  const [, y, m, d] = match;
  return `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`;
}

function postMeta(post) {
  const meta = el('p', { class: 'post-meta' });
  if (post.date) {
    meta.append(el('time', { datetime: post.date, text: formatDate(post.date) }));
  }
  if (post.tags.length) {
    const tags = el('span', { class: 'post-tags' });
    for (const tag of post.tags) {
      tags.append(el('span', { class: 'tag', text: `#${tag}` }));
    }
    meta.append(tags);
  }
  return meta;
}

function showMessage(root, title, detail, withBackLink = false) {
  const box = el('section', { class: 'message', role: 'status' }, [
    el('h2', { class: 'message-title', text: title }),
    el('p', { text: detail }),
  ]);
  if (withBackLink) {
    box.append(el('p', {}, el('a', { href: './', text: '← 글 목록으로' })));
  }
  root.querySelector('.status')?.remove();
  root.append(box);
}

async function renderList(root) {
  let slugs;
  try {
    const res = await fetch('posts/index.json');
    if (!res.ok) {
      throw new LoadError(res.status);
    }
    slugs = await res.json();
    if (!Array.isArray(slugs)) {
      throw new Error('index.json은 slug 배열이어야 합니다.');
    }
  } catch (error) {
    console.error(error);
    showMessage(root, '글 목록을 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.');
    return;
  }

  const valid = slugs.filter((slug) => typeof slug === 'string' && SLUG_RE.test(slug));
  const results = await Promise.allSettled(valid.map(loadPost));
  const posts = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      posts.push(result.value);
    } else {
      console.error(result.reason);
    }
  }
  const failed = slugs.length - posts.length;

  if (posts.length === 0) {
    if (failed > 0) {
      showMessage(root, '글을 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.');
    } else {
      showMessage(root, '아직 글이 없습니다.', '첫 글을 기다려 주세요.');
    }
    return;
  }

  posts.sort((a, b) => b.date.localeCompare(a.date));

  const list = el('ul', { class: 'post-list' });
  for (const post of posts) {
    const href = `post.html?slug=${encodeURIComponent(post.slug)}`;
    list.append(
      el('li', {}, el('article', { class: 'post-card' }, [
        el('h2', { class: 'post-card-title' }, el('a', { href, text: post.title })),
        postMeta(post),
        post.description && el('p', { class: 'post-description', text: post.description }),
      ])),
    );
  }

  root.querySelector('.status')?.remove();
  root.append(list);
  if (failed > 0) {
    root.append(el('p', { class: 'notice', text: `글 ${failed}편을 불러오지 못했습니다.` }));
  }
}

async function renderPost(root) {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug || !SLUG_RE.test(slug)) {
    document.title = `글을 찾을 수 없습니다 · ${SITE_NAME}`;
    showMessage(root, '글을 찾을 수 없습니다.', '주소가 올바른지 확인해 주세요.', true);
    return;
  }

  let post;
  try {
    post = await loadPost(slug);
  } catch (error) {
    console.error(error);
    if (error instanceof LoadError && error.status === 404) {
      document.title = `글을 찾을 수 없습니다 · ${SITE_NAME}`;
      showMessage(root, '글을 찾을 수 없습니다.', '삭제되었거나 주소가 잘못되었을 수 있습니다.', true);
    } else {
      showMessage(root, '글을 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.', true);
    }
    return;
  }

  document.title = `${post.title} · ${SITE_NAME}`;
  if (post.description) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', post.description);
  }

  const content = el('div', { class: 'post-content' });
  content.innerHTML = parse(post.body);

  root.querySelector('.status')?.remove();
  root.append(
    el('article', { class: 'post' }, [
      el('header', { class: 'post-header' }, [
        el('h1', { class: 'post-title', text: post.title }),
        postMeta(post),
      ]),
      content,
    ]),
  );
}

initThemeToggle();

const root = document.getElementById('content');
if (document.body.dataset.page === 'post') {
  renderPost(root);
} else {
  renderList(root);
}
