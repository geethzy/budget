// HTML generation only. Stateless: the same view model always gives the same HTML.
import { money, longDate, monthTitle, esc } from './format.js';
import { parseYm } from '../core/dates.js';

const TAB_LABELS = [['add', 'Add'], ['calendar', 'Calendar'], ['overview', 'Overview']];

function nav(tab) {
  return `<nav>${TAB_LABELS.map(([id, label]) =>
    `<button data-action="tab" data-value="${id}" class="${tab === id ? 'on' : ''}">${label}</button>`).join('')}</nav>`;
}

function message(text) {
  return text ? `<div class="msg">${esc(text)}</div>` : '';
}

// Month grid. Used by the Add picker, the Edit picker, and the Calendar tab.
function calendar({ key, grid, cells, selected, totals = {}, action, today }) {
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => `<div class="wd">${w}</div>`).join('');
  const body = cells.map((c) => c
    ? `<button class="day ${c.date === selected ? 'sel' : ''} ${c.date === today ? 'today' : ''}" data-action="${action}" data-date="${c.date}" data-target="${key}">${c.day}${totals[c.date] ? '<i class="pip"></i>' : ''}</button>`
    : '<span></span>').join('');
  return `<div class="cal">
    <div class="cal-h">
      <button data-action="shift-month" data-key="${key}" data-delta="-1" aria-label="Previous month">‹</button>
      <span>${monthTitle(grid)}</span>
      <button data-action="shift-month" data-key="${key}" data-delta="1" aria-label="Next month">›</button>
    </div>
    <div class="grid">${weekdays}${body}</div>
  </div>`;
}

function chips(categories, selectedId, action) {
  return categories.map((c) =>
    `<button class="chip ${selectedId === c.id ? 'on' : ''}" style="background:${c.pastel}" data-action="${action}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
}

function addView(vm) {
  const a = vm.add;
  return `<h1>Add expense</h1>
    ${a.reminder ? '<div class="prompt">No expenses logged today. Anything you spent?</div>' : ''}
    <div class="stack">
      <input type="number" inputmode="decimal" placeholder="Amount (LKR)" value="${esc(a.draft.amount)}" data-action="draft-amount">
      <div class="chips">${chips(vm.categories, a.draft.cat, 'draft-cat')}</div>
      <div>
        <p class="lbl">Date</p>
        <button class="datebtn" data-action="toggle-picker" data-target="add">${longDate(a.draft.date)} ▾</button>
        ${a.picker ? `<div style="margin-top:10px">${calendar({ key: 'add', grid: a.grid, cells: a.cells, selected: a.draft.date, action: 'pick-date', today: vm.today })}</div>` : ''}
      </div>
      ${message(vm.message)}
      <button class="btn" data-action="save-expense">Save</button>
    </div>`;
}

function editBox(vm) {
  const e = vm.calendar.edit;
  return `<div class="editbox stack">
    <input type="number" inputmode="decimal" value="${esc(e.amount)}" data-action="edit-amount" aria-label="Amount">
    <div class="chips">${chips(vm.categories, e.cat, 'edit-cat')}</div>
    <div>
      <p class="lbl">Date</p>
      <button class="datebtn" data-action="toggle-picker" data-target="edit">${longDate(e.date)} ▾</button>
      ${e.picker ? `<div style="margin-top:10px">${calendar({ key: 'edit', grid: e.grid, cells: e.cells, selected: e.date, action: 'pick-date', today: vm.today })}</div>` : ''}
    </div>
    ${message(vm.message)}
    <div class="acts">
      <button class="btn small" data-action="save-edit">Save</button>
      <button class="btn small ghost" data-action="cancel-edit">Cancel</button>
    </div>
  </div>`;
}

function row(e, byId) {
  const c = byId[e.cat] || { name: e.cat, strong: '#cccccc' };
  return `<div class="row">
    <div><span class="dot" style="background:${c.strong}"></span>${esc(c.name)}</div>
    <div class="acts">${money(e.amount)}
      <button class="btn small ghost" data-action="start-edit" data-id="${e.id}">Edit</button>
      <button class="del" data-action="delete" data-id="${e.id}" aria-label="Delete">×</button>
    </div>
  </div>`;
}

function calendarView(vm) {
  const c = vm.calendar;
  const byId = Object.fromEntries(vm.categories.map((x) => [x.id, x]));
  const items = c.items.length
    ? c.items.map((e) => (c.edit && c.edit.id === e.id ? editBox(vm) : row(e, byId))).join('')
    : '<p class="muted">No expenses on this day.</p>';
  return `<h1>Calendar</h1>
    ${calendar({ key: 'cal', grid: c.grid, cells: c.cells, selected: c.selected, totals: c.totals, action: 'select-day', today: vm.today })}
    <section>
      <h1>${longDate(c.selected)}${c.items.length ? ' · ' + money(c.total) : ''}</h1>
      ${items}
    </section>`;
}

function overviewView(vm) {
  const s = vm.overview.summary;
  const rows = s.byCategory.map((c) => `<div style="padding:14px 0;border-bottom:1px solid var(--line)">
      <div class="row" style="border:0;padding:0">
        <span><i class="dot" style="background:${c.strong}"></i>${esc(c.name)}</span>
        <span>${money(c.spent)} / ${money(c.limit)}</span>
      </div>
      <div class="muted ${c.state === 'over' ? 'over-text' : ''}">${c.left < 0 ? money(-c.left) + ' over' : money(c.left) + ' left'}</div>
      <div class="bar"><i style="width:${Math.min(c.pct, 100)}%;background:${c.state === 'over' ? 'var(--over)' : c.strong}"></i></div>
    </div>`).join('');
  return `<h1>${esc(monthTitle(parseYm(vm.today)))}</h1>
    <p class="lbl">Remaining</p>
    <p class="big ${s.left < 0 ? 'over-text' : ''}">${money(s.left)}</p>
    <p class="muted">Spent ${money(s.spent)} of ${money(s.limit)}</p>
    <div class="bar" style="height:10px"><i style="width:${Math.min(s.pct, 100)}%;background:${s.state === 'over' ? 'var(--over)' : '#b9b9b9'}"></i></div>
    <section>${rows}</section>
    <section>
      <h1>Backup</h1>
      <div class="stack">
        <button class="btn ghost" data-action="export">Export expenses (JSON)</button>
        <label class="btn ghost" for="import-file">Import from file</label>
        <input id="import-file" type="file" accept="application/json,.json" data-action="import-file" class="sr">
        ${message(vm.message)}
      </div>
    </section>`;
}

export function page(vm) {
  const views = { add: addView, calendar: calendarView, overview: overviewView };
  return views[vm.tab](vm) + nav(vm.tab);
}
