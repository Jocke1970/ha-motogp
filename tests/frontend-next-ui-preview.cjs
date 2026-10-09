'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
process.env.TZ='Europe/Stockholm';
let now=Date.parse('2026-09-20T13:46:00+02:00');
class Clock extends Date {constructor(...a){super(...(a.length?a:[now]));} static now(){return now;}}
const registry=new Map();
class Base {
  constructor(){this._today='2026-09-20';this._live={name:'Race',category:'MotoGP'};this._snapshot={day:this._today,name:'Race',category:'MotoGP',riders:[]};this._ids={race:'race'};this._hass={states:{}};this.view={innerHTML:''};this.shadowRoot={querySelector:()=>null,appendChild(){},getElementById:()=>this.view};this.hidden=false;this._filter='Total';}
  _spoiler(){return this.hidden;}
  _click(){this.legacyClicked=true;}
  _render(){this.view.innerHTML='<div class="root">OVERVIEW<div class="foot">old footer</div></div>';}
  _timing(){
    if(this.hidden)return 'HIDDEN';
    let text='<section><span class="nt-label">🏁 MotoGP · Race</span><div class="nt-session-record"><strong>⚡ fastest</strong></div><div class="nt-scroll"><div class="nt-table">'+
      '<div class="nt-row nt-heading"><span>POS</span><span>FÖRARE / TEAM</span><span>VARV</span><span>SENASTE</span><span>Δ FRAMFÖR</span><span>Δ LEDARE</span><span>STATUS</span></div>';
    for(const r of this._snapshot.riders)text+=`<div class="nt-row"><span>${r.position}</span>`+
      `<span class="nt-person"><span class="nt-color"></span><span class="nt-person-text"><b>${r.surname}</b><small>${r.team}</small></span></span>`+
      `<span>${r.num_lap}</span><span class="nt-fast-lap">⚡ ${r.last_lap_time} <span class="nt-pb-chip">PB</span></span>`+
      `<span>+0.200</span><span>+1.100</span><span>${r.status_name}</span></div>`;
    return text+'</div></div></section>';
  }
}
class Overview extends Base{}class Timing extends Base{}
Overview.buildInfo={version:'0.2.0-split.2'};Timing.buildInfo={version:'0.2.0-split.2'};
registry.set('ha-motogp-next-overview-card',Overview);registry.set('ha-motogp-next-timing-card',Timing);
const ctx={Date:Clock,console,document:{createElement:()=>({setAttribute(){},textContent:''})},
  customElements:{get:name=>registry.get(name),whenDefined:name=>Promise.resolve(registry.get(name))}};
(async()=>{
  vm.runInNewContext(fs.readFileSync(process.argv[2]||'/mnt/data/ha-motogp-next-ui-preview.js','utf8'),ctx);
  for(let i=0;i<4;i++)await Promise.resolve();
  const r={position:3,number:93,surname:'TEST',team:'TEAM',num_lap:12,
    last_lap_time:"1'30.450",best_lap_time:"1'29.980",status_name:'RUNNING'};
  const race={state:'GP',attributes:{start_grids:{MotoGP:[{position:8,number:93,rider:'TEST',team:'TEAM'},
    {position:1,number:1,rider:'A',team:'B'}]},sessions_all:[{category:'MotoGP',name:'Race',type:'RAC',
    date:'2026-09-20T14:00:00+00:00',status:'NOT-STARTED'}]}};
  const standing={attributes:{standings:[{position:1,rider:'STANDINGS',points:250}]}};
  const timing=new Timing();timing._snapshot.riders=[r];timing._hass.states={race};
  let h=timing._timing();
  assert.match(h,/SENASTE VARV/);assert.match(h,/FRAMFÖR/);assert.match(h,/LEDARE/);
  assert.match(h,/⏱ fastest/);assert.doesNotMatch(h,/⚡/);
  assert.match(h,/nt-last-main[\s\S]*nt-pb-chip[\s\S]*Snabbaste: 1&#39;29\.980/);
  assert.match(h,/▲ \+5/);assert.match(h,/RUNNING/);
  timing._snapshot.name='Q1';timing._live.name='Q1';
  assert.match(timing._timing(),/nt-position-empty/,'no progression in qualifying');
  timing._snapshot.name='Race';timing._live.name='Race';
  race.attributes.start_grids.MotoGP.push({position:9,number:93});
  assert.match(timing._timing(),/nt-position-empty/,'duplicate start number is ambiguous');
  race.attributes.start_grids.MotoGP.pop();
  timing.hidden=true;assert.equal(timing._timing(),'HIDDEN');timing.hidden=false;
  const overview=new Overview();overview._hass.states={race,'sensor.motogp_rider_standings':standing};overview._live=null;
  overview._render();h=overview.view.innerHTML;
  assert.match(h,/Startgrid · MotoGP Race/);assert.match(h,/P8 · #93/);
  assert.match(h,/VM-ställning/);assert.match(h,/Moto3 · Moto2 · MotoGP/);
  assert.match(h,/STANDINGS/);
  overview._click({target:{closest:sel=>sel==='[data-motogp-standing]'?{getAttribute:()=> 'Moto2'}:null}});
  assert.match(overview.view.innerHTML,/Moto2: inväntar verifierad klassvis data/);
  assert.doesNotMatch(overview.view.innerHTML,/STANDINGS/,'never relabel MotoGP as Moto2');
  now=Date.parse('2026-09-20T13:43:00+02:00');overview._render();
  assert.doesNotMatch(overview.view.innerHTML,/Startgrid · MotoGP Race/,'17 min before start');
  now=Date.parse('2026-09-20T13:46:00+02:00');overview.hidden=true;overview._render();
  assert.doesNotMatch(overview.view.innerHTML,/Startgrid|VM-ställning/,'no spoiler bypass');
  console.log('PASS: timer icon, two-line laps, race-only progression, ambiguity, T-15 grid, standing tabs and spoiler');
})().catch(e=>{console.error(e);process.exitCode=1;});
