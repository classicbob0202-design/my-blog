# Review 서브에이전트 지침 — 2048 게임

## 역할
너는 Review 단계 담당이다. 구현은 다른 서브에이전트(Build)가 했다. 너는 구현자의 보고를 믿지 말고 **직접** 브라우저와 코드로 확인한다. 결과는 `review.md`로 남긴다.

## 기준 문서
- `C:\Users\bobby\Desktop\my-blog\apps\game-2048\spec.md` — 승인된 계획서. **8장 검증 체크리스트**를 항목별로 확인한다(2.9 판 저장 관련 항목 포함).
- `C:\Users\bobby\Desktop\my-blog\CLAUDE.md` — 웹앱 규칙, 블로그 디자인·모바일 규칙
- Build가 밝힌 계획서와 다른 점(타당한지 판단할 것):
  1. 테마 인라인 스크립트를 `<meta charset>` 바로 뒤에 둠(stylesheet보다는 앞)
  2. 래퍼 max-width를 `calc(448px + gutter*2)`로 함
  3. 생성/합치기 효과에 `transform` 대신 CSS `scale` 속성 사용
  4. 버튼 hover 변수, `.button-secondary`, preview.svg의 2 타일 테두리, reduced-motion에서 `+N` 숨김, 첫 방문 시 "새 게임" 알림 생략

## 검증 방법
- 로컬 서버: `http://localhost:8000/apps/game-2048/` (블로그 루트에서 `python -m http.server 8000`이 이미 떠 있을 수 있다. 응답이 없으면 `C:\Users\bobby\Desktop\my-blog`에서 백그라운드로 띄운다.)
- 브라우저 도구(`mcp__Claude_Browser__*`)로 실제 페이지를 열어 확인한다.
  - 키 입력, 375px 모바일 폭(resize_window preset mobile), 라이트/다크(`localStorage.theme` 설정 후 새로고침), 콘솔 오류.
  - 로직은 콘솔에서 `await import('./game.js')`로 직접 호출해 확인한다.
  - 승리/패배 같은 상황은 `localStorage`의 `game-2048:state`에 원하는 판을 넣고 새로고침해서 만든다.
  - 스와이프는 가능하면 PointerEvent를 디스패치해 확인하고, 못 하면 그렇다고 적는다.
- 코드도 읽는다: 버그, spec 위반, 보안(innerHTML에 사용자/저장값을 넣는지), 전역 변수, `!important`, 외부 리소스.
- 테스트가 끝나면 브라우저의 `localStorage`에서 `game-2048:*` 키와 `theme` 키를 지우고, 뷰포트를 desktop으로 되돌린다.

## 수정 범위
- 작성: `C:\Users\bobby\Desktop\my-blog\apps\game-2048\review.md`
- 문제를 발견하면 고칠 수 있다. 단, **`apps/game-2048/`의 `index.html`, `style.css`, `game.js`, `main.js`, `preview.svg`만** 수정한다. 고친 뒤에는 그 항목을 다시 확인한다.
- `spec.md`, `briefs/`, 그리고 `apps/game-2048/` 밖의 모든 파일(블로그 `index.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`)은 수정하지 않는다.
- 설계를 크게 바꿔야 하는 문제는 고치지 말고 review.md에 "미해결"로 적는다.

## review.md 형식 (한국어)
1. **요약** — 결과 한 줄(통과/조건부 통과/실패), 확인 환경
2. **체크리스트 결과** — spec 8장 항목별 ✅/❌/⚠️(확인 못 함)와 짧은 근거
3. **Build의 변경점 판단** — 위 4가지가 타당한지
4. **발견한 문제와 수정 내역** — 문제, 원인, 고친 파일·내용, 재확인 결과
5. **미해결 / 확인하지 못한 것**

## 끝나면
review.md 경로, 최종 판정, 고친 내용, 미해결 사항을 짧게 보고한다.
