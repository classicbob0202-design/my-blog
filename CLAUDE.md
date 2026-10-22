# CLAUDE.md

## 프로젝트 개요

`posts/` 폴더의 마크다운 글을 브라우저에서 직접 읽어 렌더링하는 정적 블로그입니다.
빌드 단계 없이 파일 그대로 GitHub Pages에 배포합니다(`.nojekyll`로 Jekyll 처리를 끔).
목표는 **깔끔하고 읽기 좋은** 블로그이며, 다크 모드와 모바일 화면을 지원합니다.

## 기술 제약

- 순수 HTML, CSS, JavaScript(ES 모듈)만 사용합니다.
- 프레임워크(React, Vue 등), CSS 라이브러리(Tailwind, Bootstrap 등), jQuery, 번들러(webpack, Vite 등), npm 의존성을 추가하지 않습니다.
- 마크다운 파서도 직접 구현합니다(`js/markdown.js`).
- 외부 라이브러리가 꼭 필요해 보이면 추가하기 전에 먼저 사용자에게 묻습니다.

## 동작 방식

- `index.html`(목록)과 `post.html`(상세)은 모두 `js/main.js`를 불러오고, `<body data-page="list|post">` 값으로 어느 화면을 그릴지 정합니다.
- **목록**: `posts/index.json`(slug 배열) → 각 `posts/{slug}.md`를 `fetch` → `parseFrontMatter()`로 메타데이터 추출 → `date` 기준 최신순 정렬 → `.post-list`로 렌더링. 일부 글만 실패하면 나머지는 보여주고 실패 개수를 안내합니다.
- **상세**: `post.html?slug=파일명`. slug는 `SLUG_RE`(`/^[a-z0-9-]+$/`)로 검증한 뒤 불러오고, 본문은 `parse()` 결과를 `.post-content`에 넣습니다. 문서 제목과 `meta[name="description"]`도 글에 맞게 바꿉니다.
- DOM은 `main.js`의 `el()` 헬퍼로 만들고, 사용자 입력이나 글 메타데이터는 `textContent`로만 넣습니다. `innerHTML`은 `parse()` 결과에만 씁니다.
- 불러오기 실패 시 빈 화면 대신 `showMessage()`로 안내합니다(404는 "글을 찾을 수 없습니다", 그 외는 "불러오지 못했습니다").

## 디렉터리 구조

```
my-blog/
├── .gitignore          # Git에서 제외할 파일
├── .nojekyll           # GitHub Pages의 Jekyll 처리 끄기
├── .claude/
│   └── launch.json     # 로컬 미리보기 서버 설정 (python http.server, 8000)
├── index.html          # 글 목록 페이지
├── post.html           # 글 상세 페이지 (post.html?slug=파일명)
├── css/
│   └── style.css       # 전체 스타일 (디자인 토큰, 라이트/다크 변수)
├── js/
│   ├── main.js         # 목록·상세 렌더링, 오류 안내, 공통 초기화
│   ├── markdown.js     # 마크다운 → HTML 변환기, front matter 파서
│   └── theme.js        # 다크 모드 토글
├── images/             # 글에 쓰는 이미지
└── posts/
    ├── index.json      # 글 목록 매니페스트 (slug 배열)
    └── *.md            # 블로그 글
```

구조를 바꾸면 이 섹션도 함께 갱신합니다.

## 글 작성

각 글은 `posts/{slug}.md`이며 맨 위에 front matter를 둡니다.

```markdown
---
title: 글 제목
date: 2026-10-22
tags: [일상, 개발]
description: 목록에 표시될 한 줄 요약
---

본문...
```

- 파일명이 곧 slug입니다. 영문 소문자, 숫자, 하이픈만 씁니다(예: `my-first-post.md`).
- 정적 호스팅은 폴더 목록을 읽을 수 없으므로 **새 글은 반드시 `posts/index.json`에 slug를 추가**합니다. 이 파일은 slug 문자열 배열(`["hello-world"]`)만 담고, 제목·날짜 같은 메타데이터는 front matter에만 둡니다.
- `date`는 `YYYY-MM-DD` 형식입니다(정렬과 날짜 표시가 이 형식에 의존).
- 이미지는 `images/`에 두고 본문에서 `images/파일명`으로 참조하며, 대체 텍스트를 꼭 씁니다.

## 마크다운 변환기 (`js/markdown.js`)

공개 함수: `parse(markdown) → html`, `parseFrontMatter(text) → { meta, body }`, `escapeHtml(str)`.

지원 문법:

