const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Timing { _timing(){return this.mockHTML;} }
Timing.buildInfo={version:'0.2.0-split.2'};
const context={console,Date,Map,customElements:{get:()=>Timing,whenDefined:()=>Promise.resolve()},document:{createElement:()=>({setAttribute(){},textContent:''})}};
const row=(p,last,prev,first)=>`<div class="nt-row"><span>${p}</span><span class="nt-person"><span class="nt-person-text"><b>Name</b><small>Team</small></span></span><span>7</span><span>${last}</span><span>${prev}</span><span>${first}</span><span>CL</span></div>`;
(async()=>{
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../frontend/ha-motogp-next-gap-trends.js'),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));
const t=new Timing();const styles=[];t.shadowRoot={querySelector:()=>styles[0]||null,appendChild:x=>styles.push(x)};
t._spoiler=()=>false;t._today='2026-09-19';t._event='San Marino';t._ids={riders:'positions'};
t._hass={states:{positions:{attributes:{session_fastest_lap:"1'28.634",event:'San Marino'}}}};
t._live={key:'session1'};
const a={rider_id:'a',position:1,gap_prev:'0.000',gap_first:'0.000',last_lap_time:"1'28.634",best_lap_time:"1'28.634",best_lap_number:7,last_lap:7,is_session_fastest:true};
const b={rider_id:'b',position:2,gap_prev:'0.450',gap_first:'0.450',last_lap_time:'1:29.000',best_lap_time:'1:28.000',is_session_fastest:false};
t._snapshot={day:t._today,category:'MotoGP',name:'Race',riders:[a,b]};
const render=()=>{t.mockHTML=row(1,'1&#39;28.634','—','LEDARE')+row(2,'1:29.000',b.gap_prev,b.gap_first);return t._timing();};
let out=render();assert.match(out,/nt-fast-lap/,'nested fast lap fixed');assert.doesNotMatch(out,/nt-gap-arrow/,'first sample no arrow');
b.gap_prev='0.620';b.gap_first='0.620';out=render();assert.match(out,/nt-gap-trend up/);assert.match(out,/▼/);
out=render();assert.match(out,/▼/,'unchanged rerender keeps prior trend');
b.gap_prev='0.410';b.gap_first='0.410';out=render();assert.match(out,/nt-gap-trend down/);assert.match(out,/▲/);
b.position=3;t.mockHTML=row(1,'1&#39;28.634','—','LEDARE')+row(3,'1:29.000',b.gap_prev,b.gap_first);assert.doesNotMatch(t._timing(),/nt-gap-arrow/,'position reset');
b.position=2;b.gap_prev='0.340';b.gap_first='0.340';render();
t._spoiler=()=>true;assert.equal(t._timing(),t.mockHTML,'spoiler hides added info');t._spoiler=()=>false;
t._live=null;out=render();assert.doesNotMatch(out,/nt-gap-arrow/,'no new trend from a finished snapshot');
t._live={key:'new-session'};out=render();assert.doesNotMatch(out,/nt-gap-arrow/,'session reset');
assert.equal(styles.length,1,'style once');console.log('PASS: nested row fastest lap, trend up/down, rerender persistence, position/session resets, spoiler, inactive snapshot, style once');
})().catch(e=>{console.error(e);process.exitCode=1;});
