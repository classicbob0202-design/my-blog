# 2048 게임 — 계획서 (spec)

> 작성: Plan 단계 / 2026-10-16
> 상태: 사용자 승인 완료(2026-10-16). 10장 결정 사항 반영.

## 1. 개요

4×4 판에서 방향키나 스와이프로 숫자 타일을 밀어 같은 숫자끼리 합치고, 2048 타일을 만드는 퍼즐 게임이다. 현재 점수와 최고 점수를 보여준다. 블로그와 같은 톤의 색·폰트, 같은 다크 모드 설정을 쓰고, `/apps/game-2048/` 안에서만 동작한다(빌드 도구·외부 라이브러리 없음).

## 2. 기능 목록

### 2.1 게임 규칙
- 판은 4×4이고, 빈 칸은 `0`으로 나타낸다.
- **시작**: 빈 판에 무작위 타일 2개를 놓는다(각각 2: 90%, 4: 10%).
- **이동**: 한 방향(상·하·좌·우)으로 모든 타일을 끝까지 민다.
- **합치기**:
  - 미는 방향의 앞쪽부터 처리한다. 같은 값 두 개가 맞닿으면 하나로 합쳐 값이 2배가 된다.
  - **한 번 이동에서 각 타일은 최대 한 번만 합쳐진다.** 합쳐서 생긴 타일은 같은 이동 안에서 다시 합쳐지지 않는다.
  - 예시(왼쪽으로 밀 때, 한 줄 기준):
    - `[2,2,2,2]` → `[4,4,0,0]`
    - `[2,2,4,0]` → `[4,4,0,0]` (새로 생긴 4는 기존 4와 합쳐지지 않는다)
    - `[4,4,8,8]` → `[8,16,0,0]`
    - `[2,2,2,0]` → `[4,2,0,0]` (앞쪽 두 개가 먼저 합쳐진다)
    - `[2,0,0,2]` → `[4,0,0,0]`
    - `[0,0,0,2]` → `[2,0,0,0]`
    - `[2,4,8,16]` → 변화 없음
- **새 타일**: 이동으로 판이 **실제로 바뀌었을 때만** 빈 칸 중 하나를 고르게 무작위로 골라 새 타일(2: 90%, 4: 10%)을 1개 놓는다. 판이 그대로면 새 타일도, 점수 변화도 없다.

### 2.2 점수
- 합쳐질 때마다 **합쳐진 결과 타일 값**만큼 점수를 더한다(예: 2+2 → +4, 한 번에 4와 8이 생기면 +12).
- 화면에 **현재 점수**와 **최고 점수**를 함께 보여준다.
- 최고 점수는 `localStorage` 키 `game-2048:best`에 정수 문자열로 저장한다. 읽기·쓰기 모두 `try/catch`로 감싸고, 실패하면 메모리 값만 쓴다(오류를 화면에 띄우지 않는다). 숫자가 아닌 값이 저장돼 있으면 0으로 본다.
- 현재 점수가 최고 점수를 넘는 순간 최고 점수도 함께 갱신·저장한다.
- 점수가 오를 때 점수 상자 옆에 `+N`이 잠깐 떠올랐다 사라지는 효과를 준다(장식용, `aria-hidden="true"`).

### 2.3 승리 / 패배
- **승리**: 이동 결과 판에 2048 이상 타일이 처음 생기면 승리 오버레이를 띄운다. 문구 "2048 달성!"과 버튼 **계속하기** / **새 게임**.
  - **계속하기**를 누르면 오버레이를 닫고 같은 판으로 계속한다. 이후 4096 등을 만들어도 승리 오버레이는 다시 뜨지 않는다(`keepPlaying = true`).
  - 승리 오버레이가 떠 있는 동안 이동 입력은 무시한다.
- **패배**: 이동(및 새 타일 생성) 후 빈 칸이 없고, 가로·세로로 인접한 같은 값도 없으면 게임 오버. 문구 "더 이상 움직일 수 없어요"와 최종 점수, 버튼 **다시 하기**.
  - 승리와 패배가 같은 이동에서 동시에 성립하면 승리 오버레이를 먼저 보여주고, "계속하기"를 누르면 곧바로 패배 오버레이를 보여준다.
