import {
  SIZE,
  addRandomTile,
  canMove,
  createGame,
  hasWon,
  isValidBoard,
  move,
} from './game.js';
import { initThemeToggle } from './theme.js';

const BEST_KEY = 'game-2048:best';
const STATE_KEY = 'game-2048:state';
const SLIDE_MS = 100;
const SWIPE_MIN = 30;

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const els = {
  board: document.getElementById('board'),
  tileLayer: document.querySelector('.tile-layer'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  scoreAdd: document.querySelector('.score-add'),
  newGame: document.querySelector('.new-game'),
  overlay: document.querySelector('.overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayText: document.querySelector('.overlay-text'),
  overlayActions: document.querySelector('.overlay-actions'),
  announcer: document.getElementById('announcer'),
};

const state = {
  board: null,
  score: 0,
  best: 0,
  won: false,
  keepPlaying: false,
  over: false,
};

// 화면 타일: { id, row, col, value, el }
let tiles = [];
let nextTileId = 1;
// 진행 중인 애니메이션: { timer, removed, merges, spawn }
let pending = null;
let overlayMode = null;
let pointerStart = null;

function formatNumber(value) {
  return value.toLocaleString('ko-KR');
}

/* ---------- 저장 ---------- */

function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    // 저장 실패 시 메모리 값만 쓴다.
  }
}

function saveState() {
  const data = {
    board: state.board,
    score: state.score,
    won: state.won,
    keepPlaying: state.keepPlaying,
    over: state.over,
  };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(data));
  } catch {
    // 저장 실패는 조용히 넘어간다.
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw === null) {
      return null;
    }
    const data = JSON.parse(raw);
    if (
      data === null ||
      typeof data !== 'object' ||
      !isValidBoard(data.board) ||
      !Number.isSafeInteger(data.score) ||
      data.score < 0 ||
      typeof data.won !== 'boolean' ||
      typeof data.keepPlaying !== 'boolean' ||
      typeof data.over !== 'boolean'
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/* ---------- 알림 ---------- */

function announce(message) {
  els.announcer.textContent = '';
  requestAnimationFrame(() => {
    els.announcer.textContent = message;
  });
}

/* ---------- 점수판 ---------- */

function renderScores() {
  els.score.textContent = formatNumber(state.score);
  els.best.textContent = formatNumber(state.best);
}

function showScoreAdd(amount) {
  if (reducedMotion.matches) {
    return;
  }
  const el = els.scoreAdd;
  el.textContent = `+${formatNumber(amount)}`;
  el.classList.remove('is-active');
  // 같은 클래스를 다시 붙여도 애니메이션이 처음부터 돌도록 리플로를 일으킨다.
  void el.offsetWidth;
  el.classList.add('is-active');
}

/* ---------- 타일 렌더링 ---------- */

function createTileEl(row, col, value, extraClass) {
  const el = document.createElement('div');
  el.className = `tile digits-${Math.min(String(value).length, 5)}`;
  if (extraClass) {
    el.classList.add(extraClass);
  }
  el.dataset.value = value >= 4096 ? 'super' : String(value);
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--row', String(row));
  el.style.setProperty('--col', String(col));
  const inner = document.createElement('div');
  inner.className = 'tile-inner';
  inner.textContent = String(value);
  el.append(inner);
  return el;
}

function addTile(row, col, value, extraClass) {
  const el = createTileEl(row, col, value, extraClass);
  els.tileLayer.append(el);
  tiles.push({ id: nextTileId++, row, col, value, el });
}

function renderAll() {
  els.tileLayer.replaceChildren();
  tiles = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = state.board[row][col];
      if (value !== 0) {
        addTile(row, col, value);
      }
    }
  }
}

function tilesMatchBoard() {
  const seen = new Set();
  for (const tile of tiles) {
    const key = `${tile.row},${tile.col}`;
    if (seen.has(key) || state.board[tile.row][tile.col] !== tile.value) {
      return false;
    }
    seen.add(key);
  }
  const count = state.board.flat().filter((value) => value !== 0).length;
  return count === tiles.length;
}

function finishAnimation() {
  if (!pending) {
    return;
  }
  const { timer, removed, merges, spawn } = pending;
  pending = null;
  clearTimeout(timer);

  for (const tile of removed) {
    tile.el.remove();
  }
  tiles = tiles.filter((tile) => !removed.includes(tile));
  for (const merge of merges) {
    addTile(merge.row, merge.col, merge.value, 'tile-merged');
  }
  addTile(spawn.row, spawn.col, spawn.value, 'tile-new');

  // 안전장치: 화면과 상태가 어긋나면 통째로 다시 그린다.
  if (!tilesMatchBoard()) {
    renderAll();
  }
}

function animateMove(result, spawnTile) {
  const removed = [];
  const byPosition = new Map(tiles.map((tile) => [`${tile.row},${tile.col}`, tile]));
  for (const m of result.moves) {
    const tile = byPosition.get(`${m.from[0]},${m.from[1]}`);
    if (!tile) {
      continue;
    }
    tile.row = m.to[0];
    tile.col = m.to[1];
    tile.el.style.setProperty('--row', String(tile.row));
    tile.el.style.setProperty('--col', String(tile.col));
    if (m.merged) {
      removed.push(tile);
    }
  }

  pending = { timer: null, removed, merges: result.merges, spawn: spawnTile };
  if (reducedMotion.matches) {
    finishAnimation();
  } else {
    pending.timer = setTimeout(finishAnimation, SLIDE_MS);
  }
}

