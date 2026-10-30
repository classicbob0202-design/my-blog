# 2048 게임 — 계획서 (spec)

> 상태: **승인됨 (2026-10-30)**. Build는 이 문서를 기준으로 한다.

- 작성: Plan 단계 / 2026-10-30
- 기준 문서: 프로젝트 루트 `CLAUDE.md`. 이 문서와 다르면 `CLAUDE.md`를 따르고 차이를 메인에 알린다.
- 10장 "열린 질문"은 사용자 답이 오기 전까지 **권장 기본안**대로 구현한다고 보고 이 문서 전체를 썼다. 답이 다르면 해당 절만 고친다.

## 1. 개요

4×4 판에서 방향키·WASD·스와이프로 숫자 타일을 밀어 같은 숫자를 합치고 2048 타일을 만드는 퍼즐 게임이다.

- **점수판**: 현재 점수, 최고 점수.
- **기록판**: 지난 게임 점수 상위 10개(점수·최고 타일·날짜).
- **이어 하기**: 진행 중인 판을 저장해 새로고침 후에도 이어 한다.
- **사용법 안내**: 조작법과 저장 방식을 화면에 적는다.
- `apps/game-2048/` 안에서 자체 완결된다. 외부 라이브러리·CDN·웹폰트 없음. 블로그 파일을 import하지 않고 필요한 값·코드는 복사한다.
- 블로그 색 팔레트(`css/variables.css`)와 다크 모드(`localStorage`의 `theme` 키)를 그대로 따른다.

## 2. 기능 목록

### 2.1 게임 규칙

- 판은 4×4, 빈 칸은 `0`.
- **시작**: 빈 판의 무작위 빈 칸 2곳에 타일을 하나씩 놓는다. 값은 2(90%) 또는 4(10%).
- **이동**: 상·하·좌·우 중 한 방향으로 모든 타일을 그 방향 끝까지 민다.
- **합치기**
  - 미는 방향의 **앞쪽(벽 쪽)부터** 처리한다. 같은 값 두 개가 (빈 칸을 사이에 두더라도) 이어지면 하나로 합쳐 값이 2배가 된다.
  - **한 번 이동에서 각 타일은 최대 한 번만 합쳐진다.** 합쳐서 생긴 타일은 같은 이동에서 다시 합쳐지지 않는다.
  - 얻는 점수 = 이번 이동에서 **합쳐서 생긴 타일 값의 합**.
- 합치기 예시 (한 줄을 **왼쪽**으로 밀 때):

  | # | 입력 | 결과 | 얻는 점수 | 비고 |
  |---|---|---|---|---|
  | 1 | `[2,2,2,2]` | `[4,4,0,0]` | 8 | 두 쌍이 각각 합쳐짐 |
  | 2 | `[2,2,4,0]` | `[4,4,0,0]` | 4 | 새로 생긴 4는 원래 4와 다시 합쳐지지 않음 |
  | 3 | `[2,2,2,0]` | `[4,2,0,0]` | 4 | 벽 쪽 두 개가 먼저 합쳐짐 |
  | 4 | `[4,4,8,8]` | `[8,16,0,0]` | 24 | |
  | 5 | `[2,0,0,2]` | `[4,0,0,0]` | 4 | 빈 칸을 사이에 둬도 합쳐짐 |
  | 6 | `[8,0,8,8]` | `[16,8,0,0]` | 16 | 앞의 두 8만 합쳐짐 |
  | 7 | `[0,0,0,2]` | `[2,0,0,0]` | 0 | 이동만 |
  | 8 | `[2,4,8,16]` | `[2,4,8,16]` | 0 | 변화 없음 (무효 이동) |
  | 9 | `[0,0,0,0]` | `[0,0,0,0]` | 0 | 변화 없음 |
  | 10 | `[4,0,4,4]` | `[8,4,0,0]` | 8 | |

  오른쪽으로 밀면 줄을 뒤집어 같은 규칙을 적용한다: `[2,2,2,0]` 오른쪽 → `[0,0,2,4]`.
- **새 타일**: 이동으로 판이 **실제로 바뀌었을 때만** 빈 칸 하나를 균등하게 골라 새 타일 1개(2: 90%, 4: 10%)를 놓는다. 판이 그대로면 새 타일도 점수 변화도 저장도 없다.

### 2.2 점수판

- **현재 점수**: 2.1의 규칙대로 더한다. 새 게임이면 0.
- **최고 점수**: 지금까지의 모든 게임 중 가장 높은 점수. 현재 점수가 최고 점수를 넘는 순간 함께 올라가고 바로 저장한다(`game-2048:best`, 4.6).
- 점수가 오른 이동에서는 현재 점수 상자 위에 `+N`이 떠올랐다 사라진다(600ms, 장식용 `aria-hidden="true"`, reduced-motion이면 표시하지 않음).
- 숫자 표시는 `toLocaleString('ko-KR')` (예: `12,345`), `font-variant-numeric: tabular-nums`.

### 2.3 기록판 (권장안)

| 항목 | 권장안 |
|---|---|
| 보관 개수 | 점수 상위 **10개** 저장·표시 (열린 질문 1) |
| 보여 줄 것 | 순위, 점수, 최고 타일, 날짜, 중단 여부 |
| 기록 시점 ① | **게임 오버** 순간 (점수 > 0일 때) |
| 기록 시점 ② | **진행 중에 새 게임**을 시작할 때 — 점수 > 0이고 게임 오버가 아니면 "중단"으로 기록 (열린 질문 2) |
| 기록 안 함 | 점수 0인 판, 이미 기록한 판(같은 `id`) |
| 초기화 | "기록 지우기" 버튼 + `confirm()` 확인. 기록만 지우고 **최고 점수는 유지** (열린 질문 3) |

- 정렬: 점수 내림차순. 점수가 같으면 **먼저 기록된 것이 위**(안정 정렬, 새 기록은 같은 점수들의 뒤에 넣는다).
- 11번째 이하로 밀려난 기록은 버린다. 새 기록이 10위 안에 못 들면 목록은 그대로다.
- 승리 후 "계속하기"로 이어 한 판도 끝날 때(게임 오버 또는 중단) 한 번만 기록한다.
- 같은 판을 두 번 기록하지 않도록 모든 판에 `id`를 붙이고(4.5), `addRecord`는 이미 같은 `id`가 있으면 아무것도 바꾸지 않는다. (예: 게임 오버 → 새로고침 → 새 게임을 눌러도 다시 기록되지 않음.)
- 표시 형식 (한 항목):

  ```
  1   12,345점        최고 타일 1024 · 2026.10.30
  2    8,200점  중단   최고 타일 512 · 2026.10.29
  ```

  - 날짜는 기록한 날의 **로컬 날짜** `YYYY-MM-DD`로 저장하고 `YYYY.MM.DD`로 표시한다.
  - "중단" 표시는 작은 배지(`.records__badge`), 게임 오버로 끝난 판은 배지 없음.
  - 방금 추가된 기록은 `.records__item--latest`로 강조(굵게 + 왼쪽 강조선 `var(--accent)`). 다음 새 게임을 시작하면 강조를 없앤다. 강조는 저장하지 않는다.
- 기록이 없으면 목록 대신 "아직 기록이 없어요. 첫 판을 끝내 보세요!" 문장(`.records__empty`)을 보이고, "기록 지우기" 버튼은 `disabled`.
- `confirm` 문구: "기록판의 기록을 모두 지울까요? 최고 점수는 그대로 남아요."

### 2.4 승리 / 패배