- 오버레이는 판 위에 반투명으로 겹친다(판이 비쳐 보이게). 오버레이가 열리면 첫 버튼으로 포커스를 옮긴다.

### 2.4 새 게임
- 헤더의 **새 게임** 버튼은 언제든 판을 새로 시작한다(점수 0, `won`/`keepPlaying`/`over` 초기화, 타일 2개). 확인 창은 띄우지 않는다.
- 최고 점수는 유지한다.

### 2.5 조작
- **키보드**: 방향키, `W`/`A`/`S`/`D`(대소문자 무관). 방향키는 `preventDefault()`로 페이지 스크롤을 막는다. `Ctrl`/`Meta`/`Alt` 조합 입력은 무시한다. 포커스가 `<button>`에 있을 때도 방향키는 게임에 쓴다(Enter/Space는 버튼 동작).
- **터치 스와이프**(Pointer Events 사용):
  - 게임판 요소에 `touch-action: none`을 주어 스와이프 중 페이지가 스크롤·확대되지 않게 한다.
  - `pointerdown`에서 시작점 기록 → `pointerup`에서 이동량 계산. 이동 거리가 **30px 미만**이면 무시하고, 가로·세로 중 절댓값이 큰 축의 방향으로 1회 이동한다.
  - `pointercancel`이면 기록을 버린다. 마우스 드래그도 같은 방식으로 동작해도 된다.
  - 판 바깥(헤더, 안내 문구)은 일반 스크롤이 가능하게 둔다.
- 애니메이션 중에 들어온 입력도 받는다. 새 입력이 오면 진행 중인 애니메이션은 즉시 최종 상태로 맞춘 뒤 새 이동을 처리한다(입력이 씹히지 않게).

### 2.6 애니메이션 (가볍게)
- **이동**: 타일이 원래 칸에서 새 칸으로 `transform: translate`로 미끄러진다. 100ms, `ease-in-out`.
- **생성**: 새 타일은 이동 애니메이션이 끝난 뒤 `scale(0) → scale(1)`로 나타난다. 150ms.
- **합치기**: 합쳐진 타일은 `scale(1) → scale(1.15) → scale(1)`로 한 번 튄다. 150ms.
- `@media (prefers-reduced-motion: reduce)`에서는 모든 transition/animation을 끈다(즉시 배치).
- `transform`/`opacity`만 애니메이션하고, `top`/`left`/`width`는 애니메이션하지 않는다.

### 2.7 다크 모드
- 블로그와 **같은 규칙**을 따른다: `localStorage`의 `theme` 키가 `"light"`/`"dark"`면 그 값, 아니면 `prefers-color-scheme`.
- `<head>`에 블로그 `index.html`과 같은 인라인 스크립트를 **가장 먼저** 넣어 `<html data-theme>`를 설정한다(FOUC 방지). 블로그 파일을 import하지 않고 코드를 복사한다.
- 런타임 동기화(`main.js`):
  - 저장값이 없을 때 OS 설정이 바뀌면 따라간다(`matchMedia(...).addEventListener('change')`).
  - 다른 탭(블로그)에서 테마를 바꾸면 `window`의 `storage` 이벤트(`key === 'theme'`)로 감지해 반영한다.
- 게임 페이지에는 **테마 토글 버튼을 두지 않는다**(읽기 전용으로 따라가기). → 열린 질문 1 참고.

### 2.8 접근성
- `aria-live="polite"`인 시각적으로 숨긴(`.sr-only`) 영역 하나를 두고 다음을 알린다:
  - 이동으로 점수가 오른 경우: "점수 1234점" (최고 점수 갱신 시 "점수 1234점, 최고 기록"). 점수 변화가 없으면 알리지 않는다.
  - 승리: "2048 달성! 계속하려면 계속하기 버튼을 누르세요."
  - 패배: "게임 오버. 최종 점수 1234점."
  - 새 게임: "새 게임을 시작했습니다."