/* ---------- 오버레이 ---------- */

function overlayButtons() {
  return Array.from(els.overlayActions.querySelectorAll('button'));
}

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function openOverlay(mode) {
  overlayMode = mode;
  if (mode === 'win') {
    els.overlayTitle.textContent = '2048 달성!';
    els.overlayText.textContent = '계속해서 더 큰 숫자에 도전하거나 새 게임을 시작하세요.';
    els.overlayActions.replaceChildren(
      makeButton('계속하기', continueGame),
      makeButton('새 게임', () => startNewGame(true)),
    );
  } else {
    els.overlayTitle.textContent = '더 이상 움직일 수 없어요';
    els.overlayText.textContent = `최종 점수 ${formatNumber(state.score)}점`;
    els.overlayActions.replaceChildren(makeButton('다시 하기', () => startNewGame(true)));
  }
  els.overlay.hidden = false;
  overlayButtons()[0].focus();
}

function closeOverlay() {
  overlayMode = null;
  els.overlay.hidden = true;
  els.overlayActions.replaceChildren();
}

function continueGame() {
  state.keepPlaying = true;
  saveState();
  if (state.over) {
    openOverlay('lose');
    announce(`게임 오버. 최종 점수 ${formatNumber(state.score)}점.`);
    return;
  }
  closeOverlay();
  els.board.focus();
}

function trapFocus(event) {
  if (event.key !== 'Tab' || !overlayMode) {
    return;
  }
  const buttons = overlayButtons();
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  const index = buttons.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (index === -1 || index === buttons.length - 1)) {
    event.preventDefault();
    first.focus();
  }
}

/* ---------- 게임 흐름 ---------- */

function canAcceptInput() {
  return !state.over && !(state.won && !state.keepPlaying);
}

function startNewGame(fromOverlay) {
  finishAnimation();
  const game = createGame();
  state.board = game.board;
  state.score = 0;
  state.won = false;
  state.keepPlaying = false;
  state.over = false;
  closeOverlay();
  renderAll();
  renderScores();
  saveState();
  announce('새 게임을 시작했습니다.');
  if (fromOverlay) {
    els.newGame.focus();
  }
}

function handleMove(direction) {
  if (!canAcceptInput()) {
    return;
  }
  finishAnimation();

  const result = move(state.board, direction);
  if (!result.moved) {
    return;
  }
  const spawn = addRandomTile(result.board);
  state.board = spawn.board;
  state.score += result.scoreGained;

  let newBest = false;
  if (state.score > state.best) {
    state.best = state.score;
    newBest = true;
    saveBest();
  }
  renderScores();
  if (result.scoreGained > 0) {
    showScoreAdd(result.scoreGained);
  }

  animateMove(result, spawn.tile);

  let message = null;
  if (!state.won && hasWon(state.board)) {
    state.won = true;
    message = '2048 달성! 계속하기 또는 새 게임을 선택하세요.';
  }
  if (!canMove(state.board)) {
    state.over = true;
  }
  saveState();

  if (state.won && !state.keepPlaying) {
    openOverlay('win');
  } else if (state.over) {
    openOverlay('lose');
    message = `게임 오버. 최종 점수 ${formatNumber(state.score)}점.`;
  }

  if (message) {
    announce(message);
  } else if (result.scoreGained > 0) {
    const scoreText = `점수 ${formatNumber(state.score)}점`;
    announce(newBest ? `${scoreText}, 최고 기록` : scoreText);
  }
}

/* ---------- 입력 ---------- */

function onKeyDown(event) {
  trapFocus(event);
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = KEY_DIRECTIONS[key];
  if (!direction) {
    return;
  }
  event.preventDefault();
  handleMove(direction);
}

function onPointerDown(event) {
  if (!event.isPrimary) {
    return;
  }
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if (!pointerStart || event.pointerId !== pointerStart.id) {
    return;
  }
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) {
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    handleMove(dx > 0 ? 'right' : 'left');
  } else {
    handleMove(dy > 0 ? 'down' : 'up');
  }
}

function onPointerCancel() {
  pointerStart = null;
}

/* ---------- 시작 ---------- */

function init() {
  initThemeToggle();

  state.best = loadBest();
  const saved = loadState();
  if (saved) {
    state.board = saved.board;
    state.score = saved.score;
    state.won = saved.won;
    state.keepPlaying = saved.keepPlaying;
    // 저장된 플래그가 판과 어긋나면(손으로 고친 값 등) 판 기준으로 맞춘다. 막힌 판에서 오버레이 없이 멈추지 않게.
    state.over = !canMove(saved.board);
    if (state.score > state.best) {
      state.best = state.score;
      saveBest();
    }
    renderAll();
    renderScores();
    if (state.won && !state.keepPlaying) {
      openOverlay('win');
    } else if (state.over) {
      openOverlay('lose');
    }
  } else {
    const game = createGame();
    state.board = game.board;
    renderAll();
    renderScores();
    saveState();
  }

  document.addEventListener('keydown', onKeyDown);
  els.board.addEventListener('pointerdown', onPointerDown);
  els.board.addEventListener('pointerup', onPointerUp);
  els.board.addEventListener('pointercancel', onPointerCancel);
  els.newGame.addEventListener('click', () => startNewGame(false));
}

init();
