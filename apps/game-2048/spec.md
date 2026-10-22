# 2048 게임 — 계획서 (spec)

> 작성: Plan 단계 / 2026-10-22
> 상태: **사용자 승인 대기**. 승인 전에는 Build를 시작하지 않는다. 열린 질문 4개는 사용자 답을 반영했다(10장).

## 1. 개요

4×4 판에서 방향키·WASD·스와이프로 숫자 타일을 밀어 같은 숫자를 합치고 2048 타일을 만드는 퍼즐 게임이다. 현재 점수와 최고 점수를 보여주는 점수판이 있다. `apps/game-2048/` 안에서 자체 완결되며(외부 라이브러리·CDN 없음), 블로그와 같은 폰트·색 톤과 같은 다크 모드 설정(`localStorage`의 `theme`)을 따르며, 게임 화면에도 테마 토글이 있다. 진행 중인 판은 저장돼 새로고침 후에도 이어서 할 수 있다.

## 2. 기능 목록

### 2.1 게임 규칙
- 판은 4×4, 빈 칸은 `0`.
- **시작**: 빈 판의 무작위 빈 칸 2곳에 타일을 하나씩 놓는다. 각 타일 값은 2(90%) 또는 4(10%).
- **이동**: 상·하·좌·우 중 한 방향으로 모든 타일을 그 방향 끝까지 민다.
- **합치기**:
  - 미는 방향의 **앞쪽(벽 쪽)부터** 처리한다. 같은 값 두 개가 (빈 칸을 사이에 두더라도) 이어지면 하나로 합쳐 값이 2배가 된다.
  - **한 번 이동에서 각 타일은 최대 한 번만 합쳐진다.** 합쳐서 생긴 타일은 같은 이동에서 다시 합쳐지지 않는다.
  - 예시(왼쪽으로 밀 때, 한 줄):

    | 입력 | 결과 | 얻는 점수 | 비고 |
    |---|---|---|---|
    | `[2,2,2,2]` | `[4,4,0,0]` | 8 | 두 쌍이 각각 합쳐짐 |
    | `[2,2,4,0]` | `[4,4,0,0]` | 4 | 새로 생긴 4는 기존 4와 합쳐지지 않음 |
    | `[2,2,2,0]` | `[4,2,0,0]` | 4 | 앞쪽 두 개가 먼저 합쳐짐 |
    | `[4,4,8,8]` | `[8,16,0,0]` | 24 | |
    | `[2,0,0,2]` | `[4,0,0,0]` | 4 | 빈 칸을 사이에 둬도 합쳐짐 |
    | `[0,0,0,2]` | `[2,0,0,0]` | 0 | 이동만 |
    | `[2,4,8,16]` | `[2,4,8,16]` | 0 | 변화 없음 |
    | `[8,0,8,8]` | `[16,8,0,0]` | 16 | |
- **새 타일**: 이동으로 판이 **실제로 바뀌었을 때만**, 빈 칸 중 하나를 균등하게 골라 새 타일 1개(2: 90%, 4: 10%)를 놓는다. 판이 그대로면 새 타일도 점수 변화도 없다.

### 2.2 점수판
- **현재 점수**: 합쳐질 때마다 **합쳐서 생긴 타일 값**만큼 더한다(2+2 → +4, 한 이동에서 4와 8이 생기면 +12).
- **최고 점수**: `localStorage` 키 `game-2048:best`에 정수 문자열로 저장한다.
  - 읽기·쓰기 모두 `try/catch`로 감싸고, 실패하면 메모리 값만 쓴다(화면에 오류를 띄우지 않는다).
  - 저장값이 음이 아닌 정수가 아니면(`"abc"`, `"-5"`, `"1.5"`) 0으로 본다.
  - 현재 점수가 최고 점수를 넘는 순간 최고 점수도 함께 갱신·저장한다.
- 점수가 오르면 현재 점수 상자 위에 `+N`이 잠깐 떠올랐다 사라진다(600ms, 장식용, `aria-hidden="true"`, reduced-motion이면 표시하지 않음).
- 숫자 표시는 `toLocaleString('ko-KR')`(예: `12,345`).

### 2.3 승리 / 패배
- **승리**: 이동 결과 판에 2048 이상 타일이 **처음** 생기면 승리 오버레이를 띄운다.
  - 제목 "2048 달성!", 버튼 **계속하기**(첫 번째) / **새 게임**.
  - **계속하기**: 오버레이를 닫고 같은 판으로 이어서 한다. 이후 4096 등을 만들어도 승리 오버레이는 다시 뜨지 않는다(`keepPlaying = true`).
  - 오버레이가 떠 있는 동안 이동 입력(키·스와이프)은 무시한다.
- **패배**: 이동 + 새 타일 생성 후 빈 칸이 없고 가로·세로로 인접한 같은 값도 없으면 게임 오버.
  - 제목 "더 이상 움직일 수 없어요", 최종 점수 표시, 버튼 **다시 하기**.
  - 같은 이동에서 승리와 패배가 동시에 성립하면 승리 오버레이를 먼저 보이고, **계속하기**를 누르면 곧바로 패배 오버레이로 바꾼다.
