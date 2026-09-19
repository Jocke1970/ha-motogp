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
const rider=(p)=>({position:p,number:30+p,surname:`RIDER${p}`,num_lap:3,last_lap_time:"1'42.123",gap_prev:p===1?'0.000':'.123',gap_first:p===1?'0.000':'.123'});
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
  assert.equal((timing.view.innerHTML.match(/Q2 ↑/g)||[]).length,4,'Moto2 Q1 4 riders marked');
  assert.match(timing.view.innerHTML,/Q2-GRÄNS · preliminärt/);
  assert.match(timing.shadowRoot.innerHTML,/nt-heading>span:nth-child\(2\)\{text-align:center\}/);
  assert.match(timing.view.innerHTML,/data-live-remaining/);
  timing.connectedCallback();const tick=timers.find(t=>t.ms===1000&&t.fn.toString().includes('refreshLiveClock'));
  assert.ok(tick,'local 1-second clock timer');tick.fn();now+=2000;tick.fn();
  assert.equal(timing.liveNode.textContent,'8:18 kvar');
  push({'sensor.motogp_session_time_remaining':e('300')});tick.fn();
  assert.equal(timing.liveNode.textContent,'5:00 kvar','new sensor value resyncs');
  now=Date.parse('2026-09-19T13:47:00+02:00');
  push({'sensor.motogp_session_status':e('Finished',{...meta('Moto2','Q1'),session_status_id:'F'}),
    'sensor.motogp_next_race':race(sessions.map(s=>s.id==='m2q1'?{...s,status:'FINISHED'}:s))});
  assert.match(timing.view.innerHTML,/RIDER1/,'finished result still visible before cutoff');
  now=Date.parse('2026-09-19T13:50:00+02:00');timing._render();
  assert.doesNotMatch(timing.view.innerHTML,/RIDER1/,'old riders cleared 15min before Q2');
  now=Date.parse('2026-09-19T15:04:00+02:00');
  push({'sensor.motogp_next_race':race(sessions.map(s=>s.id==='m2q1'||s.id==='m2q2'?{...s,status:'FINISHED'}:s))});
  assert.match(timing.view.innerHTML,/Nästa: MotoGP · Sprint/,'start passed but Sprint remains next');
  assert.doesNotMatch(timing.view.innerHTML,/Nästa: MotoGP · Warm Up/);
  assert.match(overview.view.innerHTML,/INVÄNTAR STATUS/,'schedule does not pretend a started session finished');
  now=Date.parse('2026-09-19T10:55:00+02:00');
  const q1=[{id:'gpq1',category:'MotoGP',name:'Q1',date:'2026-09-19T10:50:00+00:00',status:'IN-PROGRESS'},
    {id:'gpq2',category:'MotoGP',name:'Q2',date:'2026-09-19T11:15:00+00:00',status:'NOT-STARTED'}];
  push({'sensor.motogp_next_race':race(q1),...live('MotoGP','Q1',[rider(1),rider(2),rider(3)])});
  assert.equal((timing.view.innerHTML.match(/Q2 ↑/g)||[]).length,2,'MotoGP Q1 only first 2 marked');
  push({'switch.motogp_no_spoiler':e('on')});
  assert.doesNotMatch(timing.view.innerHTML,/Q2 ↑|RIDER1/,'spoiler must hide rider info');
  timing.disconnectedCallback();overview.disconnectedCallback();
  assert.ok(!bundle.includes('hass.callService('),'one file remains read-only');
  console.log('PASS: single bundle, started session, 15min cleanup, Moto2/MotoGP Q1, live second clock, sensor resync, spoiler, stable custom elements');
})().catch(err=>{console.error(err);process.exitCode=1;});
