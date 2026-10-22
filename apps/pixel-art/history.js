// 되돌리기/다시하기 스택. 순수 함수만 둔다.

export const HISTORY_LIMIT = 100;

export function createHistory() {
  return { past: [], future: [] };
}

export function record(history, before) {
  const past = [...history.past, before];
  if (past.length > HISTORY_LIMIT) {
    past.splice(0, past.length - HISTORY_LIMIT);
  }
  return { past, future: [] };
}

export function undo(history, current) {
  if (history.past.length === 0) {
    return null;
  }
  const past = history.past.slice(0, -1);
  const grid = history.past[history.past.length - 1];
  return { history: { past, future: [current, ...history.future] }, grid };
}

export function redo(history, current) {
  if (history.future.length === 0) {
    return null;
  }
  const [grid, ...future] = history.future;
  return { history: { past: [...history.past, current], future }, grid };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}