- 오버레이는 게임판 위에 반투명 배경으로 겹친다(판이 비쳐 보임). 열리면 첫 버튼으로 포커스를 옮긴다.

### 2.4 새 게임
- 헤더의 **새 게임** 버튼은 언제든 새 판을 시작한다: 점수 0, `won`/`keepPlaying`/`over` 초기화, 오버레이 닫기, 타일 2개. 확인 창은 띄우지 않는다.
- 최고 점수는 유지한다.

### 2.5 조작
- **키보드** (`document`의 `keydown`):
  - `ArrowUp/Down/Left/Right`, `w/a/s/d`(대소문자 무관, `event.key` 기준) → 각각 상/좌/하/우.
  - 게임에 쓴 키는 `preventDefault()`로 페이지 스크롤을 막는다.
  - `Ctrl`/`Meta`/`Alt`가 눌려 있으면 무시한다(브라우저 단축키 보존). `Shift`는 허용한다.
  - 포커스가 버튼에 있어도 방향키는 게임에 쓴다(Enter/Space는 버튼 동작 그대로).
  - 키를 누르고 있어 생기는 반복 입력(`event.repeat`)도 받는다.
- **터치 스와이프** (Pointer Events, 게임판 요소에만 등록):
  - 게임판에 `touch-action: none`을 줘서 스와이프 중 페이지 스크롤·확대가 일어나지 않게 한다. 판 바깥은 평소처럼 스크롤된다.
  - `pointerdown`: 시작 좌표와 `pointerId` 기록(`isPrimary`가 아니면 무시). `pointerup`: 같은 `pointerId`면 이동량 계산. `pointercancel`: 기록 폐기.
  - 이동 거리(가로·세로 중 큰 쪽 절댓값)가 **30px 미만이면 무시**, 아니면 절댓값이 큰 축의 방향으로 1회 이동.
  - 마우스 드래그도 같은 코드로 동작해도 된다.
- **연속 입력**: 애니메이션 중 새 입력이 오면, 진행 중인 애니메이션을 즉시 최종 상태로 맞춘 뒤 새 이동을 처리한다(입력이 씹히지 않고, 화면과 상태가 어긋나지 않게).

### 2.6 애니메이션 (가볍게)
- **이동**: 타일이 `transform: translate(...)`로 새 칸까지 미끄러진다. 100ms `ease-in-out`.
- **생성**: 이동이 끝난 뒤 새 타일이 `scale(0) → scale(1)`로 나타난다. 150ms.
- **합치기**: 이동이 끝난 뒤 합쳐진 타일이 `scale(1) → scale(1.12) → scale(1)`로 한 번 튄다. 150ms.
- `transform`/`opacity`만 애니메이션한다.
- `@media (prefers-reduced-motion: reduce)`: 모든 transition/animation을 끄고(`transition: none; animation: none;`), JS도 `matchMedia('(prefers-reduced-motion: reduce)')`를 보고 이동 대기 시간을 0으로 한다.

### 2.7 다크 모드
- 블로그와 **같은 규칙**: `localStorage`의 `theme` 값이 `"light"`/`"dark"`면 그 값, 아니면 `prefers-color-scheme`.
- `<head>` 맨 앞에 블로그 `index.html`과 **똑같은 인라인 스크립트**를 넣어 `<html data-theme>`를 먼저 설정한다(깜빡임 방지). 블로그 파일을 import하지 않고 복사한다.
- 런타임 동기화(`main.js`): 저장값이 없을 때 OS 설정 변경을 따라가고(`matchMedia(...).addEventListener('change')`), 다른 탭(블로그)에서 `theme`가 바뀌면 `storage` 이벤트(`event.key === 'theme'`)로 반영한다.
- **테마 토글**: 헤더에 블로그와 같은 원형 토글 버튼(`.theme-toggle`, 같은 SVG 아이콘)을 둔다.
  - 누르면 `data-theme`를 light↔dark로 바꾸고 `localStorage`의 `theme` 키에 저장한다(블로그와 공유, `try/catch`).
  - `aria-label="다크 모드"`, 현재 상태를 `aria-pressed`로 표시, 44×44px.
  - 블로그 `js/theme.js`를 import하지 않고 같은 동작을 `main.js`(또는 `theme.js`를 앱 폴더에 따로)에 구현한다.

### 2.8 접근성
- 시각적으로 숨긴(`.sr-only`) `aria-live="polite"` 영역 하나(`#announcer`)로 다음을 알린다.
  - 점수가 오른 이동: "점수 1,234점" (최고 기록 갱신 시 "점수 1,234점, 최고 기록"). 점수 변화 없으면 알리지 않음.
  - 승리: "2048 달성! 계속하기 또는 새 게임을 선택하세요."
  - 패배: "게임 오버. 최종 점수 1,234점."
  - 새 게임: "새 게임을 시작했습니다."
  - 같은 문구가 연속돼도 읽히도록 `textContent`를 비운 뒤 `requestAnimationFrame` 안에서 새 문구를 넣는다.
