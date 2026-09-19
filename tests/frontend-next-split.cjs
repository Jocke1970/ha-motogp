'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
process.env.TZ = 'Europe/Stockholm';
const read = name => fs.readFileSync(`${__dirname}/../${name}`, 'utf8');
const registry = new Map();
const OldMobile = class {};
registry.set('ha-motogp-card', OldMobile);
class Element {
  attachShadow() {
    this.view = {innerHTML: ''};
    this.shadowRoot = {innerHTML: '', addEventListener() {}, contains() {return true;},
      getElementById: id => id === 'app' ? this.view : null};
    return this.shadowRoot;
  }
}
const RealDate = Date;
class Clock extends RealDate {
  constructor(...args) {super(...(args.length ? args : [RealDate.parse('2026-09-19T11:00:00+02:00')]));}
}
const ctx = {Date: Clock, HTMLElement: Element, window: {customCards: []}, console,
  setInterval: () => 1, clearInterval() {},
  customElements: {get: name => registry.get(name), define: (name, klass) => {
    assert.ok(!registry.has(name), `Duplicate element: ${name}`);registry.set(name, klass);
  }, whenDefined: name => Promise.resolve(registry.get(name))}};
vm.runInNewContext(read('frontend/ha-motogp-next-card.js'), ctx);
const Base = registry.get('ha-motogp-next-card');
assert.equal(Base.buildInfo.version, '0.2.0-dev.4');
const split = read('frontend/ha-motogp-next-split.js');
vm.runInNewContext(split, ctx);
vm.runInNewContext(split, ctx);
assert.equal(registry.get('ha-motogp-card'), OldMobile);
assert.equal(registry.get('ha-motogp-next-card'), Base);
assert.equal(ctx.window.customCards.filter(card => card.type === 'ha-motogp-next-timing-card').length, 1);
const Overview = registry.get('ha-motogp-next-overview-card');
const Timing = registry.get('ha-motogp-next-timing-card');
const overview = new Overview(), timing = new Timing();
overview.setConfig({type: 'custom:ha-motogp-next-overview-card'});
timing.setConfig({type: 'custom:ha-motogp-next-timing-card'});
assert.equal(timing.getGridOptions().min_columns, 12);
assert.match(timing.shadowRoot.innerHTML, /min-width:900px/);
const entity = (state, attributes = {}) => ({state, attributes});
const meta = {event: 'Qatar Airways Grand Prix of Austria', category: 'MotoGP',
  session_shortname: 'Q1', championship_id: 3};
let states = {
  'sensor.motogp_next_race': entity('GRAND PRIX OF AUSTRIA', {date_start: '2026-09-19',
    date_end: '2026-09-20', sessions_all: [{id: 'q1', category: 'MotoGP', name: 'Q1',
      date: '2026-09-19T10:50:00+00:00', status: 'IN-PROGRESS'}]}),
  'sensor.motogp_current_session': entity('Q1', meta),
  'sensor.motogp_session_status': entity('In Progress', {...meta, session_status_id: 'S', tv_delay_effective_seconds: 17}),
  'sensor.motogp_rider_positions': entity('1 rider', {...meta, tv_delay_seconds: 15,
    tv_delay_ready: true, riders: [{surname: 'FERNANDEZ', position: 1, number: 25,
      team: 'Aprilia', num_lap: 3, last_lap_time: "1'41.749", gap_first: '0.000', color: '#0077cc'}]}),
  'sensor.motogp_race_lap_count': entity('3', {num_laps: 0}),
  'sensor.motogp_session_time_remaining': entity('467'),
  'sensor.motogp_track_weather': entity('No data', {air: '0'}),
  'switch.motogp_no_spoiler': entity('off')
};
overview.hass = {states};timing.hass = {states};
assert.match(overview.view.innerHTML, /Helgens schema/);
assert.match(overview.view.innerHTML, /Banväder/);
assert.doesNotMatch(overview.view.innerHTML, /data-timing/);
assert.doesNotMatch(timing.view.innerHTML, /Helgens schema|Banväder|GRAND PRIX OF AUSTRIA/);
assert.match(timing.view.innerHTML, /data-timing aria-expanded="true"/);
assert.match(timing.view.innerHTML, /7:47 kvar/);
assert.match(timing.view.innerHTML, /FERNANDEZ/);
assert.match(timing.view.innerHTML, /<span class="num">3<\/span>/);
assert.doesNotMatch(timing.view.innerHTML, />L3<|>L 3</);
timing._click({target: {closest: () => ({dataset: {timing: ''}})}});
assert.match(timing.view.innerHTML, /data-timing aria-expanded="false"/);
assert.match(overview.view.innerHTML, /Helgens schema/);
states = {...states, 'switch.motogp_no_spoiler': entity('on')};
timing.hass = {states};
assert.doesNotMatch(timing.view.innerHTML, /FERNANDEZ/);
assert.match(timing.view.innerHTML, /Spoilerläge/);
console.log('PASS: dev.4 and mobile preserved; isolated overview/full-width timing; Q1 timer, lap without L, expander, spoiler');