- 같은 문구가 연속될 때도 읽히도록, 갱신 시 내용을 비웠다가 다음 프레임(`requestAnimationFrame`)에 넣는다.
- 오버레이는 `role="dialog"`, `aria-modal="true"`, `aria-labelledby`(제목 id). 열려 있는 동안 Tab 포커스가 오버레이 버튼 안에서만 돌게 하고, 닫히면 게임판(또는 새 게임 버튼)으로 포커스를 돌려준다.
- 게임판 컨테이너: `role="application"`은 쓰지 않는다. 대신 `role="group"`, `aria-label="2048 게임판"`과 `aria-describedby`(안내 문구)를 단다. 개별 타일은 `aria-hidden="true"`(판 상태를 매 이동마다 읽어주지 않는다).
- 모든 버튼은 최소 44×44px, `:focus-visible` 윤곽선은 블로그와 동일(`2px solid var(--color-accent)`).
- 타일 숫자 대비는 라이트·다크 모두 WCAG AA(4.5:1) 이상(6장 표 참고, 모두 계산 확인함).

### 2.9 진행 중인 판 저장 (사용자 결정으로 추가)
- 새로고침해도 하던 판을 이어서 할 수 있게, 상태를 `localStorage` 키 `game-2048:state`에 JSON으로 저장한다: `{ "board": number[][], "score": number, "won": boolean, "keepPlaying": boolean }`.
- 저장 시점: 이동이 일어난 턴이 끝날 때, 새 게임 시작 시, "계속하기"를 눌렀을 때.
- 게임 오버가 되면 저장된 판을 지운다(`removeItem`). 다음 방문은 새 게임으로 시작한다.
- 불러오기: 페이지 로드 시 읽어서 **검증**한다 — 4×4 배열, 각 값이 0 또는 2 이상의 2의 거듭제곱 정수, 0이 아닌 타일이 1개 이상, `score`가 0 이상 정수, `won`/`keepPlaying`이 boolean. 하나라도 어긋나거나 JSON 파싱이 실패하면 저장값을 버리고 새 게임으로 시작한다.
  - 불러온 판이 `canMove`가 false면 저장값을 지우고 새 게임으로 시작한다.
  - `won && !keepPlaying`인 판을 불러오면 승리 오버레이를 다시 띄운다.
- 읽기·쓰기·삭제 모두 `try/catch`로 감싸고, 실패해도 게임은 그대로 동작한다.
- 저장/검증 코드는 `main.js`에 둔다(판 검증 함수는 순수 함수라 `game.js`에 `isValidBoard(board)`로 둬도 된다).

## 3. 파일 구조

```
apps/game-2048/
├── index.html      # 페이지 마크업, <head> 인라인 테마 스크립트, 메타 태그
├── style.css       # 전체 스타일 (색 변수, 라이트/다크, 레이아웃, 타일, 애니메이션)
├── game.js         # 게임 로직 — 순수 함수만, DOM·localStorage·Math.random 직접 접근 없음
├── main.js         # 진입점: 상태 관리, 렌더링, 입력(키보드·스와이프), 저장소, 테마 동기화, aria-live
├── preview.svg     # 블로그 카드용 미리보기 이미지 (손으로 작성한 정적 SVG, 진행 중인 판 모습)
├── spec.md         # 이 문서
├── review.md       # (Review 단계에서 작성)
└── briefs/         # 서브에이전트 지침 파일
```

- `index.html`은 `<script type="module" src="main.js">` 하나만 불러오고, `main.js`가 `game.js`를 import한다.
- 모든 경로는 상대 경로(`./style.css` 등)로 써서, 블로그 루트·하위 경로 어디에 배포돼도 동작하게 한다.
- 블로그의 `css/style.css`, `js/*.js`는 import하지 않는다. 필요한 값(폰트 스택, 색 변수)은 `style.css`에 복사한다.
- 코드 스타일은 블로그와 같다: ES 모듈, `const`/`let`, 2칸 들여쓰기, 세미콜론, 전역 변수 없음, 클래스명은 소문자-하이픈, `!important` 금지.

## 4. 핵심 로직 설계 (`game.js`)