- **승리**: 이동 결과 판에 2048 이상 타일이 **처음** 생기면(`!won && hasWon(board)`) 승리 메시지를 판 위에 띄운다.
  - 제목 "2048 달성!", 문구 "계속해서 더 높은 점수에 도전할 수 있어요.", 버튼 **계속하기**(첫 번째), **새 게임**.
  - **계속하기**: 메시지를 닫고 같은 판으로 이어 한다(`keepPlaying = true`). 이후 4096을 만들어도 승리 메시지는 다시 뜨지 않는다.
- **패배**: 이동 + 새 타일 뒤 `canMove(board) === false`면 게임 오버.
  - 기록판에 기록(2.3)한 뒤 메시지를 띄운다.
  - 제목 "더 이상 움직일 수 없어요", 문구 "최종 점수 N점" + 기록판 10위 안에 들었으면 " · 기록판 K위", 버튼 **다시 하기**.
- 같은 이동에서 승리·패배가 함께 성립하면 승리 메시지를 먼저 보이고, **계속하기**를 누르면 곧바로 패배 메시지로 바꾼다(기록은 패배가 확정된 그 이동에서 이미 했다).
- 메시지가 떠 있는 동안 이동 입력(키·스와이프)은 무시한다.
- 메시지는 게임판 위에 반투명 배경(`--game-overlay`)으로 겹친다. 열리면 첫 버튼에 포커스(2.10).

### 2.5 새 게임

- 헤더의 **새 게임** 버튼, 승리 메시지의 **새 게임**, 패배 메시지의 **다시 하기**가 같은 함수 `startNewGame()`을 부른다.
- 순서:
  1. 지금 판이 점수 > 0이고 게임 오버가 아니면 — 헤더 버튼으로 눌렀을 때만 `confirm("진행 중인 판을 끝내고 새 게임을 시작할까요? 지금 점수는 기록판에 '중단'으로 남아요.")` (열린 질문 4). 취소하면 아무것도 하지 않는다. 승리 메시지의 **새 게임**은 이미 의사를 밝힌 것이므로 확인 창 없이 진행.
  2. 위 조건이면 지금 판을 "중단"으로 기록(2.3).
  3. 새 `id`, 점수 0, `won/keepPlaying/over = false`, 타일 2개. 메시지 닫기, 최신 기록 강조 해제.
  4. 진행 상태 저장, 알림 "새 게임을 시작했어요."
- 최고 점수와 기록판은 유지한다.

### 2.6 조작

- **키보드** (`document`의 `keydown`)
  - `ArrowUp/Down/Left/Right`, `w/a/s/d`(대소문자 무관, `event.key.toLowerCase()`) → 상/좌/하/우.
  - 게임에 쓴 키는 `event.preventDefault()`로 페이지 스크롤을 막는다.
  - `Ctrl`/`Meta`/`Alt`가 눌려 있으면 무시(브라우저 단축키 보존). `Shift`는 허용.
  - 포커스가 버튼에 있어도 방향키·WASD는 게임에 쓴다(Enter/Space는 버튼 동작 그대로).
  - 키를 누르고 있어 생기는 반복 입력(`event.repeat`)도 받는다.
  - 메시지(승리/패배)가 떠 있으면 무시한다.
- **스와이프** (Pointer Events, `.game-board` 요소에만 등록)
  - `.game-board`에 `touch-action: none; user-select: none;` → 판 위 스와이프 중 페이지 스크롤·확대 없음. 판 밖은 평소처럼 스크롤.
  - `pointerdown`: `isPrimary`가 아니면 무시. 시작 좌표·`pointerId` 기록, `setPointerCapture`.
  - `pointerup`: 같은 `pointerId`면 `dx`, `dy` 계산. `max(|dx|, |dy|) < 30px`면 무시, 아니면 절댓값이 큰 축 방향으로 1회 이동(같으면 가로).
  - `pointercancel`: 기록 폐기.
  - 메시지 안 버튼에서 시작한 포인터는 무시(`event.target.closest('.game-message')`).
  - 마우스 드래그도 같은 코드로 동작한다.
- **연속 입력**: 애니메이션 중 새 입력이 오면 진행 중 애니메이션을 즉시 최종 상태로 맞춘 뒤(`finishAnimation()`) 새 이동을 처리한다. 입력이 씹히거나 화면과 상태가 어긋나면 안 된다.

### 2.7 애니메이션 (가볍게)

- **미끄러짐**: 타일이 `transform: translate(...)`로 새 칸까지 이동, `100ms ease-in-out`.
- **생성**: 미끄러짐이 끝난 뒤 새 타일이 `scale(0) → scale(1)`, `150ms`.
- **합치기**: 미끄러짐이 끝난 뒤 합쳐진 타일이 `scale(1) → scale(1.12) → scale(1)`, `150ms`.
- `transform`·`opacity`만 애니메이션한다.
- `@media (prefers-reduced-motion: reduce)`: 위 transition/animation과 `+N` 효과를 모두 끈다(`transition: none; animation: none;`). JS도 `matchMedia('(prefers-reduced-motion: reduce)').matches`면 대기 시간 0으로 바로 `finishAnimation()`.
- 테마 전환은 블로그와 같이 `body`에 `transition: background-color 0.2s, color 0.2s`만.

### 2.8 다크 모드

- `<head>` 안, `<meta name="viewport">` 바로 다음에 블로그 `index.html`과 **글자 하나 다르지 않은 인라인 스크립트**를 넣는다(저장값 `light`/`dark` → 아니면 `prefers-color-scheme` → `document.documentElement.dataset.theme`).
- `theme.js`: 블로그 `js/theme.js`를 그대로 복사하고, 끝에 **다른 탭 동기화**만 추가한다.

  ```js
  // 다른 탭(블로그 등)에서 테마를 바꾸면 따라간다.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === 'light' || event.newValue === 'dark') apply(event.newValue);
  });
  ```

  (위 코드는 즉시 실행 함수 **안**에 넣는다.)
- 토글 버튼: 블로그와 같은 `<button class="theme-toggle" type="button" aria-label="다크 모드로 전환">🌙</button>`. 다크일 때 `☀️` + "라이트 모드로 전환", 라이트일 때 `🌙` + "다크 모드로 전환"(블로그 `theme.js`의 `updateButton`이 처리). 44×44px.
- `<meta name="color-scheme" content="light dark">`를 넣고, `[data-theme="dark"]`에 `color-scheme: dark`.

### 2.9 저장·불러오기

- 키 3개 (형식은 4.6): `game-2048:state`(진행 중인 판), `game-2048:best`(최고 점수), `game-2048:records`(기록판). 테마는 블로그와 공유하는 `theme`.
- 모든 접근은 `storage.js`의 `try/catch` 함수로만 한다. 실패하면 메모리 값으로 계속 플레이하고 화면에 오류를 띄우지 않는다.
- **저장 시점**
  - `state`: 새 게임 시작, 실제 이동(새 타일 놓은 뒤), 승리 후 "계속하기".
  - `best`: 최고 점수가 바뀐 이동마다.
  - `records`: 기록 추가, 기록 지우기.
- **불러오기** (페이지 로드 시 한 번)
  - `best` → `parseBest`. 깨졌으면 0.
  - `records` → `parseRecords`. 깨진 항목만 버리고 나머지는 쓴다. 배열이 아니면 `[]`.
  - `state` → `parseSavedGame`. `null`이면 새 게임을 시작하고 새 상태를 저장한다(깨진 값을 덮어씀).
  - 불러온 점수가 `best`보다 크면 `best`를 올려 저장한다. 기록판 1위 점수가 `best`보다 커도 같은 방식으로 맞춘다.
  - 불러온 판이 `over`면 패배 메시지를, `won && !keepPlaying`이면 승리 메시지를 다시 띄운다. 이때 기록하지 않는다(이미 같은 `id`로 기록됨).

### 2.10 접근성

