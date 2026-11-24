// Helpers for the fields the iOS Shortcut sends (merchant and amount).
// The SMS text itself never reaches the app.
// Fingerprint used to avoid logging the same payment twice. Not reversible.
export function refOf(input) {
  const text = String(input ?? '');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Removes control characters and extra spaces, and limits the length.
export function cleanMerchant(input) {
  return String(input ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
