// The only module that talks to localStorage and to backup files.
import { CATEGORIES, RULES, STORAGE } from './config.js';
import { sanitizeList } from '../core/expenses.js';

const DEFAULT_OPTS = { categoryIds: CATEGORIES.map((c) => c.id), maxAmount: RULES.maxAmount };

export function createStore({ storage = globalThis.localStorage, keys = STORAGE, opts = DEFAULT_OPTS } = {}) {
  const read = (key) => {
    try { return JSON.parse(storage.getItem(key)); } catch { return null; }
  };

  return {
    load() {
      const current = read(keys.key);
      if (current && Array.isArray(current.expenses)) {
        return { expenses: sanitizeList(current.expenses, opts) };
      }
      for (const legacy of keys.legacyKeys) {
        const old = read(legacy);
        if (old && Array.isArray(old.expenses)) {
          return { expenses: sanitizeList(old.expenses, opts) };
        }
      }
      return { expenses: [] };
    },

    save(state) {
      try {
        storage.setItem(keys.key, JSON.stringify({ version: 2, expenses: state.expenses }));
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
      }, null, 2);
    },

    // Validates a backup file. Throws with a readable message, and imports nothing if any entry is bad.
    parseBackup(text) {
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
      if (!data || !Array.isArray(data.expenses)) throw new Error('No expenses found in that file.');
      const list = sanitizeList(data.expenses, opts);
      if (list.length !== data.expenses.length) throw new Error('Some entries are invalid. Nothing was imported.');
      return list;
    },
  };
}
