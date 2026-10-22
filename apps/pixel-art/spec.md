# 픽셀 아트 에디터 — 계획서 (spec)

> 작성: Plan 단계 / 2026-10-22
> 상태: **사용자 승인 대기**. 승인 전에는 Build를 시작하지 않는다. 10장 열린 질문은 사용자가 답했다(모두 권장안 채택).

## 1. 개요

16×16 격자에 도트를 찍어 그림을 그리고, 완성한 그림을 투명 배경 PNG로 저장하는 작은 에디터다. 16색 기본 팔레트와 사용자 색 고르기, 펜·지우개·채우기·스포이드 도구, 되돌리기/다시하기, 격자선 토글, 작업 자동 저장을 넣는다. 마우스·터치(손가락 드래그)·키보드로 모두 그릴 수 있다.

`apps/pixel-art/` 안에서 자체 완결되며(외부 라이브러리·CDN 없음, PNG는 `<canvas>.toBlob`), 블로그와 같은 폰트·색 톤과 같은 다크 모드 설정(`localStorage`의 `theme`)을 따르고, 화면에 테마 토글이 있다. 다크 모드는 **에디터 화면만** 바꾸며 그림 색과 PNG 결과에는 영향이 없다.

## 2. 기능 목록

### 2.1 도구

도구는 4개이며 한 번에 하나만 선택된다(기본: 펜).

| 도구 | 단축키 | 동작 |
|---|---|---|
| 펜 | `B` | 누른 칸을 현재 색으로 칠한다. 드래그하면 이어 칠한다. |
| 지우개 | `E` | 누른 칸을 투명(`null`)으로 만든다. 드래그하면 이어 지운다. |
| 채우기 | `G` | 누른 칸과 **같은 색(투명 포함)으로 상하좌우 연결된** 영역을 현재 색으로 칠한다(4방향, 대각선 제외). 드래그해도 누른 순간 1회만. |
| 스포이드 | `I` | 누른 칸의 색을 현재 색으로 고르고 **자동으로 펜으로 돌아간다**. 투명 칸을 찍으면 **지우개로 바꾼다**. 그림은 바뀌지 않는다. |

- 채우기: 누른 칸이 이미 현재 색이면 아무 것도 하지 않는다(되돌리기 기록도 없음).
- 단축키는 포커스가 `<input>`·`<select>`에 있을 때와 `Ctrl`/`Meta`/`Alt`가 눌려 있을 때는 무시한다. 대소문자 무관(`event.key.toLowerCase()`).

### 2.2 그리기 입력 (Pointer Events, 캔버스에만 등록)

- 캔버스에 `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`을 주고 `contextmenu`를 `preventDefault()`한다 → 그리는 중 페이지 스크롤·확대·길게 누르기 메뉴가 생기지 않는다. 캔버스 바깥은 평소대로 스크롤된다.
- `pointerdown`: `isPrimary`가 아니면 무시. 마우스는 `button === 0`만 받는다. `setPointerCapture(pointerId)`. 획(stroke) 시작 시점의 격자를 `strokeBefore`로 기억하고, 현재 도구를 누른 칸에 적용한다.
- `pointermove`(같은 `pointerId`, 펜·지우개일 때만): 지난 칸 → 현재 칸을 **선 보간(Bresenham)**으로 이어 칠한다. 빠르게 움직여도 칸이 비지 않는다. 지원되면 `event.getCoalescedEvents()`의 각 점에 대해 같은 처리를 한다.
- 좌표 → 칸: `x = Math.floor((clientX - rect.left) / rect.width * 16)`, `y`도 같은 방식. **클램프하지 않는다**: 캔버스 밖 좌표도 그대로 선 보간한 뒤, 격자 밖 칸은 버린다(밖으로 나갔다 들어와도 가장자리에 엉뚱한 선이 생기지 않음).
- 지난 칸과 현재 칸이 같으면 아무 것도 하지 않는다.
- `pointerup`/`pointercancel`/`lostpointercapture`: 획을 끝낸다. `strokeBefore`와 현재 격자가 다르면 되돌리기 기록 1개를 남기고 자동 저장한다(**한 획 = 되돌리기 1단계**).
- 렌더링은 `requestAnimationFrame`으로 모아서 프레임당 최대 1회 그린다.

### 2.3 키보드로 그리기

- 캔버스는 `tabindex="0"`으로 포커스를 받는다. 키보드 커서(현재 칸)는 처음 `(0, 0)`이며, 캔버스에 포커스가 있을 때만 화면에 표시한다.
- 캔버스 포커스 중:
  - 방향키: 커서 1칸 이동(가장자리에서 멈춤, 순환 없음). `preventDefault()`로 페이지 스크롤을 막는다.
  - `Space`/`Enter`: 커서 칸에 현재 도구 적용(획 1개로 처리 → 되돌리기 1단계).
  - `Shift` + 방향키: 이동한 칸에 펜·지우개를 바로 적용(키를 떼는 시점이 아니라 **매 이동이 획 1개**).
  - 마우스/터치로 칸을 누르면 커서도 그 칸으로 옮긴다.
- 문서 전체(`document`의 `keydown`):
  - `Ctrl/Meta + Z`: 되돌리기, `Ctrl/Meta + Shift + Z` 또는 `Ctrl/Meta + Y`: 다시하기. 포커스가 `<input>`·`<select>`에 있으면 가로채지 않는다.
  - 도구 단축키(2.1).
