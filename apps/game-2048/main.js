// 2048 진입점: 상태 관리, 렌더링, 입력(키보드·스와이프), 저장소, 테마 동기화, aria-live.
import {
  SIZE,
  WIN_VALUE,
  addRandomTile,
  canMove,
  createGame,
  hasWon,
  isValidBoard,
  move,
} from './game.js';

const BEST_KEY = 'game-2048:best';
const STATE_KEY = 'game-2048:state';
const THEME_KEY = 'theme';
const SWIPE_MIN = 30;
const MOVE_MS = 100;

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

// 한글 입력 상태에서는 event.key가 'Process'나 'ㅈ' 등으로 오므로, 물리 키 위치(event.code)로 WASD를 보완한다.
const CODE_DIRECTIONS = {
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right',
};

const els = {
  board: document.getElementById('board'),
  layer: document.getElementById('tile-layer'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  scorePlus: document.getElementById('score-plus'),
  newGame: document.getElementById('new-game'),
  winOverlay: document.getElementById('win-overlay'),
  overOverlay: document.getElementById('over-overlay'),
  continueButton: document.getElementById('continue-button'),
  winNewGame: document.getElementById('win-new-game'),
  retryButton: document.getElementById('retry-button'),
  finalScore: document.getElementById('final-score'),
  announcer: document.getElementById('announcer'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

const state = {
  board: null,
  score: 0,
  best: 0,
  won: false,
  keepPlaying: false,
  over: false,
};

// 화면에 그려진 타일: { id, row, col, value, el }
let tiles = [];
let nextTileId = 1;
// 이동 애니메이션 후 처리(합치기·생성)가 남아 있으면 { timer, finish }
let pending = null;
let announceFrame = 0;
let swipe = null;

/* ---------------------------------------------------------------------------
   저장소 (모든 접근은 try/catch)
   ------------------------------------------------------------------------ */

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    // 저장 실패 시 메모리 값만 쓴다.
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    // 무시한다.
  }
}

function loadBest() {
  const raw = storageGet(BEST_KEY);
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return 0;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : 0;
}

function saveState() {
  const data = {
    board: state.board,
    score: state.score,
    won: state.won,
    keepPlaying: state.keepPlaying,
  };
  storageSet(STATE_KEY, JSON.stringify(data));
}

function clearSavedState() {
  storageRemove(STATE_KEY);
}

function loadSavedState() {
  const raw = storageGet(STATE_KEY);
  if (raw === null) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    clearSavedState();
    return null;
  }
  const valid = data !== null
    && typeof data === 'object'
    && isValidBoard(data.board)
    && Number.isSafeInteger(data.score)
    && data.score >= 0
    && typeof data.won === 'boolean'
    && typeof data.keepPlaying === 'boolean';
  if (!valid || !canMove(data.board)) {
    clearSavedState();
    return null;
  }
  return {
    board: data.board.map((row) => row.slice()),
    score: data.score,
    won: data.won,
    keepPlaying: data.keepPlaying,
  };
}

/* ---------------------------------------------------------------------------
   알림 (aria-live)
   ------------------------------------------------------------------------ */

function announce(message) {
  cancelAnimationFrame(announceFrame);
  els.announcer.textContent = '';
  announceFrame = requestAnimationFrame(() => {
    els.announcer.textContent = message;
  });
}

/* ---------------------------------------------------------------------------
   점수
   ------------------------------------------------------------------------ */

function renderScores() {
  els.score.textContent = String(state.score);
  els.best.textContent = String(state.best);
}

function showScorePlus(amount) {
  const el = els.scorePlus;
  el.textContent = `+${amount}`;
  el.classList.remove('is-active');
  // 애니메이션을 처음부터 다시 시작하기 위해 리플로우를 일으킨다.
  void el.offsetWidth;
  el.classList.add('is-active');
}

// 최고 점수를 갱신했으면 true
function updateBest() {
  if (state.score > state.best) {
    state.best = state.score;
    storageSet(BEST_KEY, String(state.best));
    return true;
  }
  return false;
}

/* ---------------------------------------------------------------------------
   타일 렌더링
   ------------------------------------------------------------------------ */

function setTilePosition(el, row, col) {
  el.style.setProperty('--row', String(row));
  el.style.setProperty('--col', String(col));
}

function setTileValue(el, value) {
  const digits = String(value).length;
  el.dataset.value = String(value);
  el.textContent = String(value);
  el.classList.toggle('tile-super', value > WIN_VALUE);
  el.classList.toggle('digits-3', digits === 3);
  el.classList.toggle('digits-4', digits === 4);
  el.classList.toggle('digits-5', digits >= 5);
}

