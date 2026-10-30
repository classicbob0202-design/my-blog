// 2048 진입점: 상태, 화면 그리기, 입력, 저장, 알림
import {
  addRandomTile,
  canMove,
  createGame,
  describeBoard,
  getMaxTile,
  hasWon,
  move,
  parseSavedGame,
  serializeGame,
} from './game.js';
import { addRecord, formatDate, parseBest, parseRecords, toDateString } from './scores.js';
import { KEYS, readItem, writeItem } from './storage.js';

const SLIDE_MS = 100;
const SWIPE_MIN = 30;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const KEY_DIRECTIONS = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
};

const TEXT = {
  confirmNewGame: "진행 중인 판을 끝내고 새 게임을 시작할까요? 지금 점수는 기록판에 '중단'으로 남아요.",
  confirmReset: '기록판의 기록을 모두 지울까요? 최고 점수는 그대로 남아요.',
  newGame: '새 게임을 시작했어요.',
  reset: '기록을 지웠어요.',
  winTitle: '2048 달성!',
  winText: '계속해서 더 높은 점수에 도전할 수 있어요.',
  winAnnounce: '2048 달성! 계속하기 또는 새 게임을 고르세요.',
  loseTitle: '더 이상 움직일 수 없어요',
};

const els = {
  board: document.querySelector('.game-board'),
  tiles: document.querySelector('.game-board__tiles'),
  score: document.getElementById('score-value'),
  best: document.getElementById('best-value'),
  gain: document.querySelector('.score-box__gain'),
  newGame: document.getElementById('new-game'),
  readBoard: document.getElementById('read-board'),
  message: document.querySelector('.game-message'),
  messageTitle: document.getElementById('game-message-title'),
  messageText: document.getElementById('game-message-text'),
  messageActions: document.querySelector('.game-message__actions'),
  recordsList: document.querySelector('.records__list'),
  recordsEmpty: document.querySelector('.records__empty'),
  recordsReset: document.querySelector('.records__reset'),
  announcer: document.getElementById('announcer'),
};

const state = {
  id: '',
  board: [],
  score: 0,
  best: 0,
  won: false,
  keepPlaying: false,
  over: false,
  records: [],
  latestRecordId: null,
  bestAnnounced: false,
  maxTileSeen: 0,
};

// 화면 타일 목록과 진행 중 애니메이션
let views = [];
let nextViewId = 1;
let pending = null;
let pendingTimer = 0;
let messageType = null; // 'win' | 'lose' | null
let pointer = null;

const formatNumber = (value) => value.toLocaleString('ko-KR');

const createGameId = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const canPlay = () => !state.over && !(state.won && !state.keepPlaying) && messageType === null;

/* ---------- 저장 ---------- */

const saveState = () => {
  writeItem(KEYS.state, serializeGame(state));
};

const saveBest = () => {
  writeItem(KEYS.best, String(state.best));
};

const saveRecords = () => {
  writeItem(KEYS.records, JSON.stringify(state.records));
};

/* ---------- 알림 ---------- */

const announce = (message) => {
  els.announcer.textContent = '';
  requestAnimationFrame(() => {
    els.announcer.textContent = message;
  });
};

/* ---------- 점수판 ---------- */

const renderScores = () => {
  els.score.textContent = formatNumber(state.score);
  els.best.textContent = formatNumber(state.best);
};

const showGain = (amount) => {
  if (amount <= 0 || reducedMotion.matches) return;
  els.gain.textContent = `+${formatNumber(amount)}`;
  els.gain.classList.remove('score-box__gain--show');
  // 같은 효과를 다시 시작하려고 레이아웃을 한 번 계산시킨다.
  void els.gain.offsetWidth;
  els.gain.classList.add('score-box__gain--show');
};

els.gain.addEventListener('animationend', () => {
  els.gain.classList.remove('score-box__gain--show');
  els.gain.textContent = '';
});

/* ---------- 타일 ---------- */

