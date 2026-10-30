// 뽀모도로 타이머 순수 로직
// DOM·localStorage·실제 시계를 쓰지 않는다. 현재 시각(ms)은 항상 인자 now로 받는다.

export const PHASES = ['focus', 'short', 'long'];
export const PHASE_LABELS = { focus: '집중', short: '짧은 휴식', long: '긴 휴식' };
export const MAX_CATCH_UP = 8;

export const DEFAULT_SETTINGS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStart: false,
  sound: true,
  notify: false,
};

// 숫자 설정의 허용 범위
export const SETTING_RANGES = {
  focusMin: { min: 1, max: 90 },
  shortMin: { min: 1, max: 30 },
  longMin: { min: 1, max: 60 },
  longEvery: { min: 2, max: 8 },
};

const STATUSES = ['idle', 'running', 'paused'];
const BOOLEAN_KEYS = ['autoStart', 'sound', 'notify'];
const MINUTE_KEYS = { focus: 'focusMin', short: 'shortMin', long: 'longMin' };

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inRange = (value, { min, max }) =>
  Number.isInteger(value) && value >= min && value <= max;

export const durationMs = (phase, settings) => settings[MINUTE_KEYS[phase]] * 60_000;

// 진행 중에 설정을 바꾸면 현재 단계는 원래 길이를 유지한다(다음 단계부터 적용).
// 그때만 상태에 lengthMs(현재 단계의 원래 길이)가 붙는다. 없으면 설정값이 곧 단계 길이다.
export const phaseLength = (state, settings) => state.lengthMs ?? durationMs(state.phase, settings);

const withoutLength = ({ lengthMs, ...rest }) => rest;

// 단계별로 설정에서 나올 수 있는 길이인지(1분 단위, 범위 안)
const isPossibleLength = (phase, ms) =>
  Number.isInteger(ms) && ms % 60_000 === 0 && inRange(ms / 60_000, SETTING_RANGES[MINUTE_KEYS[phase]]);

export const createState = (settings) => ({
  phase: 'focus',
  status: 'idle',
  endsAt: null,
  remainingMs: durationMs('focus', settings),
  cycleCount: 0,
});

export const getRemaining = (state, now) =>
  state.status === 'running' ? Math.max(0, state.endsAt - now) : state.remainingMs;

export const start = (state, now) => {
  if (state.status === 'running') return state;
  return { ...state, status: 'running', endsAt: now + state.remainingMs };
};

export const pause = (state, now) => {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', remainingMs: getRemaining(state, now), endsAt: null };
};

export const toggle = (state, now) =>
  state.status === 'running' ? pause(state, now) : start(state, now);

export const reset = (state, settings) => ({
  ...withoutLength(state),
  status: 'idle',
  endsAt: null,
  remainingMs: durationMs(state.phase, settings),
});

export const nextPhase = (state, settings, completed) => {
  if (state.phase === 'focus') {
    const cycleCount = completed ? state.cycleCount + 1 : state.cycleCount;
    const phase = completed && cycleCount >= settings.longEvery ? 'long' : 'short';
    return { phase, cycleCount };
  }
  if (state.phase === 'long') return { phase: 'focus', cycleCount: 0 };
  return { phase: 'focus', cycleCount: state.cycleCount };
};

const idleAt = (phase, cycleCount, settings) => ({
  phase,
  status: 'idle',
  endsAt: null,
  remainingMs: durationMs(phase, settings),
  cycleCount,
});

export const skip = (state, settings) => {
  const { phase, cycleCount } = nextPhase(state, settings, false);
  return idleAt(phase, cycleCount, settings);
};

export const tick = (state, settings, now) => {
  const events = [];
  let current = state;
  for (let i = 0; i < MAX_CATCH_UP; i += 1) {
    if (current.status !== 'running' || now < current.endsAt) break;
    const completedAt = current.endsAt;
    events.push({ phase: current.phase, completedAt });
    const { phase, cycleCount } = nextPhase(current, settings, true);
    if (settings.autoStart) {
      const length = durationMs(phase, settings);
      current = { phase, cycleCount, status: 'running', endsAt: completedAt + length, remainingMs: length };
    } else {
      current = idleAt(phase, cycleCount, settings);
    }
  }
  // 따라잡기 상한을 넘겼으면 현재 단계를 대기 상태로 둔다.
  if (current.status === 'running' && now >= current.endsAt) {
    current = { ...current, status: 'idle', endsAt: null, remainingMs: durationMs(current.phase, settings) };
  }
  return { state: current, events };
};

