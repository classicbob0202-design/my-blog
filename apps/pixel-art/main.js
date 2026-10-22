import {
  SIZE,
  PALETTE,
  EXPORT_SCALES,
  createGrid,
  inBounds,
  getPixel,
  paintLine,
  floodFill,
  isBlank,
  normalizeColor,
  isValidGrid,
  colorName,
  toRGBA,
} from './pixel.js';
import { createHistory, record, undo, redo, canUndo, canRedo } from './history.js';
import { initThemeToggle } from './theme.js';

const STORAGE_KEY = 'pixel-art:state';
const SAVE_DELAY = 300;
const TOOLS = ['pen', 'eraser', 'fill', 'picker'];
const TOOL_NAMES = { pen: '펜', eraser: '지우개', fill: '채우기', picker: '스포이드' };
const TOOL_KEYS = { b: 'pen', e: 'eraser', g: 'fill', i: 'picker' };
const DEFAULTS = {
  color: '#000000',
  customColor: '#00aaff',
  tool: 'pen',
  showGrid: true,
  exportScale: 16,
};
const ARROWS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const paletteEl = document.getElementById('palette');
const customLabel = document.getElementById('custom-color-label');
const customInput = document.getElementById('custom-color');
const chipSwatch = document.getElementById('chip-swatch');
const chipLabel = document.getElementById('chip-label');
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');
const clearButton = document.getElementById('clear');
const gridCheckbox = document.getElementById('show-grid');
const scaleSelect = document.getElementById('export-scale');
const saveButton = document.getElementById('save-png');
const announcer = document.getElementById('announcer');
const toolButtons = [...document.querySelectorAll('.tool-button')];

const state = {
  grid: createGrid(),
  history: createHistory(),
  tool: DEFAULTS.tool,
  color: DEFAULTS.color,
  customColor: DEFAULTS.customColor,
  showGrid: DEFAULTS.showGrid,
  exportScale: DEFAULTS.exportScale,
  cursor: { x: 0, y: 0 },
  stroke: null,
};

const swatches = [];
let renderQueued = false;
let saveTimer = 0;
let announceFrame = 0;

// ---------- 저장 / 불러오기 ----------

function loadState() {
  let data;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (!data || typeof data !== 'object' || data.version !== 1 || !isValidGrid(data.pixels)) {
    return;
  }
  state.grid = data.pixels.slice();
  state.color = normalizeColor(data.color) ?? DEFAULTS.color;
  state.customColor = normalizeColor(data.customColor) ?? DEFAULTS.customColor;
  state.tool = TOOLS.includes(data.tool) && data.tool !== 'picker' ? data.tool : DEFAULTS.tool;
  state.showGrid = typeof data.showGrid === 'boolean' ? data.showGrid : DEFAULTS.showGrid;
  state.exportScale = EXPORT_SCALES.includes(data.exportScale) ? data.exportScale : DEFAULTS.exportScale;
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const data = {
    version: 1,
    pixels: state.grid,
    color: state.color,
    customColor: state.customColor,
    tool: state.tool,
    showGrid: state.showGrid,
    exportScale: state.exportScale,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 저장할 수 없어도 메모리에서는 계속 동작한다.
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DELAY);
}

// 아무것도 안 바꾼 탭이 닫히면서 다른 탭의 최신 그림을 덮어쓰지 않게, 대기 중인 저장만 처리한다.
function flushSave() {
  if (saveTimer) {
    saveNow();
  }
}

// 다른 탭이 저장하면, 이 탭에 저장 안 된 변경이 없을 때만 따라간다.
function onStorage(event) {
  if (event.key !== STORAGE_KEY || event.newValue === null || saveTimer || state.stroke) {
    return;
  }
  loadState();
  state.history = createHistory();
  updateAll();
  scheduleRender();
}

// ---------- 알림 ----------

function announce(message) {
  cancelAnimationFrame(announceFrame);
  announcer.textContent = '';
  announceFrame = requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

function announceCursor() {
  const { x, y } = state.cursor;
  announce(`${y + 1}행 ${x + 1}열, ${colorName(getPixel(state.grid, x, y))}`);
}

// ---------- 렌더링 ----------

function readColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    checkerA: style.getPropertyValue('--color-checker-a').trim(),
    checkerB: style.getPropertyValue('--color-checker-b').trim(),
    grid: style.getPropertyValue('--color-grid').trim(),
    cursor: style.getPropertyValue('--color-cursor').trim(),
    bg: style.getPropertyValue('--color-bg').trim(),
  };
}