const setViewPosition = (view) => {
  view.el.style.setProperty('--row', view.row);
  view.el.style.setProperty('--col', view.col);
};

const createView = (value, row, col, effect) => {
  const el = document.createElement('div');
  const valueClass = value >= 4096 ? 'game-board__tile--super' : `game-board__tile--v${value}`;
  const digits = Math.min(String(value).length, 6);
  el.className = `game-board__tile ${valueClass} game-board__tile--digits-${digits}`;
  if (effect) el.classList.add(`game-board__tile--${effect}`);
  el.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('div');
  inner.className = 'game-board__tile-inner';
  inner.textContent = String(value);
  el.append(inner);

  const view = { id: nextViewId, row, col, value, el, mergedAway: false };
  nextViewId += 1;
  setViewPosition(view);
  els.tiles.append(el);
  return view;
};

// 타일 층을 state.board 그대로 통째로 다시 그린다.
const renderBoard = (effect = null) => {
  els.tiles.replaceChildren();
  views = [];
  state.board.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) views.push(createView(value, r, c, effect));
    });
  });
};

const viewsMatchBoard = () => {
  const grid = state.board.map((row) => row.map(() => 0));
  for (const view of views) {
    if (grid[view.row][view.col] !== 0) return false;
    grid[view.row][view.col] = view.value;
  }
  return grid.every((row, r) => row.every((value, c) => value === state.board[r][c]));
};

// 진행 중 애니메이션을 즉시 최종 상태로 맞춘다.
const finishAnimation = () => {
  if (!pending) return;
  clearTimeout(pendingTimer);
  const { merges, spawn } = pending;
  pending = null;

  views = views.filter((view) => {
    if (!view.mergedAway) return true;
    view.el.remove();
    return false;
  });
  merges.forEach(({ row, col, value }) => {
    views.push(createView(value, row, col, 'merged'));
  });
  if (spawn) views.push(createView(spawn.value, spawn.row, spawn.col, 'new'));

  // 안전장치: 화면과 상태가 어긋나면 통째로 다시 그린다.
  if (!viewsMatchBoard()) renderBoard();
};

const animateMove = (result, spawn) => {
  const byPosition = new Map(views.map((view) => [`${view.row},${view.col}`, view]));
  result.moves.forEach(({ from, to, merged }) => {
    const view = byPosition.get(`${from[0]},${from[1]}`);
    if (!view) return;
    view.row = to[0];
    view.col = to[1];
    view.mergedAway = merged;
    setViewPosition(view);
  });

  pending = { merges: result.merges, spawn };
  if (reducedMotion.matches) {
    finishAnimation();
  } else {
    pendingTimer = setTimeout(finishAnimation, SLIDE_MS);
  }
};

/* ---------- 기록판 ---------- */

const renderRecords = () => {
  const items = state.records.map((record, index) => {
    const item = document.createElement('li');
    item.className = 'records__item';
    if (record.id === state.latestRecordId) item.classList.add('records__item--latest');

    const rank = document.createElement('span');
    rank.className = 'records__rank';
    rank.textContent = String(index + 1);
    const rankSuffix = document.createElement('span');
    rankSuffix.className = 'visually-hidden';
    rankSuffix.textContent = '위,';
    rank.append(rankSuffix);

    const score = document.createElement('span');
    score.className = 'records__score';
    score.textContent = `${formatNumber(record.score)}점`;

    item.append(rank, score);

    if (record.ended === 'quit') {
      const badge = document.createElement('span');
      badge.className = 'records__badge';
      badge.textContent = '중단';
      item.append(badge);
    }

    const meta = document.createElement('span');
    meta.className = 'records__meta';
    meta.textContent = `최고 타일 ${record.maxTile} · ${formatDate(record.date)}`;
    item.append(meta);
    return item;
  });

  els.recordsList.replaceChildren(...items);
  const isEmpty = items.length === 0;
  els.recordsList.hidden = isEmpty;
  els.recordsEmpty.hidden = !isEmpty;
  els.recordsReset.disabled = isEmpty;
};

