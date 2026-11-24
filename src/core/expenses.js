// Pure functions over an array of expenses: { id, amount, cat, date }.
import { isValidDate } from './dates.js';

export function validateExpense(input, { categoryIds, maxAmount }) {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }
  if (amount > maxAmount) return { ok: false, error: 'That amount is too large.' };
  if (!categoryIds.includes(input.cat)) return { ok: false, error: 'Choose a category.' };
  if (!isValidDate(input.date)) return { ok: false, error: 'Pick a valid date.' };
  return { ok: true, value: { amount, cat: input.cat, date: input.date } };
}

// Keeps only well-formed entries. Used when loading or importing data.
export function sanitizeList(raw, opts) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string') return [];
    const r = validateExpense(e, opts);
    if (!r.ok) return [];
    return [{ id: e.id, ...r.value, ...(typeof e.ref === 'string' ? { ref: e.ref } : {}) }];
  });
}

export const addExpense = (list, expense) => [...list, expense];
export const updateExpense = (list, id, patch) => list.map((e) => (e.id === id ? { ...e, ...patch } : e));
export const removeExpense = (list, id) => list.filter((e) => e.id !== id);

export function expensesOn(list, date) {
  return list.filter((e) => e.date === date).sort((a, b) => a.id.localeCompare(b.id));
}

export function totalsByDate(list) {
  const totals = {};
  for (const e of list) totals[e.date] = (totals[e.date] || 0) + e.amount;
  return totals;
}
