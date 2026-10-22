# Build 서브에이전트 지침 — 2048 게임

## 역할
너는 Build 단계 담당이다. 승인된 계획서(`spec.md`)대로 2048 게임을 구현한다. 검증 보고서(review.md)는 쓰지 않는다(Review 단계가 따로 한다).

## 작업 범위 (이 파일들만 만든다)
`C:\Users\bobby\Desktop\my-blog\apps\game-2048\` 안의:
- `index.html`
- `style.css`
- `game.js`
- `main.js`
- `preview.svg`
- (선택) `theme.js` — 테마 코드를 `main.js`와 나누고 싶을 때만

다음은 만들거나 수정하지 않는다:
- `spec.md`, `briefs/` 아래 파일, `review.md`
- `apps/game-2048/` 밖의 모든 파일(블로그 `index.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, `AGENTS.md` 등)
- git 커밋·브랜치 작업도 하지 않는다.

## 따를 문서 (읽기만)
- `C:\Users\bobby\Desktop\my-blog\apps\game-2048\spec.md` — **이 문서가 기준이다.** 특히 2장(기능, 2.7 테마 토글과 2.9 이어하기 포함), 4장(함수 시그니처·한 턴 흐름·렌더링 방식), 5장(마크업 골격·레이아웃), 6장(색 표), 7장의 `preview.svg` 사양, 10장(결정 사항).
- `C:\Users\bobby\Desktop\my-blog\CLAUDE.md` — 웹앱 규칙과 블로그 규칙의 코드 스타일.
- `C:\Users\bobby\Desktop\my-blog\index.html`의 `<head>` 인라인 테마 스크립트와 테마 토글 SVG, `js\theme.js` — 값과 동작을 **복사**해서 쓴다(import 금지).

## 지켜야 할 것
- HTML, CSS, JavaScript(ES 모듈)만. 외부 라이브러리·CDN·폰트 파일 없음.
- 모든 경로는 상대 경로. `/`로 시작하는 경로 금지(사이트가 GitHub Pages `/my-blog/` 아래에서 서비스됨).
- `game.js`는 순수 함수만: `document`, `window`, `localStorage` 참조 없음, `Math.random`은 기본 인자로만.
- 코드 스타일: `const`/`let`, 2칸 들여쓰기, 세미콜론, 전역 변수 없음, 클래스명 소문자-하이픈, `!important` 금지, DOM 텍스트는 `textContent`로만(`innerHTML` 금지), 주석은 한국어로 필요한 곳에만 짧게.
- 컴포넌트 CSS에 색 값을 직접 쓰지 않고 변수만 쓴다. 다크는 `[data-theme="dark"]`에서 변수만 재정의.
- `localStorage` 접근은 모두 `try/catch`.

## spec에서 애매한 점을 만나면
추측으로 크게 벗어나지 말고 spec의 의도에 가장 가까운 쪽으로 구현한 뒤, 보고에 "spec과 다르게 한 점"으로 적는다.

## 스스로 확인할 것 (간단히)
- `python -m http.server 8000`을 루트(`C:\Users\bobby\Desktop\my-blog`)에서 띄울 수 있으면 `http://localhost:8000/apps/game-2048/`가 콘솔 오류 없이 열리는지 확인한다. 브라우저 도구가 없으면 생략하고 보고에 적는다. 서버를 띄웠다면 끝날 때 꺼 둔다.
- `node`가 있으면 `game.js`를 import해서 spec 2.1 표의 8개 예시를 `slideLine`으로 돌려 본다. 없으면 생략한다. 확인용 스크립트를 저장소 안에 남기지 않는다.

## 끝나면
다음을 짧게 보고한다.
1. 만든 파일 목록과 각 파일 줄 수
2. 직접 확인한 것과 결과, 확인하지 못한 것
3. spec과 다르게 한 점(없으면 "없음")