// 지금 판을 기록판에 남긴다. 기록판 순위(없으면 null)를 돌려준다.
const recordGame = (ended) => {
  if (state.score <= 0) return null;
  const existed = state.records.some((record) => record.id === state.id);
  const { records, rank } = addRecord(state.records, {
    id: state.id,
    score: state.score,
    maxTile: getMaxTile(state.board),
    date: toDateString(new Date()),
    ended,
  });
  if (!existed) {
    state.records = records;
    if (rank !== null) state.latestRecordId = state.id;
    saveRecords();
    renderRecords();
  }
  return rank;
};

const findRank = () => {
  const index = state.records.findIndex((record) => record.id === state.id);
  return index === -1 ? null : index + 1;
};

/* ---------- 메시지 ---------- */

const createMessageButton = (label, variant, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button--${variant}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const getMessageButtons = () => Array.from(els.messageActions.querySelectorAll('button'));

const hideMessage = () => {
  messageType = null;
  els.message.hidden = true;
  els.messageActions.replaceChildren();
};

const loseText = (rank) => {
  const base = `최종 점수 ${formatNumber(state.score)}점`;
  return rank === null ? base : `${base} · 기록판 ${rank}위`;
};

const loseAnnouncement = (rank) => {
  const base = `게임 오버. 최종 점수 ${formatNumber(state.score)}점.`;
  return rank === null ? base : `${base} 기록판 ${rank}위.`;
};

const showMessage = (type, rank = null) => {
  messageType = type;
  els.messageActions.replaceChildren();

  if (type === 'win') {
    els.messageTitle.textContent = TEXT.winTitle;
    els.messageText.textContent = TEXT.winText;
    els.messageActions.append(
      createMessageButton('계속하기', 'primary', continueAfterWin),
      createMessageButton('새 게임', 'secondary', () => {
        startNewGame({ confirmQuit: false });
        els.newGame.focus();
      }),
    );
  } else {
    els.messageTitle.textContent = TEXT.loseTitle;
    els.messageText.textContent = loseText(rank);
    els.messageActions.append(
      createMessageButton('다시 하기', 'primary', () => {
        startNewGame({ confirmQuit: false });
        els.newGame.focus();
      }),
    );
  }

  els.message.hidden = false;
  getMessageButtons()[0].focus();
};

function continueAfterWin() {
  state.keepPlaying = true;
  saveState();
  hideMessage();
  if (state.over) {
    // 같은 이동에서 패배도 성립했다. 기록은 그 이동에서 이미 했다.
    const rank = findRank();
    showMessage('lose', rank);
    announce(loseAnnouncement(rank));
    return;
  }
  els.board.focus();
}

/* ---------- 게임 진행 ---------- */

function startNewGame({ confirmQuit }) {
  const inProgress = state.score > 0 && !state.over;
  if (inProgress && confirmQuit && !window.confirm(TEXT.confirmNewGame)) return;
  if (inProgress) recordGame('quit');

  finishAnimation();
  const game = createGame(Math.random);
  state.id = createGameId();
  state.board = game.board;
  state.score = 0;
  state.won = false;
  state.keepPlaying = false;
  state.over = false;
  state.bestAnnounced = false;
  state.maxTileSeen = getMaxTile(game.board);
  state.latestRecordId = null;

  hideMessage();
  saveState();
  renderScores();
  renderRecords();
  renderBoard('new');
  announce(TEXT.newGame);
}

const handleMove = (direction) => {
  if (!canPlay()) return;
  finishAnimation();

  const result = move(state.board, direction);
  if (!result.moved) return;

  const spawn = addRandomTile(result.board, Math.random);
  state.board = spawn.board;
  state.score += result.scoreGained;

  let bestMessage = null;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest();
    if (!state.bestAnnounced) {
      state.bestAnnounced = true;
      bestMessage = `최고 점수 갱신! 지금 ${formatNumber(state.score)}점.`;
    }
  }

  let tileMessage = null;
  const maxTile = getMaxTile(state.board);
  if (maxTile > state.maxTileSeen) {
    state.maxTileSeen = maxTile;
    if (maxTile >= 128) tileMessage = `${maxTile} 타일을 만들었어요.`;
  }

  renderScores();
  showGain(result.scoreGained);

  const justWon = !state.won && hasWon(state.board);
  if (justWon) state.won = true;

  let rank = null;
  if (!canMove(state.board)) {
    state.over = true;
    rank = recordGame('over');
  }

  saveState();
  animateMove(result, spawn.tile);

  if (justWon) {
    showMessage('win');
    announce(TEXT.winAnnounce);
  } else if (state.over) {
    showMessage('lose', rank);
    announce(loseAnnouncement(rank));
  } else if (bestMessage) {
    announce(bestMessage);
  } else if (tileMessage) {
    announce(tileMessage);
  }
};

