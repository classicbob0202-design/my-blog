// 뽀모도로 타이머 화면·입력·저장·소리·알림
import {
  PHASE_LABELS,
  createState,
  getRemaining,
  toggle,
  reset,
  skip,
  tick,
  applySettings,
  formatTime,
  formatSpoken,
  progress,
  addCompletion,
  getTodayCount,
  dateKey,
  parseSettings,
  parseToday,
  parseSession,
  toSession,
  validateSettingsInput,
} from './timer.js';

const KEYS = {
  settings: 'pomodoro:settings',
  today: 'pomodoro:today',
  session: 'pomodoro:session',
};
const CIRCUMFERENCE = 2 * Math.PI * 45;
const NUMBER_FIELDS = ['focusMin', 'shortMin', 'longMin', 'longEvery'];
const CHECK_FIELDS = ['autoStart', 'sound', 'notify'];
const IGNORED_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'];
const NOTIFY_DENIED = '브라우저 알림이 허용되지 않았습니다. 브라우저 설정에서 허용할 수 있습니다.';
const NOTIFY_UNSUPPORTED = '이 브라우저는 알림을 지원하지 않습니다.';

// 저장소 ------------------------------------------------------------------
const load = (key) => {
  try {
    const text = localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const store = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 저장이 막혀도 화면은 그대로 쓸 수 있다.
  }
};

const offsetAt = (now) => new Date(now).getTimezoneOffset();
const notifySupported = 'Notification' in window;
const notifyGranted = () => notifySupported && Notification.permission === 'granted';

// 요소 --------------------------------------------------------------------
const el = {
  timer: document.querySelector('.timer'),
  phase: document.querySelector('.timer__phase'),
  time: document.querySelector('.timer__time'),
  ring: document.querySelector('.timer__ring-progress'),
  setCount: document.querySelector('.timer__set-count'),
  setTotal: document.querySelector('.timer__set-total'),
  dots: document.querySelector('.timer__dots'),
  toggle: document.querySelector('[data-action="toggle"]'),
  reset: document.querySelector('[data-action="reset"]'),
  skip: document.querySelector('[data-action="skip"]'),
  message: document.querySelector('.timer__message'),
  announcer: document.querySelector('[data-role="announcer"]'),
  todayNumber: document.querySelector('.today__number'),
  form: document.querySelector('.settings__form'),
  note: document.querySelector('.settings__note'),
  status: document.querySelector('.settings__status'),
  helpValues: document.querySelectorAll('.help__value'),
};
const notifyBox = el.form.elements.namedItem('notify');

// 상태 --------------------------------------------------------------------
let settings = parseSettings(load(KEYS.settings));
if (settings.notify && !notifyGranted()) settings = { ...settings, notify: false };
let today = parseToday(load(KEYS.today));
let state = parseSession(load(KEYS.session), settings, Date.now()) ?? createState(settings);
let audioContext = null;
let lastTime = '';
let lastTitle = '';
let lastDotCount = -1;

const saveSession = () => store(KEYS.session, toSession(state));

// 알림 --------------------------------------------------------------------
const announce = (text) => {
  el.announcer.textContent = '';
  requestAnimationFrame(() => {
    el.announcer.textContent = text;
  });
};

const ensureAudio = () => {
  try {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = new AudioCtor();
    }
    audioContext.resume().catch(() => {});
  } catch (error) {
    audioContext = null;
  }
};

const beep = () => {
  if (!audioContext) return;
  try {
    const base = audioContext.currentTime;
    [0, 0.25, 0.5].forEach((offset) => {
      const startAt = base + offset;
      const endAt = startAt + 0.15;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.2, startAt + 0.01);
      gain.gain.setValueAtTime(0.2, endAt - 0.03);
      gain.gain.linearRampToValueAtTime(0, endAt);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(startAt);
      osc.stop(endAt);
    });
  } catch (error) {
    // 소리를 낼 수 없으면 조용히 넘어간다.
  }
};