function render() {
  renderQueued = false;
  const size = canvas.width;
  if (size === 0) {
    return;
  }
  const edge = (i) => Math.round((i * size) / SIZE);
  const colors = readColors();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  for (let y = 0; y < SIZE; y += 1) {
    const y0 = edge(y);
    const y1 = edge(y + 1);
    for (let x = 0; x < SIZE; x += 1) {
      const x0 = edge(x);
      const x1 = edge(x + 1);
      const color = state.grid[y * SIZE + x];
      if (color === null) {
        // 투명 칸은 칸마다 2×2 체크무늬
        const mx = Math.round((x0 + x1) / 2);
        const my = Math.round((y0 + y1) / 2);
        ctx.fillStyle = colors.checkerA;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.fillStyle = colors.checkerB;
        ctx.fillRect(mx, y0, x1 - mx, my - y0);
        ctx.fillRect(x0, my, mx - x0, y1 - my);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
  }

  if (state.showGrid) {
    ctx.fillStyle = colors.grid;
    for (let i = 1; i < SIZE; i += 1) {
      const p = edge(i);
      ctx.fillRect(p, 0, 1, size);
      ctx.fillRect(0, p, size, 1);
    }
  }

  if (document.activeElement === canvas) {
    const { x, y } = state.cursor;
    const x0 = edge(x);
    const y0 = edge(y);
    const w = edge(x + 1) - x0;
    const h = edge(y + 1) - y0;
    const line = Math.max(2, Math.round(2 * (window.devicePixelRatio || 1)));
    ctx.lineWidth = line;
    ctx.strokeStyle = colors.cursor;
    ctx.strokeRect(x0 + line / 2, y0 + line / 2, w - line, h - line);
    // 커서 색과 같은 색 칸 위에서도 보이도록 안쪽에 배경색 선을 하나 더 긋는다.
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.bg;
    ctx.strokeRect(x0 + line + 0.5, y0 + line + 0.5, w - 2 * line - 1, h - 2 * line - 1);
  }
}

function scheduleRender() {
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(render);
  }
}

function resizeCanvas() {
  const size = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
  if (size > 0 && canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  render();
}

// 화면 배율만 바뀌면(모니터 이동 등) 크기 변화가 없어 ResizeObserver가 울리지 않으므로 따로 감시한다.
function watchPixelRatio() {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  query.addEventListener('change', () => {
    resizeCanvas();
    watchPixelRatio();
  }, { once: true });
}

// ---------- UI 갱신 ----------

function updateButtons() {
  undoButton.disabled = !canUndo(state.history);
  redoButton.disabled = !canRedo(state.history);
  clearButton.disabled = isBlank(state.grid);
}

function updateToolUI() {
  for (const button of toolButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === state.tool));
  }
}

function updateColorUI() {
  const index = PALETTE.findIndex((item) => item.color === state.color);
  swatches.forEach((swatch, i) => {
    swatch.setAttribute('aria-pressed', String(i === index));
  });
  customLabel.classList.toggle('is-selected', index === -1);
  customInput.value = state.customColor;

  if (state.tool === 'eraser') {
    chipSwatch.classList.add('is-transparent');
    chipSwatch.style.backgroundColor = '';
    chipLabel.textContent = '투명';
  } else {
    chipSwatch.classList.remove('is-transparent');
    chipSwatch.style.backgroundColor = state.color;
    chipLabel.textContent = colorName(state.color);
  }
}

function updateAll() {
  updateButtons();
  updateToolUI();
  updateColorUI();
  gridCheckbox.checked = state.showGrid;
  scaleSelect.value = String(state.exportScale);
}

// ---------- 상태 변경 ----------

// 모든 그림 변경이 거치는 곳
function commit(nextGrid, before) {
  if (nextGrid === before) {
    return false;
  }
  state.history = record(state.history, before);
  state.grid = nextGrid;
  updateButtons();
  scheduleRender();
  scheduleSave();
  return true;
}

function setTool(tool, { silent = false } = {}) {
  state.tool = tool;
  updateToolUI();
  updateColorUI();
  scheduleSave();
  if (!silent) {
    announce(`${TOOL_NAMES[tool]} 도구`);
  }
}

