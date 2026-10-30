# 뽀모도로 타이머 — 계획서 (spec)

> 상태: **승인됨 (2026-10-30)**. Build는 이 문서를 기준으로 한다.

- 앱 이름(폴더): `pomodoro` → `apps/pomodoro/`
- 기준 문서: 프로젝트 루트 `CLAUDE.md`. 이 spec과 다르면 CLAUDE.md를 따르고 차이를 보고한다.
- "열린 질문"(10장)의 항목은 **권장 기본안을 적용한 상태로** 이 spec 전체가 쓰여 있다. 사용자가 다른 답을 고르면 해당 부분만 고친다.

---

## 1. 개요

집중(기본 25분)과 휴식(기본 5분)을 번갈아 재는 뽀모도로 타이머. 집중을 4번 마치면 긴 휴식(15분)을 한 번 둔다.
오늘 완료한 집중 횟수를 브라우저에 저장해 보여 주고, 날짜가 바뀌면 0부터 다시 센다.

- 순수 HTML / CSS / JavaScript(ES 모듈). 외부 라이브러리·CDN·웹폰트·소리 파일 없음.
- `apps/pomodoro/` 안에서 자체 완결. 블로그 파일을 import하지 않고, 필요한 코드·값은 복사한다.
- 남은 시간은 `setInterval` 횟수가 아니라 **종료 예정 시각(타임스탬프) − 현재 시각**으로 계산한다.
- 타이머 로직(`timer.js`)은 DOM·`localStorage`·실제 시계를 쓰지 않는 순수 모듈이다. 현재 시각 `now`(ms)를 인자로 받는다.

---

## 2. 기능 목록

### 2.1 단계(phase) 흐름

| 단계 | 내부 값 | 화면 이름 | 기본 길이 |
|---|---|---|---|
| 집중 | `focus` | 집중 | 25분 |
| 짧은 휴식 | `short` | 짧은 휴식 | 5분 |
| 긴 휴식 | `long` | 긴 휴식 | 15분 |

- 시작 단계는 `focus`.
- `focus`가 **끝까지 완료**되면 `cycleCount += 1`. `cycleCount`가 `longEvery`(기본 4)에 도달하면 다음 단계는 `long`, 아니면 `short`.
- `short` 또는 `long`이 끝나면(완료든 건너뛰기든) 다음은 `focus`. `long`이 끝나면 `cycleCount = 0`.
- **건너뛰기**한 집중은 완료로 세지 않는다(오늘 횟수 +0, `cycleCount` 그대로). 건너뛴 집중 다음은 항상 `short`.
- 단계가 바뀌면 기본으로 **대기(idle)** 상태가 된다. 설정의 "다음 단계 자동 시작"이 켜져 있으면 바로 실행(running)된다.

### 2.2 상태(status)

- `idle`: 단계 길이 그대로 대기. 시작 버튼 글자 "시작".
- `running`: 진행 중. 시작 버튼 글자 "일시정지".
- `paused`: 남은 시간을 기억한 채 멈춤. 시작 버튼 글자 "계속".

### 2.3 버튼

| 버튼 | 글자 | 동작 |
|---|---|---|
| 시작/일시정지 | 시작 · 일시정지 · 계속 | idle/paused → running, running → paused |
| 초기화 | 초기화 | 현재 단계를 처음 길이로 되돌리고 idle. 단계와 `cycleCount`는 그대로 |
| 건너뛰기 | 건너뛰기 | 현재 단계를 끝내지 않고 다음 단계로(완료로 세지 않음), idle |

- 모든 버튼은 `<button type="button">`, 최소 44×44px.
- 시작/일시정지 버튼에 `aria-pressed`는 쓰지 않는다(글자가 바뀌므로 충분).

### 2.4 단축키

| 키 | 동작 |
|---|---|
| `Space` | 시작/일시정지/계속 |
| `R` (`r`) | 초기화 |
| `S` (`s`) | 건너뛰기 |

- `keydown`을 `document`에 건다. 다음 경우에는 **무시**한다: `event.ctrlKey || event.metaKey || event.altKey`, `event.repeat`, 이벤트 대상이 `input`·`textarea`·`select`·`button`·`a`·`summary` 이거나 `isContentEditable`. (버튼에 포커스가 있을 때 Space는 브라우저가 그 버튼을 누르므로 중복 실행을 막는다.)
- 처리한 경우 `event.preventDefault()`(Space로 페이지가 스크롤되지 않게).
- 판별은 `event.code`가 아니라 `event.key`(`' '`, `'r'`, `'R'`, `'s'`, `'S'`)로 한다.

### 2.5 오늘 완료 횟수

- 집중이 **완료**될 때마다 +1. 완료 시각(`completedAt`, 즉 원래 종료 예정 시각) 기준 로컬 날짜에 더한다.
- 화면: "오늘 완료한 집중" 제목 아래 큰 숫자 + "회". 예: `3회`.
- 이번 세트 진행: "이번 세트 2 / 4" 문구와 점 4개(채워진 점 = `cycleCount`). 점은 장식(`aria-hidden="true"`), 문구가 정보.
- 날짜 바뀜: 화면 갱신 때마다(250ms) 오늘 날짜 키를 다시 계산해 저장된 날짜와 다르면 0으로 보인다. 저장값은 다음 완료 때 새 날짜로 덮어쓴다.

### 2.6 알림 (시간이 끝났을 때)

세 가지를 함께 쓴다. 기본: 화면 표시 항상 + 소리 켬 + 브라우저 알림 끔.

1. **화면 표시(항상)**: 메시지 영역에 문장 표시. 예: "집중이 끝났습니다. 짧은 휴식을 시작하세요." (자동 시작이 켜져 있으면 "집중이 끝났습니다. 짧은 휴식을 시작했습니다.") 같은 문장을 스크린 리더 알림 영역에도 넣는다(2.10).
2. **소리(설정, 기본 켬)**: Web Audio API로 짧은 비프 3번. 사양:
   - `OscillatorNode` `type = 'sine'`, `frequency = 880`Hz.
   - 비프 길이 0.15초, 간격 0.25초(시작 시각 0, 0.25, 0.5초).
   - `GainNode`: 0에서 0.01초 동안 0.2로 올리고, 끝 0.03초 전부터 0으로 내림(딸깍 소리 방지).
   - `AudioContext`는 사용자가 **처음 시작 버튼(또는 Space)을 누를 때** 만들고 `resume()`한다(자동 재생 정책). 없거나 실패하면 조용히 넘어간다(`try/catch`).
