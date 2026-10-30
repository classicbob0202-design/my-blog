# Review 서브에이전트 지침 — 2048 게임

## 역할
너는 Review 단계 담당이다. Build 결과를 검증하고 `review.md`를 쓴다. 문제를 찾으면 앱 폴더 안에서 고친다. 너는 Build 담당과 **다른** 에이전트다 — 구현자의 보고를 믿지 말고 직접 확인한다.

## 작업 범위
- 작성: `C:\Users\bobby\Desktop\my-blog\apps\game-2048\review.md`
- 수정 가능: `apps\game-2048\` 안의 구현 파일(`index.html`, `style.css`, `game.js`, `scores.js`, `storage.js`, `main.js`, `theme.js`, `preview.svg`)
- 수정 금지: `spec.md`, `briefs/`, 앱 폴더 밖 모든 파일(블로그 파일, `CLAUDE.md`, **같은 시간에 다른 리뷰어가 검사하는 `apps/pomodoro/`**), git 명령

## 따를 문서 (읽기만)
- `apps\game-2048\spec.md` — 기능 기준, 8장 검증 체크리스트, 10장 결정 사항(모두 권장안)
- `CLAUDE.md` — 웹앱 규칙(블로그 색 팔레트, 사용법 안내 문구 포함), 다크 모드·반응형·코드 작성 규칙

## Build 담당이 남긴 메모 (참고, 직접 판단할 것)
- Node 로직 테스트 73개 통과 보고. 스와이프는 합성 이벤트로만 확인, reduced-motion·다른 탭 테마 동기화·포커스 윤곽선은 미확인.
- spec과 다르게 한 점: `bestAnnounced`는 점수>0일 때만 true / 메시지가 열려 있으면 Tab 포커스를 메시지 버튼으로 가둠 / `:root`에 `color-scheme` 추가 / `setPointerCapture`를 try/catch.
- 알림 영역(aria-live) 문구가 뒤쪽 탭에서 requestAnimationFrame 정지 때문에 늦게 들어갔다고 함 — 앞에 보이는 탭(`tabs_select`)에서 확인 필요.

## 검사할 것
1. spec 8장 검증 체크리스트 항목 전부(통과/수정함/실패/확인 불가). 로직은 Node로 직접 다시 돌린다.
2. 브라우저 `http://localhost:8000/apps/game-2048/` — 콘솔 오류, 375·768·1280px 레이아웃과 가로 스크롤, 라이트/다크, 탭 대상 44px, 키보드 조작, 사용법 안내 문구, "← 블로그로" 링크
3. 코드: 금지 패턴(`innerHTML`, `!important`, `/`로 시작하는 경로, `:root`/`[data-theme="dark"]` 밖의 색 리터럴, 전역 변수, try/catch 없는 localStorage), 순수 모듈에 DOM·저장소·`Math.random` 참조 없음, 블로그 색 변수 사용
4. 저장값: 깨진 값·범위 밖 값·localStorage 예외에서도 앱이 열리는지, 기록판이 같은 판을 두 번 기록하지 않는지
5. 글자/배경 대비 WCAG AA(4.5:1)를 라이트·다크 모두 직접 계산(타일 숫자 포함)
6. spec과 다르게 구현된 점이 합리적인지

## 고치는 기준
- 버그, 규칙 위반, spec 불일치는 고친다. 고친 뒤 같은 항목을 다시 확인한다.
- 큰 설계 변경이나 spec 자체의 문제는 고치지 말고 review.md에 "사용자 결정 필요"로 적는다.

## review.md 형식 (한국어)
- 요약(한 단락): 전체 판정
- 검사 결과 표: 항목 / 결과(통과·수정함·실패·확인 불가) / 메모
- 수정한 것: 파일, 무엇을, 왜
- 남은 문제와 사용자 결정 필요 사항
- 확인하지 못한 것(실기기 터치, 스크린 리더 등)

## 스스로 지킬 것
- 확인용 스크립트는 저장소 밖 `C:\Users\bobby\AppData\Local\Temp\claude\C--Users-bobby-Obsidian\55819529-4fdd-4729-a231-156359b894cb\scratchpad\` 아래에 두고 끝나면 지운다.
- 브라우저는 **`tabs_create`로 만든 새 탭의 tabId로만** 작업하고, 다른 탭을 닫거나 조작하지 않는다. 끝나면 그 탭을 닫는다. 서버(8000)는 끄지 않는다. 바뀐 파일이 안 보이면 `fetch(url, {cache: 'reload'})`로 갱신 후 새로고침한다.
- 시작할 때 `localStorage`의 `theme`와 `game-2048:*` 값을 기록하고, 끝날 때 정확히 그 상태로 돌린다(없던 키는 삭제). `pomodoro:*` 키는 건드리지 않는다. 다른 탭의 테마 변경이 `storage` 이벤트로 넘어올 수 있으니 라이트/다크 확인 직전에 현재 테마를 다시 확인한다.

## 끝나면
review.md 경로, 판정, 수정한 파일과 요지, 남은 문제(사용자 결정 필요 포함)를 짧게 보고한다.
