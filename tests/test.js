// Run with: npm test   (Node 18+). Uses only the built-in test runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, shiftMonth, calendarCells } from '../src/core/dates.js';
import { validateExpense, sanitizeList } from '../src/core/expenses.js';
import { monthSummary } from '../src/core/budget.js';
import { refOf, cleanMerchant } from '../src/core/sms.js';
import { resolveCategory } from '../src/core/rules.js';
import { createStore } from '../src/data/storage.js';
import { createController } from '../src/app/controller.js';
import { CATEGORIES, RULES, VENDOR_RULES } from '../src/data/config.js';

const OPTS = { categoryIds: CATEGORIES.map((c) => c.id), maxAmount: RULES.maxAmount };
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const fixedNow = () => new Date(2026, 10, 24, 21, 0); // 24 Nov 2026, 9 PM
const seqIds = () => { let n = 0; return () => `id${++n}`; };
const makeController = (storage = memory()) =>
  createController({ store: createStore({ storage }), now: fixedNow, newId: seqIds() });
const PARTS = { amount: '100.00', merchant: 'MOBITEL (PVT) LTD COLOMBO LK' };

test('dates: validation and month arithmetic', () => {
  assert.equal(isValidDate('2026-11-24'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.deepEqual(shiftMonth({ y: 2026, m: 11 }, 1), { y: 2027, m: 0 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 0 }, -1), { y: 2025, m: 11 });
});

test('dates: calendar starts on the right weekday', () => {
  const cells = calendarCells({ y: 2026, m: 10 });
  assert.equal(cells.filter((c) => c === null).length, new Date(2026, 10, 1).getDay());
  assert.equal(cells.filter(Boolean).length, 30);
});

test('expenses: validation rounds amounts and rejects bad input', () => {
  const ok = validateExpense({ amount: '12.6', cat: 'bills', date: '2026-11-24' }, OPTS);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.amount, 13);
  assert.equal(validateExpense({ amount: '0', cat: 'bills', date: '2026-11-24' }, OPTS).ok, false);
  assert.equal(validateExpense({ amount: '5', cat: 'nope', date: '2026-11-24' }, OPTS).ok, false);
});

test('expenses: sanitizeList drops malformed entries', () => {
  const list = sanitizeList([
    { id: 'a', amount: 100, cat: 'bills', date: '2026-11-01' },
    { id: 'b', amount: -5, cat: 'bills', date: '2026-11-01' },
    null,
  ], OPTS);
  assert.deepEqual(list.map((e) => e.id), ['a']);
});

test('budget: warning state at 80%; Other has no budget', () => {
  const list = [{ id: 'a', amount: 25000, cat: 'grocery', date: '2026-11-03' }];
  const s = monthSummary(list, CATEGORIES, '2026-11', RULES.warnAt);
  assert.equal(s.byCategory.find((c) => c.id === 'grocery').state, 'warn');
  assert.equal(s.byCategory.find((c) => c.id === 'other').limit, 0);
});

test('sms helpers: dates, merchant cleaning and fingerprints', () => {
  assert.equal(cleanMerchant('  ACME\u0007   STORE  '), 'ACME STORE');
  assert.equal(cleanMerchant('x'.repeat(200)).length, 60);
  assert.equal(refOf('a|b'), refOf('a|b'));
  assert.notEqual(refOf('a|b'), refOf('a|c'));
});

test('rules: a category you chose beats the seed rules; unknown merchants fall back', () => {
  assert.equal(resolveCategory('KEELLS SUPER', {}, VENDOR_RULES, 'other'), 'grocery');
  assert.equal(resolveCategory('KEELLS SUPER', { 'keells super': 'bills' }, VENDOR_RULES, 'other'), 'bills');
  assert.equal(resolveCategory('Some Shop', {}, VENDOR_RULES, 'other'), 'other');
});

test('storage: legacy v1 data is migrated', () => {
  const storage = memory();
  storage.setItem('expense-tracker-v1', JSON.stringify({
    expenses: [{ id: 'old1', amount: 500, cat: 'transport', date: '2026-11-10', note: 'bus' }],
  }));
  const loaded = createStore({ storage }).load();
  assert.deepEqual(loaded.expenses, [{ id: 'old1', amount: 500, cat: 'transport', date: '2026-11-10' }]);
});