3. **브라우저 알림(설정, 기본 끔)**: 체크박스 "브라우저 알림 받기".
   - 체크할 때만 `Notification.requestPermission()`을 부른다(페이지 로드 때 묻지 않는다).
   - 결과가 `'granted'`가 아니면 체크를 다시 풀고 설정 영역에 "브라우저 알림이 허용되지 않았습니다. 브라우저 설정에서 허용할 수 있습니다."를 보여 준다.
   - `'Notification' in window`가 거짓이면 체크박스를 `disabled`로 두고 옆에 "이 브라우저는 알림을 지원하지 않습니다."
   - 실제 알림은 `document.visibilityState === 'hidden'`일 때만 보낸다(화면을 보고 있으면 화면 표시로 충분). 제목 "뽀모도로", 본문은 화면 표시 문장과 같다.

### 2.7 다크 모드

- 블로그와 같은 방식: `<head>` 인라인 스크립트로 처음 테마 결정, `localStorage`의 `theme` 키 공유(`'light' | 'dark'`), 없으면 `prefers-color-scheme`.
- 헤더 오른쪽에 토글 버튼 `.theme-toggle`(☀️/🌙, `aria-label` "다크 모드로 전환"/"라이트 모드로 전환").
- `theme.js`는 블로그 `js/theme.js`를 그대로 복사한다(선택자 `.theme-toggle` 동일).
- 전환 효과는 `body`에 `transition: background-color 0.2s, color 0.2s`만.

### 2.8 저장·불러오기

- 키 3개: `pomodoro:settings`, `pomodoro:today`, `pomodoro:session` (형식은 4.4).
- 모든 `localStorage.getItem/setItem`과 `JSON.parse`는 `try/catch`. 실패하면 기본값으로 동작하고 화면은 그대로 쓸 수 있다.
- 불러온 값은 `timer.js`의 검증 함수를 거친 뒤에만 쓴다.
- **세션 이어가기**: 새로고침·탭을 닫았다 열어도 진행 중인 타이머를 이어간다.
  - running이었다면 저장된 `endsAt` 기준으로 계속 줄어든 상태로 보인다.
  - 닫혀 있는 사이 `endsAt`이 지났다면, 열 때 `tick`으로 완료 처리한다. 집중이었다면 오늘 횟수에 반영(완료 날짜가 오늘일 때만). 이때 **소리·브라우저 알림은 내지 않고** 메시지만 "자리를 비운 사이 집중이 끝났습니다. 짧은 휴식을 시작하세요."처럼 앞에 "자리를 비운 사이 "를 붙여 보여 준다.
  - 자동 시작이 켜져 있어 여러 단계가 지나갔다면 최대 8단계까지만 따라잡고, 그래도 남으면 현재 단계를 idle로 둔다(4.2 `tick`).
- 저장 시점: 상태가 바뀔 때만(시작·일시정지·계속·초기화·건너뛰기·단계 완료·설정 저장). 화면 갱신(250ms)마다 저장하지 않는다.
- 여러 탭 동시 사용은 맞추지 않는다(범위 밖, 마지막에 저장한 탭이 이긴다).

### 2.9 사용법 안내 문구

위치: 화면 아래쪽 `<section class="help">`, 제목 "사용법". 아래 문장을 **그대로** 쓴다.

> **조작**
> - 시작을 누르면 집중 25분이 시작됩니다. 진행 중에 다시 누르면 일시정지, 한 번 더 누르면 이어서 진행합니다.
> - 초기화는 지금 단계를 처음 시간으로 되돌립니다. 건너뛰기는 지금 단계를 끝내지 않고 다음 단계로 넘어가며, 완료 횟수에 세지 않습니다.
> - 집중을 4번 마치면 긴 휴식(15분)이, 그 밖에는 짧은 휴식(5분)이 이어집니다.
> - 시간은 아래 "설정"에서 분 단위로 바꿀 수 있습니다.
>
> **단축키**
> - Space: 시작 / 일시정지
> - R: 초기화
> - S: 건너뛰기
> - 글자 입력칸이나 버튼에 포커스가 있을 때는 단축키가 동작하지 않습니다.
>
> **저장**
> - 설정, 오늘 완료한 집중 횟수, 진행 중인 타이머는 이 브라우저에만 저장됩니다(localStorage). 서버로 보내지 않습니다.
> - 새로고침하거나 탭을 닫았다 열어도 타이머는 이어서 진행됩니다.
> - 오늘 완료 횟수는 날짜가 바뀌면 0부터 다시 셉니다.
> - 시크릿 창이나 저장이 막힌 브라우저에서는 저장되지 않을 수 있습니다.

- "25분/5분/15분/4번"은 **현재 설정값으로 바꿔 넣는다**(`textContent`로 해당 `<span>`만 갱신). 마크업에서 숫자 부분은 `<span class="help__value" data-help="focusMin">25</span>`처럼 감싼다. `data-help` 값: `focusMin`, `shortMin`, `longMin`, `longEvery`.

### 2.10 접근성

- 큰 시간 표시(`.timer__time`)는 `aria-live`를 붙이지 **않는다**(매초 읽히지 않게). 포커스를 받지 않는 일반 텍스트.
- 별도 알림 영역 `<p class="visually-hidden" aria-live="polite" data-role="announcer">`: 다음 때만 문장을 넣는다.
  - 단계 완료/전환: 2.6의 문장.
  - 시작: "집중 시작. 25분 남았습니다."(남은 분은 올림), 일시정지: "일시정지. 24분 13초 남았습니다.", 계속: "다시 시작했습니다.", 초기화: "집중을 처음 시간으로 되돌렸습니다.", 건너뛰기: "짧은 휴식으로 넘어갔습니다."
  - 같은 문장을 연달아 넣을 때도 읽히도록 비운 뒤 다음 프레임(`requestAnimationFrame`)에 넣는다.
- 진행 링 SVG는 `aria-hidden="true"`(장식). 정보는 시간 텍스트와 단계 이름이 전달한다.
- 탭 제목(`document.title`)은 화면 갱신마다 바뀐 경우에만 갱신:
  - running/idle: `24:13 집중 - 뽀모도로`
  - paused: `24:13 집중(일시정지) - 뽀모도로`
  - 단계 이름은 `집중` / `짧은 휴식` / `긴 휴식`.
