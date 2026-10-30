// localStorage 안전 래퍼: 저장소를 쓸 수 없어도 오류 없이 계속 동작한다.

export const KEYS = {
  state: 'game-2048:state',
  best: 'game-2048:best',
  records: 'game-2048:records',
};

export function readItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

export function writeItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}