- 커서가 움직이거나 칠할 때 `#announcer`로 "3행 5열, 빨강"(투명이면 "투명")을 알린다. 행·열은 1부터 센다.

### 2.4 팔레트

- **기본 16색**(투명은 팔레트에 넣지 않고 지우개 도구로 다룬다). 순서대로 2행 이상 격자에 배치한다. 각 견본은 `aria-label`에 이름을 단다.

| # | 이름 | 값 | # | 이름 | 값 |
|---|---|---|---|---|---|
| 1 | 검정 | `#000000` | 9 | 초록 | `#2e7d32` |
| 2 | 진회색 | `#5f574f` | 10 | 하늘 | `#29b6f6` |
| 3 | 회색 | `#a3a3a3` | 11 | 파랑 | `#1e63d6` |
| 4 | 흰색 | `#ffffff` | 12 | 남색 | `#283593` |
| 5 | 빨강 | `#e53935` | 13 | 보라 | `#8e24aa` |
| 6 | 주황 | `#fb8c00` | 14 | 분홍 | `#f48fb1` |
| 7 | 노랑 | `#fdd835` | 15 | 갈색 | `#8d5524` |
| 8 | 연두 | `#7cb342` | 16 | 살구 | `#ffccaa` |

- **기본 현재 색**: 검정 `#000000`.
- **색 고르기**: 견본을 누르면 현재 색이 되고, 도구가 지우개·스포이드면 **펜으로 바꾼다**(채우기는 그대로 둔다).
- **사용자 색**: 팔레트 끝에 `<input type="color">`(라벨 "사용자 색")를 둔다. `input` 이벤트에서 현재 색으로 정하고 펜으로 바꾼다(채우기 선택 중이면 유지). 값은 저장(2.8)된다.
- **선택 표시**: 선택된 견본에 `aria-pressed="true"`, 바깥 3px 링(`outline: 3px solid var(--color-accent); outline-offset: 2px`). 현재 색이 기본 16색이 아니면(사용자 색·스포이드로 고른 색) 어느 견본도 선택되지 않고 사용자 색 입력이 링을 가진다.
- **현재 색 칩**: 도구 줄 옆에 현재 색 사각형 + 이름 또는 hex(`#e53935`→"빨강", 그 외 대문자 없는 hex 그대로). 지우개 선택 중이면 체크무늬 칩 + "투명".
- 견본에는 `1px solid var(--color-border)` 테두리를 준다(흰색·검정이 배경에 묻히지 않게).
- 색 값은 항상 **소문자 `#rrggbb`**로 정규화해 다룬다.

### 2.5 편의 기능 — 넣을 것 / 뺄 것

| 기능 | 결정 | 이유 |
|---|---|---|
| 되돌리기/다시하기 | **넣음** — 최대 100단계, 새 획이 생기면 다시하기 목록 비움. 버튼 2개 + 단축키. 불가능할 때 버튼 `disabled`. | 실수 복구가 가장 중요한 편의 기능. 256칸 스냅숏이라 구현이 단순하다. |
| 스포이드 | **넣음** | 함수 하나로 끝나고 사용자 색 재사용에 필요. |
| 채우기 | **넣음** (4방향) | 배경 칠하기가 16×16에서도 손이 많이 가고, 순수 함수로 검증하기 쉽다. |
| 격자선 토글 | **넣음** — 기본 켬, 저장됨. PNG에는 절대 들어가지 않는다. | 그릴 때는 필요, 결과 확인할 때는 방해. |
| 자동 저장 | **넣음** (2.8) | 모바일에서 탭을 닫거나 새로고침해도 그림이 남아야 한다. |
| 되돌리기 기록 저장 | 뺌 | 새로고침하면 기록은 비운다(그림만 유지). |
| 여러 그림·레이어·격자 크기 변경·도형 도구·대칭 그리기·PNG 불러오기 | 뺌 | 9장 참고. |

### 2.6 전체 지우기

- 버튼 "전체 지우기". 그림이 이미 비어 있으면 `disabled`.
- 누르면 `window.confirm('그림을 모두 지울까요? 되돌리기로 복구할 수 있어요.')`로 확인한다. 확인하면 모든 칸을 투명으로 만들고 **되돌리기 기록 1단계**를 남긴다(실수로 확인해도 복구 가능). 현재 색·도구·설정은 유지.
- 알림: "그림을 모두 지웠습니다."

### 2.7 PNG 저장

- **크기 선택**: `<select>`(라벨 "크기"): `1×`(16px) / `8×`(128px) / `16×`(256px, 기본) / `32×`(512px). 옵션 글자는 "16×16px (원본)", "128×128px", "256×256px", "512×512px". 선택값은 저장(2.8)된다.
- **만드는 방법**: 화면 캔버스를 쓰지 않는다. `toRGBA(grid, scale)`(4장)로 만든 픽셀 배열을 새 `<canvas>`(`width = height = 16 * scale`)에 `putImageData`로 넣고 `toBlob(cb, 'image/png')`. `drawImage` 확대를 쓰지 않으므로 보간·번짐이 없다.
- **투명 배경**: 투명 칸은 RGBA `(0,0,0,0)`, 색 칸은 알파 255. 격자선·체크무늬·커서는 들어가지 않는다.
- **파일 이름**: `pixel-art-YYYYMMDD-HHmmss.png`(로컬 시각, 예: `pixel-art-20261022-153045.png`).
- **저장 동작**: `URL.createObjectURL(blob)` → 숨긴 `<a download="파일이름">`을 만들어 `click()` → 문서에서 제거 → `setTimeout(..., 1000)` 뒤 `URL.revokeObjectURL`. 데스크톱은 다운로드, iOS Safari 13+/Android Chrome도 `download` 속성으로 파일 저장(iOS는 "다운로드" 폴더 또는 미리보기 화면).
- `toBlob`이 `null`을 주면 알림 "PNG를 만들지 못했습니다."를 띄우고 끝낸다. 성공하면 "PNG를 저장했습니다(256×256px)."
- 빈 그림도 저장은 허용한다(전부 투명한 PNG).

