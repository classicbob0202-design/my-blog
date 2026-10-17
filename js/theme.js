// 다크 모드 토글. 초기 테마는 <head>의 인라인 스크립트가 먼저 적용한다.

const STORAGE_KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장할 수 없는 환경(사생활 보호 모드 등)에서는 이번 방문에만 적용한다.
  }
}

function systemTheme() {
  return media.matches ? 'dark' : 'light';
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}

export function initThemeToggle() {
  const button = document.querySelector('.theme-toggle');
  if (!button) {
    return;
  }

  applyTheme(getStoredTheme() ?? systemTheme(), button);

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    storeTheme(next);
  });

  // 직접 고른 값이 없으면 OS 설정 변경을 따라간다.
  media.addEventListener('change', () => {
    if (!getStoredTheme()) {
      applyTheme(systemTheme(), button);
    }
  });

  // 다른 탭에서 바꾼 값을 반영한다.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(getStoredTheme() ?? systemTheme(), button);
    }
  });
}
