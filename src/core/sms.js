// Helpers for the fields the iOS Shortcut sends (amount, merchant, date, time).
// The SMS text itself never reaches the app.
import { isValidDate } from './dates.js';

// Fingerprint used to avoid logging the same payment twice. Not reversible.
export function refOf(input) {
  const text = String(input ?? '');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// '17/11/26' or '17/11/2026' -> '2026-11-17'. Returns null if it is not a real date.
export function shortDate(input) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(String(input ?? '').trim());
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[2]}-${m[1]}`;
  return isValidDate(iso) ? iso : null;
}

// Removes control characters and extra spaces, and limits the length.
export function cleanMerchant(input) {
  return String(input ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