### 4.1 데이터 구조
- **판(Board)**: `number[][]` — 4×4 2차원 배열, `board[row][col]`, `row` 0이 위, `col` 0이 왼쪽. 빈 칸은 `0`.
- 모든 함수는 입력 판을 **변경하지 않고** 새 배열을 반환한다(불변).
- **방향(Direction)**: 문자열 `'up' | 'down' | 'left' | 'right'`.
- **난수**: 무작위가 필요한 함수는 `rng`(0 이상 1 미만을 반환하는 함수)를 인자로 받고 기본값은 `Math.random`. 테스트에서 고정값을 넣을 수 있게 한다.

### 4.2 내보낼 함수 (export)

```js
export const SIZE = 4;
export const WIN_VALUE = 2048;

createEmptyBoard() → Board
// 0으로 채운 4×4 판

addRandomTile(board, rng = Math.random) → { board, tile: { row, col, value } } | null
// 빈 칸 중 하나를 고르게 선택(rng 1회), 값은 rng 1회로 결정(< 0.9 → 2, 그 외 → 4).
// 빈 칸이 없으면 null.

createGame(rng = Math.random) → { board, tiles: [{ row, col, value }, { row, col, value }] }
// 빈 판 + addRandomTile 2회.

slideLine(line) → { line, scoreGained, moves }
// 길이 4 배열 하나를 "인덱스 0 쪽으로" 민다. 합치기 규칙(각 타일 1회만)을 여기서만 구현한다.
// moves: 원래 칸의 비어있지 않은 타일마다 { from: 원래 인덱스, to: 새 인덱스, merged: boolean }
//   merged는 그 타일이 합쳐짐에 참여했는지(합쳐진 두 타일 모두 true, 같은 to).

move(board, direction) → { board, scoreGained, moved, moves, merges }
// 방향에 맞게 각 행/열을 꺼내(right·down은 뒤집어서) slideLine을 적용하고 다시 판에 넣는다.
// moved: 판이 하나라도 바뀌었는지(이동 전후 비교).
// moves:  [{ from: [row, col], to: [row, col], merged }]  — 판 좌표로 변환한 이동 목록(애니메이션용)
// merges: [{ row, col, value }]  — 합쳐져 새로 생긴 타일 위치와 값
// moved가 false면 board는 입력과 같은 내용, scoreGained 0, merges [].

hasEmptyCell(board) → boolean
canMove(board) → boolean
// 빈 칸이 있거나, 가로/세로로 인접한 같은 값이 하나라도 있으면 true.
hasWon(board) → boolean
// WIN_VALUE 이상 타일이 있으면 true.
```

- 새 타일 생성은 `move` 안에서 하지 않는다. 호출하는 쪽(`main.js`)이 `moved === true`일 때만 `addRandomTile`을 부른다. 이렇게 해야 `move`가 결정적(deterministic)이라 검증이 쉽다.

### 4.3 한 번의 턴 처리 흐름 (`main.js`)

```
입력(direction)
 └ 오버레이 열림(승리 대기 또는 게임 오버)이면 무시
 └ result = move(state.board, direction)
 └ result.moved가 false면 종료(아무 변화 없음)
 └ spawn = addRandomTile(result.board)
 └ state.board = spawn.board, state.score += result.scoreGained
 └ 최고 점수 갱신·저장
 └ 렌더링(moves → 이동 애니메이션, merges → 합치기 효과, spawn.tile → 생성 효과)
 └ 승리 판정: !state.won && hasWon(board) → state.won = true, 승리 오버레이
 └ 패배 판정: !canMove(board) → state.over = true
      (승리 오버레이가 떠 있으면 "계속하기" 후에 패배 오버레이 표시)
 └ aria-live 알림
```

### 4.4 게임 상태 (`main.js` 안, 모듈 스코프 변수)

```js
{
  board,          // Board
  score,          // number
  best,           // number
  won,            // 2048을 한 번이라도 만들었는지
  keepPlaying,    // 승리 후 계속하기를 눌렀는지
  over,           // 이동 불가
}
```
- "이동 입력을 받을 수 있는가" = `!state.over && !(state.won && !state.keepPlaying)`.