- 모든 버튼·링크·입력에 보이는 `:focus-visible` 외곽선(`outline: 2px solid var(--accent); outline-offset: 2px`).
- 색만으로 단계를 구분하지 않는다: 단계 이름 텍스트가 항상 보인다.
- 설정 입력은 `<label for>`로 연결, 오류 문장은 `aria-describedby`로 연결.
- `prefers-reduced-motion: reduce`이면 링의 `transition`을 없앤다.

---

## 3. 파일 구조

```
apps/pomodoro/
├── briefs/          # 지침 (Build가 건드리지 않음)
├── spec.md          # 이 문서 (Build가 건드리지 않음)
├── index.html       # 마크업 + <head> 인라인 테마 스크립트
├── style.css        # 블로그 변수 복사 + 앱 전용 변수 + 레이아웃
├── theme.js         # 블로그 js/theme.js 복사본. <script defer>
├── timer.js         # 순수 로직 (ES 모듈, export만). DOM·localStorage·Date.now 사용 금지
├── main.js          # 화면·입력·저장·소리·알림 (ES 모듈, timer.js import)
└── preview.svg      # 블로그 카드 미리보기
```

- `index.html` 불러오기 순서: `<head>` 인라인 테마 스크립트 → `<link rel="stylesheet" href="style.css">` → `<script src="theme.js" defer></script>` → `<script type="module" src="main.js"></script>`.
- reset은 `style.css` 맨 위에 최소한으로 넣는다(`box-sizing: border-box`, `margin: 0`, 이미지 `max-width: 100%`). 블로그 `reset.css`를 import하지 않는다.
- 모든 경로는 상대 경로(`style.css`, `./timer.js`, `../../`).
- `timer.js` 안에서 `Date`는 `dateKey`의 계산용으로 **인자로 받은 `now`만** 써서 만들 수 있다(`new Date(now)`는 허용, `Date.now()`/인자 없는 `new Date()`는 금지).

---

## 4. 핵심 로직 설계 (`timer.js`)

### 4.1 상수와 상태 모양

```js
export const PHASES = ['focus', 'short', 'long'];
export const PHASE_LABELS = { focus: '집중', short: '짧은 휴식', long: '긴 휴식' };
export const MAX_CATCH_UP = 8;

export const DEFAULT_SETTINGS = {
  focusMin: 25,   // 정수 1~90
  shortMin: 5,    // 정수 1~30
  longMin: 15,    // 정수 1~60
  longEvery: 4,   // 정수 2~8
  autoStart: false,
  sound: true,
  notify: false,
};

// 상태 (불변 객체로 다룬다. 함수는 항상 새 객체를 반환)
// {
//   phase: 'focus' | 'short' | 'long',
//   status: 'idle' | 'running' | 'paused',
//   endsAt: number | null,     // running일 때만 숫자(ms epoch), 그 외 null
//   remainingMs: number,       // idle/paused일 때 남은 시간. running일 때는 참고하지 않음
//   cycleCount: number,        // 이번 세트에서 완료한 집중 수 (0 ~ longEvery)
// }
```

### 4.2 함수 (모두 순수, 인자를 바꾸지 않음)

| 함수 | 인자 | 반환 | 설명 |
|---|---|---|---|
| `durationMs(phase, settings)` | 단계, 설정 | number | `분 × 60_000` |
| `createState(settings)` | 설정 | 상태 | `{phase:'focus', status:'idle', endsAt:null, remainingMs:durationMs('focus'), cycleCount:0}` |
| `getRemaining(state, now)` | 상태, ms | number | running이면 `max(0, endsAt - now)`, 아니면 `remainingMs` |
| `start(state, now)` | 상태, ms | 상태 | idle/paused → running, `endsAt = now + remainingMs`. running이면 그대로 반환 |
| `pause(state, now)` | 상태, ms | 상태 | running → paused, `remainingMs = getRemaining(state, now)`, `endsAt = null`. 그 외 그대로 |
| `toggle(state, now)` | 상태, ms | 상태 | running이면 `pause`, 아니면 `start` |
| `reset(state, settings)` | 상태, 설정 | 상태 | 같은 단계·같은 `cycleCount`, idle, `remainingMs = durationMs(phase)` |
| `nextPhase(state, settings, completed)` | 상태, 설정, boolean | `{phase, cycleCount}` | 2.1 규칙. `completed`가 참인 focus만 `cycleCount+1`. focus 다음은 `cycleCount >= longEvery`면 `long` 아니면 `short`. long 다음 focus는 `cycleCount 0` |
| `skip(state, settings)` | 상태, 설정 | 상태 | `nextPhase(..., false)` 로 이동, idle, 새 단계 전체 길이 |
| `tick(state, settings, now)` | 상태, 설정, ms | `{ state, events }` | 아래 참고 |
| `applySettings(state, oldSettings, newSettings)` | | 상태 | 아래 참고 |
| `formatTime(ms)` | ms | `'MM:SS'` | 초는 **올림**: `totalSec = Math.ceil(ms / 1000)`. 분은 2자리 이상(`90:00`). 음수는 0으로 |
| `formatSpoken(ms)` | ms | string | 알림용. `24분 13초`, 초가 0이면 `25분`, 1분 미만이면 `40초` (올림 기준 동일) |
| `progress(state, settings, now)` | | 0~1 | `1 - getRemaining / durationMs(phase)`, 0~1로 자름 |
| `dateKey(now, tzOffsetMin)` | ms, 분 | `'YYYY-MM-DD'` | `new Date(now - tzOffsetMin * 60_000)`의 **UTC** 연·월·일. `tzOffsetMin`은 main이 `new Date(now).getTimezoneOffset()`으로 넘김(한국은 `-540`) |
| `addCompletion(today, completedAt, tzOffsetMin)` | today, ms, 분 | today | `key = dateKey(completedAt)`. `today.date === key`면 `count+1`, 아니면 `{date:key, count:1}`. count 상한 999 |
| `getTodayCount(today, now, tzOffsetMin)` | | number | `today.date === dateKey(now)`면 `count`, 아니면 0 |
| `parseSettings(raw)` | 아무 값 | 설정 | 4.4 검증. 필드별로 틀리면 그 필드만 기본값 |
| `parseToday(raw)` | 아무 값 | today | 틀리면 `{date:'', count:0}` |
| `parseSession(raw, settings, now)` | 아무 값, 설정, ms | 상태 \| null | 틀리면 `null`(main이 `createState` 사용) |
| `toSession(state)` | 상태 | 저장용 객체 | 4.4 형식 |
| `validateSettingsInput(values)` | 폼 문자열 객체 | `{ ok, settings, errors }` | 폼 입력 검증(4.5) |

