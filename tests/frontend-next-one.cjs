'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
process.env.TZ='Europe/Stockholm';
const bundle=fs.readFileSync(process.argv[2]||'/tmp/ha-motogp-next.js','utf8');
let now=Date.parse('2026-09-19T13:45:00+02:00');
class Clock extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const timers=[];const registry=new Map([['ha-motogp-card',class Original{}]]);
class Element {
  attachShadow(){
    this.view={innerHTML:''};this.liveNode={textContent:''};
    this.shadowRoot={innerHTML:'',addEventListener(){},contains(){return true;},
      appendChild(){},getElementById:()=>this.view,
      querySelector:(sel)=>sel==='[data-live-remaining]'&&this.view.innerHTML.includes('data-live-remaining')?this.liveNode:null,
      querySelectorAll:()=>[]};return this.shadowRoot;
  }
}
const ctx={Date:Clock,HTMLElement:Element,window:{customCards:[]},document:{createElement:()=>({setAttribute(){},textContent:''})},console,
  setInterval:(fn,ms)=>{const id=timers.length+1;timers.push({fn,ms,id});return id;},clearInterval:()=>{},
  customElements:{get:k=>registry.get(k),define:(k,v)=>{assert.ok(!registry.has(k),`duplicate ${k}`);registry.set(k,v);},whenDefined:k=>Promise.resolve(registry.get(k))}};
