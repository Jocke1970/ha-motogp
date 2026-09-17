/* Run: node tests/frontend-smoke.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'Europe/Stockholm';
const source = fs.readFileSync(path.join(__dirname, '../frontend/ha-motogp-card.js'), 'utf8');
let now = Date.parse('2026-09-18T08:55:00+02:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const registry = new Map();
class Element {
  attachShadow() {
    const view = { innerHTML: '' };
    this._view = view;
    this.shadowRoot = { innerHTML: '', addEventListener() {},
      getElementById(id) { return id === 'view' ? view : null; } };
    return this.shadowRoot;
  }
}
const context = { customElements: { get: name => registry.get(name),
  define: (name, klass) => registry.set(name, klass) },
  HTMLElement: Element, window: { customCards: [] }, Date: Clock,
  setInterval: () => 1, clearInterval() {}, console };
vm.runInNewContext(source, context, { filename: 'ha-motogp-card.js' });
const Card = registry.get('ha-motogp-card');
assert.ok(Card, 'Custom element should register');
const card = new Card();
card.setConfig({ mode: 'both' });
const session = (date, category, name, status = '') =>
  ({ id: `${category}-${name}`, date, category, name, status });
const sessions = [
  session('2026-09-18T09:00:00+00:00', 'Moto3', 'FP1'),
  session('2026-09-18T10:45:00+00:00', 'MotoGP', 'FP1'),
  session('2026-09-19T08:40:00+00:00', 'Moto3', 'FP2')
];
const state = (value, attributes = {}) => ({ state: value, attributes });
let entities = {
  'sensor.motogp_next_race': state('Test GP', {
    sessions_all: sessions, schedule_categories: ['MotoGP', 'Moto2', 'Moto3'] }),
  'sensor.motogp_current_session': state('FP1', { category: 'Moto3', event: 'Test GP' }),
  'sensor.motogp_session_status': state('Not Started', { category: 'Moto3', session_status_id: 'N' }),
  'sensor.motogp_rider_positions': state('1 rider', { category: 'Moto3', riders: [
    { position: 1, surname: 'TEST', team: 'Honda', last_lap_time: '1:40.000', number: 5 }] }),
  'sensor.motogp_race_lap_count': state('0', { num_laps: 0 }),
  'sensor.motogp_session_time_remaining': state('2100'),
  'input_select.motogp_schedule_category': state('Total')
};
const push = changes => { entities = { ...entities, ...changes }; card.hass = { states: entities }; };
const click = dataset => card._click({ target: { closest: () => ({ dataset }) } });
push({});
assert.match(card._view.innerHTML, /data-day="2026-09-18" aria-expanded="true"/, 'Today open by default');
assert.match(card._view.innerHTML, /data-day="2026-09-19" aria-expanded="false"/, 'Other days closed');
assert.match(card._view.innerHTML, /data-timing aria-expanded="false"/, 'Pre-start timing closed');
click({ day: '2026-09-19' });
assert.match(card._view.innerHTML, /data-day="2026-09-18" aria-expanded="false"/);
assert.match(card._view.innerHTML, /data-day="2026-09-19" aria-expanded="true"/);
click({ day: '2026-09-19' });
assert.match(card._view.innerHTML, /data-day="2026-09-19" aria-expanded="false"/);
click({ day: '2026-09-18' }); // Open current day to inspect its visible tiles.
push({ 'sensor.motogp_session_status': state('In Progress', {
  category: 'Moto3', session_status_id: 'S' }) });
assert.match(card._view.innerHTML, /data-timing aria-expanded="true"/, 'LIVE auto opens');
assert.ok(card._snapshot, 'Active feed cached locally');
assert.equal((card._view.innerHTML.match(/class="tile live-tile"/g) || []).length, 1,
  'Only the Moto3 FP1 tile should be LIVE');
click({ timing: '' });
assert.match(card._view.innerHTML, /data-timing aria-expanded="false"/, 'Manual hide works');
push({ 'sensor.motogp_race_lap_count': state('1', { num_laps: 10 }) });
assert.match(card._view.innerHTML, /data-timing aria-expanded="false"/, 'Updates do not force reopen');
push({
  'sensor.motogp_current_session': state('FP1', { category: 'MotoGP', event: 'Test GP' }),
  'sensor.motogp_session_status': state('In Progress', { category: 'MotoGP', session_status_id: 'S' }),
  'sensor.motogp_rider_positions': state('1 rider', { category: 'MotoGP', riders: [
    { position: 1, surname: 'NEW', number: 7 }] })
});
assert.match(card._view.innerHTML, /data-timing aria-expanded="true"/, 'New LIVE session reopens');
assert.match(card._view.innerHTML, /MotoGP · FP1/, 'New category shown');
push({ 'sensor.motogp_session_status': state('Finished', {
  category: 'MotoGP', session_status_id: 'F' }) });
push({ 'sensor.motogp_current_session': state('FP2', { category: 'Moto3', event: 'Test GP' }),
  'sensor.motogp_session_status': state('Not Started', { category: 'Moto3', session_status_id: 'N' }) });
assert.match(card._view.innerHTML, /Senaste timing: MotoGP · FP1/,
  'Last snapshot retained while next feed waits');
now = Date.parse('2026-09-19T00:01:00+02:00');
card._render();
assert.equal(card._manualDay, null, 'Manual day resets at midnight');
console.log('PASS: registration, day defaults, local clicks, category match, session transitions, snapshot, midnight day reset');
