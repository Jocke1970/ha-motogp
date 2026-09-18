/* Run with TZ=Europe/Stockholm node tests/frontend-next.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'Europe/Stockholm';
const source = fs.readFileSync(path.join(__dirname, '../frontend/ha-motogp-next-card.js'), 'utf8');
let now = Date.parse('2026-09-18T14:50:00+02:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const registry = new Map();
const legacy = class LegacyMobile {};
registry.set('ha-motogp-card', legacy);
class Element {
  attachShadow() {
    this._view = {innerHTML:''};
    this.shadowRoot = {innerHTML:'',addEventListener() {},contains() {return true;},
      getElementById:id => id === 'app' ? this._view : null};
    return this.shadowRoot;
  }
}
let timers = 0;
const context = {customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},
  HTMLElement:Element,window:{customCards:[]},Date:Clock,
  setInterval:()=>++timers,clearInterval:()=>--timers,console};
vm.runInNewContext(source,context,{filename:'ha-motogp-next-card.js'});
assert.equal(registry.get('ha-motogp-card'),legacy,'Original mobile custom element must remain untouched');
const Card = registry.get('ha-motogp-next-card');
assert.ok(Card && Card.buildInfo.version === '0.2.0-dev.2');
vm.runInNewContext(source,context,{filename:'ha-motogp-next-card.js'});
assert.equal(registry.get('ha-motogp-next-card'),Card,'Duplicate resource cannot replace registered card');
const card = new Card();
card.setConfig({type:'custom:ha-motogp-next-card'});
const state = (v,attributes={}) => ({state:v,attributes});
const sessions = [
  {id:'m3a',category:'Moto3',name:'FP1',date:'2026-09-18T09:00:00+00:00',status:'FINISHED'},
  {id:'m2a',category:'Moto2',name:'FP1',date:'2026-09-18T10:00:00+00:00',status:'FINISHED'},
  {id:'mga',category:'MotoGP',name:'Practice',date:'2026-09-18T15:00:00+00:00',status:'NOT-STARTED'},
  {id:'m3b',category:'Moto3',name:'FP2',date:'2026-09-19T08:40:00+00:00',status:'NOT-STARTED'},
  {id:'mgb',category:'MotoGP',name:'Race',date:'2026-09-20T14:00:00+00:00',status:'NOT-STARTED'}
];
let entities = {
  'sensor.motogp_next_race':state('GRAND PRIX OF AUSTRIA',{date_start:'2026-09-18',date_end:'2026-09-20',
    circuit:'Red Bull Ring - Spielberg',country:'Austria',sessions_all:sessions}),
  'sensor.motogp_current_session':state('unknown'),
  'sensor.motogp_session_status':state('unknown'),
  'sensor.motogp_rider_positions':state('No riders'),
  'sensor.motogp_track_weather':state('No data',{air:'0',ground:'0',humidity:'0',track:'',weather:''}),
  'switch.motogp_no_spoiler':state('off')
};
const push = change => {entities={...entities,...change};card.hass={states:entities};};
const html = () => card._view.innerHTML;
const click = dataset => card._click({target:{closest:()=>({dataset})}});
const opened = (day,value) => assert.match(html(),new RegExp(`data-day="${day}" aria-expanded="${value}"`));
push({});
assert.match(html(),/GRAND PRIX OF AUSTRIA/);
assert.match(html(),/18–20 sep/, 'Human-readable header date range');
assert.doesNotMatch(html(),/2026-09-26T11:00:00/);
opened('2026-09-18',true);opened('2026-09-19',false);opened('2026-09-20',false);
assert.match(html(),/class="daybtn today"[^>]*data-day="2026-09-18"/, 'Today marker independent of expansion');
assert.equal((html().match(/class="tile done"/g)||[]).length,2,'Completed sessions gray');
assert.match(html(),/Inga banväderdata rapporterade ännu/, 'No weather is an informative empty state');
assert.doesNotMatch(html(),/<b>0°C<\/b>/);
// API confirms final session: retain today's completed results and auto-open tomorrow.
now = Date.parse('2026-09-18T15:10:00+02:00');
const complete = sessions.map(s=>s.id==='mga'?{...s,status:'FINISHED'}:s);
push({'sensor.motogp_next_race':state('GRAND PRIX OF AUSTRIA',{date_start:'2026-09-18',date_end:'2026-09-20',
  circuit:'Red Bull Ring - Spielberg',country:'Austria',sessions_all:complete})});
opened('2026-09-18',true);opened('2026-09-19',true);opened('2026-09-20',false);
assert.equal((html().match(/class="tile done"/g)||[]).length,3);
assert.match(html(),/✓ KLART/);
// Each visible day is independently and instantly manually controllable.
click({day:'2026-09-18'});opened('2026-09-18',false);opened('2026-09-19',true);
click({day:'2026-09-18'});opened('2026-09-18',true);opened('2026-09-19',true);
click({day:'2026-09-19'});opened('2026-09-18',true);opened('2026-09-19',false);
click({day:'2026-09-19'});opened('2026-09-19',true);
click({category:'Moto2'});
assert.match(html(),/Moto2 · 1 pass/,'Local category selection');
opened('2026-09-18',true);
opened('2026-09-19',false); // Saturday has no Moto2 sessions in test data.
click({category:'Total'});
opened('2026-09-18',true);opened('2026-09-19',true);
// Feed can leave a past pass NOT-STARTED. Do not call it finished or open tomorrow too early.
card._dayOverrides.clear();
now = Date.parse('2026-09-18T16:59:00+02:00');
push({'sensor.motogp_next_race':state('GRAND PRIX OF AUSTRIA',{date_start:'2026-09-18',date_end:'2026-09-20',
  circuit:'Red Bull Ring - Spielberg',country:'Austria',sessions_all:sessions})});
opened('2026-09-18',true);opened('2026-09-19',false);
assert.match(html(),/PASSERAT/,'Elapsed start does not claim FINISHED');
now = Date.parse('2026-09-18T17:01:00+02:00');card._render();
opened('2026-09-18',true);opened('2026-09-19',true);
// A real active session suspends the next-day preview.
push({'sensor.motogp_track_weather':state('Dry',{air:'17',ground:'24',humidity:'65',track:'Dry'})});
assert.match(html(),/17°C/);assert.match(html(),/24°C/);assert.match(html(),/65%/);
push({'sensor.motogp_current_session':state('Practice',{category:'MotoGP',event:'GRAND PRIX OF AUSTRIA'}),
  'sensor.motogp_session_status':state('In Progress',{category:'MotoGP',session_status_id:'S'}),
  'sensor.motogp_rider_positions':state('1 rider',{category:'MotoGP',riders:[
    {position:1,surname:'RIDER ONE',number:'12',color:'d01010',team:'Team',num_lap:4,last_lap_time:"1'29.100"}]})});
card._dayOverrides.clear();card._render();
opened('2026-09-19',false);
assert.match(html(),/data-timing aria-expanded="true"/,'Live session auto-opens');
assert.match(html(),/RIDER ONE/);
click({timing:''});assert.match(html(),/data-timing aria-expanded="false"/);
push({'sensor.motogp_track_weather':state('Dry',{air:'18',ground:'26',humidity:'64',track:'Dry'})});
assert.match(html(),/data-timing aria-expanded="false"/,'Updates do not undo manual timing collapse');
push({'sensor.motogp_session_status':state('Finished',{category:'MotoGP',session_status_id:'F'})});
click({timing:''});assert.match(html(),/RIDER ONE/,'Completed snapshot remains available');
push({'switch.motogp_no_spoiler':state('on')});
assert.doesNotMatch(html(),/RIDER ONE/);assert.equal(card._snapshot,null,'No spoiler purges cached riders');
now = Date.parse('2026-09-19T00:01:00+02:00');card._render();
opened('2026-09-19',true);opened('2026-09-18',false);opened('2026-09-20',false);
card.connectedCallback();card.connectedCallback();assert.equal(timers,1);
card.disconnectedCallback();assert.equal(timers,0);
console.log('PASS: isolation, explicit and presumed last-pass transition, dual day/manual override, status honesty, empty weather, timing, spoiler and midnight');