- **알림 영역**: 시각적으로 숨긴(`.visually-hidden`) `<p id="announcer" aria-live="polite">` 하나. 같은 문구도 다시 읽히게 `textContent = ''` 후 `requestAnimationFrame` 안에서 새 문구를 넣는다.
- **알릴 것 (과하지 않게 — 매 이동 점수는 알리지 않는다)**

  | 상황 | 문구 |
  |---|---|
  | 이번 판에서 처음으로 최고 점수를 넘었을 때(판당 1번) | "최고 점수 갱신! 지금 1,234점." |
  | 이번 판 최대 타일이 128 이상으로 새로 올라갔을 때 | "256 타일을 만들었어요." |
  | 승리 | "2048 달성! 계속하기 또는 새 게임을 고르세요." |
  | 패배 | "게임 오버. 최종 점수 1,234점." (+ " 기록판 3위.") |
  | 새 게임 | "새 게임을 시작했어요." |
  | 기록 지우기 | "기록을 지웠어요." |
  | 판 읽기 버튼 | `describeBoard` 결과 + " 점수 1,234점." |

  한 이동에 여러 개가 겹치면 승리/패배 > 최고 점수 > 타일 순으로 **하나만** 알린다.
- **판 읽기 (원할 때 읽는 대체 텍스트)**: 헤더 버튼 "판 읽기"를 누르면 `describeBoard(board)`(4.3) 문장을 알림 영역에 넣는다. 예: "1행: 2, 빈칸, 빈칸, 4. 2행: 빈칸, 빈칸, 빈칸, 빈칸. 3행: 8, 빈칸, 빈칸, 빈칸. 4행: 빈칸, 빈칸, 빈칸, 2."
- **게임판**: `role="group"`, `aria-label="2048 게임판"`, `aria-describedby="game-board-desc"`(시각적으로 숨긴 문장 "방향키나 W·A·S·D, 스와이프로 타일을 움직여요. 판 상태는 '판 읽기' 버튼으로 들을 수 있어요."). 배경 칸과 타일은 모두 `aria-hidden="true"`. `tabindex="-1"`(포커스 복귀용).
- **점수 상자**: 값은 일반 `<span>`(라이브 영역 아님). 상자에 보이는 라벨("점수"/"최고")이 있으므로 그대로 읽힌다.
- **메시지(승리/패배)**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="game-message-title"`, `aria-describedby="game-message-text"`. 열리면 첫 버튼에 포커스, 열린 동안 Tab/Shift+Tab이 메시지 안 버튼끼리만 돈다. 닫힐 때 "계속하기"면 게임판(`tabindex="-1"`)으로, "새 게임/다시 하기"면 헤더의 **새 게임** 버튼으로 포커스를 돌린다.
- **기록판**: `<section aria-labelledby="records-title">` + `<ol>`. 각 항목을 읽으면 "1위, 12,345점, 최고 타일 1024, 2026.10.30"처럼 들리도록 순위 숫자도 텍스트로 넣는다(`.records__rank`에 "1", 뒤에 시각적으로 숨긴 "위,").
- 모든 버튼·링크 최소 44×44px. `:focus-visible`은 블로그와 같은 `outline: 2px solid var(--accent); outline-offset: 2px;`.
- 타일 숫자·버튼 글자·보조 글자 대비 4.5:1 이상(6.3 표, 계산 확인함).

### 2.11 사용법 안내 문구

- 위치: 게임판 **바로 아래**(1024px 이상에서는 오른쪽 열, 기록판 아래). `<section class="help" aria-labelledby="help-title">`.
- 제목 `<h2 id="help-title">사용법</h2>`, 아래 문장을 **그대로** `<ul class="help__list">`의 `<li class="help__item">`로 넣는다.
  1. 방향키(← ↑ → ↓)나 W·A·S·D를 누르면 모든 타일이 그쪽으로 밀려요.
  2. 휴대폰에서는 게임판을 손가락으로 쓸어(스와이프) 움직여요.
  3. 같은 숫자 두 개가 부딪히면 하나로 합쳐지고, 합쳐진 숫자만큼 점수가 올라요.
  4. 2048 타일을 만들면 승리! 계속하기를 눌러 더 높은 점수에 도전할 수 있어요.
  5. 진행 중인 판, 최고 점수, 기록판은 이 브라우저에 자동으로 저장돼요. 새로고침하거나 다시 들어와도 이어서 할 수 있어요.
  6. 게임이 끝나거나 진행 중에 새 게임을 누르면 점수가 기록판에 남아요(상위 10개).
  7. 다른 브라우저·기기, 시크릿 창과는 저장이 공유되지 않아요.
  8. 화면 낭독기를 쓴다면 '판 읽기' 버튼으로 지금 판 상태를 들을 수 있어요.
- 헤더의 소개 한 줄: "같은 숫자를 밀어 합쳐 2048을 만들어 보세요."

## 3. 파일 구조

```
apps/game-2048/
├── briefs/         # 서브에이전트 지침 (손대지 않음)
├── spec.md         # 이 문서 (손대지 않음)
├── review.md       # Review 단계에서 작성
├── index.html      # 마크업, <head> 인라인 테마 스크립트, 메타 태그
├── style.css       # 블로그 변수 복사 + 앱 전용 변수(라이트/다크), 레이아웃, 타일, 애니메이션
├── game.js         # [순수] 게임 규칙·판 검증·판 설명 문장. DOM·localStorage·Math.random 직접 사용 없음
├── scores.js       # [순수] 최고 점수·기록판 검증/추가/정렬, 날짜 문자열. DOM·localStorage 없음
├── storage.js      # localStorage 안전 래퍼(try/catch)와 키 상수. 로직 없음
├── main.js         # 진입점: 상태, 렌더링·애니메이션, 입력, 저장 호출, 알림, 메시지, 기록판 그리기
├── theme.js        # 블로그 js/theme.js 복사 + storage 이벤트 동기화 (defer 즉시 실행 함수)
└── preview.svg     # 블로그 카드용 미리보기 (정적 SVG)
```

- `index.html`이 불러오는 것: `style.css`, `<script src="theme.js" defer>`, `<script type="module" src="main.js">`. `main.js`가 `./game.js`, `./scores.js`, `./storage.js`를 import한다.
- **모든 경로는 상대 경로** (`style.css`, `./game.js`, `../../`). `/`로 시작하는 경로 금지(GitHub Pages `/my-blog/` 하위 경로).
- 블로그의 `css/*.css`, `js/*.js`는 import하지 않는다. 필요한 값·코드는 복사한다.
- `reset.css`는 따로 두지 않고, 필요한 최소 초기화(`box-sizing: border-box`, `margin: 0`, 버튼 `font: inherit`)만 `style.css` 맨 위에 쓴다.
- 코드 규칙(CLAUDE.md): `const`/`let`(`var` 금지), 2칸 들여쓰기, 전역 변수 없음, BEM 클래스, `!important` 금지, ID 선택자로 스타일링 금지(ID는 JS·ARIA 연결용만), DOM에 글자를 넣을 때는 `textContent`만(`innerHTML`·`insertAdjacentHTML` 금지), 주석은 한국어로 필요한 곳에만.
- 순수 모듈 테스트: 스크래치 폴더의 `.mjs` 스크립트에서 `import('file:///C:/Users/bobby/Desktop/my-blog/apps/game-2048/game.js')`로 불러 Node(22 이상)로 실행한다. 앱 폴더에 `package.json`·테스트 파일을 만들지 않는다.

## 4. 핵심 로직 설계

### 4.1 데이터 구조

- **Board**: `number[][]` — 4×4, `board[row][col]`, `row 0`이 위, `col 0`이 왼쪽, 빈 칸 `0`.
- **Direction**: `'up' | 'down' | 'left' | 'right'`.
- **불변성**: 모든 순수 함수는 입력을 바꾸지 않고 새 배열/객체를 반환한다.
- **난수 주입**: 난수가 필요한 함수는 `rng`(`[0, 1)`을 반환하는 함수)를 **필수 인자**로 받는다. 기본값을 두지 않는다 → `game.js`에 `Math.random`이라는 글자가 아예 없다. `main.js`가 `Math.random`을 넘긴다.
- **Record**: `{ id: string, score: number, maxTile: number, date: 'YYYY-MM-DD', ended: 'over' | 'quit' }`.

### 4.2 `game.js` export

```js
export const SIZE = 4;
export const WIN_VALUE = 2048;
export const MAX_TILE = 131072; // 4×4에서 이론상 가장 큰 타일(2^17)

export function createEmptyBoard() → Board  // 0으로 채운 4×4

export function addRandomTile(board, rng)
  → { board, tile: { row, col, value } } | null
// 빈 칸 목록을 행 우선(위→아래, 왼→오) 순서로 만든다.
// index = Math.floor(rng() * 빈칸수) 로 칸을 고르고, 이어서 value = rng() < 0.9 ? 2 : 4.
// rng를 정확히 2번, 이 순서로 호출한다. 빈 칸이 없으면 rng를 부르지 않고 null.

export function createGame(rng)
  → { board, tiles: [tileA, tileB] }       // 빈 판에 addRandomTile 2번 (rng 4번 호출)

export function slideLine(line)
  → { line, scoreGained, moves }
// 길이 4 배열을 인덱스 0 쪽으로 민다. 합치기 규칙(타일당 1번)은 여기에만 구현한다.
// moves: 원래 0이 아니던 칸마다 { from, to, merged } (from/to는 0~3 인덱스).
//        합쳐진 두 타일은 같은 to, 둘 다 merged: true.

export function move(board, direction)
  → { board, moved, scoreGained, moves, merges }
// 각 행/열을 꺼내(right·down은 뒤집어서) slideLine 후 되돌려 넣는다.
// moved:   이동 전후 판이 한 칸이라도 다르면 true
// moves:   [{ from: [row, col], to: [row, col], merged }]  — 판 좌표, 애니메이션용
// merges:  [{ row, col, value }]  — 합쳐져 생긴 타일 위치·값
// moved가 false면: board는 입력과 같은 값의 새 복사본, scoreGained 0, merges [].
// 새 타일은 만들지 않는다(결정적 함수).

export function canMove(board) → boolean   // 빈 칸 또는 가로·세로로 이웃한 같은 값이 있으면 true
export function hasWon(board) → boolean    // WIN_VALUE 이상 타일이 있으면 true
export function getMaxTile(board) → number // 가장 큰 값(빈 판이면 0)

export function isValidBoard(board) → boolean
// 4행 배열, 각 행 길이 4 배열, 각 값이 0 또는 2~MAX_TILE 사이 2의 거듭제곱 정수,
// 0이 아닌 타일 1개 이상.

export function describeBoard(board) → string
// "1행: 2, 빈칸, 빈칸, 4. 2행: … 4행: …" (값은 숫자 그대로, 0은 "빈칸", 숫자에 쉼표 없음)

export function serializeGame(game) → string
// game = { id, board, score, won, keepPlaying, over } → JSON 문자열 (v: 1 포함, 4.6)

export function parseSavedGame(raw) → game | null
// raw: localStorage에서 읽은 문자열 또는 null. 4.6 검증 규칙을 모두 통과해야 game 반환.
// JSON.parse 오류도 내부에서 잡아 null.
```

### 4.3 `scores.js` export

```js
export const RECORD_LIMIT = 10;

export function parseBest(raw) → number
// raw가 /^\d{1,15}$/ 이고 Number.isSafeInteger면 그 수, 아니면 0. (null, "abc", "-5", "1.5" → 0)

export function isValidRecord(item) → boolean   // 4.6 records 규칙

export function parseRecords(raw) → Record[]
// JSON 배열이 아니면 []. 유효한 항목만 남기고, id 중복은 앞의 것만, 4.4 정렬 후 RECORD_LIMIT개.

export function addRecord(records, entry, limit = RECORD_LIMIT)
  → { records, rank }
// entry.score가 0이면 records 그대로(새 배열 복사), rank null.
// 같은 id가 이미 있으면 records 그대로, rank는 그 항목의 순위(1부터).
// 아니면 같은 점수들의 뒤에 끼워 넣고 limit개로 자른다.
// 잘린 뒤 남아 있으면 rank = 순위(1부터), 밀려났으면 rank null.

export function toDateString(date) → 'YYYY-MM-DD'   // Date 객체의 로컬 연·월·일 (main이 new Date()를 넘김)
export function formatDate(dateString) → 'YYYY.MM.DD'
```

### 4.4 정렬 규칙

- 점수 내림차순. 같은 점수는 배열에 먼저 있던 것이 위(안정). `addRecord`는 "점수가 `entry.score` 이상인 마지막 항목" 바로 뒤에 넣는다.

### 4.5 게임 상태 (`main.js` 모듈 스코프)

```js
const state = {
  id,           // 판 id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  board,        // Board
  score,        // number
  best,         // number
  won,          // 2048을 한 번이라도 만들었는지
  keepPlaying,  // 승리 후 "계속하기"를 눌렀는지
  over,         // 더 이상 이동 불가
  records,      // Record[]
  latestRecordId,   // 방금 추가된 기록 id (강조용, 저장 안 함) | null
  bestAnnounced,    // 이번 판에서 "최고 점수 갱신"을 알렸는지 (저장 안 함)
  maxTileSeen,      // 이번 판 최대 타일 (알림용, 불러올 때 getMaxTile로 계산)
};
// 이동 가능 조건: !state.over && !(state.won && !state.keepPlaying)
```

`bestAnnounced`는 판 시작 시 `false`. 단, 불러온 판의 점수가 이미 최고 점수와 같으면 `true`로 둔다(새로고침마다 다시 알리지 않게).

### 4.6 저장 형식과 검증

**`game-2048:state`** — JSON 문자열

```json
{ "v": 1, "id": "mfx3k2a-4f1z", "board": [[2,0,0,4],[0,0,0,0],[8,0,0,0],[0,0,0,2]],
  "score": 36, "won": false, "keepPlaying": false, "over": false }
```

검증(하나라도 어기면 `null` → 새 게임):
- `JSON.parse` 성공, 결과가 `null` 아닌 일반 객체.
- `v === 1`.
- `id`: 문자열, `/^[a-z0-9-]{1,40}$/`.
- `isValidBoard(board)`.
- `score`: `Number.isSafeInteger(score) && score >= 0`.
- `won`, `keepPlaying`, `over`: 모두 boolean.
- 일관성: `keepPlaying`이 `true`면 `won`도 `true` / `hasWon(board)`이면 `won`이 `true` / `over === !canMove(board)`.

**`game-2048:best`** — 정수 문자열. 예: `"20480"`. 검증은 `parseBest`.

**`game-2048:records`** — JSON 배열

```json
[ { "id": "mfx3k2a-4f1z", "score": 12345, "maxTile": 1024, "date": "2026-10-30", "ended": "over" },
  { "id": "mfw9p01-1ab", "score": 8200, "maxTile": 512, "date": "2026-10-29", "ended": "quit" } ]
```

항목 검증(`isValidRecord`): 일반 객체 / `id` 위와 같은 정규식 / `score` 1 이상 안전 정수 / `maxTile` 2~`MAX_TILE` 2의 거듭제곱 / `date` `/^\d{4}-\d{2}-\d{2}$/` 이고 월 01~12, 일 01~31 / `ended`가 `"over"` 또는 `"quit"`. 모르는 추가 속성은 무시(검증 실패 아님)하고, 다시 저장할 때 위 다섯 속성만 쓴다.

### 4.7 `storage.js`

```js
export const KEYS = { state: 'game-2048:state', best: 'game-2048:best', records: 'game-2048:records' };
export function readItem(key) → string | null      // 실패 시 null
export function writeItem(key, value) → boolean    // 실패 시 false
export function removeItem(key) → boolean
```

### 4.8 한 턴 처리 흐름 (`main.js`)

```
handleMove(direction)
 ├ 이동 불가 상태면 return
 ├ 진행 중 애니메이션이 있으면 finishAnimation()
 ├ result = move(state.board, direction)
 ├ result.moved === false → return
 ├ spawn = addRandomTile(result.board, Math.random)   // moved면 빈 칸이 있으므로 null 아님
 ├ state.board = spawn.board; state.score += result.scoreGained
 ├ 최고 점수 갱신 → 바뀌었으면 writeItem(best)
 ├ 점수판 갱신, +N 효과
 ├ 승리: !state.won && hasWon(board) → state.won = true
 ├ 패배: !canMove(board) → state.over = true → addRecord(..., ended: 'over') → records 저장
 ├ writeItem(state, serializeGame(...))
 ├ 렌더링: moves로 미끄러짐 → 100ms 뒤 finishAnimation(): merges 튐 + spawn.tile 생성
 ├ 메시지: 승리면 승리 메시지(패배도 성립하면 "계속하기" 때 패배로 전환), 아니고 패배면 패배 메시지
 └ 알림 하나 (2.10 우선순위)
```

### 4.9 렌더링 방식

- 배경 칸 16개(`.game-board__cell`)는 CSS grid로 고정.
- 타일은 그 위에 겹친 `.game-board__tiles`(`position: absolute; inset: var(--board-gap)`) 안에 `position: absolute` 요소로 둔다.
  - 크기: `width/height: calc((100% - 3 * var(--board-gap)) / 4)`.
  - 위치: `transform: translate(calc(var(--col) * (100% + var(--board-gap))), calc(var(--row) * (100% + var(--board-gap))))`. `--row/--col`은 JS가 `el.style.setProperty('--row', r)`로 설정.
  - 생성·튐 효과는 안쪽 요소(`.game-board__tile-inner`)의 `@keyframes`로 준다(바깥 `transform`은 위치 전용).
- `main.js`는 화면 타일 목록을 `{ id, row, col, value, el }`로 관리한다.
  1. `moves`대로 각 타일의 `--row/--col`을 바꾼다.
  2. 100ms 뒤(reduced-motion이면 즉시) `finishAnimation()`: 합쳐진 두 요소를 지우고 `merges` 위치에 새 값 타일(`--merged`), `spawn.tile` 위치에 새 타일(`--new`)을 만든다.
  3. 끝에서 화면 타일 값이 `state.board`와 다르면 타일 층을 `state.board`로 통째로 다시 그린다(안전장치).
- 타일 마크업 (`document.createElement` + `textContent`):

  ```html
  <div class="game-board__tile game-board__tile--v128 game-board__tile--digits-3" aria-hidden="true">
    <div class="game-board__tile-inner">128</div>
  </div>
  ```

  - 값 수식어: `--v2` … `--v2048`, 4096 이상은 `--super`(숫자는 실제 값).
  - 자릿수 수식어: `--digits-1` ~ `--digits-6`.

## 5. 화면 구성

### 5.1 마크업 골격

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>/* 블로그 index.html과 같은 인라인 테마 스크립트 */</script>
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="같은 숫자를 밀어 합쳐 2048을 만드는 퍼즐 게임">
  <title>2048 · My Blog</title>
  <link rel="stylesheet" href="style.css">
  <script src="theme.js" defer></script>
  <script type="module" src="main.js"></script>
