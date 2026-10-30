// 글 목록·글 상세 렌더링 (ES 모듈)
// posts/index.json의 이름 목록으로 posts/{id}.md를 불러와
// index.html에는 최신순 카드 목록을, post.html에는 글 하나를 그린다.
import { parse, parseFrontMatter } from './markdown.js';

const INDEX_URL = 'posts/index.json';
const SITE_NAME = 'My Blog';
const ID_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const listArea = document.querySelector('.post-list-area');
const detailArea = document.querySelector('.post-detail');

class NotFoundError extends Error {}

const postUrl = (id) => `posts/${id}.md`;

// 'YYYY-MM-DD'를 '2026년 10월 30일'로 바꾼다.
const formatDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const createDate = (post, className) => {
  const date = createElement('time', className, formatDate(post.date));
  date.dateTime = post.date;
  return date;
};

const createTagList = (tags, blockName) => {
  const tagList = createElement('ul', `${blockName}__tags`);
  tagList.setAttribute('aria-label', '태그');
  tags.forEach((tag) => tagList.append(createElement('li', `${blockName}__tag`, `#${tag}`)));
  return tagList;
};

const showMessage = (area, text) => {
  area.replaceChildren(createElement('p', 'page-text', text));
};

// .md 파일 하나를 불러와 글 정보와 본문으로 나눈다. 제목·날짜가 없으면 실패로 본다.
const fetchPost = async (id) => {
  const response = await fetch(postUrl(id));
  if (response.status === 404) throw new NotFoundError(id);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { data, content } = parseFrontMatter(await response.text());
  if (!data.title || !DATE_RE.test(data.date || '')) {
    throw new Error(`${id}: 제목이나 날짜가 없습니다.`);
  }
  return {
    id,
    title: data.title,
    date: data.date,
    // 요약은 summary 또는 description 어느 이름으로 써도 된다.
    summary: data.summary || data.description || '',
    tags: (data.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    // draft: true인 글은 초안이라 목록·상세 어디에도 보여 주지 않는다.
    draft: (data.draft || '').toLowerCase() === 'true',
    content,
  };
};

/* 글 목록 */

const createCard = (post) => {
  const item = document.createElement('li');
  const card = createElement('article', 'post-card');

  const title = createElement('h2', 'post-card__title');
  const link = createElement('a', 'post-card__link', post.title);
  link.href = `post.html?id=${encodeURIComponent(post.id)}`;
  title.append(link);

  card.append(title, createDate(post, 'post-card__date'));
  if (post.summary) card.append(createElement('p', 'post-card__summary', post.summary));
  if (post.tags.length > 0) card.append(createTagList(post.tags, 'post-card'));

  item.append(card);
  return item;
};

const renderList = async () => {
  try {
    const response = await fetch(INDEX_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    if (!Array.isArray(index)) throw new Error('index.json 형식이 올바르지 않습니다.');
    const ids = index.filter((id) => typeof id === 'string' && ID_RE.test(id));

    // 일부 글이 실패해도 나머지는 보여 준다.
    const results = await Promise.allSettled(ids.map(fetchPost));
    const posts = [];
    let failed = index.length - ids.length;
    results.forEach((result, order) => {
      if (result.status === 'fulfilled') {
        if (!result.value.draft) posts.push({ ...result.value, order });
      } else {
        failed += 1;
        console.warn('글을 불러오지 못했습니다:', ids[order], result.reason);
      }
    });

    // 최신 날짜 먼저, 날짜가 같으면 index.json에서 뒤에 있는 글 먼저.
    posts.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);

    const children = [];
    if (posts.length > 0) {
      const list = createElement('ul', 'post-list');
      posts.forEach((post) => list.append(createCard(post)));
      children.push(list);
    } else if (failed === 0) {
      children.push(createElement('p', 'page-text', '아직 글이 없습니다.'));
    }
    if (failed > 0) {
      children.push(createElement('p', 'page-text post-list__notice', `글 ${failed}개를 불러오지 못했습니다.`));
    }
    listArea.replaceChildren(...children);
  } catch (error) {
    console.warn('글 목록을 불러오지 못했습니다:', error);
    showMessage(listArea, '글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
};

/* 글 상세 */

const setPageMeta = (title, description) => {
  document.title = `${title} - ${SITE_NAME}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && description) meta.setAttribute('content', description);
};

const createBackLink = () => {
  const backLink = createElement('a', 'post-detail__back', '← 글 목록으로');
  backLink.href = 'index.html';
  return backLink;
};

const showDetailMessage = (heading, text) => {
  setPageMeta(heading);
  detailArea.replaceChildren(
    createElement('h1', 'page-title', heading),
    createElement('p', 'page-text', text),
    createBackLink(),
  );
};

const renderPost = (post) => {
  setPageMeta(post.title, post.summary);

  const header = createElement('header', 'post-detail__header');
  header.append(
    createElement('h1', 'post-detail__title', post.title),
    createDate(post, 'post-detail__date'),
  );
  if (post.tags.length > 0) header.append(createTagList(post.tags, 'post-detail'));

  // innerHTML은 마크다운 변환기(parse) 결과에만 쓴다. 변환기가 글 안의 HTML을 모두 글자로 바꾼다.
  const body = createElement('div', 'post-detail__body');
  body.innerHTML = parse(post.content);

  detailArea.replaceChildren(header, body, createBackLink());
};

const renderDetail = async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !ID_RE.test(id)) {
    showDetailMessage('글을 찾을 수 없습니다', '주소가 올바른지 확인해 주세요.');
    return;
  }
  try {
    const post = await fetchPost(id);
    if (post.draft) {
      showDetailMessage('아직 공개되지 않은 글입니다', '초안 상태인 글이에요. 공개된 뒤에 다시 와 주세요.');
      return;
    }
    renderPost(post);
  } catch (error) {
    if (error instanceof NotFoundError) {
      showDetailMessage('글을 찾을 수 없습니다', '삭제되었거나 주소가 잘못된 글입니다.');
      return;
    }
    console.warn('글을 불러오지 못했습니다:', error);
    showDetailMessage('글을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
  }
};

if (listArea) renderList();
if (detailArea) renderDetail();