test('storage: backup round-trips; invalid files are rejected', () => {
  const store = createStore({ storage: memory() });
  const expenses = [{ id: 'x', amount: 300, cat: 'outings', date: '2026-11-05' }];
  const back = store.parseBackup(store.serialize({ expenses, merchantMap: { 'acme store': 'grocery' } }));
  assert.deepEqual(back.expenses, expenses);
  assert.deepEqual(back.merchantMap, { 'acme store': 'grocery' });
  assert.throws(() => store.parseBackup('not json'), /not valid JSON/);
  assert.throws(() => store.parseBackup(JSON.stringify({ expenses: [{ amount: -1 }] })), /Nothing was imported/);
});

test('controller: add an expense by hand, then see it in the overview', () => {
  const c = makeController();
  c.dispatch('draft-amount', { value: '1500' });
  c.dispatch('draft-cat', { cat: 'bills' });
  c.dispatch('save-expense', {});
  assert.equal(c.view().overview.summary.spent, 1500);
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

test('controller: prefill fills the Add form without saving', () => {
  const c = makeController();
  c.dispatch('prefill', { amount: 'Rs 1,250', cat: 'hacked', date: '2026-02-30' });
  const vm = c.view();
  assert.equal(vm.add.draft.amount, '1250');
  assert.equal(vm.add.draft.cat, 'grocery');
  assert.equal(vm.overview.summary.spent, 0);
});

test('SMS: goes to review and is not counted until a category is picked', () => {
  const c = makeController();
  c.dispatch('import-sms', PARTS);
  const p = c.view().pending[0];
  assert.equal(c.view().pending.length, 1);
  assert.equal(p.vendor, 'MOBITEL (PVT) LTD COLOMBO LK');
  assert.equal(p.suggested, 'bills');
  assert.equal(c.view().overview.summary.spent, 0);
  c.dispatch('review-pick', { id: p.id, cat: 'bills' });
  assert.equal(c.view().pending.length, 0);
  assert.equal(c.view().overview.summary.spent, 100);
});

test('SMS: an unknown merchant is learned from the category you pick', () => {
  const c = makeController();
  c.dispatch('import-sms', { amount: '800.00', merchant: 'ACME STORE' });
  assert.equal(c.view().pending[0].suggested, 'other');
  c.dispatch('review-pick', { id: c.view().pending[0].id, cat: 'grocery' });
  c.dispatch('import-sms', { amount: '300.00', merchant: 'acme   store' });
  assert.equal(c.view().pending[0].suggested, 'grocery');
});

test('SMS: the same payment is not added twice, but a different amount is', () => {
  const c = makeController();
  c.dispatch('import-sms', PARTS);
  c.dispatch('import-sms', PARTS);
  assert.equal(c.view().pending.length, 1);
  c.dispatch('import-sms', { ...PARTS, amount: '250.00' });
  assert.equal(c.view().pending.length, 2);
});

test('SMS: a missing or invalid amount is rejected', () => {
  const c = makeController();
  c.dispatch('import-sms', { ...PARTS, amount: '' });
  assert.equal(c.view().pending.length, 0);
  assert.match(c.view().message, /Couldn't read the amount/);
});

test('SMS: dismiss removes a pending entry', () => {
  const c = makeController();
  c.dispatch('import-sms', PARTS);
  c.dispatch('dismiss-pending', { id: c.view().pending[0].id });
  assert.equal(c.view().pending.length, 0);
});

test('SMS: pending entries survive a reload and contain only the fields sent', () => {
  const storage = memory();
  makeController(storage).dispatch('import-sms', PARTS);
  const reloaded = makeController(storage);
  assert.equal(reloaded.view().pending.length, 1);
  const saved = storage.getItem('expense-tracker-v2');
  assert.ok(!saved.includes('authorised'));
  assert.ok(!saved.includes('Dear Cardholder'));
});

test('rules: merchants match whole words only; your list is applied', () => {
  assert.equal(resolveCategory('SPAR', {}, VENDOR_RULES, 'other'), 'grocery');
  assert.equal(resolveCategory('Sparkle Cafe', {}, VENDOR_RULES, 'other'), 'other');
  assert.equal(resolveCategory('PERERA & SONS', {}, VENDOR_RULES, 'other'), 'outings');
  assert.equal(resolveCategory('UBER', {}, VENDOR_RULES, 'other'), 'transport');
  assert.equal(resolveCategory('DIALOG AXIATA', {}, VENDOR_RULES, 'other'), 'bills');
  assert.equal(resolveCategory('CARGILLS', {}, VENDOR_RULES, 'other'), 'other');
});