**`tick(state, settings, now)`**

```
events = []
loop (최대 MAX_CATCH_UP번):
  state.status !== 'running' 또는 now < state.endsAt 이면 중단
  completedAt = state.endsAt
  events.push({ phase: state.phase, completedAt })
  { phase, cycleCount } = nextPhase(state, settings, true)
  if settings.autoStart:
    state = { phase, cycleCount, status:'running', endsAt: completedAt + durationMs(phase), remainingMs: durationMs(phase) }
  else:
    state = { phase, cycleCount, status:'idle', endsAt:null, remainingMs: durationMs(phase) }
loop가 MAX_CATCH_UP번 다 돌고도 running이고 now >= endsAt 이면:
  state = { ...state, status:'idle', endsAt:null, remainingMs: durationMs(state.phase) }
return { state, events }
```

- 자동 시작일 때 다음 단계는 **이전 종료 예정 시각부터** 잰다(백그라운드에서 늦게 깨어나도 밀리지 않음).
- main은 `events` 중 `phase === 'focus'`인 것마다 `addCompletion`을 부른다.

**`applySettings(state, oldSettings, newSettings)`**

- 상태가 idle이고 `remainingMs === durationMs(phase, oldSettings)`(아직 손대지 않음)면 `remainingMs = durationMs(phase, newSettings)`.
- 그 밖(running/paused 또는 idle인데 남은 시간이 다름)은 현재 단계는 그대로, **다음 단계부터** 새 길이.
- `cycleCount >= newSettings.longEvery`이고 phase가 `focus`면 `cycleCount = newSettings.longEvery - 1`로 줄인다(다음 집중 완료 후 긴 휴식).

### 4.3 시간 계산 원칙

- `main.js`는 `setInterval(render, 250)`으로 화면만 다시 그린다. 매 render에서 `now = Date.now()`를 구해 `tick` → `getRemaining`을 부른다. 간격 횟수는 세지 않는다.
- `document`의 `visibilitychange`(보이게 될 때)에도 즉시 `render()`.
- 시간 표시 문자열과 탭 제목은 이전 값과 다를 때만 DOM에 쓴다.

### 4.4 저장 형식과 검증 규칙

**`pomodoro:settings`**

```json
{ "version": 1, "focusMin": 25, "shortMin": 5, "longMin": 15, "longEvery": 4,
  "autoStart": false, "sound": true, "notify": false }
```

- `raw`가 객체(배열·null 아님)가 아니거나 `version !== 1`이면 전체 기본값.
- 숫자 필드: `Number.isInteger(v)`이고 범위 안(focusMin 1~90, shortMin 1~30, longMin 1~60, longEvery 2~8). 문자열 `"25"`, `25.5`, `NaN`, 범위 밖 → 그 필드만 기본값.
- boolean 필드: `typeof v === 'boolean'`이 아니면 기본값.
- `notify`가 `true`로 불러와져도 main은 `Notification.permission !== 'granted'`면 `false`로 바꿔 쓴다.

**`pomodoro:today`**

```json
{ "date": "2026-10-30", "count": 3 }
```

- `date`: `/^\d{4}-\d{2}-\d{2}$/`에 맞는 문자열. `count`: 정수 0~999. 하나라도 틀리면 `{date:'', count:0}`.

**`pomodoro:session`**

```json
{ "version": 1, "phase": "focus", "status": "running", "endsAt": 1793341200000,
  "remainingMs": 1500000, "cycleCount": 2 }
```

- `version === 1`, `phase`는 `PHASES` 중 하나, `status`는 `idle|running|paused` 중 하나.
- `cycleCount`: 정수 0 ~ `settings.longEvery`.
- `remainingMs`: 정수 0 ~ `durationMs(phase, settings)`. idle/paused에서 0이면 무효(무효 → `null`).
- `status === 'running'`이면 `endsAt`은 유한한 정수, `status !== 'running'`이면 `endsAt === null`.
- running의 `endsAt`이 `now + durationMs(phase)`보다 크면 무효(시계 조작·잘못된 값). 그래서 시그니처가 `parseSession(raw, settings, now)`다.
- 과거 `endsAt`은 유효(닫혀 있는 동안 끝난 것). 불러온 뒤 바로 `tick`을 부른다.
- (Review에서 추가, 2026-10-30 반영) 선택 필드 `lengthMs`: 진행 중·일시정지 중에 현재 단계 길이 설정을 바꿨을 때만 저장되는 "현재 단계의 원래 길이(ms)". 있으면 `remainingMs`·`endsAt` 범위 검사와 진행률을 이 값 기준으로 한다. `reset`·`skip`·완료 때 지운다. (이유: 없으면 짧게 바꾼 뒤 새로고침할 때 세션이 무효가 되어 타이머가 처음부터 시작됨.)

### 4.5 설정 폼 입력 검증 (`validateSettingsInput`)

- 입력: `{ focusMin: '25', shortMin: '5', longMin: '15', longEvery: '4', autoStart: true, sound: true, notify: false }`(숫자는 input의 문자열 값).
- 숫자 문자열은 `/^\d+$/`이어야 하고, 정수로 바꿔 범위 검사. 틀린 필드마다 `errors[필드] = '1~90 사이의 정수를 입력하세요.'`(범위는 필드별).
- `ok`가 거짓이면 저장하지 않고, 각 입력 아래 `.settings__error`에 문장을 `textContent`로 넣고 입력에 `aria-invalid="true"`.

### 4.6 날짜 바뀜 처리

- 날짜 키는 항상 `dateKey(now, new Date(now).getTimezoneOffset())`로 구한다(main).
- 화면의 오늘 횟수는 매 render에서 `getTodayCount(today, now, offset)` → 자정이 지나면 화면에 0이 보인다.
- 저장값은 바로 지우지 않는다. 다음 집중 완료 때 `addCompletion`이 새 날짜 `{date, count:1}`로 덮어쓴다.
- 자정을 넘겨 끝난 집중은 `completedAt` 날짜(다음 날)에 센다.