function setColor(color) {
  state.color = color;
  if (state.tool === 'eraser' || state.tool === 'picker') {
    state.tool = 'pen';
    updateToolUI();
  }
  updateColorUI();
  scheduleSave();
  announce(`현재 색 ${colorName(color)}`);
}

function pickColor(x, y) {
  const color = getPixel(state.grid, x, y);
  if (color === null) {
    setTool('eraser', { silent: true });
    announce('투명, 지우개 도구');
    return;
  }
  state.color = color;
  if (!PALETTE.some((item) => item.color === color)) {
    state.customColor = color;
  }
  setTool('pen', { silent: true });
  announce(`현재 색 ${colorName(color)}, 펜 도구`);
}

// 한 칸에 현재 도구를 적용해 새 격자를 돌려준다(스포이드는 상태만 바꾼다).
function applyTool(grid, x, y) {
  switch (state.tool) {
    case 'pen':
      return paintLine(grid, x, y, x, y, state.color);
    case 'eraser':
      return paintLine(grid, x, y, x, y, null);
    case 'fill':
      return floodFill(grid, x, y, state.color);
    default:
      pickColor(x, y);
      return grid;
  }
}

function doUndo() {
  if (state.stroke) {
    return;
  }
  const result = undo(state.history, state.grid);
  if (!result) {
    return;
  }
  state.history = result.history;
  state.grid = result.grid;
  updateButtons();
  scheduleRender();
  scheduleSave();
  announce('되돌렸습니다');
}

function doRedo() {
  if (state.stroke) {
    return;
  }
  const result = redo(state.history, state.grid);
  if (!result) {
    return;
  }
  state.history = result.history;
  state.grid = result.grid;
  updateButtons();
  scheduleRender();
  scheduleSave();
  announce('다시 했습니다');
}

function clearAll() {
  if (isBlank(state.grid)) {
    return;
  }
  if (!window.confirm('그림을 모두 지울까요? 되돌리기로 복구할 수 있어요.')) {
    return;
  }
  commit(createGrid(), state.grid);
  announce('그림을 모두 지웠습니다.');
}

// ---------- 포인터 입력 ----------

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  // 테두리를 뺀 그림 영역 기준으로 계산한다.
  const left = rect.left + canvas.clientLeft;
  const top = rect.top + canvas.clientTop;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  return {
    x: Math.floor(((event.clientX - left) / width) * SIZE),
    y: Math.floor(((event.clientY - top) / height) * SIZE),
  };
}

function onPointerDown(event) {
  if (!event.isPrimary || state.stroke) {
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  const { x, y } = cellFromEvent(event);
  if (!inBounds(x, y)) {
    return;
  }
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // 캡처할 수 없어도 그리기는 계속한다.
  }
  state.cursor = { x, y };
  const before = state.grid;
  // 스포이드가 도구를 바꿔도 이번 획은 처음 도구로 처리한다.
  state.stroke = { pointerId: event.pointerId, before, lastX: x, lastY: y, tool: state.tool };
  state.grid = applyTool(before, x, y);
  scheduleRender();
}

function onPointerMove(event) {
  const stroke = state.stroke;
  if (!stroke || event.pointerId !== stroke.pointerId) {
    return;
  }
  if (stroke.tool !== 'pen' && stroke.tool !== 'eraser') {
    return;
  }
  const color = stroke.tool === 'pen' ? state.color : null;
  const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
  const points = coalesced.length > 0 ? coalesced : [event];
  let grid = state.grid;
  for (const point of points) {
    const { x, y } = cellFromEvent(point);
    if (x === stroke.lastX && y === stroke.lastY) {
      continue;
    }
    grid = paintLine(grid, stroke.lastX, stroke.lastY, x, y, color);
    stroke.lastX = x;
    stroke.lastY = y;
    if (inBounds(x, y)) {
      state.cursor = { x, y };
    }
  }
  if (grid !== state.grid) {
    state.grid = grid;
    scheduleRender();
  }
}

function onPointerEnd(event) {
  const stroke = state.stroke;
  if (!stroke || event.pointerId !== stroke.pointerId) {
    return;
  }
  // pointerup 좌표가 마지막 move와 다를 수 있으니 끝 위치까지 이어 칠한다. cancel 좌표는 믿지 않는다.
  if (event.type === 'pointerup') {
    onPointerMove(event);
  }
  state.stroke = null;
  const changed = state.grid !== stroke.before;
  if (changed) {
    // 획 동안 바뀐 격자를 기록 1개로 남긴다.
    const next = state.grid;
    state.grid = stroke.before;
    commit(next, stroke.before);
  }
  scheduleRender();
}

