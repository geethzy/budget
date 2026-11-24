// Pure budget maths: spending per month and category, and warning states.
import { monthKeyOf } from './dates.js';

export function spentIn(list, monthKey, catId) {
  return list
    .filter((e) => monthKeyOf(e.date) === monthKey && (!catId || e.cat === catId))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function status(spent, limit, warnAt) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const state = pct >= 100 ? 'over' : pct >= warnAt ? 'warn' : 'ok';
  return { spent, limit, left: limit - spent, pct, state };
}

export function monthSummary(list, categories, monthKey, warnAt) {
  const total = categories.reduce((s, c) => s + c.limit, 0);
  return {
    ...status(spentIn(list, monthKey), total, warnAt),
    byCategory: categories.map((c) => ({
      id: c.id,
      name: c.name,
      strong: c.strong,
      ...status(spentIn(list, monthKey, c.id), c.limit, warnAt),
    })),
  };
}
