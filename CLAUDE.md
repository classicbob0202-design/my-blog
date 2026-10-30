# CLAUDE.md

이 프로젝트에서 작업할 때 따르는 기준이다. 다른 문서(스킬, 메모)와 다르면 이 파일을 따르고, 차이를 사용자에게 알린다.

## 프로젝트 개요

- **목표**: 개인 블로그 웹사이트
- **연습 순서**: 처음부터 하나씩 다시 만드는 연습 프로젝트다. 앞 단계가 끝나기 전에 다음 단계 작업(미니앱 폴더, 배포 설정, 하네스 등)을 미리 만들지 않는다.
  1. 블로그 작성 ← **지금 단계**
  2. 미니앱 추가
  3. GitHub 배포
  4. 하네스 구축 (Plan → Build → Review → Embed)
- **기술 스택**: 순수 HTML, CSS, JavaScript (Vanilla)
- **금지**: React·Vue·Svelte 등 프레임워크, Tailwind·Bootstrap 등 CSS 라이브러리, jQuery, 빌드 도구(Webpack·Vite 등), npm 패키지 의존성
- **필수 요구사항**
  1. 다크 모드 지원
  2. 모바일에서도 잘 보이는 반응형 레이아웃

## 폴더 구조

현재 구조다. 작업 전에 실제 폴더를 확인하고, 구조를 바꾸면 이 트리도 함께 고친다. `(예정)` 표시는 아직 없는 폴더다.

```
/
├── index.html          # 메인 (글 목록)
├── post.html           # 글 상세 페이지 (post.html?id=글이름)
├── about.html          # 소개 페이지
├── css/
│   ├── reset.css       # 브라우저 기본 스타일 초기화
│   ├── variables.css   # 색상·폰트·간격 변수 (라이트/다크 테마)
│   └── style.css       # 레이아웃 및 컴포넌트 스타일
├── js/
│   ├── theme.js        # 다크 모드 토글
│   ├── main.js         # 공통 기능 (모바일 메뉴)
│   ├── posts.js        # 글 목록·상세 렌더링 (ES 모듈)
│   └── markdown.js     # 직접 만든 마크다운 변환기 (ES 모듈)
├── posts/
│   ├── index.json      # 게시할 글 이름 목록 (예: ["hello-blog", "dark-mode"])
│   ├── {글이름}.md     # 글 하나 = 파일 하나 (프런트매터 + 마크다운 본문)
│   └── drafts/         # (예정) 예약 작업이 만드는 AI 뉴스 초안. 블로그에 보이지 않는다
└── assets/
    └── images/         # (예정) 글에 넣을 이미지
```

## 글 쓰는 법

1. `posts/{글이름}.md` 파일을 만든다. 글이름은 영문 소문자·숫자·하이픈만 쓴다 (`/^[a-z0-9-]+$/`).
2. 파일 맨 위에 프런트매터를 쓴다.

```markdown
---
title: 글 제목
date: 2026-10-30
tags: 태그1, 태그2
description: 목록 카드에 보이는 한두 문장 요약 (summary라고 써도 된다)
draft: false
---
```

   - `title`, `date`(YYYY-MM-DD)는 필수다. 없으면 목록에서 빠지고 "글 N개를 불러오지 못했습니다"에 세어진다.
   - `draft: true`면 초안이다. 목록에도 안 보이고, 주소로 들어와도 "아직 공개되지 않은 글입니다"만 보인다.
3. 본문은 `##`부터 쓴다 (`#`은 글 제목이 쓴다). 지원 문법: 제목, 문단, 굵게·기울임, 인라인 코드, 코드 블록, 링크·이미지(`http(s)`와 상대 경로만), 목록, 인용, 구분선. 표와 중첩 목록, HTML 태그는 지원하지 않는다 (HTML은 글자 그대로 보인다).
4. `posts/index.json`에 글이름을 추가한다. 목록은 날짜 최신순이고, 날짜가 같으면 `index.json`에서 뒤에 있는 글이 먼저다.

## 다크 모드 규칙

- 색상은 **반드시 CSS 변수**로 정의하고, 코드 안에 색상값을 직접 쓰지 않는다.
- 테마는 `<html data-theme="light|dark">` 속성으로 전환한다.
- 초기 테마 결정 순서:
  1. `localStorage`에 저장된 사용자 선택
  2. 없으면 시스템 설정 `prefers-color-scheme`
- 페이지 로드 시 깜빡임(FOUC)을 막기 위해, 테마 결정 스크립트는 `<head>` 안에 **인라인으로** 넣는다.
- `localStorage` 접근은 `try/catch`로 감싼다.
- 토글 버튼에는 `aria-label`을 붙이고, 현재 상태에 맞게 아이콘(☀️/🌙)을 바꾼다.
- 아래 값은 `css/variables.css`를 처음 만들 때 쓰는 시작값이다. 파일이 생긴 뒤에는 `variables.css`가 기준이며, 색을 바꾸면 여기는 고치지 않아도 된다.

