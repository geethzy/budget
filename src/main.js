// Composition root: wires store, controller and views together, and listens to events.
import { createStore } from './data/storage.js';
import { createController } from './app/controller.js';
import { page } from './ui/views.js';
import { todayStr } from './core/dates.js';

const root = document.getElementById('app');
const controller = createController({ store: createStore() });

function render() {
  root.innerHTML = page(controller.view());
}

function payloadOf(el) {
  const p = { ...el.dataset };
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') p.value = el.value;
  return p;
}

function run(el) {
  const action = el.dataset.action;
  if (action === 'delete' && !confirm('Delete this expense?')) return;
  if (action === 'export') return exportBackup();
  if (controller.dispatch(action, payloadOf(el)).render) render();
}

function exportBackup() {
  const blob = new Blob([controller.exportText()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expenses-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && el.tagName !== 'INPUT') run(el);
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && el.dataset.action !== 'import-file') run(el);
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.action !== 'import-file' || !el.files[0]) return;
  const text = await el.files[0].text();
  controller.dispatch('import', { text });
  el.value = '';
  render();
});

// Links like ?amount=1250&cat=bills&date=2026-11-24 pre-fill the Add form (used by the iOS Shortcut).
const params = new URLSearchParams(location.search);
if (params.has('amount')) {
  controller.dispatch('prefill', {
    amount: params.get('amount'),
    cat: params.get('cat') || undefined,
    date: params.get('date') || undefined,
  });
  history.replaceState(null, '', location.pathname);
}

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