### 2.8 자동 저장

- `localStorage` 키 `pixel-art:state`에 JSON 저장:
  ```json
  { "version": 1, "pixels": ["#000000", null, ...256개], "color": "#e53935",
    "customColor": "#00aaff", "tool": "pen", "showGrid": true, "exportScale": 16 }
  ```
- **저장 시점**: 획 끝(변화가 있을 때), 채우기, 전체 지우기, 되돌리기/다시하기, 색·도구·격자선·크기 변경. 마지막 변경 후 300ms 디바운스 + `pagehide`에서 즉시 저장. 모든 접근은 `try/catch`, 실패하면 조용히 넘어간다(메모리에서는 계속 동작).
- **불러오기**: 로드 시 읽어 검증한다. `version === 1`이고 `isValidGrid(pixels)`이면 그림을 쓰고, 나머지 필드는 **필드별로** 검증해 잘못된 것만 기본값으로 둔다(`color`·`customColor`: `#rrggbb`, `tool`: 4개 중 하나, `showGrid`: boolean, `exportScale`: 1·8·16·32 중 하나). JSON이 깨졌거나 `pixels`가 잘못되면 전체를 기본값(빈 그림)으로 시작한다. 스포이드가 저장돼 있으면 펜으로 시작한다.
- `beforeunload` 경고는 띄우지 않는다(자동 저장이 있으므로).

### 2.9 다크 모드 (2048과 같은 방식)

- `localStorage`의 `theme`가 `"light"`/`"dark"`면 그 값, 아니면 `prefers-color-scheme`.
- `<head>` 맨 앞에 블로그 `index.html`과 **똑같은 인라인 스크립트**(복사)로 `<html data-theme>`를 먼저 설정한다.
- `theme.js`는 `apps/game-2048/theme.js`와 같은 내용을 **복사**해 둔다(`initThemeToggle()`: 토글, `theme` 키 저장, OS 변경 추적, `storage` 이벤트 반영). import하지 않는다.
- 헤더 오른쪽에 블로그·2048과 같은 원형 `.theme-toggle`(같은 SVG, `aria-label="다크 모드"`, `aria-pressed`, `title="다크 모드 전환"`, 44×44px).
- 캔버스는 CSS 변수(체크무늬·격자선·커서 색)를 `getComputedStyle`로 읽어 그리므로, `MutationObserver`로 `<html>`의 `data-theme` 변경을 감지해 **다시 그린다**.

### 2.10 접근성

- 시각적으로 숨긴 `aria-live="polite"` 영역 `#announcer` 하나로 알린다: 커서 이동/칠하기(2.3), 도구 변경("채우기 도구"), 색 변경("현재 색 빨강"), 되돌리기/다시하기("되돌렸습니다"/"다시 했습니다"), 전체 지우기, PNG 저장 결과. 같은 문구가 반복돼도 읽히도록 `textContent`를 비운 뒤 `requestAnimationFrame`에서 넣는다.
- 캔버스: `role="application"`, `aria-roledescription="픽셀 그림판"`, `aria-label="16×16 그림판"`, `aria-describedby="canvas-help"`. 도움말 문구는 화면에 보이게 둔다.
- 도구 버튼 4개: `<div role="group" aria-label="도구">` 안의 `<button aria-pressed>`. 팔레트: `<div role="group" aria-label="팔레트">` 안의 `<button aria-pressed aria-label="빨강">`.
- 모든 버튼·견본·`<select>`·색 입력은 최소 44×44px. `:focus-visible`은 `2px solid var(--color-accent)`, `outline-offset: 2px`(선택 링과 겹치지 않게 견본은 선택 링 3px + 포커스 시 `outline-offset: 5px` 등 Build 단계에서 구분되게).
- 선택 상태는 색만으로 표시하지 않는다(도구는 배경 반전 + `aria-pressed`, 견본은 링 + `aria-pressed`).
- 키보드만으로 모든 기능 사용 가능: 그리기(2.3), 도구·색·되돌리기·격자선·저장·테마·블로그로 가기.

## 3. 파일 구조

```
apps/pixel-art/
├── index.html      # 마크업, <head> 인라인 테마 스크립트, 메타 태그
├── style.css       # 디자인 토큰(블로그 값 복사 + 앱 전용), 라이트/다크, 레이아웃
├── pixel.js        # 순수 로직: 격자, 칠하기, 선 보간, 채우기, 검증, PNG용 RGBA 배열
├── history.js      # 순수 로직: 되돌리기/다시하기 스택
├── main.js         # 진입점: 상태, 캔버스 렌더링, 포인터·키보드 입력, 팔레트·도구 UI, 저장/불러오기, PNG 내보내기, aria-live
├── theme.js        # 테마 토글 (apps/game-2048/theme.js 복사)
├── preview.svg     # 블로그 카드용 정적 미리보기
├── spec.md         # 이 문서 (Plan)
├── review.md       # 검증 결과 (Review 단계)
└── briefs/         # 서브에이전트 지침 파일
```

