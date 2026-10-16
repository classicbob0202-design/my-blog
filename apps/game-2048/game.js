// 2048 게임 로직 — 순수 함수만 둔다(DOM, window, localStorage 접근 없음).
// 모든 함수는 입력 판을 변경하지 않고 새 배열을 반환한다.

export const SIZE = 4;
export const WIN_VALUE = 2048;

export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function emptyCells(board) {
  const cells = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === 0) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

export function addRandomTile(board, rng = Math.random) {
  const cells = emptyCells(board);
  if (cells.length === 0) {
    return null;
  }
  const index = Math.min(cells.length - 1, Math.floor(rng() * cells.length));
  const { row, col } = cells[index];
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

// 길이 SIZE 배열 하나를 인덱스 0 쪽으로 민다. 각 타일은 한 번의 이동에서 최대 한 번만 합쳐진다.
export function slideLine(line) {
  const result = new Array(line.length).fill(0);
  const moves = [];
  let scoreGained = 0;
  let target = 0;
  let canMergeIntoTarget = false;

  for (let from = 0; from < line.length; from += 1) {
    const value = line[from];
    if (value === 0) {
      continue;
    }
    const prev = target - 1;
    if (canMergeIntoTarget && result[prev] === value) {
      result[prev] = value * 2;
      scoreGained += value * 2;
      // 합쳐짐에 참여한 앞 타일도 merged로 표시한다.
      const partner = moves[moves.length - 1];
      partner.merged = true;
      moves.push({ from, to: prev, merged: true });
      canMergeIntoTarget = false;
    } else {
      result[target] = value;
      moves.push({ from, to: target, merged: false });
      target += 1;
      canMergeIntoTarget = true;
    }
  }

  return { line: result, scoreGained, moves };
}

// 방향별로 줄을 이루는 칸 좌표 목록(인덱스 0이 미는 방향의 앞쪽).
function linePositions(direction, index) {
  const positions = [];
  for (let i = 0; i < SIZE; i += 1) {
    if (direction === 'left') {
      positions.push([index, i]);
    } else if (direction === 'right') {
      positions.push([index, SIZE - 1 - i]);
    } else if (direction === 'up') {
      positions.push([i, index]);
    } else {
      positions.push([SIZE - 1 - i, index]);
    }
  }
  return positions;
}

export function move(board, direction) {
  if (!['up', 'down', 'left', 'right'].includes(direction)) {
    return { board: cloneBoard(board), scoreGained: 0, moved: false, moves: [], merges: [] };
  }

  const next = createEmptyBoard();
  const moves = [];
  const merges = [];
  let scoreGained = 0;

  for (let index = 0; index < SIZE; index += 1) {
    const positions = linePositions(direction, index);
    const line = positions.map(([row, col]) => board[row][col]);
    const slid = slideLine(line);
    scoreGained += slid.scoreGained;

    slid.line.forEach((value, i) => {
      const [row, col] = positions[i];
      next[row][col] = value;
    });

    slid.moves.forEach((m) => {
      moves.push({ from: positions[m.from], to: positions[m.to], merged: m.merged });
    });

    const mergedTargets = new Set(slid.moves.filter((m) => m.merged).map((m) => m.to));
    mergedTargets.forEach((to) => {
      const [row, col] = positions[to];
      merges.push({ row, col, value: slid.line[to] });
    });
  }

  let moved = false;
  for (let row = 0; row < SIZE && !moved; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] !== next[row][col]) {
        moved = true;
        break;
      }
    }
  }

  if (!moved) {
    return { board: cloneBoard(board), scoreGained: 0, moved: false, moves: [], merges: [] };
  }
  return { board: next, scoreGained, moved, moves, merges };
}

export function hasEmptyCell(board) {
  return board.some((row) => row.some((value) => value === 0));
}

export function canMove(board) {
  if (hasEmptyCell(board)) {
    return true;
  }
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = board[row][col];
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
  if (!Number.isSafeInteger(value) || value < 0) {
    return false;
  }
  if (value === 0) {
    return true;
  }
  // 2 이상의 2의 거듭제곱인지 확인한다.
  let n = value;
  while (n > 2 && n % 2 === 0) {
    n /= 2;
  }
  return n === 2;
}

// 저장된 판 검증: 4×4 배열, 각 값이 0 또는 2 이상의 2의 거듭제곱 정수, 타일 1개 이상.
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
      if (!isTileValue(value)) {
        return false;
      }
      if (value !== 0) {
        tiles += 1;
      }
    }
  }
  return tiles > 0;
}
