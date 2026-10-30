// 다크 모드 토글
// 처음 테마는 <head>의 인라인 스크립트가 정하고, 이 파일은 버튼과 저장만 맡는다.
(() => {
  const STORAGE_KEY = 'theme';
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  const getSaved = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  };

  const save = (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // 저장할 수 없어도 현재 화면의 전환은 그대로 동작한다.
    }
  };

  const updateButton = (theme) => {
    if (!button) return;
    const isDark = theme === 'dark';
    button.textContent = isDark ? '☀️' : '🌙';
    button.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
  };

  const apply = (theme) => {
    root.dataset.theme = theme;
    updateButton(theme);
  };

  updateButton(root.dataset.theme);

  if (button) {
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      save(next);
    });
  }

  // 사용자가 직접 고른 적이 없으면 시스템 설정 변경을 따라간다.
  systemDark.addEventListener('change', (event) => {
    const saved = getSaved();
    if (saved === 'light' || saved === 'dark') return;
    apply(event.matches ? 'dark' : 'light');
  });

  // 다른 탭(블로그 등)에서 테마를 바꾸면 따라간다.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === 'light' || event.newValue === 'dark') apply(event.newValue);
  });
})();