export const applySettings = (state, oldSettings, newSettings) => {
  const original = phaseLength(state, oldSettings);
  const newLength = durationMs(state.phase, newSettings);
  const next = withoutLength(state);
  if (state.status === 'idle' && state.remainingMs === original) {
    next.remainingMs = newLength;
  } else if (original !== newLength) {
    // 현재 단계는 원래 길이 그대로 둔다. 진행 링과 저장값 검증이 이 길이를 기준으로 한다.
    next.lengthMs = original;
  }
  if (next.phase === 'focus' && next.cycleCount >= newSettings.longEvery) {
    next.cycleCount = newSettings.longEvery - 1;
  } else if (next.cycleCount > newSettings.longEvery) {
    // 휴식 단계에서도 저장 검증 범위(0 ~ longEvery)를 벗어나지 않게 맞춘다.
    next.cycleCount = newSettings.longEvery;
  }
  return next;
};

export const formatTime = (ms) => {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const formatSpoken = (ms) => {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec}초`;
};

export const progress = (state, settings, now) => {
  const ratio = 1 - getRemaining(state, now) / phaseLength(state, settings);
  return Math.min(1, Math.max(0, ratio));
};

export const dateKey = (now, tzOffsetMin) => {
  const local = new Date(now - tzOffsetMin * 60_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addCompletion = (today, completedAt, tzOffsetMin) => {
  const key = dateKey(completedAt, tzOffsetMin);
  if (today.date === key) return { date: key, count: Math.min(999, today.count + 1) };
  return { date: key, count: 1 };
};

export const getTodayCount = (today, now, tzOffsetMin) =>
  today.date === dateKey(now, tzOffsetMin) ? today.count : 0;

export const parseSettings = (raw) => {
  const settings = { ...DEFAULT_SETTINGS };
  if (!isPlainObject(raw) || raw.version !== 1) return settings;
  Object.keys(SETTING_RANGES).forEach((key) => {
    if (inRange(raw[key], SETTING_RANGES[key])) settings[key] = raw[key];
  });
  BOOLEAN_KEYS.forEach((key) => {
    if (typeof raw[key] === 'boolean') settings[key] = raw[key];
  });
  return settings;
};

export const parseToday = (raw) => {
  const empty = { date: '', count: 0 };
  if (!isPlainObject(raw)) return empty;
  const { date, count } = raw;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return empty;
  if (!inRange(count, { min: 0, max: 999 })) return empty;
  return { date, count };
};

export const parseSession = (raw, settings, now) => {
  if (!isPlainObject(raw) || raw.version !== 1) return null;
  const { phase, status, endsAt, remainingMs, cycleCount } = raw;
  if (!PHASES.includes(phase) || !STATUSES.includes(status)) return null;
  if (!inRange(cycleCount, { min: 0, max: settings.longEvery })) return null;
  // lengthMs는 진행 중 설정을 바꿨을 때만 저장된다. 있으면 그 길이로 검증한다.
  const hasLength = raw.lengthMs !== undefined;
  if (hasLength && !isPossibleLength(phase, raw.lengthMs)) return null;
  const length = hasLength ? raw.lengthMs : durationMs(phase, settings);
  if (!inRange(remainingMs, { min: 0, max: length })) return null;
  if (status === 'running') {
    if (!Number.isInteger(endsAt) || endsAt > now + length) return null;
  } else {
    if (endsAt !== null || remainingMs === 0) return null;
  }
  const state = { phase, status, endsAt, remainingMs, cycleCount };
  if (hasLength && length !== durationMs(phase, settings)) state.lengthMs = length;
  return state;
};

export const toSession = (state) => {
  const session = {
    version: 1,
    phase: state.phase,
    status: state.status,
    endsAt: state.endsAt,
    remainingMs: state.remainingMs,
    cycleCount: state.cycleCount,
  };
  if (state.lengthMs !== undefined) session.lengthMs = state.lengthMs;
  return session;
};

export const validateSettingsInput = (values) => {
  const errors = {};
  const settings = {};
  Object.keys(SETTING_RANGES).forEach((key) => {
    const range = SETTING_RANGES[key];
    const text = typeof values[key] === 'string' ? values[key].trim() : '';
    const number = /^\d+$/.test(text) ? Number.parseInt(text, 10) : NaN;
    if (inRange(number, range)) {
      settings[key] = number;
    } else {
      errors[key] = `${range.min}~${range.max} 사이의 정수를 입력하세요.`;
    }
  });
  BOOLEAN_KEYS.forEach((key) => {
    settings[key] = values[key] === true;
  });
  const ok = Object.keys(errors).length === 0;
  return { ok, settings: ok ? settings : null, errors };
};