---

## 5. 화면 구성

### 5.1 마크업 골격

```html
<!doctype html>
<html lang="ko" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>25:00 집중 - 뽀모도로</title>
  <meta name="description" content="집중과 휴식을 번갈아 재는 뽀모도로 타이머">
  <script>/* 블로그 index.html의 인라인 테마 스크립트 그대로 */</script>
  <link rel="stylesheet" href="style.css">
  <script src="theme.js" defer></script>
  <script type="module" src="main.js"></script>
</head>
<body>
  <header class="app-header">
    <a class="app-header__back" href="../../">← 블로그로</a>
    <h1 class="app-header__title">뽀모도로 타이머</h1>
    <button class="theme-toggle" type="button" aria-label="다크 모드로 전환">🌙</button>
  </header>

  <main class="app">
    <section class="timer timer--focus" aria-labelledby="timer-phase">
      <p class="timer__phase" id="timer-phase">집중</p>
      <div class="timer__dial">
        <svg class="timer__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle class="timer__ring-track" cx="50" cy="50" r="45"></circle>
          <circle class="timer__ring-progress" cx="50" cy="50" r="45"></circle>
        </svg>
        <p class="timer__time">25:00</p>
      </div>
      <p class="timer__set">이번 세트 <span class="timer__set-count">0</span> / <span class="timer__set-total">4</span></p>
      <div class="timer__dots" aria-hidden="true"><!-- main이 longEvery만큼 span.timer__dot 생성(createElement) --></div>
      <div class="timer__controls">
        <button class="button button--primary" type="button" data-action="toggle">시작</button>
        <button class="button" type="button" data-action="reset">초기화</button>
        <button class="button" type="button" data-action="skip">건너뛰기</button>
      </div>
      <p class="timer__message"></p>
      <p class="visually-hidden" aria-live="polite" data-role="announcer"></p>
    </section>

    <aside class="side">
      <section class="today" aria-labelledby="today-title">
        <h2 class="today__title" id="today-title">오늘 완료한 집중</h2>
        <p class="today__count"><span class="today__number">0</span>회</p>
      </section>

      <details class="settings">
        <summary class="settings__summary">설정</summary>
        <form class="settings__form" novalidate>
          <!-- 필드 4개: focusMin, shortMin, longMin, longEvery -->
          <div class="settings__field">
            <label class="settings__label" for="focus-min">집중 (분, 1~90)</label>
            <input class="settings__input" id="focus-min" name="focusMin" type="number"
                   inputmode="numeric" min="1" max="90" step="1" aria-describedby="focus-min-error">
            <p class="settings__error" id="focus-min-error"></p>
          </div>
          <!-- short-min(1~30) "짧은 휴식 (분, 1~30)", long-min(1~60) "긴 휴식 (분, 1~60)",
               long-every(2~8) "긴 휴식까지 집중 횟수 (2~8)" 같은 모양 -->
          <label class="settings__check"><input type="checkbox" name="autoStart"> 다음 단계 자동 시작</label>
          <label class="settings__check"><input type="checkbox" name="sound"> 끝날 때 소리 내기</label>
          <label class="settings__check"><input type="checkbox" name="notify"> 브라우저 알림 받기</label>
          <p class="settings__note"></p>
          <button class="button button--primary" type="submit">설정 저장</button>
          <p class="settings__status" aria-live="polite"></p>  <!-- "저장했습니다." -->
        </form>
      </details>
    </aside>

    <section class="help" aria-labelledby="help-title">
      <h2 class="help__title" id="help-title">사용법</h2>
      <!-- 2.9 문장: h3.help__subtitle + ul.help__list 3묶음 -->
    </section>
  </main>
</body>
</html>
```

- 단계 수정자: `.timer--focus` / `.timer--short` / `.timer--long` (main이 `classList`로 바꿈). 링·단계 이름 색이 단계색을 따른다.
- 상태 수정자: `.timer--paused`일 때 `.timer__time`의 `opacity: 0.7`이 아니라 **색을 `var(--text-muted)`로**(대비 유지).
- `id`는 `label for`·`aria-labelledby`·`aria-describedby` 연결용으로만 쓰고, CSS 선택자로 쓰지 않는다. JS는 `data-action`·`data-role`·클래스로 요소를 찾는다.
- DOM에 글자를 넣을 때는 `textContent`만. `innerHTML` 금지. 점(dot)은 `document.createElement`.
- 설정 `<form>`의 `submit`에서 `event.preventDefault()`.
- `.visually-hidden`: `position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0;`

### 5.2 진행 링

- 원 둘레 `C = 2 × π × 45 ≈ 282.743`.
- `.timer__ring`은 `transform: rotate(-90deg)`(12시에서 시작).
- `.timer__ring-track`: `fill:none; stroke: var(--ring-track); stroke-width: 6`.
- `.timer__ring-progress`: `fill:none; stroke: var(--phase-color); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 282.743; transition: stroke-dashoffset 0.25s linear`.
- main이 `style.strokeDashoffset = C × progress`(경과할수록 링이 줄어듦: 남은 비율만큼 보인다)를 넣는다. 수치는 소수 3자리로 자른다.
- 시간 텍스트 `.timer__time`은 링 정중앙에 겹침(`.timer__dial`을 `display:grid`, 자식 둘 `grid-area: 1 / 1`, `place-items:center`).

### 5.3 반응형 레이아웃 (모바일 퍼스트)

| 폭 | 레이아웃 |
|---|---|
| 기본(375px 기준, ~767px) | 한 열. 좌우 여백 `var(--gutter)`(16px). 헤더: 뒤로 링크 · 제목 · 토글 한 줄(제목은 `--font-size-lg`, 넘치면 줄바꿈 허용). 링 지름 `min(72vw, 280px)`. 시간 글자 `clamp(2.75rem, 1.5rem + 7vw, 4rem)`. 버튼 3개는 `flex-wrap: wrap; gap: var(--space-sm)`, 각 `flex: 1 1 6rem`. 아래로 오늘 횟수 → 설정 → 사용법 |
| `@media (min-width: 768px)` | 본문 `max-width: var(--content-width)`(720px) 가운데. 링 지름 300px, 시간 글자 4.5rem. 버튼은 한 줄, 각 `flex: 0 0 auto; min-width: 7.5rem` |
| `@media (min-width: 1024px)` (1280에서 확인) | `.app`을 `max-width: 960px` 2열 grid: `grid-template-columns: minmax(0, 3fr) minmax(0, 2fr)`. 왼쪽 `.timer`, 오른쪽 `.side`(오늘 횟수 + 설정, `details`는 `open` 기본 아님), `.help`는 두 열 전체(`grid-column: 1 / -1`). 링 지름 340px, 시간 5rem |