### 4.5 렌더링 방식
- 배경 칸 16개는 CSS grid로 고정 배치(`.cell`).
- 타일은 그 위에 겹친 레이어(`.tile-layer`, `position: absolute; inset: 패딩`)에 `position: absolute` 요소로 둔다. 위치는 CSS 변수 `--row`, `--col`로 지정하고 `transform: translate(calc(var(--col) * (var(--cell) + var(--gap))), calc(var(--row) * (var(--cell) + var(--gap))))`로 계산한다.
- `main.js`는 화면 타일 목록을 `{ id, row, col, value, el }`로 들고 있다.
  1. `moves`대로 각 타일 요소의 `--row/--col`을 바꿔 미끄러지게 한다.
  2. 이동 transition이 끝나면(100ms 타이머, 또는 reduced-motion이면 즉시) 합쳐진 두 요소를 지우고 `merges` 위치에 새 값 요소를 만들어 `.tile-merged` 클래스를 준다. `spawn.tile` 위치에 `.tile-new` 요소를 만든다.
  3. 다음 입력이 먼저 오면 2단계를 즉시 실행해 최종 상태로 맞춘다.
- 마지막 안전장치로, 2단계 후 화면 타일 값이 `state.board`와 다르면 타일 레이어를 `state.board`로 통째로 다시 그린다.
- 타일 요소: `<div class="tile" data-value="128" aria-hidden="true">128</div>`. 2048 초과 값은 `data-value="super"`가 아니라 클래스 `.tile-super`를 추가한다(값 표시는 그대로).

## 5. 화면 구성

```
┌──────────────────────────────┐
│ ← 블로그로   (작은 링크)       │
│ 2048           [점수][최고]    │
│ 같은 숫자를 합쳐 2048을!  [새 게임] │
│ ┌──────────────────────────┐ │
│ │        4×4 게임판           │ │
│ │   (오버레이는 이 위에 겹침)   │ │
│ └──────────────────────────┘ │
│ 조작 안내: 방향키·WASD / 스와이프 │
└──────────────────────────────┘
```

- **마크업 골격**(시맨틱 태그):
  - `<header class="game-header">`: `<a class="back-link" href="../../index.html">← 블로그로</a>`, `<h1>2048</h1>`, 점수 상자 2개(`<div class="score-box">` 안에 라벨 "점수"/"최고"와 값 `<output>`), 한 줄 소개, **새 게임** 버튼.
  - `<main>`: `.board`(배경 칸 16개 + `.tile-layer` + 오버레이 `<div class="overlay" role="dialog" hidden>`).
  - 판 아래 `<p class="game-help" id="game-help">`: "방향키 또는 WASD로 타일을 움직이세요. 모바일에서는 판을 스와이프하세요."
  - `.sr-only` `aria-live` 영역.
  - `<footer>`는 넣지 않는다(가볍게).
- `<html lang="ko">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>2048 — My Blog</title>`, `<meta name="description" content="…">`.
- **레이아웃**(모바일 우선):
  - 전체 래퍼 `max-width: 480px; margin-inline: auto; padding-inline: 16px;` (768px 이상에서는 `24px`, 블로그 `--gutter`와 같음). 위아래 여백 `var(--space-5)`, 768px 이상 `var(--space-7)`.
  - 게임판 크기: `width: 100%` (래퍼 폭을 따름, 최대 448px), `aspect-ratio: 1`. 375px 화면에서 판 폭은 343px.
  - 칸 크기 변수는 판 폭에서 계산: `--gap: clamp(8px, 2.5vw, 12px)`, `--cell: calc((판 내부 폭 - 3 * --gap) / 4)`. 판 폭을 CSS만으로 계산하기 어려우면 `container-type: inline-size`와 `cqi` 단위를 쓴다(예: `--gap: 2.5cqi`). `cqi` 미지원 브라우저 대비로 `ResizeObserver` 같은 JS는 쓰지 않고, 최신 브라우저 기준으로 한다.
  - 헤더: 모바일에서는 1행에 제목(왼쪽)·점수 상자 2개(오른쪽), 2행에 소개 문구(왼쪽)·새 게임 버튼(오른쪽). 375px에서 줄바꿈되어도 가로 스크롤이 생기지 않게 `flex-wrap: wrap`.
  - 데스크톱에서도 같은 1열 구조를 유지한다(판만 최대 448px로 커짐).
  - `body`에 `overscroll-behavior: none`은 주지 않는다(판에만 `touch-action: none`).
