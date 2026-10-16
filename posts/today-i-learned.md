---
title: 오늘 배운 것
date: 2026-10-16
tags: [TIL, HTML, CSS, JavaScript]
description: 클로드 코드로 블로그를 만들면서 알게 된 HTML, CSS, JavaScript의 역할을 정리했습니다.
---

오늘은 클로드 코드와 함께 이 블로그를 처음부터 만들어 봤습니다.
프레임워크 없이 **HTML, CSS, JavaScript**만 썼더니 세 가지가 각자 어떤 일을 하는지 또렷하게 보였어요.

한 문장으로 줄이면 이렇습니다.

> HTML은 **뼈대**, CSS는 **옷**, JavaScript는 **움직임**이다.

## HTML: 내용과 구조

HTML은 페이지에 **무엇이 있는지**를 정합니다. 제목, 본문, 목록, 버튼 같은 것들이죠.

```html
<header>…</header>
<main>
  <article>…</article>
</main>
<footer>…</footer>
```

- `div`만 늘어놓기보다 `header`, `main`, `article` 같은 **시맨틱 태그**를 쓰면 구조가 더 잘 드러납니다.
- 화면 읽기 프로그램이나 검색 엔진도 이 구조를 보고 페이지를 이해합니다.
- `<meta name="viewport">` 한 줄이 있어야 휴대폰에서 화면이 제 크기로 보인다는 것도 배웠어요.

## CSS: 모양과 배치

CSS는 내용이 **어떻게 보일지**를 정합니다. 색, 글꼴, 여백, 레이아웃이 모두 CSS의 몫이에요.

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1f2328;
}

:root[data-theme="dark"] {
  --color-bg: #0f1215;
  --color-text: #e3e6ea;
}
```

- 색을 **CSS 변수**로 한곳에 모아 두니 다크 모드는 변수 값만 바꾸면 끝났습니다.
- 본문 폭을 `70ch` 정도로 제한하면 한 줄이 너무 길지 않아 읽기 편합니다.
- 작은 화면을 기준으로 먼저 만들고, 넓은 화면은 `@media (min-width: 768px)`로 덧붙이는 **모바일 우선** 방식을 썼어요.

## JavaScript: 동작과 데이터

JavaScript는 페이지가 **무엇을 할지**를 정합니다. 이 블로그에서는 이런 일을 맡았어요.

1. `fetch()`로 마크다운 파일을 불러온다.
2. 마크다운을 HTML로 바꿔 화면에 넣는다.
3. 다크 모드 버튼을 누르면 테마를 바꾸고, 선택을 `localStorage`에 기억한다.

```js
button.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
});
```

- `fetch()`를 쓰기 때문에 파일을 더블클릭해서 열면 안 되고, `python -m http.server` 같은 **로컬 서버**로 열어야 했어요.
- 글 내용을 그대로 HTML로 넣으면 위험할 수 있어서, 특수 문자를 먼저 **이스케이프**한다는 점도 새로 알았습니다.

## 한눈에 보기

| 기술 | 역할 | 이 블로그에서 한 일 |
| --- | --- | --- |
| HTML | 구조 | 헤더, 글 목록, 본문 영역 만들기 |
| CSS | 디자인 | 색상, 여백, 다크 모드, 모바일 화면 |
| JavaScript | 동작 | 글 불러오기, 마크다운 변환, 테마 전환 |

---

세 가지를 나눠서 생각하니 무엇을 고쳐야 할 때 **어느 파일을 열어야 할지** 바로 알 수 있었어요.
다음에는 글 검색 기능을 직접 만들어 보고 싶습니다.