function addTile(row, col, value, effectClass) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.setAttribute('aria-hidden', 'true');
  if (effectClass) {
    el.classList.add(effectClass);
  }
  setTileValue(el, value);
  setTilePosition(el, row, col);
  els.layer.appendChild(el);
  const tile = { id: nextTileId, row, col, value, el };
  nextTileId += 1;
  tiles.push(tile);
  return tile;
}

function redrawAll(effectClass) {
  els.layer.textContent = '';
  tiles = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = state.board[row][col];
      if (value !== 0) {
        addTile(row, col, value, effectClass);
      }
    }
  }
}

// 화면 타일이 실제 판과 다르면 통째로 다시 그린다(안전장치).
function ensureInSync() {
  const grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
  let duplicate = false;
  tiles.forEach((tile) => {
    if (grid[tile.row][tile.col] !== 0) {
      duplicate = true;
    }
    grid[tile.row][tile.col] = tile.value;
  });
  const same = !duplicate && grid.every((row, r) => row.every((v, c) => v === state.board[r][c]));
  if (!same) {
    redrawAll();
  }
}

function finishPending() {
  if (pending) {
    clearTimeout(pending.timer);
    const { finish } = pending;
    pending = null;
    finish();
  }
}

function cancelPending() {
  if (pending) {
    clearTimeout(pending.timer);
    pending = null;
  }
}

function animateTurn(result, spawnTile) {
  const byPosition = new Map();
  tiles.forEach((tile) => {
    byPosition.set(`${tile.row},${tile.col}`, tile);
  });

  const removed = [];
  result.moves.forEach((m) => {
    const tile = byPosition.get(`${m.from[0]},${m.from[1]}`);
    if (!tile) {
      return;
    }
    tile.row = m.to[0];
    tile.col = m.to[1];
    setTilePosition(tile.el, tile.row, tile.col);
    if (m.merged) {
      removed.push(tile);
    }
  });

  const finish = () => {
    if (removed.length > 0) {
      const removedIds = new Set(removed.map((tile) => tile.id));
      removed.forEach((tile) => tile.el.remove());
      tiles = tiles.filter((tile) => !removedIds.has(tile.id));
    }
    result.merges.forEach(({ row, col, value }) => {
      addTile(row, col, value, 'tile-merged');
    });
    if (spawnTile) {
      addTile(spawnTile.row, spawnTile.col, spawnTile.value, 'tile-new');
    }
    ensureInSync();
  };

  if (reducedMotion.matches) {
    finish();
  } else {
    pending = { timer: setTimeout(() => { pending = null; finish(); }, MOVE_MS), finish };
  }
}

/* ---------------------------------------------------------------------------
   오버레이
   ------------------------------------------------------------------------ */

function openOverlay() {
  if (!els.winOverlay.hidden) {
    return els.winOverlay;
  }
  if (!els.overOverlay.hidden) {
    return els.overOverlay;
  }
  return null;
}

function overlayButtons(overlay) {
  return Array.from(overlay.querySelectorAll('button'));
}

function showOverlay(overlay) {
  els.winOverlay.hidden = overlay !== els.winOverlay;
  els.overOverlay.hidden = overlay !== els.overOverlay;
  overlayButtons(overlay)[0].focus();
}

function hideOverlays(returnFocus) {
  const wasOpen = openOverlay() !== null;
  els.winOverlay.hidden = true;
  els.overOverlay.hidden = true;
  if (wasOpen && returnFocus) {
    els.board.focus();
  }
}

function showWin() {
  showOverlay(els.winOverlay);
}

function showOver() {
  els.finalScore.textContent = String(state.score);
  showOverlay(els.overOverlay);
}

function trapFocus(event) {
  const overlay = openOverlay();
  if (!overlay || event.key !== 'Tab') {
    return;
  }
  const buttons = overlayButtons(overlay);
  const index = buttons.indexOf(document.activeElement);
  event.preventDefault();
  let next;
  if (event.shiftKey) {
    next = index <= 0 ? buttons.length - 1 : index - 1;
  } else {
    next = index === -1 || index === buttons.length - 1 ? 0 : index + 1;
  }
  buttons[next].focus();
}

/* ---------------------------------------------------------------------------
   게임 흐름
   ------------------------------------------------------------------------ */

function canAcceptInput() {
  return !state.over && !(state.won && !state.keepPlaying);
}

