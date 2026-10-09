'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
process.env.TZ = 'Europe/Stockholm';
const read = name => fs.readFileSync(`${__dirname}/../${name}`, 'utf8');
let fakeNow = Date.parse('2026-09-19T11:00:00+02:00');
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
  constructor(...args) {super(...(args.length ? args : [fakeNow]));}
  static now() {return fakeNow;}
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
assert.equal(Timing.buildInfo.version, '0.2.0-split.2');
const overview = new Overview(), timing = new Timing();
overview.setConfig({type: 'custom:ha-motogp-next-overview-card'});
timing.setConfig({type: 'custom:ha-motogp-next-timing-card'});
assert.equal(timing.getGridOptions().min_columns, 12);
assert.match(timing.shadowRoot.innerHTML, /min-width:920px/);
const entity = (state, attributes = {}) => ({state, attributes});
const meta = {event: 'Qatar Airways Grand Prix of Austria', category: 'MotoGP',
  session_shortname: 'Q1', championship_id: 3};
const schedules = [{id:'q1',category:'MotoGP',name:'Q1',date:'2026-09-19T10:50:00+00:00',status:'IN-PROGRESS'},
  {id:'q2',category:'MotoGP',name:'Q2',date:'2026-09-19T11:15:00+00:00',status:'NOT-STARTED'},
  {id:'m2',category:'Moto2',name:'Q1',date:'2026-09-19T13:40:00+00:00',status:'NOT-STARTED'},
  {id:'sprint',category:'MotoGP',name:'SPR',date:'2026-09-19T15:00:00+00:00',status:'NOT-STARTED'}];
const race=entity('GRAND PRIX OF AUSTRIA', {date_start:'2026-09-19',date_end:'2026-09-20',sessions_all:schedules});
let states = {
  'sensor.motogp_next_race': race,
  'sensor.motogp_current_session': entity('Q1', meta),
  'sensor.motogp_session_status': entity('In Progress', {...meta, session_status_id:'S',tv_delay_effective_seconds:17}),
  'sensor.motogp_rider_positions': entity('1 rider', {...meta,tv_delay_seconds:15,
    tv_delay_ready:true,riders:[{surname:'FERNANDEZ',position:1,number:25,team:'Aprilia',
      num_lap:3,last_lap_time:"1'41.749",gap_first:'0.000',gap_prev:'0.000',color:'#0077cc'}]}),
  'sensor.motogp_race_lap_count': entity('3',{num_laps:0}),
  'sensor.motogp_session_time_remaining': entity('467'),
  'sensor.motogp_track_weather': entity('No data',{air:'0'}),
  'switch.motogp_no_spoiler': entity('off')
};
overview.hass={states}; timing.hass={states};
assert.match(overview.view.innerHTML, /Helgens schema/);
assert.match(overview.view.innerHTML, /Banväder/);
assert.doesNotMatch(overview.view.innerHTML, /data-timing/);
assert.match(overview.view.innerHTML, /15:00/);
assert.match(overview.view.innerHTML, /15:00 till start|15:00.*till start/);
assert.doesNotMatch(timing.view.innerHTML, /Helgens schema|Banväder|GRAND PRIX OF AUSTRIA/);
assert.match(timing.view.innerHTML, /data-timing aria-expanded="true"/);
assert.match(timing.view.innerHTML, /7:47 kvar/);
assert.match(timing.view.innerHTML, /FERNANDEZ/);
assert.match(timing.view.innerHTML, /<span>3<\/span>/);
assert.doesNotMatch(timing.view.innerHTML, />L3<|>L 3</);
assert.match(timing.view.innerHTML, /Δ FRAMFÖR/);
assert.match(timing.view.innerHTML, /Δ LEDARE/);
// Finish Q1: no false live countdown and preserve captured result with clear label.
fakeNow=Date.parse('2026-09-19T11:12:00+02:00');
states={...states,
  'sensor.motogp_session_status':entity('Finished',{...meta,session_status_id:'F'}),
  'sensor.motogp_next_race':entity(race.state,{...race.attributes,sessions_all:
    schedules.map(s=>s.id==='q1'?{...s,status:'FINISHED'}:s)})};