- **타일 숫자 크기**(판에 비례): 1~2자리 `calc(var(--cell) * 0.5)`, 3자리 `0.42`, 4자리 `0.34`, 5자리 이상 `0.28`. `font-weight: 700`, `font-variant-numeric: tabular-nums`. 자리 수 클래스(`.digits-3` 등)는 `main.js`가 붙인다.

## 6. 디자인

블로그(`css/style.css`)의 중립 회색 + 파란 강조색 톤을 이어받는다. 원조 2048의 베이지/주황 대신 **파란색 단계**로 값이 커질수록 진해지고, 2048만 금색으로 강조한다.

### 6.1 공통 변수 (블로그에서 복사)
- 폰트: `--font-sans: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;`
- 간격: `--space-1`~`--space-8`(블로그와 같은 값), `--radius: 8px`, `--tap-size: 44px`
- 본문 글자: `1.0625rem`, `line-height: 1.7`
- 페이지 색: 블로그의 `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-accent-hover`, `--color-border` 값을 라이트/다크 그대로 복사.
- 다크 모드는 `:root[data-theme="dark"]`에서 **변수만** 재정의. 컴포넌트 규칙에는 색 값을 직접 쓰지 않는다.

### 6.2 게임 전용 변수

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--color-board` (판 배경) | `#dfe3e8` | `#171b20` |
| `--color-cell` (빈 칸) | `#eef1f4` | `#1f252c` |
| `--color-overlay` (오버레이 배경) | `rgb(255 255 255 / 0.85)` | `rgb(15 18 21 / 0.85)` |
| `--color-button-bg` / `--color-button-text` (새 게임 등) | `#0a5fc2` / `#ffffff` | `#6cb6ff` / `#0f1215` |
| `--color-score-bg` (점수 상자) | `var(--color-surface)` + `1px solid var(--color-border)` | 동일 |

### 6.3 타일 색 (배경 / 글자, 괄호는 대비)

| 값 | 라이트 | 다크 |
|---|---|---|
| 2 | `#ffffff` / `#1f2328` (15.8) | `#2b333d` / `#e3e6ea` (≈10) |
| 4 | `#e8f1fc` / `#1f2328` (13.9) | `#263547` / `#e3e6ea` (10.0) |
| 8 | `#cfe2fa` / `#1f2328` (12.0) | `#1e3f66` / `#e3e6ea` (8.6) |
| 16 | `#a9cbf5` / `#1f2328` (9.4) | `#1d4f8a` / `#ffffff` (8.3) |
| 32 | `#7fb0ee` / `#0f1215` (8.4) | `#1f5fae` / `#ffffff` (6.4) |
| 64 | `#5a97e3` / `#0f1215` (6.2) | `#4a90e2` / `#0f1215` (5.7) |
| 128 | `#1f6fd1` / `#ffffff` (4.9) | `#6cb6ff` / `#0f1215` (8.7) |
| 256 | `#1a5fb8` / `#ffffff` (6.2) | `#8cc6ff` / `#0f1215` (10.4) |
| 512 | `#14509e` / `#ffffff` (7.9) | `#acd6ff` / `#0f1215` (12.4) |
| 1024 | `#0f4285` / `#ffffff` (9.8) | `#cfe7ff` / `#0f1215` (14.8) |
| 2048 | `#e0a800` / `#1f2328` (7.4) | `#f2c94c` / `#0f1215` (11.8) |
| 4096 이상 (`.tile-super`) | `#1f2328` / `#ffffff` (15.8) | `#ffffff` / `#0f1215` (18.8) |

- 변수 이름: `--tile-2-bg`, `--tile-2-text`, … `--tile-super-bg`, `--tile-super-text`. 셀렉터는 `.tile[data-value="2"] { background: var(--tile-2-bg); color: var(--tile-2-text); }` 형식.
- 라이트의 2 타일은 빈 칸과 색이 비슷하므로 `box-shadow: 0 1px 2px` (그림자 색도 변수 `--color-tile-shadow`)를 준다. 다크의 2 타일은 `1px solid var(--color-border)` 테두리로 구분한다.
- 타일 모서리 `border-radius: 6px`, 판 `var(--radius)`. 그 외 장식(그라데이션, 큰 그림자)은 넣지 않는다.

