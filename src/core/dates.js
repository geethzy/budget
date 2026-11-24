// Pure date helpers. Months are { y, m } with m counted from 0 (January = 0).
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const pad = (n) => String(n).padStart(2, '0');

export function ymd(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function todayStr(now = new Date()) {
  return ymd(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isValidDate(s) {
  if (typeof s !== 'string') return false;
  const match = DATE_RE.exec(s);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
}

export const monthKeyOf = (dateStr) => dateStr.slice(0, 7);

export function parseYm(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return { y, m: m - 1 };
}

export function shiftMonth({ y, m }, delta) {
  const idx = y * 12 + m + delta;
  return { y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
}

// Cells for a month grid, starting on Sunday. Leading blanks are null.
export function calendarCells({ y, m }) {
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push({ day: d, date: ymd(y, m, d) });
  return cells;
}