- `pixel.js`·`history.js`는 **DOM·`window`·`localStorage`·`canvas`를 참조하지 않는다**(브라우저 콘솔에서 import해 바로 검증 가능).
- `index.html`은 `style.css`와 `<script type="module" src="main.js">`만 불러오고, `main.js`가 `./pixel.js`, `./history.js`, `./theme.js`를 import한다.
- **모든 경로는 상대 경로**(`style.css`, `./pixel.js`, `../../`). `/`로 시작하는 경로 금지(GitHub Pages `/my-blog/` 하위 경로).
- 블로그·2048 파일은 import하지 않고 필요한 값만 복사한다.
- 코드 스타일: ES 모듈, `const`/`let`, 2칸 들여쓰기, 세미콜론, 전역 변수 없음, 클래스명 소문자-하이픈, `!important` 금지, 주석은 한국어로 필요한 곳에만. DOM 텍스트는 `textContent`로만.

## 4. 핵심 로직 설계

### 4.1 데이터 구조
- **Color**: 소문자 `#rrggbb` 문자열. **투명은 `null`**.
- **Grid**: 길이 256의 1차원 배열 `(Color | null)[]`, 인덱스 `y * 16 + x`. `x`는 왼쪽→오른쪽(열), `y`는 위→아래(행), 0부터.
- **불변성**: 격자를 바꾸는 함수는 입력을 바꾸지 않고 **새 배열**을 반환한다. 바뀐 칸이 없으면 **입력 배열 그대로**(같은 참조)를 반환한다 → 호출 측이 `next !== grid`로 변화 여부를 판단할 수 있다.

### 4.2 `pixel.js` export

```js
export const SIZE = 16;
export const PALETTE = [{ name: '검정', color: '#000000' }, ...];  // 2.4 표, 16개
export const EXPORT_SCALES = [1, 8, 16, 32];

export function createGrid() → Grid                  // 256칸 모두 null
export function inBounds(x, y) → boolean
export function getPixel(grid, x, y) → Color | null  // 범위 밖이면 null
export function setPixel(grid, x, y, color) → Grid   // color는 Color 또는 null(지우기). 범위 밖이거나 같은 값이면 grid 그대로
export function lineCells(x0, y0, x1, y1) → [x, y][] // Bresenham, 양 끝 포함, 범위 검사 안 함. (0,0)-(3,1) → [[0,0],[1,0],[2,1],[3,1]]
export function paintLine(grid, x0, y0, x1, y1, color) → Grid
// lineCells 중 inBounds인 칸만 setPixel. 펜(color)·지우개(null) 공용.
export function floodFill(grid, x, y, color) → Grid
// 4방향 연결, 대상 색(null 포함)과 같은 칸만. 반복문 + 스택(재귀 금지). 시작 칸이 이미 color거나 범위 밖이면 grid 그대로.
export function isBlank(grid) → boolean              // 모두 null
export function normalizeColor(value) → Color | null // '#RRGGBB'/'#rrggbb' → 소문자, 그 외(3자리 hex 포함) null
export function isValidGrid(value) → boolean         // 배열, 길이 256, 각 값이 null 또는 /^#[0-9a-f]{6}$/
export function colorName(color) → string            // 팔레트 이름, 없으면 hex, null이면 '투명'
export function toRGBA(grid, scale = 1) → Uint8ClampedArray
// 길이 (16*scale)^2 * 4. 칸 (x,y)는 [x*scale, (x+1)*scale) × [y*scale, (y+1)*scale) 영역.
// 색 칸 → [r,g,b,255], 투명 → [0,0,0,0]. scale이 EXPORT_SCALES에 없으면 throw RangeError.
```

### 4.3 `history.js` export

```js
export const HISTORY_LIMIT = 100;
export function createHistory() → { past: [], future: [] }
export function record(history, before) → History
// before(바뀌기 전 격자)를 past 끝에 추가, future 비움, past가 100개를 넘으면 가장 오래된 것 버림. 새 객체 반환.
export function undo(history, current) → { history, grid } | null
// past가 비면 null. past의 마지막을 grid로 꺼내고 current를 future 앞에 넣는다.
export function redo(history, current) → { history, grid } | null
export function canUndo(history) / canRedo(history) → boolean
```

### 4.4 앱 상태 (`main.js` 모듈 스코프)

```js
const state = {
  grid,          // Grid
  history,       // History
  tool,          // 'pen' | 'eraser' | 'fill' | 'picker'
  color,         // Color (현재 색)
  customColor,   // Color (사용자 색 입력 값, 기본 '#00aaff')
  showGrid,      // boolean
  exportScale,   // 1 | 8 | 16 | 32
  cursor,        // { x, y } 키보드 커서
  stroke,        // null | { pointerId, before: Grid, lastX, lastY }
};
```

- 모든 그림 변경은 `commit(nextGrid, before)` 한 곳을 거친다: `nextGrid !== before`면 `record` → `state.grid` 갱신 → 버튼 상태(되돌리기·다시하기·전체 지우기) 갱신 → 렌더 예약 → 저장 예약. 드래그 중에는 `state.grid`만 갱신하고 `record`는 획 끝에 1회.

