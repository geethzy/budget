// Static configuration. Change budgets, categories and rules here, not in code.
export const CURRENCY = { code: 'LKR', prefix: 'Rs', locale: 'en-US' };

export const CATEGORIES = [
  { id: 'grocery',   name: 'Grocery',   limit: 30000, pastel: '#c9f2d6', strong: '#8fd9aa' },
  { id: 'transport', name: 'Transport', limit: 10000, pastel: '#cfe6ff', strong: '#93c5f2' },
  { id: 'bills',     name: 'Bills',     limit: 5000,  pastel: '#e3d9ff', strong: '#b9a6ef' },
  { id: 'outings',   name: 'Outings',   limit: 2000,  pastel: '#ffe3cc', strong: '#f7b98a' },
  { id: 'shopping',  name: 'Shopping',  limit: 3000,  pastel: '#ffd6e8', strong: '#f0a0c6' },
  // limit 0 = no budget. Spending is still counted in the total spent.
  { id: 'other',     name: 'Other',     limit: 0,     pastel: '#e9e9e9', strong: '#bdbdbd' },
];

export const TABS = ['add', 'calendar', 'overview'];

// Merchant name -> category. Matched by substring, ignoring case. First match wins.
// Edit this list to match your merchants. Anything unmatched goes to 'other'.
export const VENDOR_RULES = [
  { match: 'keells',    cat: 'grocery' },
  { match: 'cargills',  cat: 'grocery' },
  { match: 'arpico',    cat: 'grocery' },
  { match: 'mobitel',   cat: 'bills' },
  { match: 'dialog',    cat: 'bills' },
  { match: 'ceb',       cat: 'bills' },
  { match: 'ceypetco',  cat: 'transport' },
  { match: 'pickme',    cat: 'transport' },
  { match: 'uber',      cat: 'transport' },
];

export const RULES = {
  warnAt: 80,          // percent of a limit that turns the bar amber
  reminderHour: 20,    // after this hour, the "nothing logged today" prompt appears
  maxAmount: 10_000_000,
};

export const STORAGE = {
  key: 'expense-tracker-v2',        // current storage key
  legacyKeys: ['expense-tracker-v1'], // older keys, migrated on first load
};
