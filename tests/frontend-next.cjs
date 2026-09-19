'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
process.env.TZ='Europe/Stockholm';
const code=fs.readFileSync(__dirname+'/../frontend/ha-motogp-next-card.js','utf8');
let now=Date.parse('2026-09-19T10:13:00+02:00');
class Clock extends Date {constructor(...x){super(...(x.length?x:[now]));}static now(){return now;}}
const registry=new Map([['ha-motogp-card',class Original{}]]);let timers=0;
class Element{attachShadow(){this.view={innerHTML:''};this.shadowRoot={innerHTML:'',addEventListener(){},contains(){return true;},getElementById:()=>this.view};return this.shadowRoot;}}
const ctx={Date:Clock,window:{customCards:[]},customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)},HTMLElement:Element,console,setInterval:()=>++timers,clearInterval:()=>--timers};
vm.runInNewContext(code,ctx);const Card=registry.get('ha-motogp-next-card');assert.equal(Card.buildInfo.version,'0.2.0-dev.4');
const card=new Card();card.setConfig({type:'custom:ha-motogp-next-card'});
const ent=(state,attributes={})=>({state,attributes});
const sessions=[{id:'a',category:'Moto2',name:'FP2',date:'2026-09-19T09:25:00+00:00',status:'NOT-STARTED'},
{id:'b',category:'MotoGP',name:'FP2',date:'2026-09-19T10:10:00+00:00',status:'NOT-STARTED'},
{id:'c',category:'MotoGP',name:'Sprint',date:'2026-09-19T15:00:00+00:00',status:'NOT-STARTED'},
{id:'d',category:'MotoGP',name:'Race',date:'2026-09-20T14:00:00+00:00',status:'NOT-STARTED'}];
let state={
'sensor.motogp_next_race':ent('GRAND PRIX OF AUSTRIA',{date_start:'2026-09-19',date_end:'2026-09-20',country:'Austria',sessions_all:sessions}),
'sensor.motogp_current_session':ent('FP2',{category:'MotoGP',event:'Qatar Airways Grand Prix of Austria',session_shortname:'FP2',championship_id:'3'}),
'sensor.motogp_session_status':ent('In Progress',{category:'MotoGP',event:'Qatar Airways Grand Prix of Austria',session_shortname:'FP2',championship_id:'3',session_status_id:'S',tv_delay_effective_seconds:20}),
'sensor.motogp_rider_positions':ent('27 riders',{category:'MotoGP',event:'Qatar Airways Grand Prix of Austria',session_shortname:'FP2',championship_id:'3',tv_delay_ready:true,riders:[{position:-1,surname:'UNCLASSIFIED',number:7,last_lap_time:'0.000',gap_first:'0.000',num_lap:0},{position:1,surname:'RIDERA & <script>',number:3,last_lap_time:"1'45.123",num_lap:3,gap_first:'0.000'}]}),
'sensor.motogp_race_lap_count':ent('3',{num_laps:0}),'sensor.motogp_session_time_remaining':ent('1376'),
'sensor.motogp_track_weather':ent('No data'),
'switch.motogp_no_spoiler':ent('unknown')};
const push=x=>{state={...state,...x};card.hass={states:state};};const html=()=>card.view.innerHTML;const click=x=>card._click({target:{closest:()=>({dataset:x})}});
push({});assert.match(html(),/MotoGP FP2/);assert.match(html(),/18–20 sep|19–20 sep/);assert.match(html(),/Inga banväderdata rapporterade ännu/);assert.match(html(),/data-day="2026-09-19" aria-expanded="true"/);assert.match(html(),/data-day="2026-09-20" aria-expanded="false"/);assert.match(html(),/data-timing aria-expanded="true"/);
assert.match(html(),/22:56 kvar/);assert.match(html(),/TV-delay 20 s/);assert.doesNotMatch(html(),/\/0|0\.000/);
assert.ok(html().indexOf('RIDERA')<html().indexOf('UNCLASSIFIED'));
assert.match(html(),/RIDERA &amp; &lt;script&gt;/);assert.doesNotMatch(html(),/<script>/);
assert.match(html(),/Pågår: MotoGP FP2/);assert.match(html(),/MotoGP · FP2/);
click({timing:''});assert.match(html(),/data-timing aria-expanded="false"/);assert.match(html(),/22:56 kvar/);assert.doesNotMatch(html(),/RIDERA/);
// Visible timer must update even with a manually folded rider list.
push({'sensor.motogp_session_time_remaining':ent('61')});assert.match(html(),/1:01 kvar/);assert.match(html(),/data-timing aria-expanded="false"/);
// Sprint gives lap count and lap countdown instead of seconds.
const meta={category:'MotoGP',event:'Qatar Airways Grand Prix of Austria',session_shortname:'Sprint',championship_id:'3'};
push({'sensor.motogp_current_session':ent('Sprint',meta),'sensor.motogp_session_status':ent('In Progress',{...meta,session_status_id:'S',tv_delay_effective_seconds:20}),
'sensor.motogp_rider_positions':ent('1 rider',{...meta,tv_delay_ready:true,riders:[{position:1,surname:'SPRINTRIDER',number:7,num_lap:8,last_lap_time:"1'27.100"}]}),
'sensor.motogp_race_lap_count':ent('8',{num_laps:14}),'sensor.motogp_session_time_remaining':ent('0')});
assert.match(html(),/Varv 8\/14/);assert.match(html(),/6 varv kvar/);assert.doesNotMatch(html(),/RIDERA/);
click({timing:''});assert.match(html(),/data-timing aria-expanded="false"/);assert.match(html(),/6 varv kvar/);
push({'sensor.motogp_race_lap_count':ent('9',{num_laps:14})});assert.match(html(),/5 varv kvar/);
// Never fabricate total laps; use current lap alone.
push({'sensor.motogp_race_lap_count':ent('10',{num_laps:0})});assert.match(html(),/Varv 10/);assert.doesNotMatch(html(),/varv kvar|\/0/);
// Mismatched rider category fails closed, so old FP2 riders do not leak into Sprint.
push({'sensor.motogp_rider_positions':ent('stale',{...meta,category:'Moto2',riders:[{position:1,surname:'STALERIDER'}]})});
assert.doesNotMatch(html(),/SPRINTRIDER|STALERIDER/);assert.match(html(),/VÄNTAR PÅ MATCHANDE DATA/);
// No raw feed while buffered delay not ready.
push({'sensor.motogp_rider_positions':ent('not ready',{...meta,tv_delay_seconds:15,tv_delay_ready:false,riders:[{position:1,surname:'SPOILER'}]})});assert.doesNotMatch(html(),/SPOILER/);
push({'switch.motogp_no_spoiler':ent('on')});assert.match(html(),/Spoilerläge – dolt/);assert.doesNotMatch(html(),/SPRINTRIDER/);
// Finished Saturday opens Sunday alongside today's completed sessions, with local overrides.
const done=sessions.map(x=>x.date.startsWith('2026-09-19')?{...x,status:'FINISHED'}:x);
push({'sensor.motogp_next_race':ent('GRAND PRIX OF AUSTRIA',{date_start:'2026-09-19',date_end:'2026-09-20',country:'Austria',sessions_all:done}),
'switch.motogp_no_spoiler':ent('off'),'sensor.motogp_session_status':ent('Finished',{...meta,session_status_id:'F'})});
assert.match(html(),/data-day="2026-09-19" aria-expanded="true"/);assert.match(html(),/data-day="2026-09-20" aria-expanded="true"/);
click({day:'2026-09-20'});assert.match(html(),/data-day="2026-09-20" aria-expanded="false"/);
click({day:'2026-09-20'});assert.match(html(),/data-day="2026-09-20" aria-expanded="true"/);
click({category:'Moto2'});assert.doesNotMatch(html(),/data-day="2026-09-20"/);click({category:'Total'});
now=Date.parse('2026-09-20T00:01:00+02:00');card._render();assert.match(html(),/data-day="2026-09-20" aria-expanded="true"/);
card.connectedCallback();card.connectedCallback();assert.equal(timers,1);card.disconnectedCallback();assert.equal(timers,0);
assert.ok(registry.has('ha-motogp-card'));console.log('PASS: sponsored event, live schedule, header timer folded/open, TV-delay, sprint laps and count, zero placeholders, escaping, mismatch, spoiler, midnight, resource isolation');
