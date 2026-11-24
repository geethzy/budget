// Owns state, runs named actions, and produces plain view models (no HTML).
import { TABS, RULES, CATEGORIES, VENDOR_RULES } from '../data/config.js';
import { todayStr, parseYm, shiftMonth, monthKeyOf, calendarCells, isValidDate } from '../core/dates.js';
import { validateExpense, addExpense, updateExpense, removeExpense, expensesOn, totalsByDate } from '../core/expenses.js';
import { monthSummary } from '../core/budget.js';
import { refOf, shortDate, cleanMerchant } from '../core/sms.js';
import { resolveCategory, normalizeVendor } from '../core/rules.js';

const defaultId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function createController({ store, categories = CATEGORIES, now = () => new Date(), newId = defaultId }) {
  const opts = { categoryIds: categories.map((c) => c.id), maxAmount: RULES.maxAmount };
  const today = () => todayStr(now());
  const emptyDraft = () => ({ amount: '', cat: categories[0].id, date: today() });
  const catName = (id) => (categories.find((c) => c.id === id) || { name: id }).name;

  const loaded = store.load();
  const state = {
    tab: 'add',
    expenses: loaded.expenses,       // confirmed expenses (counted in budgets)
    pending: loaded.pending,         // SMS entries waiting for a category (not counted yet)
    merchantMap: loaded.merchantMap, // merchant -> category, learned from your choices
    draft: emptyDraft(),
    edit: null,
    selectedDate: today(),
    picker: null,                    // 'add' | 'edit' | null
    grids: {},
    message: '',
  };

  const gridOf = (key) => state.grids[key] || parseYm(today());
  const persist = () => store.save({ expenses: state.expenses, pending: state.pending, merchantMap: state.merchantMap });

  const actions = {
    tab({ value }) {
      if (!TABS.includes(value)) return false;
      state.tab = value;
      state.picker = null;
      state.edit = null;
      state.message = '';
    },

    'draft-amount'({ value }) { state.draft.amount = value; return false; },
    'draft-cat'({ cat }) { state.draft.cat = cat; },

    // Pre-fills the Add form from a link. It never saves by itself.
    prefill({ amount, cat, date }) {
      const digits = String(amount ?? '').replace(/[^\d.]/g, '');
      if (digits) state.draft.amount = digits;
      if (cat && categories.some((c) => c.id === cat)) state.draft.cat = cat;
      if (date && isValidDate(date)) state.draft.date = date;
      state.tab = 'add';
      state.edit = null;
      state.picker = null;
      state.message = 'Check the details, then tap Save.';
    },

    'toggle-picker'({ target }) {
      if (state.picker === target) { state.picker = null; return; }
      const date = target === 'add' ? state.draft.date : state.edit && state.edit.date;
      state.grids[target] = parseYm(date || today());
      state.picker = target;
    },
    'pick-date'({ target, date }) {
      if (target === 'add') state.draft.date = date;
      else if (state.edit) state.edit.date = date;
      state.picker = null;
    },
    'shift-month'({ key, delta }) { state.grids[key] = shiftMonth(gridOf(key), Number(delta)); },
    'select-day'({ date }) {
      state.selectedDate = date;
      state.edit = null;
      state.picker = null;
      state.message = '';
    },

    'save-expense'() {
      const r = validateExpense(state.draft, opts);
      if (!r.ok) { state.message = r.error; return; }
      state.expenses = addExpense(state.expenses, { id: newId(), ...r.value });
      persist();
      state.draft = emptyDraft();
      state.picker = null;
      state.message = '';
    },

    'start-edit'({ id }) {
      const e = state.expenses.find((x) => x.id === id);
      if (!e) return;
      state.edit = { ...e, amount: String(e.amount) };
      state.grids.edit = parseYm(e.date);
      state.selectedDate = e.date;
      state.picker = null;
      state.message = '';
    },
    'edit-amount'({ value }) { if (state.edit) state.edit.amount = value; return false; },
    'edit-cat'({ cat }) { if (state.edit) state.edit.cat = cat; },
    'save-edit'() {
      if (!state.edit) return;
      const r = validateExpense(state.edit, opts);
      if (!r.ok) { state.message = r.error; return; }
      state.expenses = updateExpense(state.expenses, state.edit.id, r.value);
      state.selectedDate = r.value.date;
      persist();
      state.edit = null;
      state.picker = null;
      state.message = '';
    },
    'cancel-edit'() { state.edit = null; state.picker = null; state.message = ''; },

    'delete'({ id }) {
      state.expenses = removeExpense(state.expenses, id);
      if (state.edit && state.edit.id === id) state.edit = null;
      persist();
    },

    // Adds a pending entry from the Shortcut's fields. The SMS text itself never reaches the app.
    'import-sms'({ amount, merchant, date, time }) {
      state.tab = 'add';
      state.picker = null;
      const amt = Math.round(Number(String(amount ?? '').replace(/[^\d.]/g, '')));
      if (!Number.isFinite(amt) || amt <= 0 || amt > RULES.maxAmount) {
        state.message = "Couldn't read the amount from that SMS. Enter it manually.";
        return;
      }
      const vendor = cleanMerchant(merchant);
      const isoDate = shortDate(date);
      const ref = refOf([amt, normalizeVendor(vendor), isoDate || '', String(time ?? '').trim()].join('|'));
      if (state.expenses.some((e) => e.ref === ref) || state.pending.some((p) => p.ref === ref)) {
        state.message = 'This SMS is already in the list.';
        return;
      }
      state.pending.push({
        id: newId(),
        ref,
        amount: amt,
        vendor,
        date: isoDate,
        suggested: resolveCategory(vendor, state.merchantMap, VENDOR_RULES, 'other'),
      });
      persist();
      state.message = `Added Rs ${amt.toLocaleString('en-US')} to review.`;
    },

    // You pick a category for a pending SMS. It is saved, and the merchant remembers the choice.
    'review-pick'({ id, cat }) {
      const p = state.pending.find((x) => x.id === id);
      if (!p) return;
      const r = validateExpense({ amount: p.amount, cat, date: p.date || today() }, opts);
      if (!r.ok) { state.message = r.error; return; }
      state.expenses = addExpense(state.expenses, { id: newId(), ...r.value, ref: p.ref });
      state.pending = state.pending.filter((x) => x.id !== id);
      const key = normalizeVendor(p.vendor);
      if (key) {
        state.merchantMap[key] = cat;
        for (const other of state.pending) {
          if (normalizeVendor(other.vendor) === key) other.suggested = cat;
        }
      }
      persist();
      state.message = key
        ? `Saved as ${catName(cat)}. ${p.vendor} will suggest ${catName(cat)} next time.`
        : `Saved as ${catName(cat)}.`;
    },

    'dismiss-pending'({ id }) {
      state.pending = state.pending.filter((x) => x.id !== id);
      persist();
      state.message = 'Removed from review.';
    },

    'import'({ text }) {
      let data;
      try {
        data = store.parseBackup(text);
      } catch (err) {
        state.message = err.message;
        return;
      }
      state.expenses = data.expenses;
      state.merchantMap = data.merchantMap;
      state.edit = null;
      persist();
      state.message = `Imported ${data.expenses.length} expenses.`;
    },
  };

  return {
    // Returns { render }. Typing-only actions return false so the page is not rebuilt mid-keystroke.
    dispatch(action, payload = {}) {
      const fn = actions[action];
      if (!fn) return { render: false };
      return { render: fn(payload) !== false };
    },

    exportText() {
      return store.serialize({ expenses: state.expenses, merchantMap: state.merchantMap });
    },

    view() {
      const todayDate = today();
      const addGrid = gridOf('add');
      const calGrid = gridOf('cal');
      const dayItems = expensesOn(state.expenses, state.selectedDate);
      const edit = state.edit && {
        ...state.edit,
        picker: state.picker === 'edit',
        grid: gridOf('edit'),
        cells: calendarCells(gridOf('edit')),
      };
      return {
        tab: state.tab,
        today: todayDate,
        message: state.message,
        categories,
        pending: state.pending,
        add: {
          draft: state.draft,
          picker: state.picker === 'add',
          grid: addGrid,
          cells: calendarCells(addGrid),
          reminder: now().getHours() >= RULES.reminderHour && expensesOn(state.expenses, todayDate).length === 0,
        },
        calendar: {
          selected: state.selectedDate,
          grid: calGrid,
          cells: calendarCells(calGrid),
          totals: totalsByDate(state.expenses),
          items: dayItems,
          total: dayItems.reduce((s, e) => s + e.amount, 0),
          edit,
        },
        overview: {
          summary: monthSummary(state.expenses, categories, monthKeyOf(todayDate), RULES.warnAt),
        },
      };
    },
  };
}