- 모든 숫자 표시에 `font-variant-numeric: tabular-nums`(초가 바뀔 때 흔들리지 않게). 시간 글꼴은 `var(--font-mono)`.
- 가로 스크롤 방지: 모든 grid 열 `minmax(0, …)`, 이미지·SVG `max-width:100%`.
- 버튼·링크·`summary`·체크박스 라벨: `min-height: var(--tap-size)`, 버튼·토글은 `min-width: var(--tap-size)`. 체크박스 라벨은 `display:flex; align-items:center; gap` 으로 라벨 전체가 44px 높이.
- `.app-header__back`도 `display:inline-flex; align-items:center; min-height:44px`.

---

## 6. 디자인

### 6.1 블로그에서 복사할 변수 (`css/variables.css` 값 그대로)

```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --text-muted: #666666;
  --accent: #2563eb;
  --border: #e5e5e5;
  --card-bg: #f9f9f9;

  --font-base: system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --font-mono: ui-monospace, "Cascadia Code", Consolas, monospace;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);

  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.5rem;

  --content-width: 720px;
  --gutter: 16px;
  --radius: 8px;
  --tap-size: 44px;
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

### 6.2 앱 전용 변수 (같은 두 블록 안에 추가)

| 변수 | 라이트 | 다크 | 용도 · 대비 |
|---|---|---|---|
| `--phase-focus` | `#b91c1c` | `#f87171` | 집중 글자·링. bg 대비 라이트 6.5:1, 다크 6.8:1 / card-bg 대비 6.1:1, 6.0:1 |
| `--phase-short` | `#047857` | `#34d399` | 짧은 휴식. 라이트 5.5:1(card-bg 5.2:1), 다크 9.8:1 |
| `--phase-long` | `#6d28d9` | `#a78bfa` | 긴 휴식. 라이트 7.1:1, 다크 6.9:1 |
| `--ring-track` | `var(--border)` | `var(--border)` | 링 바탕 |
| `--on-accent` | `#ffffff` | `#121212` | 주 버튼 글자. accent 배경 대비 라이트 5.2:1, 다크 7.4:1 |

```css
.timer--focus { --phase-color: var(--phase-focus); }
.timer--short { --phase-color: var(--phase-short); }
.timer--long  { --phase-color: var(--phase-long); }
```

- 단계 이름 `.timer__phase`: `color: var(--phase-color)`, 굵게, `--font-size-lg`.
- 시간 `.timer__time`: `color: var(--text)`(단계색 아님, 큰 글자 가독성).
- 버튼 `.button`: `background: var(--card-bg); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius)`. `.button--primary`: `background: var(--accent); color: var(--on-accent); border-color: var(--accent)`. hover는 `filter`가 아니라 `border-color: var(--accent)`.
- 점 `.timer__dot`: 12×12px 원, `border: 2px solid var(--phase-color)`, 채운 점 `.timer__dot--done`은 `background: var(--phase-color)`.
- 카드 영역(`.today`, `.settings`, `.help`): `background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-md)`.
- `.settings__error`: `color: var(--phase-focus)`(빨강, AA 충족), `--font-size-sm`.
- CSS·JS 안에 색상값을 직접 쓰는 곳은 위 변수 정의뿐이다. `!important`, ID 선택자 금지.

---

## 7. 블로그 임베드 계획 (Embed 단계용, 지금은 만들지 않음)

- 카드 제목: **뽀모도로 타이머**
- 한 줄 설명: **25분 집중과 5분 휴식을 번갈아 재고, 오늘 완료한 집중 횟수를 기록합니다.**
- 링크: `apps/pomodoro/` (상대 경로)
- `preview.svg` (Build가 만든다)
  - `viewBox="0 0 640 360"`, `width="640" height="360"`, 외부 참조·`<script>`·웹폰트 없음.
  - 내용: 둥근 사각형 배경(`#f9f9f9`, 테두리 `#e5e5e5`, 반지름 16) / 가운데 링(지름 200, 바탕 `#e5e5e5`, 진행 약 70% `#b91c1c`, 두께 14, 끝 둥글게) / 링 안 `25:00`(`font-family="ui-monospace, Consolas, monospace"`, 56px, `#1a1a1a`) / 링 위 `집중`(24px, `#b91c1c`) / 링 아래 점 4개 중 2개 채움(`#b91c1c`).
  - SVG는 `<img>`로 들어가 CSS 변수를 못 읽으므로 **라이트 팔레트 값을 직접 쓰는 유일한 예외**다. 배경을 자체적으로 칠해 다크 블로그 위에서도 읽힌다.
  - 파일 크기 5KB 이하.
- `alt`: **"빨간 진행 링 안에 25:00이 표시된 뽀모도로 타이머 화면"**

---

## 8. 검증 체크리스트 (Review 단계용)

### 8.1 Node 로직 테스트 (`timer.js`, 스크래치 폴더의 테스트 스크립트에서 import)

기본 설정 `S = DEFAULT_SETTINGS`(25/5/15/4, autoStart false).

