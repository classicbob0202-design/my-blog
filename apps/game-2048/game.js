// 2048 게임 로직. 순수 함수만 둔다(DOM·저장소 접근 없음, 난수는 인자로 주입).

export const SIZE = 4;
export const WIN_VALUE = 2048;

export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function addRandomTile(board, rng = Math.random) {
  const empty = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] === 0) {
        empty.push([row, col]);
      }
    }
  }
  if (empty.length === 0) {
    return null;
  }
  const [row, col] = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  const next = cloneBoard(board);
  next[row][col] = value;
  return { board: next, tile: { row, col, value } };
}

export function createGame(rng = Math.random) {
  const first = addRandomTile(createEmptyBoard(), rng);
  const second = addRandomTile(first.board, rng);
  return { board: second.board, tiles: [first.tile, second.tile] };
}

// 한 줄을 인덱스 0 쪽으로 민다. 각 타일은 한 번만 합쳐진다.
export function slideLine(line) {
  const result = new Array(line.length).fill(0);
  const moves = [];
  let scoreGained = 0;
  let target = 0;
  let pending = null;

  for (let i = 0; i < line.length; i++) {
    const value = line[i];
    if (value === 0) {
      continue;
    }
    if (pending && pending.value === value) {
      const merged = value * 2;
      result[pending.to] = merged;
      scoreGained += merged;
      pending.move.merged = true;
      moves.push({ from: i, to: pending.to, merged: true });
      pending = null;
    } else {
      result[target] = value;
      const entry = { from: i, to: target, merged: false };
      moves.push(entry);
      pending = { value, to: target, move: entry };
      target++;
    }
  }

  return { line: result, scoreGained, moves };
}

// 줄 번호 i, 줄 안의 위치 k(0이 미는 방향 앞쪽)를 판 좌표로 바꾼다.
function toCoord(direction, i, k) {
  const last = SIZE - 1;
  switch (direction) {
    case 'left':
      return [i, k];
    case 'right':
      return [i, last - k];
    case 'up':
      return [k, i];
    case 'down':
      return [last - k, i];
    default:
      throw new Error(`알 수 없는 방향: ${direction}`);
  }
}

export function move(board, direction) {
  const next = createEmptyBoard();
  const moves = [];
  const merges = [];
  let scoreGained = 0;

  for (let i = 0; i < SIZE; i++) {
    const line = [];
    for (let k = 0; k < SIZE; k++) {
      const [row, col] = toCoord(direction, i, k);
      line.push(board[row][col]);
    }

    const slid = slideLine(line);
    scoreGained += slid.scoreGained;

    for (let k = 0; k < SIZE; k++) {
      const [row, col] = toCoord(direction, i, k);
      next[row][col] = slid.line[k];
    }

    const mergedTargets = new Set();
    for (const m of slid.moves) {
      const from = toCoord(direction, i, m.from);
      const to = toCoord(direction, i, m.to);
      moves.push({ from, to, merged: m.merged });
      if (m.merged && !mergedTargets.has(m.to)) {
        mergedTargets.add(m.to);
        merges.push({ row: to[0], col: to[1], value: slid.line[m.to] });
      }
    }
  }

  const moved = next.some((row, r) => row.some((value, c) => value !== board[r][c]));
  if (!moved) {
    return { board: cloneBoard(board), moved: false, scoreGained: 0, moves, merges: [] };
  }
  return { board: next, moved, scoreGained, moves, merges };
}

export function canMove(board) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = board[row][col];
      if (value === 0) {
        return true;
      }
      if (col + 1 < SIZE && board[row][col + 1] === value) {
        return true;
      }
      if (row + 1 < SIZE && board[row + 1][col] === value) {
        return true;
      }
    }
  }
  return false;
}

export function hasWon(board) {
  return board.some((row) => row.some((value) => value >= WIN_VALUE));
}

function isTileValue(value) {
  if (value === 0) {
    return true;
  }
  // 2 이상인 2의 거듭제곱 정수. Math.log2는 큰 홀수를 반올림해 통과시키므로 나눠서 확인한다.
  if (!Number.isSafeInteger(value) || value < 2) {
    return false;
  }
  let rest = value;
  while (rest % 2 === 0) {
    rest /= 2;
  }
  return rest === 1;
}

export function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== SIZE) {
    return false;
  }
  let tiles = 0;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== SIZE) {
      return false;
    }
    for (const value of row) {
      if (typeof value !== 'number' || !isTileValue(value)) {
        return false;
      }
      if (value !== 0) {
        tiles++;
      }
    }
  }
  return tiles > 0;
}