- 제목(`#`~`######`), 문단, 줄바꿈
- 굵게, 기울임, 취소선, 인라인 코드
- 링크, 이미지
- 순서 있는/없는 목록(중첩 포함)
- 인용문, 수평선
- 코드 블록(``` / ~~~, 언어 표기 → `class="language-xxx"`)
- 표(GFM 스타일, `.table-wrap`으로 감쌈)

규칙:

- **보안**: 본문 텍스트는 반드시 HTML 이스케이프한 뒤 변환합니다. 링크·이미지 URL은 허용 목록(`http`, `https`, `mailto`, 상대 경로)만 통과시키고 `javascript:`, `data:` 등은 걸러냅니다.
- DOM에 의존하지 않는 순수 함수로 유지합니다.
- 지원 문법을 추가하거나 바꾸면 위 목록도 갱신합니다.

## 디자인

장식보다 가독성을 우선합니다. 값은 `css/style.css`의 `:root` 디자인 토큰으로 관리합니다.

- **색상**: `--color-bg`, `--color-text`, `--color-muted`, `--color-accent`, `--color-border`, `--color-code-bg`, `--color-tag-bg`, `--color-quote-border`. 컴포넌트에서 색 값을 직접 쓰지 않고 변수만 씁니다. 새 색이 필요하면 라이트·다크 양쪽에 변수를 추가합니다.
- **글꼴**: `--font-sans`(시스템 폰트 스택, 한글은 Apple SD Gothic Neo·Pretendard·Noto Sans KR·Malgun Gothic), `--font-mono`.
- **간격**: `--space-1`~`--space-8`, 좌우 여백 `--gutter`. 임의의 px 값 대신 이 변수를 씁니다.
- **본문**: 폭 `--content-width`(70ch), 글자 크기 `1.0625rem`~`1.125rem`, 줄 간격 `1.7` 이상.
- **대비**: 라이트·다크 모두 본문 텍스트 대비 WCAG AA(4.5:1) 이상.
- 코드 블록과 표는 `overflow-x: auto`로 가로 스크롤, 이미지는 `max-width: 100%`.

## 다크 모드

- 기본값은 OS 설정(`prefers-color-scheme`)을 따릅니다.
- 테마는 `<html data-theme="light|dark">`로 적용하고, CSS는 `[data-theme="dark"]`에서 **색상 변수만** 재정의합니다.
- 깜빡임을 막기 위해 각 HTML의 `<head>` 맨 앞 인라인 스크립트가 저장값 또는 OS 설정으로 테마를 먼저 적용합니다. 이 스크립트는 `index.html`과 `post.html`에 똑같이 유지합니다.
- `js/theme.js`의 `initThemeToggle()`이 헤더의 `.theme-toggle` 버튼을 연결합니다.
  - 선택값은 `localStorage`의 `theme` 키에 저장하고, 모든 접근은 `try/catch`로 감쌉니다.
  - 직접 고른 값이 없으면 OS 설정 변경을 따라가고, 다른 탭에서 바꾼 값도 반영합니다.
- 토글 버튼에는 `aria-label`을 달고 현재 상태를 `aria-pressed`로 표시합니다.

## 반응형 / 모바일

- **모바일 우선**: 기본 스타일은 작은 화면 기준이고, 넓은 화면은 `@media (min-width: 768px)`에서 확장합니다(예: `--gutter` 16px → 24px).
- 모든 페이지에 `<meta name="viewport" content="width=device-width, initial-scale=1">`를 넣습니다.
- 좌우 여백은 모바일에서 최소 16px이며, 어떤 폭에서도 가로 스크롤이 생기지 않아야 합니다.
- 링크·버튼 등 탭 대상은 최소 `--tap-size`(44px) 크기입니다.

## 코드 스타일

- **HTML**: 시맨틱 태그(`header`, `main`, `article`, `nav`, `footer`, `time`) 사용, `lang="ko"`, 이미지에는 `alt`.
- **CSS**: 클래스 이름은 소문자-하이픈(`post-list`, `post-meta`). `!important`는 쓰지 않습니다.
- **JavaScript**: ES 모듈(`<script type="module">`), `const`/`let`, 2칸 들여쓰기, 세미콜론. 전역 변수를 만들지 않습니다. 주석은 한국어로, 이유가 필요한 곳에만 짧게 씁니다.

## 로컬 실행과 확인

`fetch()`로 글을 읽기 때문에 `file://`로 열면 동작하지 않습니다. 로컬 서버로 실행합니다.

```bash
python -m http.server 8000
```

그다음 `http://localhost:8000`을 엽니다(`.claude/launch.json`의 `blog` 설정과 같음).

테스트 프레임워크는 없으므로 변경 후 브라우저에서 직접 확인합니다.

- 라이트/다크 모드 모두에서 색과 대비
- 모바일 폭(375px)에서 가로 스크롤 없음, 코드 블록·표 스크롤
- 없는 글(`post.html?slug=no-such-post`)과 잘못된 slug에서 안내 메시지 표시
- 콘솔에 오류 없음

## 작업 규칙

- 큰 변경(구조 변경, 새 기능)은 계획을 먼저 보여주고 승인을 받은 뒤 구현합니다.
- 막히거나 요구사항이 불분명하면 추측하지 말고 사용자에게 묻습니다.
- 커밋은 사용자가 요청할 때만 합니다.