1. `createState(S)` → `{phase:'focus', status:'idle', endsAt:null, remainingMs:1_500_000, cycleCount:0}`.
2. `s1 = start(createState(S), 0)` → `status 'running'`, `endsAt 1_500_000`. `getRemaining(s1, 60_000) === 1_440_000`, `formatTime(...) === '24:00'`.
3. `formatTime(1_439_001) === '24:00'`, `formatTime(1_439_000) === '23:59'`, `formatTime(0) === '00:00'`, `formatTime(-5) === '00:00'`, `formatTime(5_400_000) === '90:00'`, `formatTime(999) === '00:01'`.
4. `formatSpoken(1_453_000) === '24분 13초'`, `formatSpoken(1_500_000) === '25분'`, `formatSpoken(40_000) === '40초'`.
5. `p = pause(s1, 60_000)` → `paused`, `remainingMs 1_440_000`, `endsAt null`. `getRemaining(p, 999_999_999) === 1_440_000`. `start(p, 1_000_000).endsAt === 2_440_000`.
6. `start(s1, 30_000) === s1`와 같은 값(이미 running이면 그대로). `pause(createState(S), 0)`은 idle 그대로.
7. `tick(s1, S, 1_499_999).events.length === 0`. `tick(s1, S, 1_500_000)` → `events [{phase:'focus', completedAt:1_500_000}]`, 새 상태 `phase 'short'`, `idle`, `remainingMs 300_000`, `cycleCount 1`.
8. focus 완료를 4번 반복(사이 휴식 완료 포함) → 4번째 focus 완료 뒤 `phase 'long'`, `remainingMs 900_000`, `cycleCount 4`. long 완료 뒤 `phase 'focus'`, `cycleCount 0`.
9. `skip(createState(S), S)` → `phase 'short'`, `cycleCount 0`, idle, `remainingMs 300_000`. `cycleCount 3`인 focus를 skip해도 `short`, `cycleCount 3`.
10. `reset`: running 상태(`start(...,0)`)를 `reset` → idle, `remainingMs 1_500_000`, 단계·`cycleCount` 그대로.
11. 자동 시작 `A = {...S, autoStart:true}`: `tick(start(createState(A),0), A, 2_000_000)` → `events.length === 2`(focus@1_500_000, short@1_800_000), 상태 `focus`, `running`, `endsAt 3_300_000`, `cycleCount 1`.
12. 따라잡기 상한: `A`에서 `now = 100 * 3_600_000` → `events.length === 8`, 상태 `idle`, `endsAt null`.
13. `dateKey(Date.UTC(2026,9,30,14,59,59), -540) === '2026-10-30'`, `dateKey(Date.UTC(2026,9,30,15,0,0), -540) === '2026-10-31'`, `dateKey(Date.UTC(2026,9,30,0,0,0), 0) === '2026-10-30'`.
14. `addCompletion({date:'',count:0}, t, -540)` → `{date:'2026-10-30', count:1}`(t = 위 첫 시각). 같은 날 한 번 더 → `count 2`. 다음 날 시각 → `{date:'2026-10-31', count:1}`. `getTodayCount({date:'2026-10-30',count:5}, 다음날시각, -540) === 0`. count 999에서 더해도 999.
15. `parseSettings(null)`, `parseSettings([])`, `parseSettings({version:2})` → 기본값과 같음. `parseSettings({version:1, focusMin:'25'}).focusMin === 25`(기본값으로), `{focusMin:91}` → 25, `{focusMin:25.5}` → 25, `{focusMin:50, sound:'yes'}` → `focusMin 50`, `sound true`(기본).
16. `parseToday({date:'2026-10-30', count:3})` 그대로, `{date:'20261030', count:3}`·`{date:'2026-10-30', count:-1}`·`{count:1.5}` → `{date:'', count:0}`.
17. `parseSession`: 올바른 running 세션 그대로 상태로. `phase:'nap'`, `status:'running'`인데 `endsAt:null`, `status:'idle'`인데 `endsAt` 숫자, `remainingMs:1_500_001`, `cycleCount:5`, running `endsAt = now + 1_500_001`(너무 미래) → 모두 `null`. 과거 `endsAt`은 유효.
18. `applySettings`: idle·손대지 않은 focus(1_500_000)에서 focusMin 25→30 → `remainingMs 1_800_000`. paused(1_440_000)에서 바꾸면 `1_440_000` 그대로. focus `cycleCount 3`에서 longEvery 4→3 → `cycleCount 2`.
19. `validateSettingsInput({focusMin:'0', shortMin:'5', longMin:'15', longEvery:'4', ...})` → `ok false`, `errors.focusMin` 존재. `'1e1'`, `'-3'`, `''` 도 오류. 모두 정상이면 `ok true`, 숫자형 settings.
20. 입력 객체를 바꾸지 않는다: 각 함수 호출 전후 `JSON.stringify(input)`가 같다.

### 8.2 코드 검사 (grep)

- `apps/pomodoro/` 안에 `innerHTML`, `!important`, `var ` 선언, `http://`·`https://` 외부 리소스(`<link>`/`<script src>`/`import`), `@import`, `.mp3|.wav|.ogg` 가 **0건**.
- `timer.js`에 `document`, `window`, `localStorage`, `Date.now`, `new Date()`(인자 없음), `setInterval`, `setTimeout` 0건.
- `localStorage` 접근은 모두 `try` 블록 안. 키 문자열은 `theme`, `pomodoro:settings`, `pomodoro:today`, `pomodoro:session` 4개뿐.
- CSS에서 색상 리터럴(`#`, `rgb(`, `hsl(`)은 `:root`/`[data-theme="dark"]` 변수 정의 블록에만.
- CSS에 `#아이디` 선택자 0건. 모든 클래스가 BEM 형태.
- `<head>` 인라인 스크립트가 블로그 `index.html`의 것과 같은 내용.
- `theme.js`가 블로그 `js/theme.js`와 같은 내용.
- 경로가 모두 상대 경로(`/`로 시작하는 `href`/`src` 0건).

### 8.3 브라우저 확인 (`python -m http.server 8000` → `http://localhost:8000/apps/pomodoro/`)

