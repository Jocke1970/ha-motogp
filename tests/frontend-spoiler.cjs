/* Run: node tests/frontend-spoiler.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'Europe/Stockholm';
const script = fs.readFileSync(path.join(__dirname, '../frontend/ha-motogp-card.js'), 'utf8');
let now = Date.parse('2026-09-18T09:02:00+02:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const registry = new Map();
class Element {
  attachShadow() {
    const view = { innerHTML: '' }; this.view = view;
    this.shadowRoot = { innerHTML: '', addEventListener() {},
      getElementById: id => id === 'view' ? view : null };
    return this.shadowRoot;
  }
}
vm.runInNewContext(script, {
  HTMLElement: Element, Date: Clock, console,
  customElements: { get: name => registry.get(name), define: (name, klass) => registry.set(name, klass) },
  window: {}, setInterval: () => 1, clearInterval() {}
});
const Card = registry.get('ha-motogp-card');
const card = new Card(); card.setConfig({ mode: 'both' });
const state = (value, attributes = {}) => ({ state: value, attributes });
let entities = {
  'sensor.motogp_next_race': state('Test GP', { sessions_all: [
    { id: 'moto3-fp1', date: '2026-09-18T09:00:00+00:00', category: 'Moto3', name: 'FP1' }] }),
  'sensor.motogp_current_session': state('FP1', { category: 'Moto3', event: 'Test GP' }),
  'sensor.motogp_session_status': state('In Progress', { category: 'Moto3', session_status_id: 'S' }),
  'sensor.motogp_rider_positions': state('riders', { category: 'Moto3', riders: [
    { position: 1, surname: 'SECRET_RIDER', number: 17 }] }),
  'sensor.motogp_race_lap_count': state('1'),
  'sensor.motogp_session_time_remaining': state('100'),
  'switch.motogp_no_spoiler': state('off')
};
const push = changes => { entities = { ...entities, ...changes }; card.hass = { states: entities }; };
push({});
assert.ok(card._snapshot, 'LIVE should create snapshot');
assert.match(card.view.innerHTML, /SECRET_RIDER/, 'Initially visible LIVE name');
push({ 'switch.motogp_no_spoiler': state('on') });
assert.equal(card._snapshot, null, 'Spoiler switch erases historical snapshot');
assert.match(card.view.innerHTML, /Spoilerläge aktivt/, 'Spoiler placeholder shown');
assert.doesNotMatch(card.view.innerHTML, /SECRET_RIDER/, 'No cached rider leak');
push({
  'switch.motogp_no_spoiler': state('off'),
  'sensor.motogp_session_status': state('Finished', { category: 'Moto3', session_status_id: 'F' })
});
assert.ok(card._snapshot, 'Finished session may display only after spoilers disabled');
push({ 'sensor.motogp_session_status': state('Not Started', { category: 'Moto3', session_status_id: 'N' }) });
assert.ok(card._snapshot, 'Waiting period retains prior session');
now = Date.parse('2026-09-19T00:01:00+02:00');
card._render();
assert.equal(card._snapshot, null, 'Old session expires at midnight');
assert.doesNotMatch(card.view.innerHTML, /SECRET_RIDER/, 'No previous-day rider leak');
console.log('PASS: spoiler erases snapshot; hidden names do not render; midnight expires historical results');
