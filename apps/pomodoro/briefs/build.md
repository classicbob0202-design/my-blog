# Build 서브에이전트 지침 — 뽀모도로 타이머

## 역할
너는 Build 단계 담당이다. 승인된 계획서(`spec.md`)대로 구현한다. `review.md`는 쓰지 않는다.

## 작업 범위 (이 파일들만 만든다)
`C:\Users\bobby\Desktop\my-blog\apps\pomodoro\` 안의:
- `index.html`, `style.css`, `theme.js`, `timer.js`, `main.js`, `preview.svg`

다음은 만들거나 수정하지 않는다:
- `spec.md`, `briefs/` 아래 파일, `review.md`
- `apps/pomodoro/` 밖의 모든 파일 (블로그 `index.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, 그리고 **같은 시간에 다른 서브에이전트가 만드는 `apps/game-2048/`**)
- git 명령(커밋·브랜치·체크아웃 등)은 하지 않는다.

## 따를 문서 (읽기만)
- `apps\pomodoro\spec.md` — **이 문서가 기준이다.** 2~6장 전부, 8장 검증 체크리스트, 10장 결정 사항(모두 권장안).
- `CLAUDE.md` — 웹앱 규칙, 다크 모드 규칙, 반응형 규칙, 코드 작성 규칙.
- 블로그 `css\variables.css`, `index.html`의 `<head>` 인라인 스크립트, `js\theme.js` — **복사**해서 쓴다(import 금지).

## 지켜야 할 것
- HTML, CSS, JavaScript(ES 모듈)만. 외부 라이브러리·CDN·웹폰트·소리 파일 없음(소리는 Web Audio로 생성).
- 모든 경로는 상대 경로. `/`로 시작하는 경로 금지.
- `timer.js`는 순수 함수만: `document`, `window`, `localStorage`, `Date.now()`, 인자 없는 `new Date()` 참조 없음. 현재 시각은 인자로 받는다.
- 코드 스타일: `const`/`let`, 2칸 들여쓰기, 세미콜론, 전역 변수 없음, BEM 클래스, `!important` 금지, ID 선택자로 스타일링 금지, DOM 텍스트는 `textContent`(`innerHTML`·`insertAdjacentHTML` 금지), 주석은 한국어로 필요한 곳만.
- 색은 변수만. `:root`/`[data-theme="dark"]` 블록 밖에서 색 값을 직접 쓰지 않는다(`preview.svg`는 예외).
- 사용법 안내 문구를 spec 문장 그대로 화면에 넣는다.
- `localStorage` 접근은 모두 `try/catch`.
- 브라우저 알림(Notification) 권한 요청은 사용자가 체크박스를 켤 때만. 테스트 중에도 권한 요청 창을 띄우지 않는다.

## spec에서 애매한 점을 만나면
spec 의도에 가장 가까운 쪽으로 구현하고 보고에 "spec과 다르게 한 점"으로 적는다. spec 파일은 고치지 않는다.

## 스스로 확인할 것
- 정적 서버가 8000 포트로 떠 있다: `http://localhost:8000/apps/pomodoro/`. 서버를 끄지 않는다. 브라우저 도구가 있으면 **`tabs_create`로 새 탭을 만들어 그 탭만** 쓰고(다른 탭은 건드리지 않음), 콘솔 오류 없이 열리는지, 시작·일시정지·초기화, 단계 전환이 동작하는지 본다. 바뀐 JS가 안 보이면 캐시 때문일 수 있으니 `fetch(url, {cache: 'reload'})`로 갱신한 뒤 새로고침한다.
- Node(v24)로 `timer.js`를 import해서 spec 8장의 로직 항목을 돌린다(시각은 숫자로 주입). 스크립트는 저장소 밖 `C:\Users\bobby\AppData\Local\Temp\claude\C--Users-bobby-Obsidian\55819529-4fdd-4729-a231-156359b894cb\scratchpad\` 아래에 두고, 끝나면 지운다.
- 테스트로 바꾼 `localStorage`는 끝날 때 원래대로 돌린다(시작할 때 `theme`와 `pomodoro:*` 값을 기록). `theme` 키(블로그와 공유)를 건드렸다면 반드시 밝힌다.

## 끝나면
1. 만든 파일 목록과 각 파일 줄 수
2. 직접 확인한 것과 결과(Node 테스트 통과 수 포함), 확인하지 못한 것
3. 바꾼 브라우저 저장값과 복원 여부
4. spec과 다르게 한 점(없으면 "없음")