### 4.5 렌더링 (`main.js`)
- 캔버스 백킹 크기 = `Math.round(cssWidth * devicePixelRatio)`(정사각형). `ResizeObserver`로 크기 변화 시 다시 맞추고 다시 그린다.
- 칸 경계는 `edge(i) = Math.round(i * W / 16)`으로 계산해 칸 사이 틈·겹침이 없게 한다. `ctx.imageSmoothingEnabled = false`.
- 그리는 순서: ① 투명 칸은 칸마다 2×2 체크무늬(`--color-checker-a/b`) ② 색 칸은 그 색으로 채움 ③ `showGrid`면 1 device px 격자선(`--color-grid`, 반투명) ④ 캔버스 포커스 중이면 커서 칸에 `--color-cursor` 테두리(2 device px 이상, 안쪽으로).

## 5. 화면 구성

### 5.1 렌더링 방식 결정: **`<canvas>` 하나**
- 드래그 선 보간·채우기 결과를 한 번에 다시 그리면 되고, 256개 요소의 스타일을 갱신하지 않아도 된다.
- 좌표 → 칸 변환이 사각형 계산 하나로 끝난다(DOM 칸이면 칸 사이 틈에서 `elementFromPoint`가 빗나가는 문제가 생긴다).
- 체크무늬·격자선·커서를 같은 그리기 코드로 처리하고, 고해상도 화면에서도 선명하다.
- 단점인 키보드 접근성은 캔버스 자체에 포커스 + 커서 + `aria-live` 알림(2.3, 2.10)으로 보완한다.

### 5.2 마크업 골격
- `<html lang="ko">`, `<meta charset="utf-8">`, viewport 메타, `<meta name="color-scheme" content="light dark">`, `<meta name="description" content="16×16 격자에 도트를 찍어 그리고 PNG로 저장하는 픽셀 아트 에디터">`, `<title>픽셀 아트 · 내 블로그</title>`.
- `<div class="page">`
  - `<header class="app-header">`
    - `<nav class="app-nav"><a class="back-link" href="../../">← 블로그로</a><button class="theme-toggle" …>(블로그와 같은 SVG)</button></nav>` — 2048과 같은 마크업
    - `<h1 class="app-title">픽셀 아트</h1>`, `<p class="app-intro">16×16 칸에 도트를 찍어 그림을 그려 보세요.</p>`
  - `<main class="editor">`
    - `<div class="canvas-area">`: `<canvas id="canvas" tabindex="0" …>`(2.10 속성) + `<p class="canvas-help" id="canvas-help">칸을 누르거나 드래그해서 칠하세요. 키보드: 방향키로 이동, Space로 칠하기, Shift+방향키로 이어 칠하기.</p>`
    - `<div class="panel">`
      - `<section class="panel-section" aria-labelledby="tools-title">` `<h2 id="tools-title">도구</h2>`: 도구 버튼 4개(아이콘 SVG + 보이는 글자 "펜/지우개/채우기/스포이드"), 되돌리기·다시하기 버튼, 현재 색 칩
      - `<section … aria-labelledby="palette-title">` `<h2>팔레트</h2>`: 견본 16개 + `<label class="custom-color">` 안의 `<input type="color" id="custom-color">` + 글자 "사용자 색"
      - `<section … aria-labelledby="canvas-options-title">` `<h2>그림</h2>`: 격자선 체크박스(`<label><input type="checkbox" id="show-grid"> 격자선</label>`, 라벨 영역 44px), 전체 지우기 버튼
      - `<section … aria-labelledby="export-title">` `<h2>저장</h2>`: `<label for="export-scale">크기</label><select id="export-scale">`, `<button class="button primary" id="save-png">PNG로 저장</button>`
    - `<p class="sr-only" id="announcer" aria-live="polite"></p>`
- `<footer>`는 두지 않는다.
- 아이콘은 인라인 SVG(`aria-hidden="true"`, `currentColor`)로 직접 그린다. 외부 아이콘 폰트 금지.

### 5.3 레이아웃 (모바일 우선)

```
모바일 (375px)                         데스크톱 (≥ 768px)
┌──────────────────────┐              ┌────────────────────────────────────────┐
│ ← 블로그로        [◐] │              │ ← 블로그로                          [◐] │
│ 픽셀 아트             │              │ 픽셀 아트 / 소개                         │
│ 소개                  │              │ ┌──────────────────┐  ┌──────────────┐ │
│ ┌──────────────────┐ │              │ │                  │  │ 도구          │ │
│ │  캔버스 343×343   │ │              │ │  캔버스 최대 512  │  │ 팔레트        │ │
│ └──────────────────┘ │              │ │                  │  │ 그림          │ │
│ 도움말                │              │ └──────────────────┘  │ 저장          │ │
│ 도구 [펜][지우개]…    │              │ 도움말                └──────────────┘ │
│ 팔레트 ■■■■■■ …       │              └────────────────────────────────────────┘
│ 그림 / 저장           │
└──────────────────────┘
```

