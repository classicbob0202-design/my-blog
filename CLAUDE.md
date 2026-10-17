# CLAUDE.md

## 프로젝트 개요

`posts/` 폴더의 마크다운 파일을 읽어 블로그 웹사이트로 보여주는 프로젝트입니다.
목표는 **깔끔하고 읽기 좋은** 블로그이며, 다크 모드와 모바일 화면을 지원합니다.

## 기술 제약

- **프레임워크·빌드 도구 없음**: 순수 HTML, CSS, JavaScript(ES 모듈)만 사용합니다.
- React, Vue, Tailwind, Bootstrap, jQuery, 번들러(webpack, Vite 등), npm 의존성을 추가하지 않습니다.
- 마크다운 파서도 직접 구현합니다(`js/markdown.js`). 외부 라이브러리가 꼭 필요해 보이면 추가하기 전에 먼저 사용자에게 물어봅니다.

## 디렉터리 구조

```
my-blog/
├── index.html          # 글 목록 페이지
├── post.html           # 글 상세 페이지 (post.html?slug=파일명)
├── css/
│   └── style.css       # 전체 스타일 (라이트/다크 테마 변수 포함)
├── js/
│   ├── main.js         # 목록·상세 렌더링, 공통 초기화
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   └── theme.js        # 다크 모드 토글
├── images/             # 글에 쓰는 이미지 (본문에서 images/파일명 으로 참조)
└── posts/
    ├── index.json      # 글 목록(매니페스트)
    └── *.md            # 블로그 글
```

구조를 바꿔야 할 때는 이 섹션도 함께 갱신합니다.

## 글 작성 규칙

각 글은 `posts/` 폴더의 마크다운 파일이며, 맨 위에 front matter를 둡니다.

```markdown
---
title: 글 제목
date: 2026-10-17
tags: [일상, 개발]
description: 목록에 표시될 한 줄 요약
---

본문...
```

- 파일명이 곧 slug입니다. 영문 소문자, 숫자, 하이픈만 사용합니다(예: `my-first-post.md`).
- 정적 호스팅에서는 폴더 목록을 읽을 수 없으므로, 새 글을 추가하면 `posts/index.json`에도 slug를 추가합니다. 이 파일은 slug 문자열 배열(`["hello-world"]`)이며, 제목·날짜 같은 메타데이터는 각 글의 front matter에만 둡니다.
- 목록은 `date` 기준 최신순으로 정렬합니다.

## 마크다운 변환기 (`js/markdown.js`)

지원 범위:

- 제목(`#`~`######`), 문단, 줄바꿈
- 굵게, 기울임, 취소선, 인라인 코드
- 링크, 이미지
- 순서 있는/없는 목록(중첩 포함)
- 인용문, 수평선
- 코드 블록(``` 와 언어 표기 → `class="language-xxx"`)
- 표(GFM 스타일)

규칙:

- **보안**: 본문 텍스트는 반드시 HTML 이스케이프한 뒤 변환합니다. `javascript:`, `data:` 같은 위험한 링크 프로토콜은 걸러냅니다.
- 변환 함수는 DOM에 의존하지 않는 순수 함수(`parse(markdown) → html`)로 유지합니다.
- 지원 문법을 추가하거나 바꾸면 위 목록도 갱신합니다.

## 디자인 원칙

장식보다 가독성을 우선합니다.

- **본문 폭**: 한 줄 길이를 `max-width: 70ch` 안팎으로 제한합니다.
- **타이포그래피**: 시스템 폰트 스택을 사용합니다(`-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif`). 본문 크기 `1.0625rem`~`1.125rem`, 줄 간격 `1.7` 이상.
- **여백**: 요소 사이 여백은 넉넉하게 두고, 간격 값은 CSS 변수로 일관되게 관리합니다.
- **색상**: 모든 색은 `:root`의 CSS 사용자 정의 속성(`--color-bg`, `--color-text`, `--color-muted`, `--color-accent`, `--color-border`, `--color-code-bg` 등)으로 정의하고, 컴포넌트에서 색 값을 직접 쓰지 않습니다.
- **대비**: 라이트·다크 모두 본문 텍스트 대비 WCAG AA(4.5:1) 이상을 지킵니다.
- 코드 블록은 가로 스크롤(`overflow-x: auto`)되게 하고, 이미지는 `max-width: 100%`로 넘치지 않게 합니다.

## 다크 모드

- 기본값은 OS 설정(`prefers-color-scheme`)을 따릅니다.
- 헤더의 토글 버튼으로 수동 전환할 수 있고, 선택값은 `localStorage`에 저장합니다. `localStorage` 접근은 `try/catch`로 감쌉니다.
- 테마는 `<html data-theme="light|dark">` 속성으로 적용하고, CSS에서는 `[data-theme="dark"]`에서 색상 변수만 재정의합니다.
- 페이지 로드 시 깜빡임을 막기 위해 테마 적용 스크립트는 `<head>` 안에서 인라인으로 가장 먼저 실행합니다.
- 토글 버튼에는 `aria-label`을 달고, 현재 상태를 `aria-pressed`로 표시합니다.

## 반응형 / 모바일

- **모바일 우선**으로 작성합니다. 기본 스타일은 작은 화면 기준이고, 넓은 화면은 `min-width` 미디어 쿼리로 확장합니다.
- 모든 페이지에 `<meta name="viewport" content="width=device-width, initial-scale=1">`를 넣습니다.
- 좌우 여백은 모바일에서 최소 `16px`이며, 어떤 화면에서도 가로 스크롤이 생기지 않아야 합니다.
- 탭 대상(링크, 버튼)은 최소 `44×44px`입니다.
- 표는 래퍼에 `overflow-x: auto`를 줘서 모바일에서 넘치지 않게 합니다.

## 코드 스타일

- HTML: 시맨틱 태그(`header`, `main`, `article`, `nav`, `footer`, `time`)를 사용하고, 이미지에는 `alt`를 답니다.
- CSS: 클래스 이름은 소문자-하이픈(`post-list`, `post-meta`). `!important`는 피합니다.
- JavaScript: ES 모듈(`<script type="module">`), `const`/`let`, 2칸 들여쓰기, 세미콜론 사용. 전역 변수를 만들지 않습니다.
- 글을 불러오지 못하면(404 등) 빈 화면 대신 안내 메시지를 보여줍니다.

## 로컬 실행

`fetch()`로 마크다운을 읽기 때문에 `file://`로 열면 동작하지 않습니다. 로컬 서버로 실행합니다.

```bash
python -m http.server 8000
```

그다음 브라우저에서 `http://localhost:8000`을 엽니다. 테스트 프레임워크는 없으므로, 변경 후에는 브라우저에서 라이트/다크 모드와 모바일 폭(375px)을 직접 확인합니다.

## 작업 규칙

- 큰 변경(구조 변경, 새 기능)은 계획을 먼저 보여주고 승인을 받은 뒤 구현합니다.
- 막히거나 요구사항이 불분명하면 추측하지 말고 사용자에게 묻습니다.