</head>
<body>
  <header class="top-bar">
    <div class="top-bar__inner">
      <a class="top-bar__back" href="../../">← 블로그로</a>
      <button class="theme-toggle" type="button" aria-label="다크 모드로 전환">🌙</button>
    </div>
  </header>

  <main class="game-page">
    <div class="game-page__play">
      <div class="game-header">
        <h1 class="game-header__title">2048</h1>
        <div class="score-board">
          <div class="score-box score-box--current">
            <span class="score-box__label">점수</span>
            <span class="score-box__value" id="score-value">0</span>
            <span class="score-box__gain" aria-hidden="true"></span>
          </div>
          <div class="score-box score-box--best">
            <span class="score-box__label">최고</span>
            <span class="score-box__value" id="best-value">0</span>
          </div>
        </div>
        <p class="game-header__intro">같은 숫자를 밀어 합쳐 2048을 만들어 보세요.</p>
        <div class="game-header__actions">
          <button class="button button--primary" type="button" id="new-game">새 게임</button>
          <button class="button button--secondary" type="button" id="read-board">판 읽기</button>
        </div>
      </div>

      <div class="game-board" id="game-board" role="group" aria-label="2048 게임판"
           aria-describedby="game-board-desc" tabindex="-1">
        <div class="game-board__grid" aria-hidden="true"><!-- .game-board__cell × 16 --></div>
        <div class="game-board__tiles" aria-hidden="true"></div>
        <div class="game-message" role="dialog" aria-modal="true"
             aria-labelledby="game-message-title" aria-describedby="game-message-text" hidden>
          <h2 class="game-message__title" id="game-message-title"></h2>
          <p class="game-message__text" id="game-message-text"></p>
          <div class="game-message__actions"><!-- 버튼 1~2개 --></div>
        </div>
      </div>
      <p class="visually-hidden" id="game-board-desc">(2.10 문장)</p>
    </div>

    <aside class="game-page__side">
      <section class="records" aria-labelledby="records-title">
        <div class="records__head">
          <h2 class="records__title" id="records-title">기록판</h2>
          <button class="button button--text records__reset" type="button">기록 지우기</button>
        </div>
        <ol class="records__list">
          <!-- <li class="records__item [records__item--latest]">
                 <span class="records__rank">1<span class="visually-hidden">위,</span></span>
                 <span class="records__score">12,345점</span>
                 <span class="records__badge">중단</span>   (quit일 때만)
                 <span class="records__meta">최고 타일 1024 · 2026.10.30</span>
               </li> -->
        </ol>
        <p class="records__empty">아직 기록이 없어요. 첫 판을 끝내 보세요!</p>
      </section>

      <section class="help" aria-labelledby="help-title">
        <h2 class="help__title" id="help-title">사용법</h2>
        <ul class="help__list"><!-- 2.11 문장 8개, .help__item --></ul>
      </section>
    </aside>
  </main>

  <p class="visually-hidden" id="announcer" aria-live="polite"></p>
