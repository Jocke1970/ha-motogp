/* MotoGP Next: strict live-feed identity + schedule regression. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.env.TZ = 'Europe/Stockholm';
const code = fs.readFileSync(path.join(__dirname, '../frontend/ha-motogp-next-card.js'), 'utf8');
let now = Date.parse('2026-09-18T14:50:00+02:00');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const registry = new Map();
const originalMobile = class OriginalMobile {};
registry.set('ha-motogp-card', originalMobile);
class Element {
  attachShadow() {
    this.view = {innerHTML:''};
    this.shadowRoot = {innerHTML:'', addEventListener(){}, contains(){return true;},
      getElementById:id => id === 'app' ? this.view : null};
    return this.shadowRoot;
  }
}
let timers = 0;
const ctx = {customElements:{get:n=>registry.get(n), define:(n,c)=>registry.set(n,c)},
  HTMLElement:Element, window:{customCards:[]}, Date:Clock,
  setInterval:()=>++timers, clearInterval:()=>--timers, console};
vm.runInNewContext(code,ctx,{filename:'ha-motogp-next-card.js'});
const Card = registry.get('ha-motogp-next-card');
assert.equal(registry.get('ha-motogp-card'),originalMobile);
assert.equal(Card.buildInfo.version,'0.2.0-dev.3');
vm.runInNewContext(code,ctx);
assert.equal(registry.get('ha-motogp-next-card'),Card,'Duplicate load does not replace card');
const card = new Card();card.setConfig({type:'custom:ha-motogp-next-card'});
const state = (value,attributes={})=>({state:value,attributes});
const sessions = [
  {id:'a',category:'Moto3',name:'FP1',date:'2026-09-18T09:00:00+00:00',status:'FINISHED'},
  {id:'b',category:'Moto2',name:'FP1',date:'2026-09-18T10:00:00+00:00',status:'FINISHED'},
  {id:'c',category:'MotoGP',name:'Practice',date:'2026-09-18T15:00:00+00:00',status:'NOT-STARTED'},
  {id:'d',category:'Moto3',name:'FP2',date:'2026-09-19T08:40:00+00:00',status:'NOT-STARTED'},
  {id:'e',category:'MotoGP',name:'Race',date:'2026-09-20T14:00:00+00:00',status:'NOT-STARTED'}
];
const race = list=>state('GRAND PRIX OF AUSTRIA', {date_start:'2026-09-18',date_end:'2026-09-20',
  circuit:'Red Bull Ring - Spielberg',country:'Austria',sessions_all:list});
let entities = {
  'sensor.motogp_next_race':race(sessions),
  'sensor.motogp_current_session':state('unknown'),
  'sensor.motogp_session_status':state('unknown'),
  'sensor.motogp_rider_positions':state('No riders'),
  'sensor.motogp_session_time_remaining':state('2100'),
  'sensor.motogp_race_lap_count':state('4',{num_laps:20}),
  'sensor.motogp_track_weather':state('No data',{air:'0',ground:'0',humidity:'0',track:'',weather:''}),
  'switch.motogp_no_spoiler':state('off')
};
const push=change=>{entities={...entities,...change};card.hass={states:entities};};
const html=()=>card.view.innerHTML;
const click=dataset=>card._click({target:{closest:()=>({dataset})}});
const opened=(day,value)=>assert.match(html(),new RegExp(`data-day="${day}" aria-expanded="${value}"`));
push({});
assert.match(html(),/GRAND PRIX OF AUSTRIA/);
assert.match(html(),/18–20 sep/);
assert.doesNotMatch(html(),/2026-09-26T11:00:00/);
opened('2026-09-18',true);opened('2026-09-19',false);opened('2026-09-20',false);
assert.match(html(),/class="daybtn today"[^>]*data-day="2026-09-18"/);
assert.equal((html().match(/class="tile done"/g)||[]).length,2);
assert.match(html(),/Inga banväderdata rapporterade ännu/);
assert.doesNotMatch(html(),/<b>0°C<\/b>/);
// Confirmed last session expands tomorrow while today's tiles remain gray.
now=Date.parse('2026-09-18T15:10:00+02:00');
const confirmed=sessions.map(s=>s.id==='c'?{...s,status:'FINISHED'}:s);
push({'sensor.motogp_next_race':race(confirmed)});
opened('2026-09-18',true);opened('2026-09-19',true);opened('2026-09-20',false);
assert.equal((html().match(/class="tile done"/g)||[]).length,3);
click({day:'2026-09-18'});opened('2026-09-18',false);opened('2026-09-19',true);
click({day:'2026-09-18'});opened('2026-09-18',true);
click({day:'2026-09-19'});opened('2026-09-19',false);
click({day:'2026-09-19'});opened('2026-09-19',true);
click({category:'Moto2'});assert.match(html(),/Moto2 · 1 pass/);
assert.doesNotMatch(html(),/data-day="2026-09-19"/);
click({category:'Total'});opened('2026-09-18',true);opened('2026-09-19',true);
card._dayOverrides.clear();now=Date.parse('2026-09-18T16:59:00+02:00');
push({'sensor.motogp_next_race':race(sessions)});
opened('2026-09-18',true);opened('2026-09-19',false);
assert.match(html(),/PASSERAT/);
now=Date.parse('2026-09-18T17:01:00+02:00');card._render();
opened('2026-09-18',true);opened('2026-09-19',true);
push({'sensor.motogp_track_weather':state('Dry',{air:'17',ground:'24',humidity:'65',track:'Dry'})});
assert.match(html(),/17°C/);assert.match(html(),/24°C/);assert.match(html(),/65%/);
// The real synchronized backend exposes these identity attributes on all three live sensors.
const meta={category:'MotoGP',event:'GRAND PRIX OF AUSTRIA',session_shortname:'Practice',championship_id:'3'};
const rider=(name,extra={})=>({position:1,surname:name,number:12,color:'d01010',team:'Team',
  num_lap:4,last_lap_time:"1'29.100",...extra});
push({
  'sensor.motogp_current_session':state('Practice',meta),
  'sensor.motogp_session_status':state('In Progress',{...meta,session_status_id:'S',tv_delay_effective_seconds:15}),
  'sensor.motogp_rider_positions':state('2 riders',{...meta,riders:[rider('RIDER ONE'),
    {...rider('SECOND RIDER'),position:2,number:14,gap_first:'+1.200',gap_prev:'+0.500',on_pit:true}]})
});
card._dayOverrides.clear();card._render();opened('2026-09-19',false);
assert.match(html(),/data-timing aria-expanded="true"/);
assert.match(html(),/RIDER ONE/);assert.match(html(),/SECOND RIDER/);
assert.match(html(),/\+0.500/);assert.match(html(),/DEPÅ/);
assert.match(html(),/TV-delay: 15 s/);
click({timing:''});assert.match(html(),/data-timing aria-expanded="false"/);
push({'sensor.motogp_track_weather':state('Dry',{air:'18',ground:'26',humidity:'64',track:'Dry'})});
assert.match(html(),/data-timing aria-expanded="false"/);
push({'sensor.motogp_session_status':state('Finished',{...meta,session_status_id:'F'})});
click({timing:''});assert.match(html(),/RIDER ONE/);assert.match(html(),/SENASTE PASS/);
// A new session with old rider metadata must not render stale rider names.
const moto3={category:'Moto3',event:meta.event,session_shortname:'FP1',championship_id:'1'};
push({'sensor.motogp_current_session':state('FP1',moto3),
  'sensor.motogp_session_status':state('In Progress',{...moto3,session_status_id:'S'})});
assert.doesNotMatch(html(),/RIDER ONE/);assert.match(html(),/VÄNTAR PÅ MATCHANDE DATA/);
// Update to a session actually present in today's calendar.
const newMeta={category:'Moto2',event:meta.event,session_shortname:'FP1',championship_id:'2'};
push({'sensor.motogp_current_session':state('FP1',newMeta),
  'sensor.motogp_session_status':state('In Progress',{...newMeta,session_status_id:'S'}),
  'sensor.motogp_rider_positions':state('1 rider',{...newMeta,riders:[rider('NEW RIDER')]})});
assert.match(html(),/data-timing aria-expanded="true"/);assert.match(html(),/NEW RIDER/);
// A racer list with a mismatching event, class, or session must never render.
push({'sensor.motogp_rider_positions':state('old riders',{...meta,riders:[rider('STALERIDER')]})});
assert.doesNotMatch(html(),/STALERIDER/);assert.match(html(),/VÄNTAR PÅ MATCHANDE DATA/);
push({'switch.motogp_no_spoiler':state('on')});
assert.doesNotMatch(html(),/NEW RIDER|STALERIDER/);assert.equal(card._snapshot,null);
now=Date.parse('2026-09-19T00:01:00+02:00');card._render();
opened('2026-09-19',true);opened('2026-09-18',false);opened('2026-09-20',false);
card.connectedCallback();card.connectedCallback();assert.equal(timers,1);
card.disconnectedCallback();assert.equal(timers,0);
console.log('PASS: old mobile isolation, dual-day schedule, local toggles, strict live identities, riders, delay, snapshot, spoiler and midnight');