```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --text-muted: #666666;
  --accent: #2563eb;
  --border: #e5e5e5;
  --card-bg: #f9f9f9;
}
[data-theme="dark"] {
  --bg: #121212;
  --text: #e8e8e8;
  --text-muted: #a0a0a0;
  --accent: #60a5fa;
  --border: #2a2a2a;
  --card-bg: #1e1e1e;
}
```

- 다크 모드에서도 텍스트 대비율은 WCAG AA(4.5:1) 이상을 유지한다.
- 테마 전환 시 `transition: background-color 0.2s, color 0.2s` 정도의 부드러운 효과만 준다.

## 반응형(모바일) 규칙

- **모바일 퍼스트**로 작성: 기본 스타일은 모바일, `min-width` 미디어 쿼리로 확장한다.
- 브레이크포인트
  - 모바일: 기본 (~767px)
  - 태블릿: `@media (min-width: 768px)`
  - 데스크톱: `@media (min-width: 1024px)`
- 모든 HTML 파일에 `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수.
- 본문 최대 너비는 `max-width: 720px` 정도로 제한해 가독성을 확보한다.
- 좌우 여백은 모바일에서 최소 `16px`.
- 가로 스크롤이 생기지 않게 한다 (이미지·코드블록 포함).
  - 이미지: `max-width: 100%; height: auto;`
  - 코드블록: `overflow-x: auto;`
- 폰트 크기는 `rem` 단위, 본문 기본 `1rem`(16px) 이상. 필요하면 `clamp()` 사용.
- 터치 대상(버튼·링크)은 최소 `44×44px`.
- 모바일에서는 내비게이션을 햄버거 메뉴로 접는다.
- 레이아웃은 Flexbox와 Grid를 사용한다 (float 금지).

## 코드 작성 규칙

### HTML
- 시맨틱 태그 사용: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`
- `<html lang="ko">` 지정
- 이미지에는 의미 있는 `alt` 텍스트
- 들여쓰기 2칸

### CSS
- 클래스 이름은 BEM 방식 (`.post-card__title`, `.nav--open`)
- `!important` 사용 금지
- ID 선택자로 스타일링하지 않는다

### JavaScript
- ES6+ 문법 (`const`/`let`, 화살표 함수, 템플릿 리터럴, `async/await`)
- `var` 사용 금지
- 전역 변수 최소화, 기능별로 파일 분리
- 불러오기 방식
  - 다른 파일과 코드를 주고받는 파일(`posts.js`, `markdown.js`)은 ES 모듈: `<script type="module">` + `import`/`export`
  - 혼자 동작하는 파일(`theme.js`, `main.js`)은 `<script defer>` + 즉시 실행 함수
  - 테마 초기화 스크립트만 `<head>` 안 인라인
- 사용자 입력이나 글 정보(제목·요약·태그 등)를 DOM에 넣을 때는 `textContent`만 쓴다. `innerHTML`은 마크다운 변환기 `parse()`의 결과에만 쓴다 (변환기가 글 안의 HTML을 모두 글자로 바꾼다).
- `fetch()`로 `posts/` 파일을 불러오므로 `file://`로는 열리지 않는다. 로컬 확인은 프로젝트 폴더에서 `python -m http.server 8000`을 띄우고 `http://localhost:8000/`으로 연다.
- 브라우저가 예전 JS·CSS를 기억해 바뀐 내용이 안 보이면 강력 새로고침(Ctrl+F5)한다.
- 순수 로직(`markdown.js` 등)은 Node로 테스트한다. 테스트 스크립트는 프로젝트 밖(스크래치 폴더)에 둔다.

## 작업 방식

- **승인 먼저**: 파일을 만들거나 고치기 전에 무엇을, 어느 파일에서 바꿀지 계획을 보여 주고 사용자 승인을 받는다. 승인 없이 편집하지 않는다.
- 한 번에 하나의 기능만 변경한다.
- 변경 후 직접 확인한다 (내장 브라우저 사용)
  - 라이트/다크 모드를 둘 다 켜 보고 정상 표시되는지 본다.
  - 화면 폭 375px(모바일), 768px(태블릿), 1280px(데스크톱)에서 깨짐과 가로 스크롤이 없는지 본다.
  - 브라우저 콘솔에 에러가 없는지 본다.
  - 확인하지 못한 항목은 확인했다고 말하지 않고, 못 한 이유와 함께 알린다.
- 외부 라이브러리·CDN·새 파일 구조가 필요해 보이면 추가하기 전에 묻는다.
- 예약 작업 `my-blog-ai-news-draft`(매일 오전 8시)는 `posts/drafts/`에 초안만 만든다. 초안을 게시할 때는 사용자 승인 후 `posts/`로 옮기고 `index.json`에 추가한다. 글 형식을 바꾸면 이 예약 작업의 지침(`~/.claude/scheduled-tasks/my-blog-ai-news-draft/SKILL.md`)도 함께 맞춘다.
- git 커밋·푸시는 사용자가 요청할 때만 한다.
- 설명과 주석은 한국어로 작성한다. 설명은 쉽고 간결하게 한다.