</body>
</html>
```

- 사용법 문장과 소개·라벨처럼 **바뀌지 않는 글자는 HTML에 직접** 쓴다. JS는 점수, 기록 목록, 메시지, 타일만 만든다.
- 기록 목록이 비면 `.records__list`에 `hidden`, `.records__empty`는 보임. 반대도 같다.
- `.visually-hidden`은 표준 숨김 규칙(`position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;`).

### 5.2 레이아웃 (모바일 우선)

| 폭 | 구성 |
|---|---|
| 기본(~767px), 확인 폭 375px | 1열: 상단 바 → 게임 헤더 → 게임판 → 기록판 → 사용법. 좌우 여백 `var(--gutter)`(16px). 375px에서 콘텐츠 폭 343px, 게임판 343×343, 칸 간격 10px → 칸 약 73px. |
| 태블릿 `min-width: 768px`, 확인 폭 768px | 1열 유지, `.game-page` 최대 폭 480px 가운데 정렬(게임판 480×480, 간격 12px). 위아래 여백 `var(--space-xl)`. |
| 데스크톱 `min-width: 1024px`, 확인 폭 1280px | 2열 grid: `grid-template-columns: minmax(0, 480px) minmax(260px, 320px)`, `gap: var(--space-xl)`, `justify-content: center`. 왼쪽 `.game-page__play`, 오른쪽 `.game-page__side`(기록판 위, 사용법 아래), `align-items: start`. 전체 폭 약 840px. |

- `.top-bar__inner`: `display: flex; justify-content: space-between; align-items: center;` 최대 폭은 `.game-page`와 같게, 좌우 여백 `var(--gutter)`.
- `.game-header`: grid 2열(`1fr auto`). 1행 제목·점수판, 2행 소개(2열 전체), 3행 버튼(2열 전체, `display: flex; gap: var(--space-sm); flex-wrap: wrap`). 제목 `var(--font-size-xl)` 굵게.
- `.score-board`: `display: flex; gap: var(--space-sm)`. `.score-box`: `min-width: 4.5rem`, 가운데 정렬, 라벨 `var(--font-size-sm)`, 값 `var(--font-size-lg)` 700.
- `.game-board`: `position: relative; width: 100%; aspect-ratio: 1; padding: var(--board-gap); border-radius: var(--radius); background: var(--game-board-bg); container-type: inline-size; touch-action: none; user-select: none;`. `--board-gap: 10px`(768px 이상 12px).
- 기록판·사용법: `background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-md);` 1열에서는 위아래 간격 `var(--space-lg)`.
- 375px에서 가로 스크롤이 없어야 한다: 긴 숫자(`123,456,789점`)는 `.records__score`가 줄바꿈 가능하고(`.records__item`은 `display: flex; flex-wrap: wrap; gap`), 헤더도 줄바꿈된다.
- `body`에 `overflow: hidden`·`overscroll-behavior` 금지. 판에만 `touch-action: none`.

### 5.3 타일 글자 크기 (`cqi`는 `.game-board` 기준)

- `--digits-1`, `--digits-2`: `11cqi` / `--digits-3`: `9cqi` / `--digits-4`: `7.5cqi` / `--digits-5`: `6cqi` / `--digits-6`: `5cqi`.
- `font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1;` 가운데 정렬. 타일 모서리 `4px`.

## 6. 디자인

블로그의 중립 회색 + 파란 강조색을 잇는다. 원조 2048의 베이지·주황 대신 값이 커질수록 진해지는 **파란 단계**, 2048만 **금색**(열린 질문 5).

### 6.1 블로그에서 복사할 변수 (`css/variables.css` 값 그대로)

`:root`에 복사:

```css
--bg: #ffffff; --text: #1a1a1a; --text-muted: #666666; --accent: #2563eb;
--border: #e5e5e5; --card-bg: #f9f9f9;
--font-base: system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
--font-mono: ui-monospace, "Cascadia Code", Consolas, monospace;
--font-size-sm: 0.875rem; --font-size-base: 1rem; --font-size-lg: 1.25rem;
--font-size-xl: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
--space-xs: 0.25rem; --space-sm: 0.5rem; --space-md: 1rem; --space-lg: 1.5rem; --space-xl: 2.5rem;
--content-width: 720px; --gutter: 16px; --radius: 8px; --tap-size: 44px;
```

`[data-theme="dark"]`에 복사:

```css
--bg: #121212; --text: #e8e8e8; --text-muted: #a0a0a0; --accent: #60a5fa;
--border: #2a2a2a; --card-bg: #1e1e1e;
```

- 블로그 변수 **이름을 바꾸지 않는다**(나중에 블로그 값이 바뀌면 그대로 붙여 넣을 수 있게). 이 블록 위에 주석 `/* css/variables.css에서 복사 (2026-10-30) */`.
- 컴포넌트 규칙에는 색 값을 직접 쓰지 않고 변수만 쓴다. 다크는 변수만 재정의.

### 6.2 앱 전용 변수 (라이트 / 다크)

| 변수 | 라이트 | 다크 | 비고 |
|---|---|---|---|
| `--game-board-bg` | `#dfe4ea` | `#1a1d23` | 판 배경 |
| `--game-cell-bg` | `#eef1f5` | `#23272e` | 빈 칸 |
| `--game-overlay` | `rgb(255 255 255 / 0.88)` | `rgb(18 18 18 / 0.88)` | 메시지 배경. 그 위 `--text` 대비 16.8 / 15.1, `--text-muted` 7.0(다크) |
| `--game-tile-shadow` | `rgb(26 26 26 / 0.15)` | `transparent` | 라이트 2 타일 구분용 |
| `--button-primary-bg` / `--button-primary-text` | `#2563eb` / `#ffffff` (5.2) | `#60a5fa` / `#121212` (7.4) | 블로그 `--accent`와 같은 값 |
| `--score-bg` | `var(--card-bg)` | `var(--card-bg)` | 라벨 `--text-muted` 대비 5.5 / 6.4 |

