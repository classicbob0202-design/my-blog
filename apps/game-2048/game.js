// 2048 게임 규칙 (순수 함수 모음)
// 화면·저장소·난수에 직접 기대지 않는다. 난수가 필요한 함수는 rng를 인자로 받는다.

export const SIZE = 4;
export const WIN_VALUE = 2048;
export const MAX_TILE = 131072; // 4×4에서 이론상 가장 큰 타일(2^17)

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

const copyBoard = (board) => board.map((row) => row.slice());

export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function addRandomTile(board, rng) {
  const empty = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === 0) empty.push({ row, col });
    }
  }
  if (empty.length === 0) return null;

  // rng는 칸 고르기 → 값 고르기 순서로 정확히 2번 부른다.
  const index = Math.floor(rng() * empty.length);
  const value = rng() < 0.9 ? 2 : 4;
  const { row, col } = empty[index];
  const next = copyBoard(board);
  next[row][col] = value;
  return { board: next, tile: { row, col, value } };
}

export function createGame(rng) {
  const first = addRandomTile(createEmptyBoard(), rng);
  const second = addRandomTile(first.board, rng);
  return { board: second.board, tiles: [first.tile, second.tile] };
}

export function slideLine(line) {
  const tiles = [];
  line.forEach((value, index) => {
    if (value !== 0) tiles.push({ value, from: index });
  });

  const result = [];
  const moves = [];
  let scoreGained = 0;
  let i = 0;
  // 벽 쪽(인덱스 0)부터 처리하고, 합쳐진 타일은 다시 합치지 않는다.
  while (i < tiles.length) {
    const current = tiles[i];
    const next = tiles[i + 1];
    const to = result.length;
    if (next && next.value === current.value) {
      const merged = current.value * 2;
      result.push(merged);
      scoreGained += merged;
      moves.push({ from: current.from, to, merged: true });
      moves.push({ from: next.from, to, merged: true });
      i += 2;
    } else {
      result.push(current.value);
      moves.push({ from: current.from, to, merged: false });
      i += 1;
    }
  }
  while (result.length < SIZE) result.push(0);

  return { line: result, scoreGained, moves };
}

// 방향마다 줄 k의 칸 좌표를 "미는 쪽(벽)부터" 순서로 돌려준다.
const linePositions = (direction, k) => {
  const positions = [];
  for (let i = 0; i < SIZE; i += 1) {
    if (direction === 'left') positions.push([k, i]);
    else if (direction === 'right') positions.push([k, SIZE - 1 - i]);
    else if (direction === 'up') positions.push([i, k]);
    else positions.push([SIZE - 1 - i, k]);
  }
  return positions;
};

export function move(board, direction) {
  const next = createEmptyBoard();
  const moves = [];
  const merges = [];
  let scoreGained = 0;

  for (let k = 0; k < SIZE; k += 1) {
    const positions = linePositions(direction, k);
    const line = positions.map(([row, col]) => board[row][col]);
    const slid = slideLine(line);

    positions.forEach(([row, col], index) => {
      next[row][col] = slid.line[index];
    });
    scoreGained += slid.scoreGained;

    const mergedTargets = new Set();
    slid.moves.forEach(({ from, to, merged }) => {
      moves.push({ from: positions[from], to: positions[to], merged });
      if (merged) mergedTargets.add(to);
    });
    mergedTargets.forEach((to) => {
      const [row, col] = positions[to];
      merges.push({ row, col, value: slid.line[to] });
    });
  }

  const moved = board.some((row, r) => row.some((value, c) => value !== next[r][c]));
  if (!moved) {
    return { board: copyBoard(board), moved: false, scoreGained: 0, moves: [], merges: [] };
  }
  return { board: next, moved: true, scoreGained, moves, merges };
}

export function canMove(board) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = board[row][col];
      if (value === 0) return true;
      if (col + 1 < SIZE && board[row][col + 1] === value) return true;
      if (row + 1 < SIZE && board[row + 1][col] === value) return true;
    }
  }
  return false;
}

export function hasWon(board) {
  return board.some((row) => row.some((value) => value >= WIN_VALUE));
}

export function getMaxTile(board) {
  return board.reduce((max, row) => Math.max(max, ...row), 0);
}

const isTileValue = (value) =>
  Number.isInteger(value) && value >= 2 && value <= MAX_TILE && (value & (value - 1)) === 0;

export function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== SIZE) return false;
  let tileCount = 0;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== SIZE) return false;
    for (const value of row) {
      if (value === 0) continue;
      if (!isTileValue(value)) return false;
      tileCount += 1;
    }
  }
  return tileCount > 0;
}

export function describeBoard(board) {
  return board
    .map((row, index) => {
      const cells = row.map((value) => (value === 0 ? '빈칸' : String(value)));
      return `${index + 1}행: ${cells.join(', ')}.`;
    })
    .join(' ');
}

export function serializeGame(game) {
  return JSON.stringify({
    v: 1,
    id: game.id,
    board: game.board,
    score: game.score,
    won: game.won,
    keepPlaying: game.keepPlaying,
    over: game.over,
  });
}

export function parseSavedGame(raw) {
  if (typeof raw !== 'string') return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return null;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  if (data.v !== 1) return null;
  if (typeof data.id !== 'string' || !ID_PATTERN.test(data.id)) return null;
  if (!isValidBoard(data.board)) return null;
  if (!Number.isSafeInteger(data.score) || data.score < 0) return null;
  const { won, keepPlaying, over } = data;
  if (typeof won !== 'boolean' || typeof keepPlaying !== 'boolean' || typeof over !== 'boolean') {
    return null;
  }
  // 상태가 서로 맞는지 확인한다.
  if (keepPlaying && !won) return null;
  if (hasWon(data.board) && !won) return null;
  if (over !== !canMove(data.board)) return null;

  return {
    id: data.id,
    board: copyBoard(data.board),
    score: data.score,
    won,
    keepPlaying,
    over,
  };
}
