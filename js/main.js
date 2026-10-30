// 공통 기능: 모바일 햄버거 메뉴
(() => {
  const button = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (!button || !nav) return;

  const desktop = window.matchMedia('(min-width: 768px)');

  const setOpen = (open) => {
    nav.classList.toggle('nav--open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    button.textContent = open ? '✕' : '☰';
  };

  const isOpen = () => nav.classList.contains('nav--open');

  button.addEventListener('click', () => setOpen(!isOpen()));

  // Esc로 닫고 포커스를 버튼으로 돌려준다.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });

  // 메뉴 바깥을 누르면 닫는다.
  document.addEventListener('click', (event) => {
    if (isOpen() && !nav.contains(event.target) && !button.contains(event.target)) {
      setOpen(false);
    }
  });

  // 태블릿 이상으로 넓어지면 열린 상태를 정리한다.
  desktop.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
})();