const sendNotification = (body) => {
  if (!settings.notify || !notifyGranted() || document.visibilityState !== 'hidden') return;
  try {
    new Notification('뽀모도로', { body });
  } catch (error) {
    // 알림을 만들 수 없으면 화면 표시만 남는다.
  }
};

const finishMessage = (events) => {
  const ended = PHASE_LABELS[events[events.length - 1].phase];
  const next = PHASE_LABELS[state.phase];
  const tail = state.status === 'running' ? '시작했습니다.' : '시작하세요.';
  return `${ended}이 끝났습니다. ${next}을 ${tail}`;
};

// 단계 완료 처리. silent면 소리·브라우저 알림 없이 "자리를 비운 사이" 문장만 보여 준다.
const handleEvents = (events, now, silent) => {
  if (events.length === 0) return;
  const offset = offsetAt(now);
  const todayKey = dateKey(now, offset);
  events.forEach((event) => {
    if (event.phase !== 'focus') return;
    if (silent && dateKey(event.completedAt, offsetAt(event.completedAt)) !== todayKey) return;
    today = addCompletion(today, event.completedAt, offsetAt(event.completedAt));
  });
  store(KEYS.today, today);
  saveSession();
  const text = `${silent ? '자리를 비운 사이 ' : ''}${finishMessage(events)}`;
  el.message.textContent = text;
  announce(text);
  if (!silent) {
    if (settings.sound) beep();
    sendNotification(text);
  }
};

// 화면 --------------------------------------------------------------------
const renderDots = () => {
  if (lastDotCount === settings.longEvery) return;
  lastDotCount = settings.longEvery;
  el.dots.replaceChildren();
  for (let i = 0; i < settings.longEvery; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'timer__dot';
    el.dots.append(dot);
  }
  el.setTotal.textContent = String(settings.longEvery);
};

const renderHelp = () => {
  el.helpValues.forEach((node) => {
    const value = String(settings[node.dataset.help]);
    if (node.textContent !== value) node.textContent = value;
  });
};

const render = () => {
  const now = Date.now();
  const result = tick(state, settings, now);
  if (result.events.length > 0) {
    state = result.state;
    handleEvents(result.events, now, false);
  }

  const remaining = getRemaining(state, now);
  const label = PHASE_LABELS[state.phase];
  const paused = state.status === 'paused';

  const timeText = formatTime(remaining);
  if (timeText !== lastTime) {
    el.time.textContent = timeText;
    lastTime = timeText;
  }
  const title = `${timeText} ${label}${paused ? '(일시정지)' : ''} - 뽀모도로`;
  if (title !== lastTitle) {
    document.title = title;
    lastTitle = title;
  }

  if (el.phase.textContent !== label) el.phase.textContent = label;
  ['focus', 'short', 'long'].forEach((phase) => {
    el.timer.classList.toggle(`timer--${phase}`, state.phase === phase);
  });
  el.timer.classList.toggle('timer--paused', paused);

  const offsetValue = (CIRCUMFERENCE * progress(state, settings, now)).toFixed(3);
  if (el.ring.style.strokeDashoffset !== offsetValue) el.ring.style.strokeDashoffset = offsetValue;

  const buttonText = { idle: '시작', running: '일시정지', paused: '계속' }[state.status];
  if (el.toggle.textContent !== buttonText) el.toggle.textContent = buttonText;

  const count = String(getTodayCount(today, now, offsetAt(now)));
  if (el.todayNumber.textContent !== count) el.todayNumber.textContent = count;

  renderDots();
  const cycleText = String(state.cycleCount);
  if (el.setCount.textContent !== cycleText) el.setCount.textContent = cycleText;
  Array.from(el.dots.children).forEach((dot, index) => {
    dot.classList.toggle('timer__dot--done', index < state.cycleCount);
  });
};

// 조작 --------------------------------------------------------------------
// 화면 갱신(250ms) 전에 종료 시각이 지났을 수 있으니, 조작 전에 같은 시각으로 완료부터 처리한다.
// 완료가 있었으면 true: 사용자는 끝난 단계를 누른 것이라 이번 누름은 완료 처리로 끝낸다.
const settle = (now) => {
  const result = tick(state, settings, now);
  if (result.events.length === 0) return false;
  state = result.state;
  handleEvents(result.events, now, false);
  render();
  return true;
};

