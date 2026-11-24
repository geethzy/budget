// The only module that talks to localStorage and to backup files.
import { CATEGORIES, RULES, STORAGE } from './config.js';
import { sanitizeList } from '../core/expenses.js';
import { isValidDate } from '../core/dates.js';

const CAT_IDS = CATEGORIES.map((c) => c.id);
const DEFAULT_OPTS = { categoryIds: CAT_IDS, maxAmount: RULES.maxAmount };

function sanitizePending(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.ref !== 'string') return [];
    const amount = Math.round(Number(p.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > RULES.maxAmount) return [];
    return [{
      id: p.id,
      ref: p.ref,
      amount,
      vendor: typeof p.vendor === 'string' ? p.vendor : '',
      date: isValidDate(p.date) ? p.date : null,
      suggested: CAT_IDS.includes(p.suggested) ? p.suggested : 'other',
    }];
  });
}

function sanitizeMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, cat] of Object.entries(raw)) {
    if (typeof key === 'string' && CAT_IDS.includes(cat)) out[key] = cat;
  }
  return out;
}

export function createStore({ storage = globalThis.localStorage, keys = STORAGE, opts = DEFAULT_OPTS } = {}) {
  const read = (key) => {
    try { return JSON.parse(storage.getItem(key)); } catch { return null; }
  };

  return {
    load() {
      const source = [read(keys.key), ...keys.legacyKeys.map(read)]
        .find((d) => d && Array.isArray(d.expenses));
      if (!source) return { expenses: [], pending: [], merchantMap: {} };
      return {
        expenses: sanitizeList(source.expenses, opts),
        pending: sanitizePending(source.pending),
        merchantMap: sanitizeMap(source.merchantMap),
      };
    },

    save(state) {
      try {
        storage.setItem(keys.key, JSON.stringify({
          version: 2,
          expenses: state.expenses,
          pending: state.pending,
          merchantMap: state.merchantMap,
        }));
        return true;
      } catch {
        return false;
      }
    },

    serialize(state) {
      return JSON.stringify({
        app: 'expense-tracker',
        version: 2,
        exportedAt: new Date().toISOString(),
        expenses: state.expenses,
        merchantMap: state.merchantMap,
      }, null, 2);
    },

    // Validates a backup file. Imports nothing if any entry is invalid.
    parseBackup(text) {
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
      if (!data || !Array.isArray(data.expenses)) throw new Error('No expenses found in that file.');
      const expenses = sanitizeList(data.expenses, opts);
      if (expenses.length !== data.expenses.length) throw new Error('Some entries are invalid. Nothing was imported.');
      return { expenses, merchantMap: sanitizeMap(data.merchantMap) };
    },
  };
}
