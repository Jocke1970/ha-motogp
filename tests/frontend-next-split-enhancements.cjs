const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../frontend/ha-motogp-next-split-enhancements.js'),'utf8');
class Overview { _schedule(){ return this.mockHTML; } }
class Timing { _timing(){ return this.mockHTML; } }
Overview.buildInfo={version:'0.2.0-split.2'};
Timing.buildInfo={version:'0.2.0-split.2'};
const classes={'ha-motogp-next-overview-card':Overview,'ha-motogp-next-timing-card':Timing};
const context={console,Date,customElements:{get:x=>classes[x],whenDefined:()=>Promise.resolve()},
  document:{createElement:()=>({setAttribute(){},textContent:''})}};
const root=()=>({items:[],querySelector(){return this.items[0]||null;},appendChild(x){this.items.push(x);}});
const tile=(time,name)=>`<div class="tile "><div class="row"><strong>${time}</strong><span class="badge ">KOMMANDE</span></div><div class="name">${name}</div></div>`;
const group=(day,body)=>`<div class="day"><button class="daybtn" data-day="${day}">Dag</button><div class="tiles">${body}</div></div>`;
(async()=>{
vm.runInNewContext(code,context,{filename:'enhancements.js'});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(Overview.prototype._motogpEnhancements,'split-enhancements-20260919-01');
const o=new Overview();o.shadowRoot=root();o._filter='MotoGP';
o.mockHTML=group('2026-09-19',tile('12:45','Moto2 · Q1')+tile('13:30','MotoGP · Q1'))+
  group('2026-09-20',tile('13:30','MotoGP · Q1'));
const race={attributes:{date_start:'2026-09-19',date_end:'2026-09-20',sessions_all:[
  {date:'2026-09-19T12:45:00+00:00',name:'Q1',category:'Moto2'},
  {date:'2026-09-19T13:30:00+00:00',name:'Q1',category:'MotoGP'},
  {date:'2026-09-20T13:30:00+00:00',name:'Q1',category:'MotoGP'}]}};
const out=o._schedule(race,new Date(2026,8,19,13,5));
assert.equal((out.match(/data-next-start=/g)||[]).length,1,'one countdown');
assert.match(out,/MotoGP · Q1<\/div><div class="next-tile-clock"/,'in right tile');
assert.equal(o.shadowRoot.items.length,1,'style inserted once');
o._schedule(race,new Date(2026,8,19,13,5));
assert.equal(o.shadowRoot.items.length,1,'style not duplicated');
const t=new Timing();t.shadowRoot=root();t._ids={riders:'riders'};t._today='2026-09-19';
t._spoiler=()=>false;t._live={category:'MotoGP',name:'Q2'};
t._snapshot={day:'2026-09-19',riders:[
 {position:1,is_session_fastest:true,last_lap_time:"1'28.634",best_lap_time:"1'28.634",best_lap_number:3,last_lap:3},
 {position:2,is_session_fastest:false,last_lap_time:'1:30.000',best_lap_time:'1:30.000'}]};
t._hass={states:{riders:{attributes:{session_fastest_lap:"1'28.634",lap_history_partial:false}}}};
t.mockHTML='<div class="nt-row"><span>1</span><span>1&#39;28.634</span></div><div class="nt-row"><span>2</span><span>1:30.000</span></div>';
let timing=t._timing();
assert.equal((timing.match(/nt-fast-lap/g)||[]).length,1,'only record marked');
assert.match(timing,/⚡ 1&#39;28\.634/,'escaped and highlighted');
t._snapshot.riders[0].last_lap=4;
assert.doesNotMatch(t._timing(),/nt-fast-lap/,'stale best lap not marked');
t._snapshot.riders[0].last_lap=3;
t._hass.states.riders.attributes.session_fastest_lap='0.000';
assert.doesNotMatch(t._timing(),/nt-fast-lap/,'missing session fastest not marked');
t._hass.states.riders.attributes.session_fastest_lap="1'28.634";
t._spoiler=()=>true;
assert.equal(t._timing(),t.mockHTML,'no enhancements in spoiler');
assert.equal(t.shadowRoot.items.length,1,'timing style only once');
console.log('PASS: isolated split addon (countdown, filter, verified fast lap, HTML escaping, stale lap, spoiler, style once)');
})().catch(e=>{console.error(e);process.exitCode=1;});