- `.page`: `max-width: 920px; margin-inline: auto; padding-inline: var(--gutter)`, 위아래 `var(--space-5)`(768px+ `var(--space-7)`). `--gutter` 16px → 768px+ 24px.
- **모바일**: 1열. 캔버스 `width: 100%; max-width: 512px; aspect-ratio: 1; display: block; margin-inline: auto`. 375px에서 343px(칸 약 21.4px).
- **768px 이상**: `.editor`를 `display: grid; grid-template-columns: minmax(0, 512px) minmax(240px, 1fr); gap: var(--space-6); align-items: start`. 패널은 오른쪽.
- 도구 버튼 줄: `display: flex; flex-wrap: wrap; gap: var(--space-2)`. 도구 버튼은 아이콘 위·글자 아래 또는 아이콘+글자 가로, `min-width/min-height: var(--tap-size)`.
- 팔레트: `display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--tap-size), 1fr)); gap: 6px`, 견본 `aspect-ratio: 1; min-height: var(--tap-size)`. 343px 폭에서 6열.
- 어떤 폭에서도 가로 스크롤이 없어야 한다(그리드 자식 `min-width: 0`).
- `body`에 `overflow: hidden`·`overscroll-behavior`는 주지 않는다(캔버스에만 `touch-action: none`).

## 6. 디자인

블로그의 중립 회색 + 파란 강조색 톤을 잇는다. 장식(그라데이션, 큰 그림자)은 넣지 않는다.

### 6.1 블로그에서 복사할 토큰 (값 그대로, 2048과 동일)
- `--font-sans`(블로그 스택), `--space-1`~`--space-8`, `--gutter: 16px`(768px+ 24px), `--radius: 6px`, `--tap-size: 44px`
- 라이트 `--color-bg #ffffff`, `--color-text #1f2328`, `--color-muted #59636e`, `--color-accent #0a5fc2`, `--color-border #d8dee4` / 다크 `#16181d`, `#e6e8eb`, `#9ba4ae`, `#6cb4ff`, `#30363d`
- 본문 `font-size: 1.0625rem`(768px+ `1.125rem`), `line-height: 1.7`.
- 다크는 `[data-theme="dark"]`에서 **변수만** 재정의하고 `color-scheme: dark`. 컴포넌트 규칙에는 색 값을 직접 쓰지 않는다(팔레트 견본의 배경색은 JS가 `style.backgroundColor`로 넣는 그림 데이터이므로 예외).

### 6.2 앱 전용 변수

| 변수 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-surface` | `#eef1f4` | `#22262e` | 패널 섹션·도구 버튼 배경 |
| `--color-button-bg` / `--color-button-text` | `#0a5fc2` / `#ffffff` | `#6cb4ff` / `#16181d` | 주 버튼(PNG 저장), **선택된 도구** |
| `--color-checker-a` | `#ffffff` | `#2c313a` | 투명 칸 체크무늬 밝은 쪽 |
| `--color-checker-b` | `#e3e7ec` | `#22262e` | 투명 칸 체크무늬 어두운 쪽 |
| `--color-grid` | `rgb(31 35 40 / 0.18)` | `rgb(230 232 235 / 0.18)` | 격자선(그림 위에 겹쳐도 보이게 반투명) |
| `--color-cursor` | `#0a5fc2` | `#6cb4ff` | 키보드 커서 테두리 |

- 선택 안 된 도구 버튼: 배경 `--color-surface`, 글자 `--color-text`, 테두리 `1px solid var(--color-border)`. 선택된 도구: 배경 `--color-button-bg`, 글자 `--color-button-text`(대비 라이트 6.1, 다크 8.1).
- 비활성(`disabled`) 버튼: `opacity: 0.45; cursor: not-allowed`.
- 캔버스 테두리 `1px solid var(--color-border)`, 모서리 `var(--radius)`는 주지 않는다(픽셀 가장자리가 잘리지 않게 0).
- 섹션 제목 `h2`: `font-size: 0.9375rem; color: var(--color-muted); margin: 0 0 var(--space-2)`.
- **투명 칸 표시**: 칸 하나를 2×2 체크무늬로 그린다(라이트는 흰/연회색, 다크는 어두운 두 회색). 지우개 현재 색 칩·사용자 색이 없을 때도 같은 체크무늬(CSS `conic-gradient(var(--color-checker-a) 25%, var(--color-checker-b) 0 50%, …)`).

## 7. 블로그 임베드 계획 (Embed 단계용, 이번 단계에서는 블로그 파일을 수정하지 않음)

