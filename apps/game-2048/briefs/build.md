# Build 서브에이전트 지침 — 2048 게임

## 역할
너는 Build 단계 담당이다. 승인된 계획서대로 2048 게임을 구현한다. 검증(Review)은 별도 서브에이전트가 하므로 review.md는 쓰지 않는다.

## 기준 문서
- **`C:\Users\bobby\Desktop\my-blog\apps\game-2048\spec.md`** — 사용자가 승인한 계획서. 모든 결정은 여기에 따른다. 특히 2.9(진행 중인 판 저장)와 10장(결정 사항)은 승인 후 추가된 내용이니 빠뜨리지 않는다.
- `C:\Users\bobby\Desktop\my-blog\CLAUDE.md` — 웹앱 규칙, 코드 스타일
- 참고(읽기만): 블로그의 `css/style.css`(색 변수·폰트 값 복사용), `index.html` `<head>`의 인라인 테마 스크립트(복사용)

## 수정 범위 (이 파일만 만든다/고친다)
`C:\Users\bobby\Desktop\my-blog\apps\game-2048\` 안의 다음 파일:
- `index.html`
- `style.css`
- `game.js`
- `main.js`
- `preview.svg`

이 밖의 파일(블로그의 `index.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, 이 폴더의 `spec.md`, `briefs/`)은 **절대 수정하지 않는다**. 계획서와 다르게 해야 할 이유가 생기면 고치지 말고 보고에 적는다.

## 구현 조건
- HTML, CSS, JavaScript(ES 모듈)만. 외부 라이브러리·CDN 쓰지 않는다. npm 설치 금지.
- `game.js`는 순수 함수만(DOM, `window`, `localStorage` 접근 없음, `Math.random`은 기본 인자로만).
- 모든 경로는 상대 경로.
- 2칸 들여쓰기, 세미콜론, `const`/`let`, 전역 변수 없음, 클래스명 소문자-하이픈, `!important` 금지.

## 스스로 확인할 것 (간단히)
- `node`로 `game.js`를 import해서 spec 8.1의 `slideLine`/`move`/`canMove` 사례를 실행해 결과가 맞는지 확인한다(검증 스크립트는 스크래치 폴더나 임시 파일로 만들고, 위 수정 범위 안에 남기지 않는다).
- 문법 오류가 없는지 확인한다. 브라우저 확인은 Review 단계에서 하므로 서버를 띄울 필요는 없다.

## 끝나면
만든 파일 목록, spec과 다르게 한 부분(있다면 이유), node로 확인한 결과를 짧게 보고한다.
