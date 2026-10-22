# Review 서브에이전트 지침 — 2048 게임

## 역할
너는 Review 단계 담당이다. Build 결과를 검증하고 `review.md`를 쓴다. 문제를 찾으면 앱 폴더 안에서 고친다. 너는 Build 담당과 다른 에이전트다 — 구현자의 보고를 믿지 말고 직접 확인한다.

## 작업 범위
- 작성: `C:\Users\bobby\Desktop\my-blog\apps\game-2048\review.md`
- 수정 가능: 같은 폴더의 `index.html`, `style.css`, `game.js`, `main.js`, `theme.js`, `preview.svg`
- 수정 금지: `spec.md`, `briefs/`, `apps/game-2048/` 밖의 모든 파일(블로그 `index.html`, `css/`, `js/`, `posts/`, `apps/pixel-art/`, `CLAUDE.md`, `AGENTS.md` 등), git 작업

## 따를 문서 (읽기만)
- `C:\Users\bobby\Desktop\my-blog\apps\game-2048\spec.md` — 기능 기준(2장), 디자인(6장), 임베드용 `preview.svg` 사양(7장), **8장 검증 체크리스트**, 10장 결정 사항
- `C:\Users\bobby\Desktop\my-blog\CLAUDE.md` — 웹앱 규칙과 블로그 규칙의 디자인·다크 모드·반응형·코드 스타일. spec보다 나중에 추가된 규칙 두 가지도 검사한다:
  - 블로그 색상 팔레트를 따른다(블로그 `css/style.css`의 색 변수 이름·값을 복사해 쓰는지).
  - 사용법 안내 문구가 있다(조작 방법: 키보드·스와이프 등이 화면에 보이는지).

## 검사할 것
1. spec 8장 체크리스트 전부 — 항목마다 통과 / 수정함 / 실패 / 확인 불가.
2. 브라우저 `http://localhost:8000/apps/game-2048/`: 콘솔 오류, 375px·768px·1280px 레이아웃과 가로 스크롤, 라이트/다크 대비, 탭 대상 44px, 키보드 조작, 사용법 안내 문구.
3. 코드: `innerHTML`, `!important`, `/`로 시작하는 경로, 컴포넌트 CSS의 색 리터럴, 전역 변수, try/catch 없는 `localStorage`, `game.js`의 DOM·`Math.random` 직접 참조(기본 인자만 허용).
4. 저장값: 깨진 JSON, 잘못된 판, 옛 형식, `localStorage` 예외(예: getItem을 일시적으로 throw하도록 바꿔서)에서도 앱이 열리는지.
5. Build 단계에서 확인 못 한 것: 같은 수에 승리와 패배가 동시에 나는 경우, 저장된 패배 판을 다시 열 때 동작, `prefers-reduced-motion`.
6. Build가 spec과 다르게 한 점(헤더 행 래퍼, 승리 오버레이 안내 줄, `theme.js` 분리, reduced-motion 선택자)이 합리적인지.

## 고치는 기준
- 버그, 규칙 위반, spec 불일치는 고친다. 고친 뒤 같은 항목을 다시 확인한다.
- 큰 설계 변경이나 spec 자체의 문제는 고치지 말고 review.md에 "사용자 결정 필요"로 적는다.

## review.md 형식 (한국어)
- 요약(한 단락): 전체 판정
- 검사 결과 표: 항목 / 결과 / 메모
- 수정한 것: 파일, 무엇을, 왜
- 남은 문제와 사용자 결정 필요 사항
- 확인하지 못한 것(실기기 터치, 스크린 리더 등)

## 스스로 지킬 것
- **다른 Review 에이전트가 동시에 픽셀 아트 앱을 검사한다.** 브라우저는 `tabs_create`로 새 탭을 만들어 그 `tabId`로만 작업하고, 다른 탭을 닫거나 조작하지 않는다. 서버(8000)는 이미 떠 있으니 끄지 않는다.
- `theme` 키는 블로그·다른 앱과 공유한다. 다른 탭의 테마 변경이 `storage` 이벤트로 넘어와 테마가 갑자기 바뀔 수 있으니, 다크/라이트 확인 직전에 현재 테마를 다시 확인한다.
- 시작할 때 `localStorage`의 `theme`, `game-2048:state`, `game-2048:best` 값을 기록해 두고, 끝날 때 정확히 그 상태로 돌린다(없던 키는 삭제). 보고에 적는다.
- 확인용 스크립트는 저장소 밖(임시 폴더)에 두고 지운다.

## 끝나면
review.md 경로, 판정, 수정한 파일과 요지, 남은 문제, 저장값 복원 여부를 짧게 보고한다.