- 2048과 같은 **웹앱 섹션**(`index.html`의 글 목록 아래 `.app-section` > `.app-list`)에 카드 1개를 추가한다. 2048 Embed가 아직이면 섹션을 만들 때 함께 넣는다.
- **카드 제목**: `픽셀 아트`
- **한 줄 설명**: "16×16 격자에 도트를 찍어 그리고 PNG로 저장하는 픽셀 아트 에디터."
- **링크**: `apps/pixel-art/`(상대 경로, 같은 탭)
- **미리보기: 정적 `preview.svg`**(iframe 비권장 — 캔버스의 `touch-action: none` 때문에 모바일에서 카드 위 스크롤이 막히고, 목록을 열 때마다 앱 JS가 실행된다).
- 카드 마크업: `<li><article class="app-card"><a href="apps/pixel-art/"><img src="apps/pixel-art/preview.svg" alt="픽셀 아트 에디터 미리보기: 16×16 격자에 그린 빨간 하트" width="400" height="400" loading="lazy"><h3>픽셀 아트</h3></a><p>설명</p></article></li>`.
- **`preview.svg` 사양** (Build 단계에서 작성):
  - `viewBox="0 0 400 400"`, 루트에 `role="img"`, `<title>픽셀 아트 에디터 미리보기</title>`, `shape-rendering="crispEdges"`. 외부 리소스·스크립트·폰트 없음.
  - 배경: 16×16 칸(칸당 25단위) 2×2 체크무늬(`#ffffff`/`#e3e7ec`, 칸당 12.5단위 사각형 — `<pattern>` 사용 가능).
  - 그림: 아래 하트(`R` 빨강 `#e53935`, `D` 진한 테두리 `#000000`, `W` 하이라이트 `#ffffff`, `.` 투명). 격자선은 `rgb(31 35 40 / 0.18)` 1단위 선.
    ```
    ................
    ................
    ..DDD.....DDD...
    .DRRRD...DRRRD..
    DRWWRRD.DRRRRRD.
    DRWRRRRDRRRRRRD.
    DRRRRRRRRRRRRRD.
    DRRRRRRRRRRRRRD.
    .DRRRRRRRRRRRD..
    ..DRRRRRRRRRD...
    ...DRRRRRRRD....
    ....DRRRRRD.....
    .....DRRRD......
    ......DRD.......
    .......D........
    ................
    ```
  - 바깥 테두리 `1px #d8dee4`에 해당하는 선.

## 8. 검증 체크리스트 (Review 단계)

### 8.1 순수 로직 — 콘솔에서 `const p = await import('./pixel.js'); const h = await import('./history.js');`
- [ ] `createGrid()` 길이 256, 모두 `null`
- [ ] `setPixel`: 새 배열 반환·입력 불변(`JSON.stringify` 전후 비교), 같은 값/범위 밖이면 같은 참조 반환
- [ ] `lineCells(0,0,3,1)` → `[[0,0],[1,0],[2,1],[3,1]]`; `lineCells(0,0,0,0)` → `[[0,0]]`; 역방향 `(3,1)-(0,0)`도 4칸; 대각선 `(0,0)-(15,15)` 16칸; 길이가 `max(|dx|,|dy|)+1`이고 이웃 칸끼리 8방향으로 붙어 있음(빈 칸 없음)
- [ ] `paintLine(grid, -5, 0, 20, 0, c)` → 0행 16칸만 칠해짐, 오류 없음
- [ ] `floodFill`: 빈 격자 (0,0) → 256칸 모두 칠함; 세로 벽(x=8 열 전체 칠함)으로 나뉜 왼쪽만 칠해짐; 대각선으로만 이어진 칸은 칠해지지 않음; 시작 칸이 이미 그 색이면 같은 참조; 색 칸에서 시작하면 같은 색 연결 영역만 바뀜
- [ ] `normalizeColor('#E53935')` → `'#e53935'`, `'#fff'`·`'red'`·`null` → `null`
- [ ] `isValidGrid`: 정상 true / 길이 255, `'#FFF'`, `'red'`, 숫자, 객체 → false
- [ ] `toRGBA(grid, 1)` 길이 1024; `toRGBA(grid, 16)` 길이 256·256·4; (3,2)를 `#e53935`로 칠한 뒤 scale 16에서 픽셀 (48..63, 32..47)이 `[229,57,53,255]`, (47,32)와 (64,32)는 `[0,0,0,0]`; `toRGBA(grid, 3)` → `RangeError`
- [ ] `history`: record 3번 → undo 3번으로 처음 격자, 4번째 undo `null`; undo 후 record하면 redo 불가; 101번 record 후 past 길이 100
- [ ] `pixel.js`·`history.js`에 `document`, `window`, `localStorage`, `canvas` 참조 없음

### 8.2 그리기
- [ ] 클릭/탭 한 번 → 정확히 한 칸 칠함, 지우개 → 그 칸 체크무늬
- [ ] 마우스를 대각선으로 아주 빠르게 드래그해도 칸 빠짐 없이 이어짐(터치 에뮬레이션에서도)
- [ ] 캔버스 밖으로 드래그했다 다시 들어와도 오류·엉뚱한 선 없음
- [ ] 한 획 → 되돌리기 1번에 전부 사라짐, 다시하기로 복구; 버튼 `disabled` 상태가 맞음
- [ ] 채우기·스포이드(색 칸 → 그 색 + 펜, 투명 칸 → 지우개) 동작
- [ ] 두 번째 손가락·마우스 오른쪽 버튼은 그리지 않음
- [ ] 375px 터치 에뮬레이션에서 캔버스 위 드래그 시 페이지가 스크롤되지 않고, 캔버스 밖에서는 스크롤됨
- [ ] 전체 지우기: confirm 취소 시 그대로, 확인 시 모두 투명, 되돌리기로 복구; 빈 그림일 때 버튼 비활성

### 8.3 팔레트 / 키보드
- [ ] 16색 값이 2.4 표와 일치, 견본마다 `aria-label`
- [ ] 선택 견본 링 + `aria-pressed="true"`는 하나뿐; 사용자 색을 고르면 견본 선택 해제
- [ ] 키보드만으로: Tab으로 캔버스 → 방향키 이동(페이지 스크롤 없음) → Space로 칠하기 → Shift+방향키로 이어 칠하기 → 단축키 B/E/G/I, Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y
- [ ] 색 입력·select에 포커스가 있을 때 B/E/G/I·Ctrl+Z를 가로채지 않음; Ctrl+R 등 브라우저 단축키 정상
- [ ] `#announcer`에 "3행 5열, 빨강" 형식 알림, 같은 문구 반복 시에도 갱신