## 7. 블로그 임베드 계획 (Embed 단계용)

- **카드 제목**: `2048`
- **한 줄 설명**: "같은 숫자를 밀어 합쳐 2048을 만드는 퍼즐. 방향키나 스와이프로 플레이." (짧은 버전: "숫자를 밀어 합치는 퍼즐 게임")
- **링크**: `apps/game-2048/index.html` (새 탭이 아닌 같은 탭)
- **미리보기 방식: 정적 이미지(`preview.svg`) 권장, iframe 비권장.**
  - iframe 안의 게임은 방향키·스와이프 입력을 가로채서 블로그 목록 스크롤을 방해하고(특히 모바일에서 `touch-action: none` 영역에 걸리면 페이지가 안 내려감), 카드 크기에서는 판이 너무 작아 실제로 플레이하기 어렵다.
  - 글 목록에 iframe이 들어가면 게임 JS가 목록 로딩 때마다 실행되어 무겁다.
  - `preview.svg`는 수 KB 수준의 벡터라 어느 크기에서도 선명하고, 블로그 카드에 `<img src="apps/game-2048/preview.svg" alt="2048 게임 화면 미리보기" width="… " height="…">`로 넣기 쉽다.
- **`preview.svg` 사양**(Build 단계에서 함께 작성): `viewBox="0 0 400 400"`, 4×4 판에 2·4·8·16·32·128·512·2048 등 진행 중인 판 모습. 라이트 테마 타일 색(6.3 표)을 사용하고 글자는 `<text>` + 시스템 폰트(`font-family`에 블로그 스택). 외부 리소스 참조 없음. 다크 블로그 배경 위에서도 판 배경(`#dfe3e8`)이 테두리 역할을 해 무난하다.

## 8. 검증 체크리스트 (Review 단계)

### 8.1 규칙 / 로직 (`game.js`를 브라우저 콘솔에서 `import('./game.js')`로 직접 호출해 확인)
- [ ] `slideLine([2,2,2,2])` → `[4,4,0,0]`, 점수 8
- [ ] `slideLine([2,2,4,0])` → `[4,4,0,0]`, 점수 4 (연쇄 합치기 없음)
- [ ] `slideLine([4,4,8,8])` → `[8,16,0,0]`, 점수 24
- [ ] `slideLine([2,2,2,0])` → `[4,2,0,0]`
- [ ] `slideLine([2,0,0,2])` → `[4,0,0,0]`
- [ ] `slideLine([0,0,0,2])` → `[2,0,0,0]`, 점수 0
- [ ] `slideLine([2,4,8,16])` → 그대로, 점수 0
- [ ] `slideLine([0,0,0,0])` → 그대로
- [ ] `move`의 네 방향 모두 같은 판에서 기대 결과와 일치(특히 right/down에서 `[2,2,2,0]` → 오른쪽으로 밀면 `[0,0,2,4]`)
- [ ] 이동할 수 없는 방향으로 밀면 `moved: false`, 새 타일이 생기지 않고 점수 그대로
- [ ] 이동이 일어나면 정확히 1개의 새 타일만 생김
- [ ] `addRandomTile`에 `rng`를 고정하면 결과가 예측대로(0.89 → 2, 0.9 → 4)
- [ ] 새 타일 비율: 1000회 정도 생성 시 4가 대략 10%
- [ ] 시작 시 타일 정확히 2개
- [ ] `canMove`: 빈 칸 없음 + 인접 같은 값 없음 → false / 빈 칸 없음 + 세로로만 같은 값 있음 → true
- [ ] `move`가 입력 판을 변경하지 않음(불변성)
- [ ] `game.js`에 `document`, `window`, `localStorage`, `Math.random` 직접 호출이 없음(기본 인자 제외)

