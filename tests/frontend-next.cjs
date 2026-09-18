/* Run with TZ=Europe/Stockholm node tests/frontend-next.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'Europe/Stockholm';
const source = fs.readFileSync(path.join(__dirname, '../frontend/ha-motogp-next-card.js'), 'utf8');
let now = Date.parse('2026-09-18T21:17:00+02:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const registry = new Map();
const legacy = class LegacyMobile {};
registry.set('ha-motogp-card', legacy);
class Element {
  attachShadow() {
    this._view = { innerHTML: '' };
    this.shadowRoot = {
      innerHTML: '', addEventListener() {}, contains() { return true; },
      getElementById: id => id === 'app' ? this._view : null
    };
    return this.shadowRoot;
  }
}
let timers = 0;
const context = {
  customElements: { get: name => registry.get(name), define: (name, klass) => registry.set(name, klass) },
  HTMLElement: Element, window: {customCards:[]}, Date: Clock,
  setInterval: () => ++timers, clearInterval: () => --timers, console
};
vm.runInNewContext(source, context, {filename:'ha-motogp-next-card.js'});
assert.equal(registry.get('ha-motogp-card'), legacy, 'Existing mobile card must not be replaced');
const Card = registry.get('ha-motogp-next-card');
assert.ok(Card && Card.buildInfo.version === '0.2.0-dev.1');
vm.runInNewContext(source, context, {filename:'ha-motogp-next-card.js'});
assert.equal(registry.get('ha-motogp-next-card'), Card, 'Duplicate script must not replace registered card');
const card = new Card();
card.setConfig({type:'custom:ha-motogp-next-card'});
const state = (value, attributes = {}) => ({state:value, attributes});
const sessions = [
  {id:'m3a',category:'Moto3',name:'FP1',date:'2026-09-18T09:00:00+00:00',status:'FINISHED'},
  {id:'m2a',category:'Moto2',name:'FP1',date:'2026-09-18T10:00:00+00:00',status:'FINISHED'},
  {id:'mga',category:'MotoGP',name:'Practice',date:'2026-09-18T15:00:00+00:00',status:'FINISHED'},
  {id:'m3b',category:'Moto3',name:'FP2',date:'2026-09-19T08:40:00+00:00',status:'NOT-STARTED'},
  {id:'mgb',category:'MotoGP',name:'Race',date:'2026-09-20T14:00:00+00:00',status:'NOT-STARTED'}
];
let entities = {
  'sensor.motogp_next_race':state('GRAND PRIX OF AUSTRIA', {date_start:'2026-09-18',date_end:'2026-09-20',circuit:'Red Bull Ring - Spielberg',country:'Austria',sessions_all:sessions}),
  'sensor.motogp_current_session':state('unknown'),
  'sensor.motogp_session_status':state('unknown'),
  'sensor.motogp_rider_positions':state('No riders'),
  'sensor.motogp_track_weather':state('No data', {air:'0',ground:'0',humidity:'0',track:'',weather:''}),
  'switch.motogp_no_spoiler':state('off')
};
const push = changes => { entities = {...entities,...changes}; card.hass = {states:entities}; };
const html = () => card._view.innerHTML;
const click = dataset => card._click({target:{closest:()=>({dataset})}});
push({});
assert.match(html(), /GRAND PRIX OF AUSTRIA/, 'Render event from current backend, not raw calendar date');
assert.match(html(), /data-day="2026-09-18" aria-expanded="true"/, 'Today expanded');
assert.match(html(), /data-day="2026-09-19" aria-expanded="false"/, 'Saturday collapsed');
assert.match(html(), /data-day="2026-09-20" aria-expanded="false"/, 'Sunday collapsed');
assert.equal((html().match(/class="tile done"/g) || []).length, 3, 'Finished Friday tiles are gray');
assert.doesNotMatch(html(), /2026-09-26T11:00:00/, 'Do not show irrelevant raw calendar timestamp');
assert.doesNotMatch(html(), /<b>0°C<\/b>/, 'Zero placeholder is not a measured temperature');
click({category:'Moto2'});
assert.match(html(), /Moto2 · 1 pass/, 'Category filter is local');
assert.doesNotMatch(html(), /Moto3 · FP1/, 'Unselected category absent');
click({category:'Total'});
click({day:'2026-09-19'});
assert.match(html(), /data-day="2026-09-18" aria-expanded="false"/, 'Opening Saturday closes Friday');
assert.match(html(), /data-day="2026-09-19" aria-expanded="true"/);
click({day:'2026-09-18'});
push({'sensor.motogp_track_weather':state('Dry',{air:'17',ground:'24',humidity:'65',track:'Dry'})});
assert.match(html(), /17°C/); assert.match(html(), /24°C/); assert.match(html(), /65%/);
assert.match(html(), /data-timing aria-expanded="false"/, 'Before session and no snapshot, timing collapsed');
push({
  'sensor.motogp_current_session':state('Practice',{category:'MotoGP',event:'GRAND PRIX OF AUSTRIA'}),
  'sensor.motogp_session_status':state('In Progress',{category:'MotoGP',session_status_id:'S'}),
  'sensor.motogp_rider_positions':state('1 rider',{category:'MotoGP',riders:[{position:1,surname:'RIDER ONE',number:'12',color:'d01010',team:'Team',num_lap:4,last_lap_time:"1'29.100"}]})
});
assert.match(html(), /data-timing aria-expanded="true"/, 'Live session auto-opens');
assert.match(html(), /RIDER ONE/, 'Current riders shown');
click({timing:''});
assert.match(html(), /data-timing aria-expanded="false"/, 'Manual collapse immediate');
push({'sensor.motogp_track_weather':state('Dry',{air:'18',ground:'26',humidity:'64',track:'Dry'})});
assert.match(html(), /data-timing aria-expanded="false"/, 'Unrelated sensor updates do not reopen');
push({'sensor.motogp_session_status':state('Finished',{category:'MotoGP',session_status_id:'F'})});
assert.match(html(), /data-timing aria-expanded="false"/, 'Finish respects manual collapse');
click({timing:''});
assert.match(html(), /RIDER ONE/, 'Completed session remains viewable');
push({'switch.motogp_no_spoiler':state('on')});
assert.doesNotMatch(html(), /RIDER ONE/, 'No spoiler must purge visible cached riders');
assert.equal(card._snapshot, null, 'No spoiler purges snapshot');
now = Date.parse('2026-09-19T00:01:00+02:00');
card._render();
assert.match(html(), /data-day="2026-09-19" aria-expanded="true"/, 'Midnight moves today to Saturday');
assert.match(html(), /data-day="2026-09-18" aria-expanded="false"/, 'Friday now folded');
card.connectedCallback(); card.connectedCallback(); assert.equal(timers, 1, 'Only one interval');
card.disconnectedCallback(); assert.equal(timers, 0, 'Interval cleaned up');
console.log('PASS: isolated registration, current race, wall dates, daily expanders, gray past, local filtering, weather placeholders, timing, manual overrides, spoiler, midnight, timers');