function startNewGame({ announceStart = true, returnFocus = false } = {}) {
  cancelPending();
  const game = createGame();
  state.board = game.board;
  state.score = 0;
  state.won = false;
  state.keepPlaying = false;
  state.over = false;
  hideOverlays(returnFocus);
  redrawAll('tile-new');
  renderScores();
  saveState();
  if (announceStart) {
    announce('새 게임을 시작했습니다.');
  }
}

function handleMove(direction) {
  if (!canAcceptInput()) {
    return;
  }
  finishPending();

  const result = move(state.board, direction);
  if (!result.moved) {
    return;
  }

  const spawn = addRandomTile(result.board);
  state.board = spawn ? spawn.board : result.board;
  state.score += result.scoreGained;
  const newBest = updateBest();
  renderScores();
  if (result.scoreGained > 0) {
    showScorePlus(result.scoreGained);
  }

  animateTurn(result, spawn ? spawn.tile : null);

  let justWon = false;
  if (!state.won && hasWon(state.board)) {
    state.won = true;
    justWon = true;
  }
  if (!canMove(state.board)) {
    state.over = true;
  }

  if (state.over) {
    clearSavedState();
  } else {
    saveState();
  }

  if (justWon) {
    showWin();
    announce('2048 달성! 계속하려면 계속하기 버튼을 누르세요.');
  } else if (state.over) {
    showOver();
    announce(`게임 오버. 최종 점수 ${state.score}점.`);
  } else if (result.scoreGained > 0) {
    announce(newBest ? `점수 ${state.score}점, 최고 기록` : `점수 ${state.score}점`);
  }
}

function continueGame() {
  state.keepPlaying = true;
  if (state.over) {
    showOver();
    announce(`게임 오버. 최종 점수 ${state.score}점.`);
    return;
  }
  saveState();
  hideOverlays(true);
}

/* ---------------------------------------------------------------------------
   입력
   ------------------------------------------------------------------------ */

function onKeyDown(event) {
  if (event.key === 'Tab') {
    trapFocus(event);
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = KEY_DIRECTIONS[key] || CODE_DIRECTIONS[event.code];
  if (!direction) {
    return;
  }
  if (key.startsWith('Arrow')) {
    event.preventDefault();
  }
  handleMove(direction);
}

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  if (event.target instanceof Element && event.target.closest('.overlay')) {
    return;
  }
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if (!swipe || event.pointerId !== swipe.id) {
    return;
  }
  const dx = event.clientX - swipe.x;
  const dy = event.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) {
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    handleMove(dx > 0 ? 'right' : 'left');
  } else {
    handleMove(dy > 0 ? 'down' : 'up');
  }
}

function onPointerCancel(event) {
  if (swipe && event.pointerId === swipe.id) {
    swipe = null;
  }
}

// 오버레이가 열린 동안 포커스가 바깥으로 나가면 오버레이 첫 버튼으로 되돌린다.
function onFocusIn(event) {
  const overlay = openOverlay();
  if (overlay && !overlay.contains(event.target)) {
    overlayButtons(overlay)[0].focus();
  }
}

/* ---------------------------------------------------------------------------
   테마 동기화 (블로그와 같은 규칙, 읽기 전용)
   ------------------------------------------------------------------------ */

function storedTheme() {
  const theme = storageGet(THEME_KEY);
  return theme === 'light' || theme === 'dark' ? theme : null;
}

function applyTheme() {
  const theme = storedTheme() || (darkScheme.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
}

function initTheme() {
  applyTheme();
  darkScheme.addEventListener('change', () => {
    if (!storedTheme()) {
      applyTheme();
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      applyTheme();
    }
  });
}

/* ---------------------------------------------------------------------------
   초기화
   ------------------------------------------------------------------------ */

function init() {
  initTheme();
  state.best = loadBest();

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('focusin', onFocusIn);
  els.board.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  els.newGame.addEventListener('click', () => startNewGame());
  els.winNewGame.addEventListener('click', () => startNewGame({ returnFocus: true }));
  els.retryButton.addEventListener('click', () => startNewGame({ returnFocus: true }));
  els.continueButton.addEventListener('click', continueGame);

  const saved = loadSavedState();
  if (saved) {
    state.board = saved.board;
    state.score = saved.score;
    state.won = saved.won;
    state.keepPlaying = saved.keepPlaying;
    state.over = false;
    // 저장된 점수가 최고 점수보다 높으면(최고 점수 저장 실패 등) 맞춰 둔다.
    updateBest();
    redrawAll();
    renderScores();
    if (state.won && !state.keepPlaying) {
      showWin();
    }
  } else {
    startNewGame({ announceStart: false });
  }
}

init();