// ---------- 키보드 입력 ----------

function isFormField(target) {
  return target instanceof Element && target.matches('input, select, textarea');
}

function onCanvasKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || state.stroke) {
    return;
  }
  if (ARROWS[event.key]) {
    event.preventDefault();
    const [dx, dy] = ARROWS[event.key];
    const x = Math.min(SIZE - 1, Math.max(0, state.cursor.x + dx));
    const y = Math.min(SIZE - 1, Math.max(0, state.cursor.y + dy));
    state.cursor = { x, y };
    if (event.shiftKey && (state.tool === 'pen' || state.tool === 'eraser')) {
      commit(applyTool(state.grid, x, y), state.grid);
    }
    scheduleRender();
    announceCursor();
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    const { x, y } = state.cursor;
    const wasPicker = state.tool === 'picker';
    commit(applyTool(state.grid, x, y), state.grid);
    scheduleRender();
    if (!wasPicker) {
      announceCursor();
    }
  }
}

function onDocumentKeyDown(event) {
  if (isFormField(event.target)) {
    return;
  }
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (event.altKey) {
      return;
    }
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        doRedo();
      } else {
        doUndo();
      }
    } else if (key === 'y') {
      event.preventDefault();
      doRedo();
    }
    return;
  }
  if (event.altKey || state.stroke) {
    return;
  }
  const tool = TOOL_KEYS[key];
  if (tool) {
    event.preventDefault();
    setTool(tool);
  }
}

// ---------- PNG 저장 ----------

function pad(value) {
  return String(value).padStart(2, '0');
}

function fileName(date) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `pixel-art-${day}-${time}.png`;
}

function exportPng() {
  const scale = state.exportScale;
  const size = SIZE * scale;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const outCtx = out.getContext('2d');
  outCtx.putImageData(new ImageData(toRGBA(state.grid, scale), size, size), 0, 0);
  out.toBlob((blob) => {
    if (!blob) {
      announce('PNG를 만들지 못했습니다.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(new Date());
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(`PNG를 저장했습니다(${size}×${size}px).`);
  }, 'image/png');
}

// ---------- 초기화 ----------

function buildPalette() {
  for (const item of PALETTE) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.style.backgroundColor = item.color;
    button.setAttribute('aria-label', item.name);
    button.setAttribute('aria-pressed', 'false');
    button.title = `${item.name} ${item.color}`;
    button.addEventListener('click', () => setColor(item.color));
    swatches.push(button);
    paletteEl.insertBefore(button, customLabel);
  }
}

function useCustomColor() {
  const color = normalizeColor(customInput.value);
  if (!color) {
    return;
  }
  state.customColor = color;
  state.color = color;
  if (state.tool !== 'fill') {
    state.tool = 'pen';
    updateToolUI();
  }
  updateColorUI();
  scheduleSave();
}

function init() {
  loadState();
  buildPalette();
  updateAll();

  initThemeToggle();

  for (const button of toolButtons) {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  }
  undoButton.addEventListener('click', doUndo);
  redoButton.addEventListener('click', doRedo);
  clearButton.addEventListener('click', clearAll);
  saveButton.addEventListener('click', exportPng);

  customInput.addEventListener('input', useCustomColor);
  customInput.addEventListener('click', useCustomColor);
  customInput.addEventListener('change', () => {
    announce(`현재 색 ${colorName(state.color)}`);
  });

  gridCheckbox.addEventListener('change', () => {
    state.showGrid = gridCheckbox.checked;
    scheduleRender();
    scheduleSave();
  });
  scaleSelect.addEventListener('change', () => {
    const scale = Number(scaleSelect.value);
    if (EXPORT_SCALES.includes(scale)) {
      state.exportScale = scale;
      scheduleSave();
    }
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('keydown', onCanvasKeyDown);
  canvas.addEventListener('focus', scheduleRender);
  canvas.addEventListener('blur', scheduleRender);
  document.addEventListener('keydown', onDocumentKeyDown);

  window.addEventListener('pagehide', flushSave);
  window.addEventListener('storage', onStorage);

  new ResizeObserver(resizeCanvas).observe(canvas);
  new MutationObserver(scheduleRender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  watchPixelRatio();
  resizeCanvas();
}

init();