const e=(state,attributes={})=>({state,attributes});
const event='Qatar Airways Grand Prix of Austria';
const meta=(category,name)=>({event,category,session_shortname:name,championship_id:3});
const rider=p=>({position:p,number:30+p,surname:`RIDER${p}`,num_lap:3,last_lap_time:"1'42.123",gap_prev:p===1?'0.000':'.123',gap_first:p===1?'0.000':'.123'});
const sessions=[{id:'m2q1',category:'Moto2',name:'Q1',date:'2026-09-19T13:40:00+00:00',status:'IN-PROGRESS'},
{id:'m2q2',category:'Moto2',name:'Q2',date:'2026-09-19T14:05:00+00:00',status:'NOT-STARTED'},
{id:'spr',category:'MotoGP',name:'Sprint',date:'2026-09-19T15:00:00+00:00',status:'NOT-STARTED'},
{id:'wup',category:'MotoGP',name:'Warm Up',date:'2026-09-20T09:40:00+00:00',status:'NOT-STARTED'}];
const race=(items=sessions)=>e('GRAND PRIX OF AUSTRIA',{date_start:'2026-09-19',date_end:'2026-09-20',sessions_all:items});
const live=(category,name,riders)=>({
'sensor.motogp_current_session':e(name,meta(category,name)),
'sensor.motogp_session_status':e('In Progress',{...meta(category,name),session_status_id:'S'}),
'sensor.motogp_rider_positions':e('riders',{...meta(category,name),tv_delay_seconds:30,tv_delay_ready:true,riders})});
(async()=>{
  vm.runInNewContext(bundle,ctx);for(let i=0;i<6;i++)await Promise.resolve();
  const Overview=registry.get('ha-motogp-next-overview-card'),Timing=registry.get('ha-motogp-next-timing-card');
  assert.ok(Overview&&Timing);assert.equal(ctx.window.customCards.filter(c=>c.type==='ha-motogp-next-timing-card').length,1);
  const overview=new Overview(),timing=new Timing();
  overview.setConfig({type:'custom:ha-motogp-next-overview-card'});
  timing.setConfig({type:'custom:ha-motogp-next-timing-card'});
  let states={'sensor.motogp_next_race':race(),...live('Moto2','Q1',[1,2,3,4,5].map(rider)),
    'sensor.motogp_session_time_remaining':e('500'),
    'sensor.motogp_race_lap_count':e('3',{num_laps:0}),
    'sensor.motogp_track_weather':e('No data'),
    'switch.motogp_no_spoiler':e('off')};
  const push=x=>{states={...states,...x};overview.hass={states};timing.hass={states};};
  push({});
  assert.match(overview.view.innerHTML,/0\.3\.0-dev\.3/);
  assert.match(overview.view.innerHTML,/samlad testversion/);
  assert.doesNotMatch(overview.view.innerHTML,/testresurs/);
  assert.equal((timing.view.innerHTML.match(/Q2 ↑/g)||[]).length,4,'Moto2 Q1 4 riders marked');
  assert.match(timing.view.innerHTML,/Q2-GRÄNS · preliminärt/);
  assert.match(timing.shadowRoot.innerHTML,/nt-heading>span:nth-child\(2\)\{text-align:center\}/);
  assert.match(timing.view.innerHTML,/data-live-remaining/);
  timing.connectedCallback();const tick=timers.find(t=>t.ms===1000&&t.fn.toString().includes('refreshLiveClock'));
  assert.ok(tick,'local 1-second clock timer');tick.fn();now+=2000;tick.fn();
  assert.equal(timing.liveNode.textContent,'8:18 kvar');
  push({'sensor.motogp_session_time_remaining':e('300')});tick.fn();
  assert.equal(timing.liveNode.textContent,'5:00 kvar','new sensor value resyncs');
  const fast={...rider(1),last_lap:3,best_lap_number:3,best_lap_time:"1'42.123",is_session_fastest:true};
  const personal={...rider(2),last_lap:3,best_lap_number:3,best_lap_time:"1'42.456",last_lap_time:"1'42.456",is_session_fastest:false};
  const pos=e('riders',{...meta('Moto2','Q1'),tv_delay_seconds:30,tv_delay_ready:true,
    session_fastest_lap:"1'42.123",session_fastest_rider:'RIDER1',session_fastest_rider_number:31,
    session_fastest_lap_number:3,lap_history_partial:false,riders:[fast,personal,rider(3),rider(4),rider(5)]});
  pos.last_updated=new Date(now).toISOString();
  push({'sensor.motogp_rider_positions':pos});
  assert.match(timing.view.innerHTML,/Sessionens snabbaste varv:[\s\S]*RIDER1[\s\S]*1'42\.123/);
  assert.match(timing.view.innerHTML,/nt-fast-lap/,'session record also highlights latest lap');
  assert.match(timing.view.innerHTML,/nt-personal-best/,'independent PB for another rider');
  assert.match(timing.view.innerHTML,/data-motogp-feed-age="\d+"/,'freshness chip uses HA sensor timestamp');
  const slow={...fast,last_lap:4,last_lap_time:"1'43.000"};
  push({'sensor.motogp_rider_positions':{...pos,attributes:{...pos.attributes,riders:[slow,personal,rider(3),rider(4),rider(5)]}}});
  assert.match(timing.view.innerHTML,/Sessionens snabbaste varv:[\s\S]*1'42\.123/,
    'overall record survives a slower latest lap');
  assert.doesNotMatch(timing.view.innerHTML,/nt-fast-lap" title=/,
    'old session record cannot be labeled as a new fastest latest lap');
  now=Date.parse('2026-09-19T13:47:00+02:00');
  push({'sensor.motogp_session_status':e('Finished',{...meta('Moto2','Q1'),session_status_id:'F'}),
    'sensor.motogp_next_race':race(sessions.map(s=>s.id==='m2q1'?{...s,status:'FINISHED'}:s))});
  assert.match(timing.view.innerHTML,/RIDER1/,'finished result visible before cutoff');
  now=Date.parse('2026-09-19T13:50:00+02:00');timing._render();
  assert.doesNotMatch(timing.view.innerHTML,/RIDER1/,'old riders cleared 15min before Q2');
  now=Date.parse('2026-09-19T15:04:00+02:00');
  push({'sensor.motogp_next_race':race(sessions.map(s=>s.id==='m2q1'||s.id==='m2q2'?{...s,status:'FINISHED'}:s))});
  assert.match(timing.view.innerHTML,/Schemalagd: MotoGP · Sprint/,'recently started pass is not falsely next or live');
  assert.match(timing.view.innerHTML,/STARTTID PASSERAD · INVÄNTAR MATCHANDE DATA/);
  assert.doesNotMatch(timing.view.innerHTML,/● LIVE|RIDER1/);
  assert.match(overview.view.innerHTML,/INVÄNTAR STATUS/);
  now=Date.parse('2026-09-20T10:01:00+02:00');
  const sunday=[{id:'wup',category:'MotoGP',name:'Warm Up',date:'2026-09-20T09:40:00+00:00',status:'NOT-STARTED'},
    {id:'m3rac',category:'Moto3',name:'Race',date:'2026-09-20T11:00:00+00:00',status:'NOT-STARTED'},
    {id:'m2rac',category:'Moto2',name:'Race',date:'2026-09-20T12:15:00+00:00',status:'NOT-STARTED'},
    {id:'gprac',category:'MotoGP',name:'Race',date:'2026-09-20T14:00:00+00:00',status:'NOT-STARTED'}];
  push({'sensor.motogp_next_race':race(sunday)});
  assert.match(timing.view.innerHTML,/Nästa: Moto3 · Race/,'next means future start, never overdue Warm Up');
  assert.match(timing.view.innerHTML,/STATUS OKÄND: MotoGP Warm Up/,'unverified prior pass explicitly reported');
  assert.doesNotMatch(timing.view.innerHTML,/Nästa: MotoGP · Warm Up|RIDER1|● LIVE/);
  assert.match(overview.view.innerHTML,/Nästa: Moto3 Race/,'overview also advances to future start');
  now=Date.parse('2026-09-19T10:55:00+02:00');
  const q1=[{id:'gpq1',category:'MotoGP',name:'Q1',date:'2026-09-19T10:50:00+00:00',status:'IN-PROGRESS'},
    {id:'gpq2',category:'MotoGP',name:'Q2',date:'2026-09-19T11:15:00+00:00',status:'NOT-STARTED'}];
  push({'sensor.motogp_next_race':race(q1),...live('MotoGP','Q1',[rider(1),rider(2),rider(3)])});
  assert.equal((timing.view.innerHTML.match(/Q2 ↑/g)||[]).length,2,'MotoGP Q1 only first 2 marked');
  assert.doesNotMatch(timing.view.innerHTML,/Sessionens snabbaste varv:/,'old Moto2 record cannot leak into MotoGP');
  push({'switch.motogp_no_spoiler':e('on')});
  assert.doesNotMatch(timing.view.innerHTML,/Q2 ↑|RIDER1|nt-feed-age/,'spoiler must hide rider data and chip');
  timing.disconnectedCallback();overview.disconnectedCallback();
  assert.ok(!bundle.includes('hass.callService('),'one file remains read-only');
  console.log('PASS: one resource, next-start, Q1, local clock, PB, persistent session record, freshness, spoiler');
})().catch(err=>{console.error(err);process.exitCode=1;});
