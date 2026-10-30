// 최고 점수·기록판 다루기 (순수 함수 모음)
import { MAX_TILE } from './game.js';

export const RECORD_LIMIT = 10;

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseBest(raw) {
  if (typeof raw !== 'string' || !/^\d{1,15}$/.test(raw)) return 0;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : 0;
}

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidDate = (date) => {
  if (typeof date !== 'string') return false;
  const match = DATE_PATTERN.exec(date);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
};

export function isValidRecord(item) {
  if (!isPlainObject(item)) return false;
  if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) return false;
  if (!Number.isSafeInteger(item.score) || item.score < 1) return false;
  const { maxTile } = item;
  if (!Number.isInteger(maxTile) || maxTile < 2 || maxTile > MAX_TILE || (maxTile & (maxTile - 1)) !== 0) {
    return false;
  }
  if (!isValidDate(item.date)) return false;
  return item.ended === 'over' || item.ended === 'quit';
}

// 저장할 다섯 속성만 남긴다.
const pickRecord = (item) => ({
  id: item.id,
  score: item.score,
  maxTile: item.maxTile,
  date: item.date,
  ended: item.ended,
});

export function parseRecords(raw) {
  if (typeof raw !== 'string') return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const seen = new Set();
  const records = [];
  data.forEach((item) => {
    if (!isValidRecord(item) || seen.has(item.id)) return;
    seen.add(item.id);
    records.push(pickRecord(item));
  });
  // Array.prototype.sort는 안정 정렬이라 같은 점수는 원래 순서를 지킨다.
  records.sort((a, b) => b.score - a.score);
  return records.slice(0, RECORD_LIMIT);
}

export function addRecord(records, entry, limit = RECORD_LIMIT) {
  const list = records.map(pickRecord);
  if (!entry || entry.score <= 0) return { records: list, rank: null };

  const existing = list.findIndex((item) => item.id === entry.id);
  if (existing !== -1) return { records: list, rank: existing + 1 };

  // 점수가 entry.score 이상인 마지막 항목 바로 뒤에 넣는다.
  let index = 0;
  list.forEach((item, i) => {
    if (item.score >= entry.score) index = i + 1;
  });
  list.splice(index, 0, pickRecord(entry));
  const trimmed = list.slice(0, limit);
  return { records: trimmed, rank: index < limit ? index + 1 : null };
}

const pad2 = (value) => String(value).padStart(2, '0');

export function toDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatDate(dateString) {
  return dateString.replaceAll('-', '.');
}
