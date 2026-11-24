// Run with: npm test   (Node 18+). Uses only the built-in test runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, shiftMonth, calendarCells } from '../src/core/dates.js';
import { validateExpense, sanitizeList } from '../src/core/expenses.js';
import { monthSummary } from '../src/core/budget.js';
import { createStore } from '../src/data/storage.js';
import { createController } from '../src/app/controller.js';
import { CATEGORIES, RULES } from '../src/data/config.js';

const OPTS = { categoryIds: CATEGORIES.map((c) => c.id), maxAmount: RULES.maxAmount };
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), _m: m };
};
const fixedNow = () => new Date(2026, 10, 24, 21, 0); // 24 Nov 2026, 9 PM
const seqIds = () => { let n = 0; return () => `id${++n}`; };
const makeController = (storage = memory()) =>
  createController({ store: createStore({ storage }), now: fixedNow, newId: seqIds() });

test('dates: validation and month arithmetic', () => {
  assert.equal(isValidDate('2026-11-24'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('nope'), false);
  assert.deepEqual(shiftMonth({ y: 2026, m: 11 }, 1), { y: 2027, m: 0 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 0 }, -1), { y: 2025, m: 11 });
});

test('dates: calendar starts on the right weekday', () => {
  const cells = calendarCells({ y: 2026, m: 10 });
  const leading = new Date(2026, 10, 1).getDay();
  assert.equal(cells.filter((c) => c === null).length, leading);
  assert.equal(cells.filter(Boolean).length, 30);
});

test('expenses: validation rounds amounts and rejects bad input', () => {
  const ok = validateExpense({ amount: '12.6', cat: 'bills', date: '2026-11-24' }, OPTS);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.amount, 13);
  assert.equal(validateExpense({ amount: '0', cat: 'bills', date: '2026-11-24' }, OPTS).ok, false);
  assert.equal(validateExpense({ amount: '5', cat: 'nope', date: '2026-11-24' }, OPTS).ok, false);
  assert.equal(validateExpense({ amount: '5', cat: 'bills', date: '24/11/2026' }, OPTS).ok, false);
});

test('expenses: sanitizeList drops malformed entries', () => {
  const list = sanitizeList([
    { id: 'a', amount: 100, cat: 'bills', date: '2026-11-01' },
    { id: 'b', amount: -5, cat: 'bills', date: '2026-11-01' },
    null,
    { amount: 10, cat: 'bills', date: '2026-11-01' },
  ], OPTS);
  assert.deepEqual(list.map((e) => e.id), ['a']);
});

test('budget: warning state at 80% of a category limit', () => {
  const list = [{ id: 'a', amount: 25000, cat: 'grocery', date: '2026-11-03' }];
  const s = monthSummary(list, CATEGORIES, '2026-11', RULES.warnAt);
  assert.equal(s.spent, 25000);
  assert.equal(s.limit, 50000);
  const grocery = s.byCategory.find((c) => c.id === 'grocery');
  assert.equal(grocery.state, 'warn');
  assert.equal(s.byCategory.find((c) => c.id === 'bills').state, 'ok');
});

test('storage: migrates data from the v1 key', () => {
  const storage = memory();
  storage.setItem('expense-tracker-v1', JSON.stringify({
    expenses: [{ id: 'old1', amount: 500, cat: 'transport', date: '2026-11-10', note: 'bus' }],
  }));
  const store = createStore({ storage });
  assert.deepEqual(store.load().expenses, [{ id: 'old1', amount: 500, cat: 'transport', date: '2026-11-10' }]);
});

test('storage: backup round-trips and invalid files are rejected', () => {
  const store = createStore({ storage: memory() });
  const state = { expenses: [{ id: 'x', amount: 300, cat: 'outings', date: '2026-11-05' }] };
  assert.deepEqual(store.parseBackup(store.serialize(state)), state.expenses);
  assert.throws(() => store.parseBackup('not json'), /not valid JSON/);
  assert.throws(() => store.parseBackup(JSON.stringify({ expenses: [{ amount: -1 }] })), /Nothing was imported/);
});

test('controller: add an expense, then see it in the overview', () => {
  const c = makeController();
  c.dispatch('draft-amount', { value: '1500' });
  c.dispatch('draft-cat', { cat: 'bills' });
  c.dispatch('save-expense', {});
  const vm = c.view();
  assert.equal(vm.overview.summary.spent, 1500);
  assert.equal(vm.add.draft.amount, '');
});

test('controller: invalid save shows a message and saves nothing', () => {
  const c = makeController();
  c.dispatch('save-expense', {});
  assert.equal(c.view().message, 'Enter an amount greater than zero.');
  assert.equal(c.view().overview.summary.spent, 0);
});

test('controller: edit and delete', () => {
  const c = makeController();
  c.dispatch('draft-amount', { value: '100' });
  c.dispatch('save-expense', {});
  c.dispatch('start-edit', { id: 'id1' });
  c.dispatch('edit-amount', { value: '2000' });
  c.dispatch('edit-cat', { cat: 'shopping' });
  c.dispatch('save-edit', {});
  assert.equal(c.view().overview.summary.spent, 2000);
  c.dispatch('delete', { id: 'id1' });
  assert.equal(c.view().overview.summary.spent, 0);
});

test('controller: data persists across controller instances', () => {
  const storage = memory();
  const first = makeController(storage);
  first.dispatch('draft-amount', { value: '750' });
  first.dispatch('save-expense', {});
  const second = makeController(storage);
  assert.equal(second.view().overview.summary.spent, 750);
});

test('prefill: fills the Add form from a link without saving', () => {
  const c = makeController();
  c.dispatch('prefill', { amount: 'Rs 1,250', cat: 'bills', date: '2026-11-20' });
  const vm = c.view();
  assert.equal(vm.tab, 'add');
  assert.equal(vm.add.draft.amount, '1250');
  assert.equal(vm.add.draft.cat, 'bills');
  assert.equal(vm.add.draft.date, '2026-11-20');
  assert.equal(vm.overview.summary.spent, 0);
});

test('prefill: ignores an unknown category and an invalid date', () => {
  const c = makeController();
  c.dispatch('prefill', { amount: '300', cat: 'hacked', date: '2026-02-30' });
  const vm = c.view();
  assert.equal(vm.add.draft.cat, 'grocery');
  assert.equal(vm.add.draft.date, '2026-11-24');
});