### 8.2 게임 흐름
- [ ] 2048 생성 시 승리 오버레이 → "계속하기" 후 계속 플레이 가능, 다시 뜨지 않음
- [ ] 승리 오버레이가 떠 있는 동안 방향키·스와이프 무시
- [ ] 승리와 패배가 동시에 성립할 때 승리 → 계속하기 → 패배 순서
- [ ] 게임 오버 오버레이에 최종 점수 표시, "다시 하기"로 새 게임
- [ ] 새 게임 버튼: 점수 0, 최고 점수 유지, 타일 2개
- [ ] 최고 점수가 새로고침 후에도 유지
- [ ] `localStorage`를 막은 환경(시크릿 모드/저장소 차단, 또는 콘솔에서 `Storage.prototype.getItem`을 throw하게 덮어쓰기)에서도 오류 없이 플레이 가능
- [ ] `game-2048:best`에 `"abc"`를 넣어도 0으로 처리
- [ ] 빠르게 연속 입력(애니메이션 중 입력)해도 화면 타일과 실제 판 상태가 어긋나지 않음
- [ ] 몇 번 움직인 뒤 새로고침하면 같은 판·같은 점수로 이어짐
- [ ] `game-2048:state`에 깨진 JSON, 5×5 판, 3 같은 잘못된 값을 넣으면 새 게임으로 시작(오류 없음)
- [ ] 게임 오버 후 새로고침하면 새 게임, 승리 후 "계속하기" 전 새로고침하면 승리 오버레이 다시 표시

### 8.3 조작
- [ ] 방향키·WASD 동작, 방향키 입력 시 페이지가 스크롤되지 않음
- [ ] Ctrl/Cmd 조합(예: Ctrl+R 등)은 가로채지 않음
- [ ] 모바일(또는 DevTools 터치 에뮬레이션)에서 네 방향 스와이프 동작
- [ ] 짧은 탭(30px 미만)은 이동으로 처리되지 않음
- [ ] 판 위 스와이프 중 페이지가 스크롤·확대되지 않음, 판 밖에서는 정상 스크롤

### 8.4 화면 / 디자인
- [ ] 375px 폭에서 가로 스크롤 없음, 좌우 여백 16px 이상
- [ ] 4자리·5자리 숫자(1024, 2048, 16384)가 타일 밖으로 넘치지 않음
- [ ] 모든 버튼 44×44px 이상
- [ ] 라이트/다크 모두 타일 색이 6장 표와 일치, 텍스트 대비 4.5:1 이상
- [ ] 블로그에서 다크로 설정 → 게임 페이지 다크로 열림(깜빡임 없음)
- [ ] 블로그 탭에서 테마를 바꾸면 열려 있는 게임 탭도 바뀜(`storage` 이벤트)
- [ ] 저장된 테마가 없을 때 OS 설정 변경을 따라감
- [ ] `prefers-reduced-motion: reduce`에서 애니메이션 없음
- [ ] 콘솔 오류·경고 없음

### 8.5 접근성
- [ ] 점수 변화, 승리, 패배, 새 게임이 스크린리더(`aria-live`)로 알려짐
- [ ] 오버레이가 열리면 첫 버튼에 포커스, Tab이 오버레이 안에서만 순환, 닫히면 포커스 복귀
- [ ] 키보드만으로 새 게임·계속하기·다시 하기 모두 가능, `:focus-visible` 표시

### 8.6 프로젝트 규칙
- [ ] `apps/game-2048/` 밖의 파일 변경 없음, 블로그 CSS/JS import 없음
- [ ] 외부 라이브러리·CDN 없음
- [ ] 모든 경로 상대 경로, `python -m http.server`로 `/apps/game-2048/` 접속 시 동작

## 9. 범위 밖 (이번에 만들지 않음)

- 되돌리기(undo)
- 판 크기 변경(3×3, 5×5 등), 난이도 설정
- 온라인 랭킹, 공유 기능, 로그인
- 효과음, 진동
- 게임 페이지 자체의 테마 토글 버튼
- 이동 횟수·플레이 시간 통계
- 블로그 `index.html` 수정(Embed 단계에서 별도로 진행)
- 오프라인(PWA) 지원

## 10. 결정 사항 (사용자 승인, 2026-10-16)

1. 게임 페이지 테마 토글: 두지 않음(블로그 설정을 따라감).
2. 진행 중인 판 저장: **저장함** → 2.9 참고.
3. 타일 색: 블로그 파란 단계 + 2048 금색(6장 표).
4. 미리보기 이미지: 손으로 작성한 `preview.svg`.
