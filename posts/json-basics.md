---
title: JSON 쉽게 이해하기
date: 2026-10-21
tags: [개발, 웹 기초, 데이터]
description: 웹 개발에서 가장 자주 만나는 데이터 형식, JSON의 생김새와 규칙, 자주 하는 실수
auto: daily
---

웹 개발을 시작하면 곧 **JSON**이라는 단어를 만나게 됩니다. 서버에서 받은 데이터, 설정 파일, 이 블로그의 글 목록 파일(`posts/index.json`)까지 모두 JSON입니다. 오늘은 JSON이 무엇이고 어떻게 읽고 쓰는지 정리해 봅니다.

## JSON이란?

JSON은 **JavaScript Object Notation**의 줄임말로, 데이터를 글자로 적어 주고받기 위한 약속된 형식입니다. 이름에 JavaScript가 들어가지만 Python, Java, Go 등 거의 모든 언어에서 읽고 쓸 수 있습니다.

> 사람이 읽기에도 쉽고, 컴퓨터가 해석하기에도 쉬운 것. 그것이 JSON이 널리 쓰이는 이유입니다.

## 생김새 살펴보기

간단한 사용자 정보를 JSON으로 적으면 이렇습니다.

```json
{
  "name": "민수",
  "age": 27,
  "isStudent": false,
  "skills": ["HTML", "CSS", "JavaScript"],
  "address": {
    "city": "서울",
    "zip": "04524"
  },
  "nickname": null
}
```

- 중괄호 `{ }` 는 **객체**입니다. `"이름": 값` 쌍을 쉼표로 이어 적습니다.
- 대괄호 `[ ]` 는 **배열**입니다. 값을 순서대로 나열합니다.
- 객체 안에 객체나 배열을 넣어 얼마든지 겹쳐 쓸 수 있습니다.

## 쓸 수 있는 값의 종류

JSON에서 쓸 수 있는 값은 여섯 가지뿐입니다.

| 종류 | 예시 | 설명 |
| --- | --- | --- |
| 문자열 | `"안녕"` | 반드시 큰따옴표로 감쌉니다 |
| 숫자 | `42`, `3.14` | 따옴표 없이 씁니다 |
| 불리언 | `true`, `false` | 참·거짓 |
| null | `null` | 값이 없음 |
| 배열 | `[1, 2, 3]` | 순서 있는 목록 |
| 객체 | `{"a": 1}` | 이름과 값의 묶음 |

날짜나 함수 같은 타입은 따로 없습니다. 날짜는 보통 `"2026-10-21"` 처럼 문자열로 적습니다.

## 초보자가 자주 하는 실수

JSON은 규칙이 엄격해서 작은 실수 하나로 파일 전체를 읽지 못하게 됩니다.

1. **작은따옴표 사용**: `'name'` 은 안 됩니다. 이름과 문자열 모두 큰따옴표 `"name"` 만 씁니다.
2. **마지막 쉼표**: `[1, 2, 3,]` 처럼 마지막 값 뒤에 쉼표를 붙이면 오류입니다.
3. **주석 넣기**: JSON에는 주석 문법이 없습니다. `//` 나 `/* */` 를 쓰면 안 됩니다.
4. **이름에 따옴표 빼먹기**: JavaScript 객체와 달리 `{name: "민수"}` 는 올바른 JSON이 아닙니다.

## JavaScript에서 다루기

JavaScript에는 JSON을 다루는 내장 함수 두 개가 있습니다.

```js
const text = '{"title": "첫 글", "views": 10}';

// 문자열 → 객체
const post = JSON.parse(text);
console.log(post.title); // 첫 글

// 객체 → 문자열 (들여쓰기 2칸)
const output = JSON.stringify(post, null, 2);
console.log(output);
```

`fetch()` 로 데이터를 받을 때는 `response.json()` 이 `JSON.parse` 를 대신 해 줍니다.

```js
const response = await fetch('posts/index.json');
const slugs = await response.json();
```

## 형식이 맞는지 확인하는 법

JSON이 올바른지 헷갈릴 때는 직접 확인해 보는 습관이 좋습니다.

- 브라우저 개발자 도구 콘솔에 `JSON.parse('...')` 를 넣어 보면 틀린 위치를 알려 줍니다.
- VS Code 같은 편집기는 `.json` 파일의 문법 오류에 빨간 밑줄을 그어 줍니다.
- Node.js가 있다면 `node -e "JSON.parse(require('fs').readFileSync('파일.json', 'utf8'))"` 로 검사할 수 있습니다.

## 마무리

JSON은 객체와 배열, 그리고 여섯 가지 값만 알면 충분합니다. 큰따옴표와 쉼표 규칙만 조심하면 어떤 데이터든 깔끔하게 담을 수 있습니다. 다음에 API 응답이나 설정 파일을 열어 보게 되면, 오늘 본 구조를 떠올리며 천천히 읽어 보세요.
