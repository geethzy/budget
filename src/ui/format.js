// Formatting helpers shared by all views.
import { CURRENCY } from '../data/config.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n) => `${CURRENCY.prefix} ${Math.round(n).toLocaleString(CURRENCY.locale)}`;

export function longDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthTitle({ y, m }) {
  return new Date(y, m, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
