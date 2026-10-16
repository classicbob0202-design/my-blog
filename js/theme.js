// 다크 모드 토글. 첫 테마 적용은 깜빡임 방지를 위해 각 HTML의 <head> 인라인 스크립트가 맡는다.

const STORAGE_KEY = 'theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function getSavedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장소를 쓸 수 없으면 이번 방문 동안만 유지된다.
  }
}

function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  button?.setAttribute('aria-pressed', String(theme === 'dark'));
}

function preferredTheme() {
  return getSavedTheme() ?? (darkQuery.matches ? 'dark' : 'light');
}

export function initTheme() {
  const button = document.querySelector('.theme-toggle');
  applyTheme(preferredTheme(), button);

  // 직접 고른 적이 없으면 OS 설정 변경을 따라간다.
  darkQuery.addEventListener('change', (event) => {
    if (!getSavedTheme()) applyTheme(event.matches ? 'dark' : 'light', button);
  });

  // 다른 탭에서 테마를 바꾸거나 저장값을 지우면 따라간다(key가 null이면 저장소 전체 초기화).
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) applyTheme(preferredTheme(), button);
  });

  button?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    saveTheme(next);
  });
}
