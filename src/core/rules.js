// Merchant -> category rules. Pure.

// "KEELLS  Super " and "keells super" are treated as the same merchant.
export const normalizeVendor = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Order: a category you chose in the app (exact merchant), then the seed rules (substring), then the fallback.
export function resolveCategory(vendor, learned, rules, fallback) {
  const key = normalizeVendor(vendor);
  if (!key) return fallback;
  if (learned[key]) return learned[key];
  const hit = rules.find((r) => new RegExp(`\\b${escapeRe(r.match.toLowerCase())}\\b`).test(key));
  return hit ? hit.cat : fallback;
}