const resetRecords = () => {
  if (state.records.length === 0) return;
  if (!window.confirm(TEXT.confirmReset)) return;
  state.records = [];
  state.latestRecordId = null;
  saveRecords();
  renderRecords();
  announce(TEXT.reset);
};

/* ---------- 입력 ---------- */

const trapFocus = (event) => {
  const buttons = getMessageButtons();
  if (buttons.length === 0) return;
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  const inside = buttons.includes(document.activeElement);
  if (event.shiftKey) {
    if (!inside || document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (!inside || document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && messageType !== null) {
    trapFocus(event);
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
  if (!direction || messageType !== null) return;
  event.preventDefault();
  handleMove(direction);
});

els.board.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) return;
  if (event.target.closest('.game-message')) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  try {
    els.board.setPointerCapture(event.pointerId);
  } catch (error) {
    // 캡처하지 못해도 판 위에서 손을 떼면 스와이프는 그대로 동작한다.
  }
});

els.board.addEventListener('pointerup', (event) => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  if (Math.abs(dx) >= Math.abs(dy)) {
    handleMove(dx > 0 ? 'right' : 'left');
  } else {
    handleMove(dy > 0 ? 'down' : 'up');
  }
});

els.board.addEventListener('pointercancel', () => {
  pointer = null;
});

els.newGame.addEventListener('click', () => {
  startNewGame({ confirmQuit: true });
});

els.readBoard.addEventListener('click', () => {
  announce(`${describeBoard(state.board)} 점수 ${formatNumber(state.score)}점.`);
});

els.recordsReset.addEventListener('click', resetRecords);

/* ---------- 시작 ---------- */

const init = () => {
  state.best = parseBest(readItem(KEYS.best));
  state.records = parseRecords(readItem(KEYS.records));

  const saved = parseSavedGame(readItem(KEYS.state));
  if (saved) {
    Object.assign(state, saved);
  } else {
    const game = createGame(Math.random);
    Object.assign(state, {
      id: createGameId(),
      board: game.board,
      score: 0,
      won: false,
      keepPlaying: false,
      over: false,
    });
    saveState();
  }

  // 불러온 점수나 기록판 1위가 최고 점수보다 크면 맞춘다.
  const topRecord = state.records.length > 0 ? state.records[0].score : 0;
  const best = Math.max(state.best, state.score, topRecord);
  if (best > state.best) {
    state.best = best;
    saveBest();
  }

  state.bestAnnounced = state.score > 0 && state.score === state.best;
  state.maxTileSeen = getMaxTile(state.board);
  state.latestRecordId = null;

  renderScores();
  renderRecords();
  renderBoard();

  // 불러온 판이 끝난 상태면 메시지를 다시 띄운다(기록은 하지 않는다).
  if (state.won && !state.keepPlaying) {
    showMessage('win');
  } else if (state.over) {
    showMessage('lose', findRank());
  }
};

init();