const doToggle = () => {
  const now = Date.now();
  if (settle(now)) return;
  const before = state.status;
  if (before !== 'running') ensureAudio();
  state = toggle(state, now);
  saveSession();
  el.message.textContent = '';
  const label = PHASE_LABELS[state.phase];
  if (before === 'idle') {
    announce(`${label} 시작. ${Math.ceil(getRemaining(state, now) / 60_000)}분 남았습니다.`);
  } else if (before === 'running') {
    announce(`일시정지. ${formatSpoken(getRemaining(state, now))} 남았습니다.`);
  } else {
    announce('다시 시작했습니다.');
  }
  render();
};

const doReset = () => {
  settle(Date.now());
  state = reset(state, settings);
  saveSession();
  el.message.textContent = '';
  announce(`${PHASE_LABELS[state.phase]}을 처음 시간으로 되돌렸습니다.`);
  render();
};

const doSkip = () => {
  if (settle(Date.now())) return;
  state = skip(state, settings);
  saveSession();
  el.message.textContent = '';
  announce(`${PHASE_LABELS[state.phase]}으로 넘어갔습니다.`);
  render();
};

el.toggle.addEventListener('click', doToggle);
el.reset.addEventListener('click', doReset);
el.skip.addEventListener('click', doSkip);

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const target = event.target;
  if (target instanceof Element && (IGNORED_TAGS.includes(target.tagName) || target.isContentEditable)) return;
  const actions = { ' ': doToggle, r: doReset, R: doReset, s: doSkip, S: doSkip };
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  action();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

// 설정 폼 -----------------------------------------------------------------
const fillForm = () => {
  NUMBER_FIELDS.forEach((name) => {
    el.form.elements.namedItem(name).value = String(settings[name]);
  });
  CHECK_FIELDS.forEach((name) => {
    el.form.elements.namedItem(name).checked = settings[name];
  });
};

const showErrors = (errors) => {
  NUMBER_FIELDS.forEach((name) => {
    const input = el.form.elements.namedItem(name);
    const error = input.closest('.settings__field').querySelector('.settings__error');
    const text = errors[name] ?? '';
    error.textContent = text;
    if (text) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  });
};

if (!notifySupported) {
  notifyBox.disabled = true;
  el.note.textContent = NOTIFY_UNSUPPORTED;
}

notifyBox.addEventListener('change', async () => {
  if (!notifyBox.checked) return;
  el.note.textContent = '';
  let result = 'denied';
  try {
    result = await Notification.requestPermission();
  } catch (error) {
    result = 'denied';
  }
  if (result !== 'granted') {
    notifyBox.checked = false;
    el.note.textContent = NOTIFY_DENIED;
  }
});

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  el.status.textContent = '';
  const values = {};
  NUMBER_FIELDS.forEach((name) => {
    values[name] = el.form.elements.namedItem(name).value;
  });
  CHECK_FIELDS.forEach((name) => {
    values[name] = el.form.elements.namedItem(name).checked;
  });
  const result = validateSettingsInput(values);
  showErrors(result.errors);
  if (!result.ok) return;
  const next = { ...result.settings };
  if (next.notify && !notifyGranted()) {
    next.notify = false;
    notifyBox.checked = false;
  }
  state = applySettings(state, settings, next);
  settings = next;
  store(KEYS.settings, { version: 1, ...settings });
  saveSession();
  renderHelp();
  render();
  el.status.textContent = '저장했습니다.';
});

// 시작 --------------------------------------------------------------------
const startUp = () => {
  const now = Date.now();
  const result = tick(state, settings, now);
  state = result.state;
  if (result.events.length > 0) handleEvents(result.events, now, true);
  fillForm();
  renderHelp();
  render();
  setInterval(render, 250);
};

startUp();