- 보조 버튼(`--secondary`): 배경 `transparent`, 글자 `var(--text)`, 테두리 `1px solid var(--border)`. 글자 버튼(`--text`, 기록 지우기): 글자 `var(--text-muted)`, 밑줄.
- 모든 버튼: `min-height: var(--tap-size); min-width: var(--tap-size); padding-inline: var(--space-md); border-radius: var(--radius); font: inherit; cursor: pointer;` hover는 `filter: brightness(1.08)`(primary) / 배경 `var(--card-bg)`(secondary). `disabled`는 `opacity: 0.5; cursor: not-allowed`.

### 6.3 타일 색 (배경 / 글자, 괄호는 WCAG 대비비 — Node로 계산 확인)

| 값 | 라이트 | 다크 |
|---|---|---|
| 2 | `#ffffff` / `#1a1a1a` (17.4) | `#353c48` / `#e8e8e8` (9.1) |
| 4 | `#eaf1fe` / `#1a1a1a` (15.3) | `#283a54` / `#e8e8e8` (9.4) |
| 8 | `#d3e2fd` / `#1a1a1a` (13.3) | `#24456f` / `#e8e8e8` (8.0) |
| 16 | `#b0cbfb` / `#1a1a1a` (10.6) | `#1f5294` / `#ffffff` (7.8) |
| 32 | `#86aef8` / `#1a1a1a` (7.8) | `#2563eb` / `#ffffff` (5.2) |
| 64 | `#5b8ff3` / `#1a1a1a` (5.5) | `#3b82f6` / `#121212` (5.1) |
| 128 | `#2563eb` / `#ffffff` (5.2) | `#60a5fa` / `#121212` (7.4) |
| 256 | `#1d4fc4` / `#ffffff` (7.1) | `#86bbfb` / `#121212` (9.4) |
| 512 | `#1a43a3` / `#ffffff` (8.8) | `#aacffc` / `#121212` (11.6) |
| 1024 | `#163782` / `#ffffff` (11.0) | `#cfe3fe` / `#121212` (14.3) |
| 2048 | `#f5b301` / `#1a1a1a` (9.4) | `#f5c242` / `#121212` (11.3) |
| 4096+ (`--super`) | `#1a1a1a` / `#ffffff` (17.4) | `#ffffff` / `#121212` (18.7) |

- 변수 이름: `--tile-2-bg`, `--tile-2-text`, …, `--tile-2048-bg`, `--tile-super-bg`, `--tile-super-text`. 셀렉터 예: `.game-board__tile--v2 .game-board__tile-inner { background: var(--tile-2-bg); color: var(--tile-2-text); }`.
- 라이트 2 타일은 빈 칸(`#eef1f5`)과 비슷하므로 `box-shadow: 0 1px 2px var(--game-tile-shadow)`. 다크 2 타일은 빈 칸보다 밝아 따로 구분선이 필요 없다.
- 그라데이션·큰 그림자 같은 장식은 넣지 않는다.