1. 첫 화면: `집중`, `25:00`, 탭 제목 `25:00 집중 - 뽀모도로`, 버튼 글자 `시작`, 오늘 `0회`, 세트 `0 / 4`.
2. 시작 후 약 3초 → 시간 `24:57`~`24:58`, 탭 제목 같은 값, 버튼 `일시정지`. 일시정지 → 제목 `… 집중(일시정지) - 뽀모도로`, 5초 기다려도 시간 그대로, 버튼 `계속`.
3. 설정에서 집중 1분 저장 → idle이면 바로 `01:00`. 시작해 1분 뒤: 메시지 "집중이 끝났습니다. 짧은 휴식을 시작하세요.", 단계 `짧은 휴식`·`05:00`, 오늘 `1회`, 세트 `1 / 4`, 비프 3번(소리 켬).
4. 백그라운드 정확도: 1분 집중 시작 → 다른 탭으로 70초 → 돌아오면 이미 단계가 바뀌어 있고 오늘 횟수 +1.
5. 새로고침 이어가기: 시작 10초 뒤 새로고침 → 약 `24:50`에서 계속 running. paused에서 새로고침 → 같은 남은 시간으로 paused.
6. 닫힌 동안 종료: 개발자 도구로 `pomodoro:session`의 `endsAt`을 `Date.now() - 1000`으로 바꾸고 새로고침 → 단계 `짧은 휴식`, 오늘 +1, 메시지가 "자리를 비운 사이 "로 시작, 소리 없음.
7. 날짜 바뀜: `pomodoro:today`를 `{"date":"2000-01-01","count":7}`로 바꾸고 새로고침 → 오늘 `0회`.
8. 잘못된 저장값: 세 키에 각각 `"abc"`, `"[]"`, `{"version":1,"focusMin":999}` 를 넣고 새로고침 → 콘솔 에러 없이 기본값으로 동작(focusMin 25).
9. 단축키: 빈 곳 클릭 후 Space → 시작/일시정지, 페이지 스크롤 없음. `R` 초기화, `S` 건너뛰기. 설정 입력칸에 포커스 두고 `s`/Space 입력 → 타이머 반응 없음. Ctrl+R은 새로고침(가로채지 않음).
10. 스크린 리더 알림 영역(`[data-role="announcer"]`)의 `textContent`를 `MutationObserver`로 30초 관찰 → 시작 때 1번만 바뀌고 매초 바뀌지 않음. `.timer__time`에 `aria-live` 없음.
11. 설정 오류: 집중에 `0` 입력 후 저장 → "1~90 사이의 정수를 입력하세요.", `aria-invalid="true"`, 저장 안 됨(새로고침 후 이전 값).
12. 브라우저 알림: 체크 → 권한 요청 창. 거부 시 체크 풀림 + 안내 문장.
13. 다크/라이트 토글: 아이콘·`aria-label` 바뀜, 새로고침해도 유지, 블로그 메인으로 가도 같은 테마(키 `theme` 공유). 깜빡임 없음.
14. 폭 375 / 768 / 1280: `document.documentElement.scrollWidth <= window.innerWidth`. 375에서 본문 좌우 여백 ≥ 16px. 1280에서 2열(타이머 | 오늘·설정), 사용법은 아래 전체 폭.
15. 탭 대상: 모든 `button`, `a`, `summary`, 체크박스 라벨의 `getBoundingClientRect()` 높이 ≥ 44, 버튼·토글 너비 ≥ 44.
16. 대비: 6.2 표의 조합을 계산해 모두 ≥ 4.5:1(라이트·다크 둘 다). 일시정지 시간 색(`--text-muted`)도 bg·card-bg 대비 ≥ 4.5:1.
17. "← 블로그로" 링크 `href="../../"`로 블로그 메인 이동.
18. 콘솔 에러 0건(라이트·다크, 세 폭).
19. 사용법 문구가 2.9 문장과 같고, 설정을 바꾸면 숫자(25/5/15/4)가 새 값으로 바뀜.

---

## 9. 범위 밖

- 날짜별 기록·통계 그래프, 기록 내보내기, "오늘 기록 지우기" 버튼
- 할 일(task) 목록, 집중 주제 메모
- 여러 탭·여러 기기 사이 동기화(`storage` 이벤트 포함), 서버 저장, 계정
- 서비스 워커·오프라인 설치(PWA), 앱 아이콘
- 사용자 지정 소리, 소리 파일, 볼륨 조절
- 블로그 `index.html` 카드 추가(Embed 단계에서 따로)
- 다국어

---

## 10. 열린 질문 (사용자가 정할 것)

> **결정 사항 (2026-10-30, 사용자)**: 아래 5개 질문 모두 **권장안으로** 결정. 이 spec 본문은 이미 권장안 기준이므로 바꿀 곳은 없다.

이 spec은 각 질문의 **권장 기본안**을 적용해 쓰여 있다.

1. **4번 집중 후 긴 휴식을 둘까?**
   - 권장: **둔다.** 집중 4번마다 긴 휴식 15분. 횟수(2~8)와 길이(1~60분)는 설정에서 바꿀 수 있다.
   - 대안: 두지 않음(집중/짧은 휴식만) → `long` 단계와 `longEvery`·`longMin` 설정, 세트 점 표시를 뺀다.
2. **시간 설정(분) 변경 기능을 넣을까? 범위와 저장은?**
   - 권장: **넣는다.** 정수 분 단위, 집중 1~90 / 짧은 휴식 1~30 / 긴 휴식 1~60 / 긴 휴식까지 횟수 2~8. "설정 저장" 버튼을 눌렀을 때만 `pomodoro:settings`에 저장. 진행 중 바꾸면 다음 단계부터 적용.
   - 대안: 넣지 않음(25/5/15 고정) → 설정 폼과 `pomodoro:settings` 중 숫자 필드를 뺀다.
3. **시간이 끝났을 때 알림 방식은?**
   - 권장: **화면 표시는 항상 + 소리(Web Audio 비프 3번) 기본 켬 + 브라우저 알림은 기본 끔(사용자가 체크할 때 권한 요청, 탭이 숨겨져 있을 때만 표시).** 셋 다 끌 수는 없고 화면 표시는 남는다.
   - 대안: 화면 표시만 / 소리 기본 끔 / 브라우저 알림 제외.
4. **다음 단계를 자동으로 시작할까?**
   - 권장: **기본은 자동 시작 안 함**(끝나면 대기, 사용자가 시작). 설정 체크박스로 켤 수 있다.
   - 대안: 기본 켬 / 옵션 자체를 빼고 항상 수동.
5. **새로고침·탭 닫힘 후 진행 중인 타이머를 이어갈까?**
   - 권장: **이어간다.** 종료 예정 시각을 저장해 다시 열면 그 기준으로 계속. 닫혀 있는 사이 끝났으면 완료로 처리(집중이면 오늘 횟수 +1)하고 소리 없이 "자리를 비운 사이 …" 메시지만 보여 준다.
   - 대안: 이어가지 않음(새로고침하면 현재 단계 처음으로) → `pomodoro:session`과 `parseSession`을 뺀다.