### 8.4 PNG 저장 — 결과 픽셀 확인 방법
1. 알려진 그림을 만든다: `(0,0)` 검정, `(15,15)` 빨강, `(3,2)` 사용자 색 `#12ab34`, 나머지 투명.
2. 콘솔에서 Blob을 가로챈다:
   ```js
   const orig = URL.createObjectURL;
   URL.createObjectURL = (b) => { window.__png = b; return orig.call(URL, b); };
   ```
3. 크기 16×(256px)로 "PNG로 저장"을 누른 뒤:
   ```js
   const bmp = await createImageBitmap(window.__png);
   const c = new OffscreenCanvas(bmp.width, bmp.height);
   const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
   const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
   [bmp.width, bmp.height, window.__png.type, px(0,0), px(15,15), px(16,0), px(255,255), px(48,32), px(100,100)];
   // 기대: 256, 256, 'image/png', [0,0,0,255], [0,0,0,255], [0,0,0,0], [229,57,53,255], [18,171,52,255], [0,0,0,0]
   ```
- [ ] 위 기대값과 일치(칸 경계 (15,15)/(16,0)에서 번짐 없음)
- [ ] 1×·8×·32× 각각 크기 16/128/512px, 1×에서 `px(15,15)`가 빨강
- [ ] 격자선을 켠 상태·다크 모드에서도 PNG에 격자선·체크무늬·다른 배경 없음(투명 칸 알파 0)
- [ ] 파일 이름이 `pixel-art-YYYYMMDD-HHmmss.png` 형식, 실제 다운로드됨(데스크톱), 모바일 에뮬레이션에서 오류 없음
- [ ] 빈 그림 저장 시 전부 투명한 PNG

### 8.5 자동 저장
- [ ] 그리고 새로고침 → 그림·현재 색·사용자 색·도구·격자선·크기 유지, 되돌리기 기록은 비어 있음
- [ ] `pixel-art:state`에 `"{"`, `pixels` 길이 255, `'#FFF'` 값, `exportScale: 3`, `tool: 'brush'` → 오류 없이 시작(잘못된 필드만 기본값, `pixels`가 잘못되면 빈 그림)
- [ ] `Storage.prototype.getItem/setItem`이 throw해도 그리기·저장 정상

### 8.6 화면 / 디자인 / 테마
- [ ] 375px에서 가로 스크롤 없음(`document.documentElement.scrollWidth <= innerWidth`), 좌우 여백 16px, 캔버스 343px
- [ ] 768px·1280px에서 2열 레이아웃, 캔버스 최대 512px
- [ ] 모든 버튼·견본·select·색 입력·체크박스 라벨 44×44px 이상
- [ ] 고해상도(DPR 2·3) 에뮬레이션에서 칸 경계·격자선이 흐리지 않고 칸 사이 틈 없음
- [ ] 블로그에서 다크로 바꾼 뒤 열기 → 처음부터 다크(깜빡임 없음); 토글 시 캔버스 체크무늬·격자선 색도 즉시 바뀜; `aria-pressed` 갱신; 다른 탭(블로그) 변경 반영; 저장값 없을 때 OS 설정 추적
- [ ] 라이트/다크 텍스트 대비 4.5:1 이상, 선택 도구 버튼 대비 4.5:1 이상
- [ ] 콘솔 오류·경고 없음

### 8.7 프로젝트 규칙
- [ ] `apps/pixel-art/` 밖 파일 변경 없음, 블로그·2048 CSS/JS import 없음, 외부 라이브러리·CDN 없음
- [ ] 모든 경로 상대 경로; `python -m http.server 8000` 후 `http://localhost:8000/apps/pixel-art/`에서 동작, "← 블로그로"가 블로그 목록으로 이동
- [ ] 시맨틱 태그, `lang="ko"`, viewport 메타, `!important` 없음, 전역 변수 없음, `innerHTML` 없음

## 9. 범위 밖 (이번에 만들지 않음)

- 격자 크기 변경(8×8, 32×32 등), 확대/축소·이동(줌·팬)
- 레이어, 여러 그림 보관(갤러리), 애니메이션 프레임
- 도형(직선·사각형·원) 도구, 대칭 그리기, 선택·이동·복사
- PNG/이미지 불러오기, SVG·GIF 내보내기, 클립보드 복사
- 공유 시트(`navigator.share`), 온라인 갤러리·로그인
- 팔레트 편집·저장, 알파(반투명) 색
- 되돌리기 기록의 영구 저장
- 마우스 호버 미리보기
- 블로그 `index.html`·CSS 수정(Embed 단계에서 별도로), 오프라인(PWA)

## 10. 결정 사항 (열린 질문에 대한 사용자 답)

1. **PNG 크기**: 1×/8×/16×/32× 중 선택, 기본 16×(256px).
2. **팔레트**: 2.4 표의 16색 + 사용자 색 1칸.
3. **전체 지우기 확인**: 브라우저 기본 `confirm()` + 되돌리기 가능. 별도 모달 없음.
4. **모바일 저장**: 다운로드(`<a download>`)만. 공유 시트는 범위 밖.
5. **편의 기능**: 되돌리기/다시하기·스포이드·채우기·격자선 토글·자동 저장 모두 넣음(2.5 표대로).