## 7. 블로그 임베드 계획 (Embed 단계용 — 이번 단계와 Build 단계에서는 블로그 파일을 고치지 않는다)

- 지금 블로그(`index.html`)에는 웹앱 영역이 없다. Embed 단계에서 새로 만든다.
- **카드 제목**: `2048`
- **한 줄 설명**: "같은 숫자를 밀어 합쳐 2048을 만드는 퍼즐 게임. 방향키·스와이프로 하고, 기록판에 점수가 남아요."
- **링크**: `apps/game-2048/` (상대 경로, 같은 탭).
- **배치 권장안** (열린 질문 6): `<main class="main">` 안 `.container`에서 글 목록(`.post-list-area`) **아래**에 `<section class="app-section" aria-labelledby="apps-title"><h2 id="apps-title">웹앱</h2><ul class="app-list">…</ul></section>`. `posts.js`가 채우는 `.post-list-area` 밖이라 JS를 고치지 않아도 된다. 클래스는 BEM(`.app-card`, `.app-card__image`, `.app-card__title`, `.app-card__desc`), 스타일은 블로그 `css/style.css`에 블로그 변수로 추가. CLAUDE.md 폴더 구조의 `apps/ (예정)` 표시도 그때 고친다.
- **미리보기 `preview.svg`** (Build 단계에서 작성)
  - `viewBox="0 0 400 400"`, `width="400" height="400"`, 루트에 `role="img"`, 첫 자식 `<title>2048 게임 화면 미리보기</title>`.
  - 판 배경 `#dfe4ea` 둥근 사각형(`rx="16"`), 4×4 칸(간격 12, 칸 `#eef1f5`, `rx="6"`).
  - 진행 중 모습 예: 1행 `2, 4, 8, 빈칸` / 2행 `16, 32, 64, 빈칸` / 3행 `128, 256, 512, 2` / 4행 `2048, 1024, 빈칸, 4`. 6.3 **라이트** 색 사용, 숫자는 `<text>` + 블로그 폰트 스택(`font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"`), 굵게, 가운데 정렬.
  - 외부 리소스·스크립트·`<style>`의 `@import` 없음. 이미지 파일이므로 색 값을 직접 쓰는 것은 다크 모드 규칙의 예외로 본다(카드 이미지는 라이트·다크 모두 같은 그림).
  - 카드의 `<img>` alt: "2048 게임 화면 미리보기: 숫자 타일이 놓인 4×4 게임판".
- iframe 미리보기는 쓰지 않는다(카드 안에서 방향키·스와이프를 가로채 목록 스크롤을 방해하고, 목록을 열 때마다 게임 JS가 돈다).

## 8. 검증 체크리스트 (Review 단계)

### 8.1 순수 로직 — Node로 `game.js`, `scores.js` import해서 확인

- [ ] `slideLine`: 2.1 표 10개 예시의 결과·점수가 모두 일치 (`[2,2,2,2]` → `[4,4,0,0]`, +8 / `[2,2,4,0]` → `[4,4,0,0]`, +4 / `[8,0,8,8]` → `[16,8,0,0]`, +16 …)
- [ ] `slideLine([2,2,2,2]).moves`: `from 0,1 → to 0 (merged)`, `from 2,3 → to 1 (merged)`
- [ ] `move` 네 방향: 판 `[[2,2,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]` left → 1행 `[4,2,0,0]`, +4 / right → 1행 `[0,0,2,4]`, +4
- [ ] 판 `[[2,0,0,0],[2,0,0,0],[4,0,0,0],[0,0,0,0]]` up → 1열 `[4,4,0,0]`(위→아래), +4 / down → 1열 `[0,0,4,4]`, +4
- [ ] 무효 이동: `[[2,4,8,16],[0,0,0,0],…]` left → `moved: false`, `scoreGained: 0`, `merges: []`, 반환 board가 입력과 다른 배열 객체
- [ ] `move`·`addRandomTile`이 입력 판을 바꾸지 않음(호출 전후 `JSON.stringify` 같음)
- [ ] `addRandomTile`: 빈 칸이 `(0,1)`, `(2,3)` 두 개인 판 + `rng`가 `0.6, 0.95` 순 → `(2,3)`에 4 / `0.1, 0.89` → `(0,1)`에 2 / `0.0, 0.9` → `(0,1)`에 4
- [ ] `addRandomTile`: 빈 칸 없는 판 → `null`, `rng` 호출 0번
- [ ] `createGame(rng)`: 0이 아닌 칸 정확히 2개, `rng` 호출 4번
- [ ] 4 비율: `Math.random`으로 10,000번 → 4가 8~12%
- [ ] `canMove`: 꽉 찬 체스판 무늬(`2,4` 교대) → false / 꽉 찬 판 + 세로로만 같은 값 하나 → true / 빈 칸 1개 → true
- [ ] `hasWon`: 2048 있으면 true, 4096만 있어도 true, 최대 1024 → false
- [ ] `getMaxTile`: 빈 판 0, `[[2,0,0,0],[0,512,0,0],…]` → 512
- [ ] `isValidBoard`: 정상 판 true / 빈 판, 5×5, 3×4, 값 `3`, `1`, `-2`, `"2"`, `262144`, `null`, 행이 배열 아님 → 모두 false
- [ ] `describeBoard([[2,0,0,4],[0,0,0,0],[8,0,0,0],[0,0,0,2]])` → "1행: 2, 빈칸, 빈칸, 4. 2행: 빈칸, 빈칸, 빈칸, 빈칸. 3행: 8, 빈칸, 빈칸, 빈칸. 4행: 빈칸, 빈칸, 빈칸, 2."
- [ ] `parseSavedGame`: `serializeGame(x)` 왕복 → 같은 값 / `null`, `"{"`, `"[]"`, `v: 2`, `id: "A B"`, `score: -4`, `score: 1.5`, `won: "true"`, `keepPlaying: true & won: false`, 2048 있는 판 + `won: false`, 움직일 수 있는 판 + `over: true` → 모두 `null`
- [ ] `parseBest`: `"20480"` → 20480 / `null`, `""`, `"abc"`, `"-5"`, `"1.5"`, `"1e3"`, `"9999999999999999"` → 0
- [ ] `parseRecords`: `null`, `"{"`, `"{}"` → `[]` / 유효 2개 + 깨진 1개(`score: "10"`) → 유효 2개 / 유효 12개 → 점수순 10개 / 같은 id 2개 → 1개
- [ ] `addRecord([], {score: 0, …})` → `records: []`, `rank: null`
- [ ] `addRecord`: 점수 `[500, 300, 100]` 목록에 300 추가 → 순서 `500, 300(기존), 300(새)`, `rank: 3`
- [ ] `addRecord`: 꽉 찬 10개(최저 100)에 50 추가 → 목록 그대로, `rank: null` / 150 추가 → 10개 유지, 100 탈락, rank 정확
- [ ] `addRecord`: 이미 있는 id로 다시 추가 → 목록 그대로, `rank`는 기존 순위
- [ ] `toDateString(new Date(2026, 0, 5))` → `"2026-01-05"`, `formatDate("2026-01-05")` → `"2026.01.05"`
- [ ] `game.js`, `scores.js`에 `document`, `window`, `localStorage`, `Math.random` 글자가 없음 (`grep`)

### 8.2 게임 흐름 (브라우저, `python -m http.server 8000` → `http://localhost:8000/apps/game-2048/`)