- 오버레이: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`(오버레이 제목 id). 열린 동안 Tab/Shift+Tab 포커스가 오버레이 버튼 안에서만 돈다. 닫힐 때 포커스는 "계속하기"로 닫은 경우 게임판(`tabindex="-1"`)으로, "새 게임/다시 하기"로 닫은 경우 헤더의 **새 게임** 버튼으로 돌려준다.
- 게임판: `role="group"`, `aria-label="2048 게임판"`, `aria-describedby="game-help"`. 개별 타일과 배경 칸은 `aria-hidden="true"`(매 이동마다 판 전체를 읽지 않는다).
- 점수 값은 `<output>`이 아닌 일반 `<span>`(라이브 영역 중복 낭독 방지).
- 모든 버튼·링크는 최소 44×44px. `:focus-visible`은 블로그와 같은 `2px solid var(--color-accent)`, `outline-offset: 2px`.
- 타일 숫자 대비: 라이트·다크 모두 4.5:1 이상(6.3 표, 계산 확인함).

### 2.9 진행 중인 판 저장 (이어하기)
- `localStorage` 키 `game-2048:state`에 JSON `{ "board": number[][], "score": number, "won": boolean, "keepPlaying": boolean, "over": boolean }`을 저장한다.
- **저장 시점**: 새 게임 시작, 실제 이동(새 타일 생성 후), 승리 후 "계속하기". 모든 접근은 `try/catch`, 실패하면 조용히 넘어간다.
- **불러오기**: 페이지 로드 시 저장값을 읽어 검증한다. 다음을 모두 만족할 때만 쓰고, 아니면 새 게임을 시작한다.
  - `board`가 4×4 배열이고 각 값이 0 또는 2 이상 2의 거듭제곱 정수
  - 0이 아닌 타일이 1개 이상
  - `score`가 음이 아닌 정수, 플래그 3개가 boolean
- 불러온 판이 `over`면 패배 오버레이를, `won && !keepPlaying`이면 승리 오버레이를 다시 띄운다.
- 최고 점수(`game-2048:best`)는 따로 관리하며, 불러온 점수가 최고 점수보다 크면 최고 점수도 맞춘다.
- 판 검증 함수(`isValidBoard(board)`)는 순수 함수로 `game.js`에 둔다.

## 3. 파일 구조

```
apps/game-2048/
├── index.html      # 페이지 마크업, <head> 인라인 테마 스크립트, 메타 태그
├── style.css       # 디자인 토큰(블로그 값 복사 + 게임 전용), 라이트/다크, 레이아웃, 타일, 애니메이션
├── game.js         # 게임 로직 — 순수 함수만. DOM·localStorage·Math.random 직접 접근 없음
├── main.js         # 진입점: 상태, 렌더링·애니메이션, 입력(키보드·스와이프), 최고 점수 저장, 테마 동기화, aria-live, 오버레이
├── preview.svg     # 블로그 카드용 미리보기 이미지(손으로 작성한 정적 SVG)
├── spec.md         # 이 문서 (Plan)
├── review.md       # 검증 결과 (Review 단계에서 작성)
└── briefs/         # 서브에이전트 지침 파일 (plan.md, build.md, review.md …)
```

- `index.html`은 `style.css`와 `<script type="module" src="main.js">`만 불러오고, `main.js`가 `./game.js`를 import한다.
- **모든 경로는 상대 경로**(`style.css`, `./game.js`, `../../`). 사이트가 GitHub Pages `/my-blog/` 하위 경로에서 서비스되므로 `/`로 시작하는 절대 경로를 쓰지 않는다.
- 블로그의 `css/style.css`, `js/*.js`는 import하지 않는다. 필요한 값만 `style.css`에 복사한다.
- 코드 스타일은 블로그와 같다: ES 모듈, `const`/`let`, 2칸 들여쓰기, 세미콜론, 전역 변수 없음, 클래스명 소문자-하이픈, `!important` 금지, 주석은 한국어로 필요한 곳에만. DOM 텍스트는 `textContent`로만 넣는다(`innerHTML` 쓰지 않음).

## 4. 핵심 로직 설계 (`game.js`)

### 4.1 데이터 구조
- **Board**: `number[][]` — 4×4, `board[row][col]`, `row 0`이 위, `col 0`이 왼쪽, 빈 칸 `0`.
- **Direction**: `'up' | 'down' | 'left' | 'right'`.
- **불변성**: 모든 함수는 입력 판을 바꾸지 않고 새 배열을 반환한다.
- **난수 주입**: 무작위가 필요한 함수는 `rng`(`[0, 1)`을 반환하는 함수)를 마지막 인자로 받고 기본값은 `Math.random`. 테스트에서 고정 수열을 넣을 수 있다.

### 4.2 export 목록

```js
export const SIZE = 4;
export const WIN_VALUE = 2048;

export function createEmptyBoard() → Board

export function addRandomTile(board, rng = Math.random)
  → { board, tile: { row, col, value } } | null
// 빈 칸 목록(행 우선 순서)을 만들고 index = Math.floor(rng() * 빈칸수)로 1회 선택,
// 값은 rng() < 0.9 ? 2 : 4 로 1회 결정(rng를 정확히 2번 호출). 빈 칸이 없으면 null.

export function createGame(rng = Math.random)
  → { board, tiles: [{ row, col, value }, { row, col, value }] }
// 빈 판에 addRandomTile 2회.

export function slideLine(line)
  → { line, scoreGained, moves }
// 길이 4 배열을 "인덱스 0 쪽으로" 민다. 합치기 규칙(각 타일 1회만)은 여기에만 구현한다.
// moves: 원래 비어 있지 않던 칸마다 { from, to, merged }
//   (merged: 합치기에 참여했으면 true. 합쳐진 두 타일은 같은 to를 가진다.)

export function move(board, direction)
  → { board, moved, scoreGained, moves, merges }
// 각 행/열을 꺼내(right·down은 뒤집어서) slideLine 적용 후 다시 넣는다.
// moved:   이동 전후 판이 하나라도 다른지
// moves:   [{ from: [row, col], to: [row, col], merged }] — 판 좌표(애니메이션용)
// merges:  [{ row, col, value }] — 합쳐져 생긴 타일의 위치·값
// moved가 false면 board는 입력과 같은 값의 복사본, scoreGained 0, merges [].
// 새 타일은 여기서 만들지 않는다(move는 결정적이어야 검증하기 쉽다).

export function canMove(board) → boolean
// 빈 칸이 있거나 가로·세로로 인접한 같은 값이 있으면 true.

export function hasWon(board) → boolean
// WIN_VALUE 이상 타일이 하나라도 있으면 true.

export function isValidBoard(board) → boolean
// 저장된 판 검증용(2.9). 4×4, 각 값 0 또는 2 이상 2의 거듭제곱 정수, 0이 아닌 타일 1개 이상.
```

### 4.3 게임 상태 (`main.js` 모듈 스코프, 전역 아님)

```js
const state = {
  board,        // Board
  score,        // number
  best,         // number
  won,          // 2048을 한 번이라도 만들었는지
  keepPlaying,  // 승리 후 "계속하기"를 눌렀는지
  over,         // 더 이상 이동 불가
};
// 입력 가능 여부: !state.over && !(state.won && !state.keepPlaying)
```

### 4.4 한 턴 처리 흐름 (`main.js`)

```
handleMove(direction)
 ├ 입력 불가 상태면 return
 ├ 진행 중 애니메이션이 있으면 즉시 마무리(finishAnimation)
 ├ result = move(state.board, direction)
 ├ result.moved === false → return (아무 변화 없음)
 ├ spawn = addRandomTile(result.board)          // moved면 빈 칸이 반드시 있으므로 null 아님
 ├ state.board = spawn.board; state.score += result.scoreGained
 ├ 최고 점수 갱신·저장, 점수판 갱신, +N 효과, 진행 상태 저장(2.9)
 ├ 렌더링: moves로 미끄러짐 → (100ms 후) merges 튐 효과 + spawn.tile 생성 효과
 ├ 승리: !state.won && hasWon(board) → state.won = true, 승리 오버레이
 ├ 패배: !canMove(board) → state.over = true
 │        (승리 오버레이가 떠 있으면 "계속하기" 때 패배 오버레이로 전환, 아니면 바로 표시)
 └ aria-live 알림 (승리/패배 문구가 있으면 그것을, 없으면 점수 문구)
```

### 4.5 렌더링 방식
- 배경 칸 16개(`.cell`)는 CSS grid로 고정 배치한다.
- 타일은 그 위에 겹친 `.tile-layer`(`position: absolute; inset: var(--board-pad)`) 안에 `position: absolute` 요소로 둔다.
  - 타일 크기: `width/height: calc((100% - 3 * var(--gap)) / 4)` (부모 `.tile-layer` 기준).
  - 위치: `transform: translate(calc(var(--col) * (100% + var(--gap))), calc(var(--row) * (100% + var(--gap))))` — `translate`의 `%`는 타일 자기 크기 기준이라 판 크기와 무관하게 맞는다. `--row`, `--col`은 JS가 `style.setProperty`로 설정.
  - 생성·튐 효과는 `transform`이 위치에 쓰이므로 **안쪽 요소**(`.tile-inner`)에 `@keyframes`로 준다.
- `main.js`는 화면 타일 목록을 `{ id, row, col, value, el }`로 관리한다.
  1. `moves`대로 각 타일의 `--row/--col`을 바꿔 미끄러지게 한다.
  2. 100ms 뒤(reduced-motion이면 즉시) `finishAnimation()`: 합쳐진 두 요소를 지우고 `merges` 위치에 새 값 타일(`.tile-merged`)을, `spawn.tile` 위치에 `.tile-new` 타일을 만든다.
  3. `finishAnimation()` 끝에서 화면 타일 값이 `state.board`와 다르면 `state.board`로 타일 레이어를 통째로 다시 그린다(안전장치).
- 타일 마크업: `<div class="tile" data-value="128" aria-hidden="true"><div class="tile-inner">128</div></div>`.
  - 4096 이상은 `data-value="super"`로 두고(색 규칙용), 숫자는 실제 값을 표시한다.
  - 자릿수 클래스 `digits-1`~`digits-5`(5자리 이상은 `digits-5`)를 붙여 글자 크기를 조절한다.

## 5. 화면 구성

```
┌───────────────────────────────────┐
│ ← 블로그로                     [◐]  │  back-link + 테마 토글 (44px 높이)
│ 2048               [점수 ][최고 ]   │  h1 + 점수 상자 2개
│ 같은 숫자를 합쳐 2048을!   [새 게임] │  소개 + 버튼
│ ┌───────────────────────────────┐ │
│ │          4×4 게임판             │ │  오버레이는 판 위에 겹침
│ └───────────────────────────────┘ │
│ 방향키 또는 WASD로 타일을 움직이세요. │  game-help
│ 모바일에서는 판을 스와이프하세요.      │
└───────────────────────────────────┘
```

### 5.1 마크업 골격
- `<html lang="ko">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="color-scheme" content="light dark">`, `<meta name="description" content="같은 숫자를 밀어 합쳐 2048을 만드는 퍼즐 게임">`, `<title>2048 · 내 블로그</title>`.
- `<header class="game-header">`
  - `<nav class="game-nav"><a class="back-link" href="../../">← 블로그로</a><button class="theme-toggle" type="button" aria-label="다크 모드" aria-pressed="false">(블로그와 같은 SVG)</button></nav>` — 링크 왼쪽, 토글 오른쪽
  - `<h1 class="game-title">2048</h1>`
  - `.scores`: `.score-box` 2개 — 라벨 `<span class="score-label">점수</span>` / `최고`, 값 `<span class="score-value" id="score">0</span>` / `id="best"`. 현재 점수 상자 안에 `+N` 효과용 `<span class="score-add" aria-hidden="true">`.
  - `<p class="game-intro">같은 숫자를 합쳐 2048을 만들어 보세요.</p>`
  - `<button type="button" class="button new-game">새 게임</button>`
- `<main>`
  - `<div class="board" id="board" role="group" aria-label="2048 게임판" aria-describedby="game-help" tabindex="-1">` 안에 `.grid`(`.cell` × 16, `aria-hidden`), `.tile-layer`, `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title" hidden>`(제목 `<h2 id="overlay-title">`, 보조 문구 `<p>`, 버튼들).
  - `<p class="game-help" id="game-help">방향키 또는 WASD로 타일을 움직이세요. 모바일에서는 판을 스와이프하세요.</p>`
  - `<p class="sr-only" id="announcer" aria-live="polite"></p>`
- `<footer>`는 두지 않는다.

### 5.2 레이아웃 (모바일 우선)
- `.page`(header+main 래퍼): `max-width: 480px; margin-inline: auto; padding-inline: var(--gutter)`, 위아래 `var(--space-5)`. `--gutter`는 16px, `@media (min-width: 768px)`에서 24px, 위아래 `var(--space-7)`.
- 게임판: `width: 100%`, `aspect-ratio: 1`, `--board-pad: var(--gap)`, `--gap: 10px`(768px 이상 12px), `border-radius: var(--radius)`, `container-type: inline-size`(타일 글자 크기용). 375px 화면에서 판 폭 343px, 칸 약 73px.
- 헤더: `display: flex; flex-wrap: wrap; align-items: center; gap`. 1행 왼쪽 제목·오른쪽 점수 상자, 2행 왼쪽 소개·오른쪽 새 게임 버튼. 좁아져서 줄바꿈돼도 가로 스크롤이 생기지 않아야 한다(점수 상자 `min-width: 4.5rem`, 숫자 `tabular-nums`).
- 데스크톱도 같은 1열 구조(판 폭은 최대 약 448px).
- `body`에 `overscroll-behavior`·`overflow: hidden`은 주지 않는다(판에만 `touch-action: none`, 판에서 `user-select: none`).

### 5.3 타일 글자 크기 (판 폭 비례, `cqi`는 `.board` 기준)
- `digits-1`·`digits-2`: `11cqi` / `digits-3`: `9cqi` / `digits-4`: `7.5cqi` / `digits-5`: `6cqi`
- `font-weight: 700`, `font-variant-numeric: tabular-nums`, `line-height: 1`, 가운데 정렬.

## 6. 디자인

블로그(`css/style.css`)의 중립 회색 + 파란 강조색 톤을 잇는다. 원조 2048의 베이지·주황 대신 값이 커질수록 진해지는 **파란 단계**를 쓰고, 2048만 **금색**으로 강조한다.

### 6.1 블로그에서 복사할 토큰 (값 그대로)
- `--font-sans: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;`
- `--space-1`~`--space-8`(0.25rem, 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 3rem, 4rem), `--gutter: 16px`(768px+ 24px), `--radius: 6px`, `--tap-size: 44px`
- 색: 라이트 `--color-bg #ffffff`, `--color-text #1f2328`, `--color-muted #59636e`, `--color-accent #0a5fc2`, `--color-border #d8dee4` / 다크 `#16181d`, `#e6e8eb`, `#9ba4ae`, `#6cb4ff`, `#30363d`
- 본문 `font-size: 1.0625rem`(768px+ `1.125rem`), `line-height: 1.7`.
- 다크는 `[data-theme="dark"]`에서 **변수만** 재정의하고 `color-scheme: dark`. 컴포넌트 규칙에는 색 값을 직접 쓰지 않는다.

### 6.2 게임 전용 변수

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--color-board` (판 배경) | `#dfe3e8` | `#22262e` |
| `--color-cell` (빈 칸) | `#eef1f4` | `#2c313a` |
| `--color-overlay` (오버레이 배경) | `rgb(255 255 255 / 0.88)` | `rgb(22 24 29 / 0.88)` |
| `--color-button-bg` / `--color-button-text` | `#0a5fc2` / `#ffffff` (6.1) | `#6cb4ff` / `#16181d` (8.1) |
| `--color-score-bg` (점수 상자) | `#eef1f4` | `#22262e` |
| `--color-tile-shadow` | `rgb(31 35 40 / 0.15)` | `transparent` |

- 점수 상자: 배경 `--color-score-bg`, 테두리 `1px solid var(--color-border)`, 라벨 `--color-muted`·0.8125rem, 값 `--color-text`·1.25rem·700.
- 버튼: 배경 `--color-button-bg`, 글자 `--color-button-text`, `min-height: var(--tap-size)`, 좌우 `var(--space-4)`, `border-radius: var(--radius)`, 테두리 없음. hover 시 `filter: brightness(1.08)`.

### 6.3 타일 색 (배경 / 글자, 괄호는 대비비 — 계산 확인함)

| 값 | 라이트 | 다크 |
|---|---|---|
| 2 | `#ffffff` / `#1f2328` (15.8) | `#353b45` / `#e6e8eb` (9.2) |
| 4 | `#e8f1fc` / `#1f2328` (13.9) | `#2d3d52` / `#e6e8eb` (9.0) |
| 8 | `#cfe2fa` / `#1f2328` (12.0) | `#23466f` / `#e6e8eb` (7.9) |
| 16 | `#a9cbf5` / `#1f2328` (9.4) | `#1d4f8a` / `#ffffff` (8.3) |
| 32 | `#7fb0ee` / `#1f2328` (7.0) | `#1f5fae` / `#ffffff` (6.4) |
| 64 | `#5a97e3` / `#1f2328` (5.2) | `#4a90e2` / `#16181d` (5.4) |
| 128 | `#1f6fd1` / `#ffffff` (4.9) | `#6cb4ff` / `#16181d` (8.1) |
| 256 | `#1a5fb8` / `#ffffff` (6.2) | `#8cc6ff` / `#16181d` (9.8) |
| 512 | `#14509e` / `#ffffff` (7.9) | `#acd6ff` / `#16181d` (11.7) |
| 1024 | `#0f4285` / `#ffffff` (9.8) | `#cfe7ff` / `#16181d` (14.0) |
| 2048 | `#e0a800` / `#1f2328` (7.4) | `#f2c94c` / `#16181d` (11.2) |
| 4096+ (`super`) | `#1f2328` / `#ffffff` (15.8) | `#ffffff` / `#16181d` (17.8) |

- 변수 이름: `--tile-2-bg`, `--tile-2-text`, …, `--tile-super-bg`, `--tile-super-text`. 셀렉터 예: `.tile[data-value="2"] .tile-inner { background: var(--tile-2-bg); color: var(--tile-2-text); }`.
- 라이트의 2 타일은 빈 칸과 비슷하므로 `box-shadow: 0 1px 2px var(--color-tile-shadow)`. 다크의 2 타일은 `--color-cell`보다 밝아 별도 테두리 없이 구분된다.
- 타일 모서리 `4px`, 판 `var(--radius)`. 그라데이션·큰 그림자 등 장식은 넣지 않는다.

## 7. 블로그 임베드 계획 (Embed 단계용, 이번 단계에서는 블로그 파일을 수정하지 않음)

- **카드 제목**: `2048`
- **한 줄 설명**: "같은 숫자를 밀어 합쳐 2048을 만드는 퍼즐. 방향키나 스와이프로 플레이."
- **링크**: `apps/game-2048/` (상대 경로, 같은 탭)
- **미리보기: 정적 이미지 `preview.svg` 권장, iframe 비권장.**
  - iframe 안의 게임은 방향키·스와이프를 가로채 목록 스크롤을 방해한다. 특히 모바일에서 `touch-action: none`인 판 위에 손가락이 닿으면 페이지가 내려가지 않는다.
  - 카드 크기에서는 판이 너무 작아 실제로 플레이하기 어렵고, 목록을 열 때마다 게임 JS가 실행돼 무겁다.
  - SVG는 수 KB짜리 벡터라 어느 크기에서도 선명하다.
- **`preview.svg` 사양** (Build 단계에서 작성): `viewBox="0 0 400 400"`, 판 배경 `#dfe3e8`·라운드 모서리, 4×4 칸에 진행 중인 판 모습(예: 2, 4, 8, 16, 32, 64, 128, 512, 2048과 빈 칸 몇 개). 6.3 표의 **라이트** 색 사용, 숫자는 `<text>` + 블로그 폰트 스택. 외부 리소스 참조·스크립트 없음. 루트에 `role="img"`와 `<title>2048 게임 화면 미리보기</title>`.
- **메인 페이지 배치 제안**:
  - 현재 `index.html`의 `<main id="content">`는 `main.js`가 글 목록을 비동기로 채운다. `main.js`를 고치지 않도록, 웹앱 영역은 **정적 HTML**로 `index.html`에 직접 쓴다.
  - 권장안: `<main>` 안의 글 목록(`#content`) **아래**에 `<section class="app-section" aria-labelledby="apps-title"><h2 id="apps-title">웹앱</h2><ul class="app-list">…</ul></section>`. h1("글 목록")·`main.js`를 건드리지 않아 변경이 가장 작다. 이를 위해 `id="content"`를 `<main>` 안쪽 `<div id="content">`로 옮기고 `<main class="container">`가 둘을 감싼다.
  - 카드 마크업: `<li><article class="app-card"><a href="apps/game-2048/"><img src="apps/game-2048/preview.svg" alt="2048 게임 화면 미리보기" width="400" height="400" loading="lazy"><h3>2048</h3></a><p>설명</p></article></li>`. 모바일 1열(이미지 폭 최대 160px, 이미지 왼쪽·글 오른쪽), 768px 이상 2열 그리드. 링크 전체가 탭 대상(44px 이상).
  - 스타일은 블로그 `css/style.css` 토큰을 써서 `.app-section`, `.app-list`, `.app-card`를 추가한다. 디렉터리 구조가 바뀌므로(apps/) CLAUDE.md 구조 섹션도 Embed 단계에서 갱신한다.
  - 대안(열린 질문 3): 웹앱 영역을 글 목록 **위**에 둔다(포트폴리오 성격 강조). 이 경우 제목 계층(h1)을 함께 정리해야 한다.

## 8. 검증 체크리스트 (Review 단계)

### 8.1 규칙 / 로직 — 브라우저 콘솔에서 `const g = await import('./game.js')`로 직접 호출
- [ ] `slideLine` 결과·점수가 2.1 표의 8개 예시와 모두 일치
- [ ] `slideLine([0,0,0,0])` → 그대로, 점수 0
- [ ] `move`의 네 방향: 한 줄이 `[2,2,2,0]`일 때 left → `[4,2,0,0]`, right → `[0,0,2,4]`; 열에 대해서도 up/down이 같은 규칙
- [ ] 이동할 수 없는 방향: `moved: false`, `scoreGained: 0`, `merges: []`
- [ ] `move`가 입력 판을 변경하지 않음(호출 전후 `JSON.stringify` 비교)
- [ ] `addRandomTile`에 고정 `rng`: 값 결정용 난수 0.89 → 2, 0.9 → 4; 빈 칸 선택이 `Math.floor(rng() * n)`대로; 빈 칸 없으면 `null`
- [ ] 4 비율: `Math.random`으로 10,000회 생성 시 대략 10%(8~12%)
- [ ] `createGame()` 결과 타일 정확히 2개
- [ ] `canMove`: 꽉 찬 판 + 인접 같은 값 없음 → false / 꽉 찬 판 + 세로로만 같은 값 → true / 빈 칸 1개 → true
- [ ] `hasWon`: 2048 → true, 4096만 있어도 true, 1024 최대 → false
- [ ] `game.js`에 `document`, `window`, `localStorage` 참조 없음, `Math.random`은 기본 인자에만

### 8.2 게임 흐름
- [ ] 실제 이동마다 새 타일 정확히 1개, 무효 이동에는 새 타일·점수 변화 없음
- [ ] 2048 생성 → 승리 오버레이, "계속하기" 후 계속 플레이, 4096을 만들어도 다시 안 뜸 (실제 플레이로 2048을 만들기 어려우므로 `hasWon` 단위 확인 + `main.js`의 승리 분기 코드 리뷰로 확인)
- [ ] 승리 오버레이 중 방향키·스와이프 무시
- [ ] 승리·패배 동시 성립 시: 승리 → 계속하기 → 패배 순
- [ ] 패배 오버레이에 최종 점수, "다시 하기"로 새 게임
- [ ] 새 게임: 점수 0, 최고 점수 유지, 타일 2개, 오버레이 닫힘
- [ ] 최고 점수가 새로고침 후 유지
- [ ] `localStorage.setItem('game-2048:best','abc')` 후 새로고침 → 최고 0
- [ ] `Storage.prototype.getItem/setItem`을 throw하도록 덮어써도 오류 없이 플레이 가능
- [ ] 빠른 연속 입력(애니메이션 중 입력)에도 화면 타일과 `state.board`가 일치
- [ ] 몇 번 이동 후 새로고침 → 같은 판·점수로 이어짐; 패배 상태에서 새로고침 → 패배 오버레이 다시 표시
- [ ] `game-2048:state`에 깨진 값(`"{"`, 5×5 판, 값 3, 빈 판) → 오류 없이 새 게임
- [ ] `isValidBoard` 단위 확인(정상 판 true, 위 깨진 판들 false)

### 8.3 조작
- [ ] 방향키·WASD(대문자 포함) 동작, 방향키로 페이지가 스크롤되지 않음
- [ ] Ctrl/Cmd/Alt 조합은 가로채지 않음(예: Ctrl+R 새로고침 정상)
- [ ] 375px 터치 에뮬레이션에서 네 방향 스와이프 동작
- [ ] 30px 미만 짧은 탭은 이동 안 함, 대각선 스와이프는 큰 축으로 처리
- [ ] 판 위 스와이프 중 페이지 스크롤·확대 없음, 판 밖에서는 정상 스크롤

### 8.4 화면 / 디자인
- [ ] 375px 폭에서 가로 스크롤 없음(`document.documentElement.scrollWidth <= innerWidth`), 좌우 여백 16px
- [ ] 1024·2048·16384 숫자가 타일 밖으로 넘치지 않음
- [ ] 모든 버튼·링크 44×44px 이상
- [ ] 라이트/다크 타일 색이 6.3 표와 일치, 글자 대비 4.5:1 이상
- [ ] 블로그에서 다크로 바꾼 뒤 게임 열기 → 처음부터 다크(깜빡임 없음)
- [ ] 블로그 탭에서 테마 변경 → 열린 게임 탭에 반영
- [ ] 저장된 테마 없을 때 OS 설정 변경을 따라감
- [ ] 게임 화면 토글로 테마 전환 → `aria-pressed` 갱신, 새로고침·블로그에서도 같은 테마 유지
- [ ] `prefers-reduced-motion: reduce` 에뮬레이션에서 애니메이션·`+N` 효과 없음
- [ ] 콘솔 오류·경고 없음

### 8.5 접근성
- [ ] 점수 상승·승리·패배·새 게임이 `#announcer`로 알려짐(같은 문구 반복 시에도 갱신)
- [ ] 오버레이 열림 시 첫 버튼 포커스, Tab 순환이 오버레이 안에 갇힘, 닫힘 시 2.8에 정한 곳으로 포커스 복귀
- [ ] 키보드만으로 새 게임·계속하기·다시 하기·블로그로 가능, `:focus-visible` 윤곽선 표시

### 8.6 프로젝트 규칙
- [ ] `apps/game-2048/` 밖의 파일 변경 없음, 블로그 CSS/JS import 없음
- [ ] 외부 라이브러리·CDN 없음
- [ ] 모든 경로 상대 경로(`/`로 시작하는 경로 없음); `python -m http.server 8000` 후 `http://localhost:8000/apps/game-2048/`에서 동작, "← 블로그로"가 블로그 목록으로 이동
- [ ] 시맨틱 태그, `lang="ko"`, viewport 메타, `!important` 없음, 전역 변수 없음

## 9. 범위 밖 (이번에 만들지 않음)

- 되돌리기(undo)
- 판 크기 변경(3×3, 5×5), 난이도 설정
- 온라인 랭킹, 공유, 로그인
- 효과음, 진동
- 이동 횟수·플레이 시간 통계
- 개발용 치트(판 주입) UI
- 블로그 `index.html`·CSS 수정(Embed 단계에서 별도로)
- 오프라인(PWA) 지원

## 10. 결정 사항 (열린 질문에 대한 사용자 답)

1. **게임 페이지의 테마 토글**: 넣는다(2.7). 블로그와 같은 `theme` 키를 공유한다.
2. **진행 중인 판 저장**: 저장한다(2.9, `game-2048:state`).
3. **메인 페이지 웹앱 영역 위치**: 글 목록 **아래**(7장 권장안).
4. **타일 색 톤**: 블로그 파란 단계 + 2048 금색(6.3 표 그대로).
