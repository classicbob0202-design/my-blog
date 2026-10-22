# Build 서브에이전트 지침 — 픽셀 아트 에디터

## 역할
너는 Build 단계 담당이다. 승인된 계획서(`spec.md`)대로 픽셀 아트 에디터를 구현한다. 검증 보고서(review.md)는 쓰지 않는다(Review 단계가 따로 한다).

## 작업 범위 (이 파일들만 만든다)
`C:\Users\bobby\Desktop\my-blog\apps\pixel-art\` 안의:
- `index.html`
- `style.css`
- `pixel.js`
- `history.js`
- `main.js`
- `theme.js`
- `preview.svg`

다음은 만들거나 수정하지 않는다:
- `spec.md`, `briefs/` 아래 파일, `review.md`
- `apps/pixel-art/` 밖의 모든 파일(블로그 `index.html`, `css/`, `js/`, `posts/`, `apps/game-2048/`, `CLAUDE.md`, `AGENTS.md` 등)
- git 커밋·브랜치 작업도 하지 않는다.

## 따를 문서 (읽기만)
- `C:\Users\bobby\Desktop\my-blog\apps\pixel-art\spec.md` — **이 문서가 기준이다.** 특히 2장(도구·입력·키보드·팔레트·편의 기능·PNG·자동 저장·테마·접근성), 3장(파일 구조), 4장(데이터 구조·함수 시그니처·상태·렌더링), 5장(마크업 골격·레이아웃), 6장(색), 7장의 `preview.svg` 사양, 10장(결정 사항).
- `C:\Users\bobby\Desktop\my-blog\CLAUDE.md` — 웹앱 규칙과 블로그 규칙의 코드 스타일.
- `C:\Users\bobby\Desktop\my-blog\apps\game-2048\theme.js`, `index.html`의 `<head>` 인라인 스크립트·헤더 마크업 — 값과 동작을 **복사**해서 쓴다(import 금지).

## 지켜야 할 것
- HTML, CSS, JavaScript(ES 모듈)만. 외부 라이브러리·CDN·폰트 파일 없음. PNG는 `<canvas>`의 `putImageData` + `toBlob`.
- 모든 경로는 상대 경로. `/`로 시작하는 경로 금지(사이트가 GitHub Pages `/my-blog/` 아래에서 서비스됨).
- `pixel.js`·`history.js`는 순수 함수만: `document`, `window`, `localStorage`, canvas 참조 없음.
- 코드 스타일: `const`/`let`, 2칸 들여쓰기, 세미콜론, 전역 변수 없음, 클래스명 소문자-하이픈, `!important` 금지, DOM 텍스트는 `textContent`로만(`innerHTML` 금지), 주석은 한국어로 필요한 곳에만 짧게.
- 컴포넌트 CSS에 색 값을 직접 쓰지 않고 변수만 쓴다. 다크는 `[data-theme="dark"]`에서 변수만 재정의. (그림 데이터의 팔레트 색은 앱 UI 색이 아니므로 JS 상수로 둬도 된다.)
- `localStorage` 접근은 모두 `try/catch`.

## spec에서 애매한 점을 만나면
추측으로 크게 벗어나지 말고 spec의 의도에 가장 가까운 쪽으로 구현한 뒤, 보고에 "spec과 다르게 한 점"으로 적는다.

## 스스로 확인할 것 (간단히)
- 정적 서버가 저장소 루트에서 8000 포트로 이미 떠 있을 가능성이 높다. `http://localhost:8000/apps/pixel-art/`를 먼저 시도하고, 직접 띄워야 하면 다른 포트를 쓰고 끝날 때 끈다.
- 브라우저 도구가 있으면 페이지가 콘솔 오류 없이 열리는지, 몇 칸 칠하고 PNG가 만들어지는지(내보내기 함수 결과의 크기·픽셀 값) 확인한다.
- `node`가 있으면 `pixel.js`·`history.js`를 import해서 spec 8.1의 로직 항목을 돌려 본다. 확인용 스크립트는 저장소 밖(임시 폴더)에 두고 끝나면 지운다.
- 브라우저 저장소(`localStorage`)를 테스트로 바꿨다면 끝날 때 원래대로 지우고 보고에 적는다. 특히 `theme` 키는 블로그와 공유하므로 건드렸다면 반드시 밝힌다.

## 끝나면
다음을 짧게 보고한다.
1. 만든 파일 목록과 각 파일 줄 수
2. 직접 확인한 것과 결과, 확인하지 못한 것
3. spec과 다르게 한 점(없으면 "없음")