- [ ] 실제 이동마다 새 타일 정확히 1개, 무효 이동에는 새 타일·점수·저장 변화 없음
- [ ] 2+2 합치기 → 점수 +4, `+4` 효과 표시
- [ ] 최고 점수가 현재 점수를 따라 올라가고 새로고침 후 유지
- [ ] 콘솔에서 `localStorage.setItem('game-2048:state', JSON.stringify({v:1,id:'t-1',board:[[1024,1024,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,2]],score:0,won:false,keepPlaying:false,over:false}))` 후 새로고침 → 왼쪽 → 승리 메시지, "계속하기" 후 계속 플레이, 다시 안 뜸
- [ ] 승리 메시지 중 방향키·스와이프 무시
- [ ] 거의 꽉 찬 판을 같은 방식으로 넣어 게임 오버 → 패배 메시지에 최종 점수(+ 기록판 순위), 기록판에 1줄 추가(배지 없음, 강조 표시)
- [ ] 게임 오버 상태에서 새로고침 → 패배 메시지 다시 표시, 기록판 줄 수 그대로
- [ ] 진행 중(점수 > 0) 헤더 "새 게임" → 확인 창, 취소 시 변화 없음, 확인 시 "중단" 배지로 기록 + 새 판
- [ ] 점수 0일 때 "새 게임" → 확인 창 없음, 기록 없음
- [ ] 기록이 11개째 들어오면 최저 기록이 빠지고 10개 유지
- [ ] "기록 지우기" → 확인 창 → 목록 비고 빈 상태 문구 표시, 버튼 `disabled`, 최고 점수 유지
- [ ] 몇 번 이동 후 새로고침 → 같은 판·점수
- [ ] 깨진 저장값: `game-2048:state`에 `"{"`, 5×5 판, 값 3 → 오류 없이 새 게임 / `game-2048:best`에 `"abc"` → 최고 0 / `game-2048:records`에 `"{"` → 빈 기록판
- [ ] `Storage.prototype.getItem`·`setItem`을 `throw`하도록 덮어쓴 뒤 새로고침 → 오류 없이 플레이 가능
- [ ] 애니메이션 중 빠른 연속 입력(키를 꾹 누르기) 뒤 화면 타일과 `state.board`가 같음(판 읽기 결과와 화면 비교)

### 8.3 조작

- [ ] 방향키·WASD(대문자 포함) 동작, 방향키로 페이지가 스크롤되지 않음
- [ ] Ctrl/Cmd/Alt 조합은 가로채지 않음(Ctrl+R 새로고침 정상)
- [ ] 375px 터치 에뮬레이션: 네 방향 스와이프 동작, 30px 미만 탭은 이동 없음, 대각선은 큰 축으로
- [ ] 판 위 스와이프 중 페이지 스크롤·확대 없음, 판 밖에서는 정상 스크롤

### 8.4 화면 / 디자인 (라이트·다크 × 375·768·1280px)

- [ ] 가로 스크롤 없음(`document.documentElement.scrollWidth <= window.innerWidth`), 375px 좌우 여백 16px 이상
- [ ] 5.2 표대로: 375·768은 1열, 1280은 게임 왼쪽·기록판+사용법 오른쪽 2열
- [ ] 1024·2048·16384·131072 타일 숫자가 타일 밖으로 넘치지 않음
- [ ] 모든 버튼·링크 44×44px 이상(`getBoundingClientRect`)
- [ ] 라이트·다크 타일 색이 6.3 표와 일치(`getComputedStyle`), 대비 4.5:1 이상
- [ ] 블로그에서 다크로 바꾼 뒤 게임 열기 → 처음부터 다크(깜빡임 없음)
- [ ] 블로그 탭에서 테마 변경 → 열린 게임 탭에 반영(storage 이벤트)
- [ ] 저장된 테마가 없을 때 OS 설정 변경을 따라감
- [ ] 게임 화면 토글: 아이콘 ☀️/🌙와 `aria-label` 전환, 새로고침·블로그에서도 같은 테마
- [ ] `prefers-reduced-motion: reduce` 에뮬레이션에서 애니메이션·`+N` 효과 없음, 이동 즉시 반영
- [ ] 사용법 문장 8개가 2.11과 글자 그대로 같음
- [ ] 콘솔 오류·경고 없음

### 8.5 접근성

- [ ] "판 읽기" → `#announcer`에 `describeBoard` 문장 + 점수
- [ ] 매 이동마다 알림이 나오지 않음. 최고 점수 갱신은 판당 1번, 128 이상 새 최대 타일, 승리·패배·새 게임·기록 지우기만 알림
- [ ] 메시지 열림 시 첫 버튼 포커스, Tab 순환이 메시지 안에 갇힘, 닫힘 시 2.10에 정한 곳으로 포커스 복귀
- [ ] 키보드만으로 새 게임·판 읽기·계속하기·다시 하기·기록 지우기·테마·블로그로 가능, `:focus-visible` 윤곽선 표시

### 8.6 프로젝트 규칙

- [ ] `git status`: `apps/game-2048/` 밖 변경 없음, `spec.md`·`briefs/` 변경 없음
- [ ] 외부 라이브러리·CDN·웹폰트 없음, 블로그 CSS/JS import 없음
- [ ] `/`로 시작하는 경로 없음, "← 블로그로"가 블로그 목록(`../../`)으로 이동
- [ ] 시맨틱 태그, `lang="ko"`, viewport 메타, 인라인 테마 스크립트가 블로그와 같음
- [ ] `!important`, `var `, `innerHTML`, `insertAdjacentHTML`, ID 선택자 스타일(`style.css`에 `#`로 시작하는 셀렉터) 없음 (`grep`)
- [ ] 클래스 이름이 BEM 형식(`block`, `block__element`, `block--modifier`, `block__element--modifier`)
- [ ] `style.css` 컴포넌트 규칙에 색 값 직접 사용 없음(변수 정의 블록만 예외)

## 9. 범위 밖 (이번에 만들지 않음)

- 되돌리기(undo), 판 크기 변경(3×3, 5×5), 난이도
- 온라인 랭킹, 공유, 로그인, 기록에 이름 입력
- 기록 내보내기/가져오기
- 효과음, 진동
- 이동 횟수·플레이 시간 통계
- 개발용 판 주입 UI (검증은 콘솔에서 `localStorage`로)
- 오프라인(PWA) 지원
- 블로그 `index.html`·CSS 수정 (Embed 단계에서 따로)

## 10. 열린 질문 (사용자가 정할 것, 괄호는 권장 기본안)

> **결정 사항 (2026-10-30, 사용자)**: 6개 질문 모두 **권장안으로** 결정("끝나면 푸시해줘"로 사이클 끝까지 진행 요청). 본문은 이미 권장안 기준.

1. **기록판 보관 개수** — 몇 개를 남길까요? (**권장: 10개**. 화면 한쪽에 다 보이고 스크롤이 길어지지 않는다.)
2. **진행 중에 새 게임을 누른 판도 기록할까요?** (**권장: 점수 > 0이면 "중단" 배지를 붙여 기록.** 대안: 게임 오버로 끝난 판만 기록.)
3. **"기록 지우기" 버튼** — 넣을까요, 지울 때 최고 점수도 같이 지울까요? (**권장: 버튼을 넣고 확인 창을 띄우며, 기록판만 지우고 최고 점수는 유지.**)
4. **헤더 "새 게임" 확인 창** — 진행 중인 판이 있을 때 물어볼까요? (**권장: 점수 > 0이고 게임 오버가 아닐 때만 `confirm`으로 확인.** 대안: 묻지 않고 바로 새 게임.)
5. **타일 색 톤** (**권장: 블로그 파란 단계 + 2048 금색**, 6.3 표.) 대안: 원조 2048의 베이지·주황 톤(대비 다시 계산 필요).
6. **블로그 메인의 웹앱 영역 위치** (Embed 단계에서 적용) (**권장: 글 목록 아래 "웹앱" 섹션.** 대안: 글 목록 위.)
