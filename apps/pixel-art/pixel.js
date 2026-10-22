// 픽셀 아트 순수 로직. 브라우저 API에 의존하지 않는다.

export const SIZE = 16;

export const PALETTE = [
  { name: '검정', color: '#000000' },
  { name: '진회색', color: '#5f574f' },
  { name: '회색', color: '#a3a3a3' },
  { name: '흰색', color: '#ffffff' },
  { name: '빨강', color: '#e53935' },
  { name: '주황', color: '#fb8c00' },
  { name: '노랑', color: '#fdd835' },
  { name: '연두', color: '#7cb342' },
  { name: '초록', color: '#2e7d32' },
  { name: '하늘', color: '#29b6f6' },
  { name: '파랑', color: '#1e63d6' },
  { name: '남색', color: '#283593' },
  { name: '보라', color: '#8e24aa' },
  { name: '분홍', color: '#f48fb1' },
  { name: '갈색', color: '#8d5524' },
  { name: '살구', color: '#ffccaa' },
];

export const EXPORT_SCALES = [1, 8, 16, 32];

const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const CELL_COUNT = SIZE * SIZE;

export function createGrid() {
  return new Array(CELL_COUNT).fill(null);
}

export function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function getPixel(grid, x, y) {
  return inBounds(x, y) ? grid[y * SIZE + x] : null;
}

export function setPixel(grid, x, y, color) {
  if (!inBounds(x, y)) {
    return grid;
  }
  const index = y * SIZE + x;
  if (grid[index] === color) {
    return grid;
  }
  const next = grid.slice();
  next[index] = color;
  return next;
}

// Bresenham 선. 양 끝 포함, 범위 검사는 하지 않는다.
export function lineCells(x0, y0, x1, y1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

export function paintLine(grid, x0, y0, x1, y1, color) {
  let next = grid;
  let copied = false;
  for (const [x, y] of lineCells(x0, y0, x1, y1)) {
    if (!inBounds(x, y)) {
      continue;
    }
    const index = y * SIZE + x;
    if (next[index] === color) {
      continue;
    }
    if (!copied) {
      next = grid.slice();
      copied = true;
    }
    next[index] = color;
  }
  return next;
}

// 4방향 채우기. 재귀 대신 스택을 쓴다.
export function floodFill(grid, x, y, color) {
  if (!inBounds(x, y)) {
    return grid;
  }
  const target = grid[y * SIZE + x];
  if (target === color) {
    return grid;
  }
  const next = grid.slice();
  const stack = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    if (!inBounds(cx, cy)) {
      continue;
    }
    const index = cy * SIZE + cx;
    if (next[index] !== target) {
      continue;
    }
    next[index] = color;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

export function isBlank(grid) {
  return grid.every((value) => value === null);
}

export function normalizeColor(value) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function isValidGrid(value) {
  return Array.isArray(value)
    && value.length === CELL_COUNT
    && value.every((item) => item === null || (typeof item === 'string' && COLOR_PATTERN.test(item)));
}

export function colorName(color) {
  if (color === null) {
    return '투명';
  }
  const entry = PALETTE.find((item) => item.color === color);
  return entry ? entry.name : color;
}

export function toRGBA(grid, scale = 1) {
  if (!EXPORT_SCALES.includes(scale)) {
    throw new RangeError(`지원하지 않는 배율: ${scale}`);
  }
  const width = SIZE * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const color = grid[y * SIZE + x];
      if (color === null) {
        continue;
      }
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      for (let py = y * scale; py < (y + 1) * scale; py += 1) {
        for (let px = x * scale; px < (x + 1) * scale; px += 1) {
          const i = (py * width + px) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }
  return data;
}