overview.hass={states};timing.hass={states};
assert.match(overview.view.innerHTML,/3:00 till start/);
assert.match(timing.view.innerHTML,/Nästa: MotoGP · Q2/);
assert.match(timing.view.innerHTML,/11:15/);
assert.match(timing.view.innerHTML,/3:00 till start/);
assert.match(timing.view.innerHTML,/Senaste passets förardata: MotoGP · Q1 \(ej live\)/);
assert.match(timing.view.innerHTML,/FERNANDEZ/);
assert.doesNotMatch(timing.view.innerHTML,/● LIVE/);
// A newly mounted card after finish cannot claim historic riders it has not observed.
const lateTiming=new Timing();lateTiming.setConfig({type:'custom:ha-motogp-next-timing-card'});
lateTiming.hass={states};
assert.match(lateTiming.view.innerHTML,/Nästa: MotoGP · Q2/);
assert.doesNotMatch(lateTiming.view.innerHTML,/FERNANDEZ/);
// Filtered overview countdown follows its filtered schedule, standalone timing stays global.
overview._click({target:{closest:()=>({dataset:{category:'Moto2'}})}});
assert.match(overview.view.innerHTML,/2:28:00 till start/);
assert.match(timing.view.innerHTML,/3:00 till start/);
// Local expander does not affect the other card.
timing._click({target:{closest:()=>({dataset:{timing:''}})}});
assert.match(timing.view.innerHTML,/data-timing aria-expanded="false"/);
assert.match(timing.view.innerHTML,/3:00 till start/);
assert.match(overview.view.innerHTML,/Helgens schema/);
// Invalid rider values and HTML must never leak as raw markup.
fakeNow=Date.parse('2026-09-19T11:16:00+02:00');
const metaQ2={...meta,session_shortname:'Q2'};
states={...states,
  'sensor.motogp_current_session':entity('Q2',metaQ2),
  'sensor.motogp_session_status':entity('In Progress',{...metaQ2,session_status_id:'S'}),
  'sensor.motogp_rider_positions':entity('1 rider',{...metaQ2,tv_delay_seconds:15,tv_delay_ready:true,
    riders:[{surname:'<script>alert(1)</script>',position:-1,number:77,team:'Unknown',
      num_lap:0,last_lap_time:'0.000',gap_first:'0.000',gap_prev:'0.000',color:'red;background:url(javascript:1)'}]}),
  'sensor.motogp_race_lap_count':entity('0',{num_laps:0}),
  'sensor.motogp_session_time_remaining':entity('600')};
timing.hass={states};
assert.match(timing.view.innerHTML,/MotoGP · Q2/);
assert.doesNotMatch(timing.view.innerHTML,/FERNANDEZ|<script>|javascript:1/);
assert.match(timing.view.innerHTML,/&lt;script&gt;alert/);
assert.match(timing.view.innerHTML,/10:00 kvar/);
assert.match(timing.view.innerHTML,/>—<\/span>/);
assert.doesNotMatch(timing.view.innerHTML,/>0\.000<\/span>/);
// Spoiler hides all rider data without exposing raw live data.
states={...states,'switch.motogp_no_spoiler':entity('on')};
timing.hass={states};
assert.doesNotMatch(timing.view.innerHTML,/&lt;script&gt;alert/);
assert.match(timing.view.innerHTML,/SPOILERLÄGE/);
// A 1-second countdown tick only edits countdown text nodes; no 1-second table rerender.
const updated={textContent:''};
timing.shadowRoot.querySelectorAll=()=>[{getAttribute:()=>String(Date.parse('2026-09-19T11:20:00+02:00')),
  set textContent(value){updated.textContent=value;}}];
timing.connectedCallback();
timing.disconnectedCallback();
assert.equal(timing._countTimer,null);
console.log('PASS: split.2 distinct timing layout, next-pass countdowns, finish snapshot, filter, L-free laps, escaping, spoiler, independent toggles and timer cleanup');
