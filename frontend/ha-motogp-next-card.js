/* MotoGP Next: isolated frontend for motogp-test. No HA writes or service calls. */
(() => {
  'use strict';
  const TAG = 'ha-motogp-next-card';
  const VERSION = '0.2.0-dev.4';
  const BUILD = 'next-20260919-04';
  if (customElements.get(TAG)) {
    console.warn(`[${TAG}] Already registered. Reload the browser to load a changed JS resource.`);
    return;
  }
  const IDS = Object.freeze({
    race: 'sensor.motogp_next_race', session: 'sensor.motogp_current_session',
    status: 'sensor.motogp_session_status', riders: 'sensor.motogp_rider_positions',
    laps: 'sensor.motogp_race_lap_count', remaining: 'sensor.motogp_session_time_remaining',
    weather: 'sensor.motogp_track_weather', spoiler: 'switch.motogp_no_spoiler'
  });
  const WD = ['SÖNDAG','MÅNDAG','TISDAG','ONSDAG','TORSDAG','FREDAG','LÖRDAG'];
  const MONTH = ['JAN','FEB','MAR','APR','MAJ','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const valid = value => value != null &&
    !['', 'unknown', 'unavailable', 'none', 'hidden', 'null'].includes(String(value).trim().toLowerCase());
  const cat = value => {
    const raw = String(value || '').trim();
    const match = /moto\s*(gp|2|3|e)/i.exec(raw);
    return match ? ({gp:'MotoGP','2':'Moto2','3':'Moto3',e:'MotoE'})[match[1].toLowerCase()] : raw;
  };
  const sess = value => ({RAC:'Race',SPR:'Sprint',PR:'Practice',WUP:'Warm Up'})[String(value || '').toUpperCase()] || String(value || '');
  const keyName = value => String(sess(value)).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const canon = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  // Preserve reported event wall time; source currently marks wall-clock schedule with +00:00.
  function parseWall(raw) {
    const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    const date = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
    return Number.isNaN(date.getTime()) ? null :
      {date, day: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`};
  }
  const dayName = day => {
    const d = new Date(`${day}T12:00:00`);
    return `${WD[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
  };
  function dateRange(start, end) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(start||''));
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(end||''));
    if (!a || !b) return [start,end].filter(valid).join(' – ');
    if (a[1] === b[1] && a[2] === b[2]) return `${+a[3]}–${+b[3]} ${MONTH[+a[2]-1].toLowerCase()}`;
    return `${+a[3]} ${MONTH[+a[2]-1].toLowerCase()} – ${+b[3]} ${MONTH[+b[2]-1].toLowerCase()}`;
  }
  function sessionsFor(race) {
    const a = race?.attributes || {};
    const source = Array.isArray(a.sessions_all) ? a.sessions_all : Array.isArray(a.sessions) ? a.sessions : [];
    const start = String(a.date_start || '').slice(0,10), end = String(a.date_end || '').slice(0,10);
    return source.filter(s => s && parseWall(s.date))
      .map(s => ({...s, _wall:parseWall(s.date), _cat:cat(s.category || 'MotoGP'), _name:sess(s.name || s.type)}))
      .filter(s => (!start || s._wall.day >= start) && (!end || s._wall.day <= end))
      .sort((a,b) => a._wall.date - b._wall.date);
  }
  function reading(raw, unit) {
    if (!valid(raw)) return '—';
    const n = Number(String(raw).replace(',','.').replace(/\s*(°|º|C|%|celsius)\s*$/i,''));
    return Number.isFinite(n) && n !== 0 ? `${n}${unit}` : '—';
  }
  const active = st => ['I','S'].includes(String(st?.attributes?.session_status_id || '').toUpperCase()) || st?.state === 'In Progress';
  const finished = st => String(st?.attributes?.session_status_id || '').toUpperCase() === 'F' || st?.state === 'Finished';
  const explicitFinish = s => ['FINISHED','CANCELLED','CANCELED'].includes(String(s.status || '').toUpperCase());
  const sortedRiders = entity => Array.isArray(entity?.attributes?.riders) ?
    entity.attributes.riders.filter(r => r && typeof r === 'object').slice().sort((a,b) =>
      (Number(a.position)>0 ? Number(a.position) : 999) - (Number(b.position)>0 ? Number(b.position) : 999)) : [];
  const safeColor = raw => /^#?[0-9a-f]{6}$/i.test(String(raw || '')) ? `#${String(raw).replace('#','')}` : '#94a3b8';
  const nonzero = raw => { const n = Number(raw); return valid(raw) && Number.isFinite(n) && n > 0 ? n : null; };
  const clock = raw => {
    const n = nonzero(raw);
    return n === null ? '' : `${Math.floor(n/60)}:${pad(Math.floor(n%60))}`;
  };
  const lapTime = raw => !valid(raw) || /^0+(?:[.:']0+)?$/.test(String(raw).trim()) ? '—' : String(raw);
  // The calendar uses an unsponsored event name; live API often prepends a title sponsor.
  // Require agreement among live sensors, a substantial calendar-name match, exact class,
  // exact session and exactly one matching session in today's weekend schedule.
  function matchingLive(race, se, st, positions, today) {
    if (!active(st) || !valid(race?.state) || !valid(se?.state)) return null;
    const sa=se.attributes||{}, ta=st.attributes||{}, pa=positions?.attributes||{};
    const category=cat(sa.category), name=keyName(se.state);
    if (!category || !name || ![sa.event,ta.event,pa.event].every(valid) ||
        !valid(ta.category) || !valid(pa.category) ||
        !valid(ta.session_shortname) || !valid(pa.session_shortname)) return null;
    const events=[sa.event,ta.event,pa.event].map(canon), calendar=canon(race.state);
    if (events.some(x => x !== events[0]) || calendar.length < 8 ||
        !(events[0].includes(calendar) || calendar.includes(events[0]))) return null;
    if (cat(ta.category)!==category || cat(pa.category)!==category ||
        keyName(ta.session_shortname)!==name || keyName(pa.session_shortname)!==name ||
        (valid(sa.session_shortname) && keyName(sa.session_shortname)!==name)) return null;
    const ids=[sa.championship_id,ta.championship_id,pa.championship_id].filter(valid).map(String);
    if (new Set(ids).size > 1) return null;
    // Do not expose unbuffered raw live timing while requested TV-delay is not ready.
    const requested=nonzero(pa.tv_delay_seconds);
    if (requested && pa.tv_delay_ready === false) return null;
    const matches=sessionsFor(race).filter(s => s._wall.day===today && s._cat===category && keyName(s._name)===name);
    if (matches.length!==1) return null;
    return {key:`${calendar}|${today}|${category}|${name}|${matches[0].id || matches[0].date}`,
      name:sess(se.state), category};
  }
  function timingInfo(live, states, ids) {
    if (!live) return [];
    const remain=states[ids.remaining], laps=states[ids.laps];
    const now=nonzero(laps?.state), total=nonzero(laps?.attributes?.num_laps);
    const isRace=['RACE','SPRINT'].includes(String(live.name).toUpperCase());
    const out=[];
    if (isRace && total !== null) {
      if (now !== null) out.push(`Varv ${now}/${total}`);
      else out.push(`${total} varv`);
      if (now !== null) out.push(`${Math.max(0,total-now)} varv kvar`);
    } else {
      const countdown=clock(remain?.state);
      if (countdown) out.push(`${countdown} kvar`);
      if (isRace && now !== null) out.push(`Varv ${now}`);
    }
    // Informational only; do not interpolate the sensor value locally (TV spoiler risk).
    const delay=nonzero(states[ids.status]?.attributes?.tv_delay_effective_seconds);
    if (delay !== null) out.push(`TV-delay ${delay} s`);
    return out;
  }
  const CSS = `
    :host{display:block;min-width:0;color:var(--primary-text-color)}*{box-sizing:border-box}
    .root{display:grid;gap:12px;font-family:var(--primary-font-family,inherit)}
    .panel{background:var(--ha-card-background,var(--card-background-color,#fff));border:1px solid var(--divider-color,#ddd);border-radius:15px;overflow:hidden;min-width:0}
    .header{padding:16px;border-top:3px solid #e10600}.eyebrow{font-size:11px;font-weight:800;opacity:.75;letter-spacing:.06em}
    h2{margin:5px 0;font-size:23px;font-weight:900;color:var(--primary-text-color)}
    .sub{color:var(--secondary-text-color);font-size:12px;line-height:1.6}
    .row{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap}
    .head{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;gap:10px;border-bottom:1px solid var(--divider-color,#ddd)}
    .head strong{font-size:14px}.muted{color:var(--secondary-text-color);font-size:11px}
    .cats{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--divider-color,#ddd)}
    button{font:inherit;color:inherit;cursor:pointer}.cat{border:1px solid var(--divider-color,#ddd);background:transparent;border-radius:20px;padding:7px 11px;font-weight:800;font-size:11px}
    .cat[selected]{background:rgba(0,153,220,.12);border-color:#0099dc;color:var(--primary-text-color)}
    .day{border-bottom:1px solid var(--divider-color,#ddd)}.day:last-child{border-bottom:0}
    .daybtn,.timingbtn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;background:transparent;border:0;padding:12px;font-weight:800}
    .daybtn[aria-expanded=true]{background:rgba(0,153,220,.07)}.daybtn:hover,.timingbtn:hover{background:rgba(127,127,127,.06)}
    .daybtn.today{border-left:3px solid #e10600;padding-left:9px}.daybtn.today .today-tag{color:#e10600;font-size:10px}
    .daybtn .summary{font-size:11px;font-weight:500;color:var(--secondary-text-color);text-align:right}
    .tiles{padding:0 10px 10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .tile{padding:9px;border:1px solid var(--divider-color,#ddd);border-radius:10px;min-width:0}
    .tile.done{opacity:.48;background:rgba(127,127,127,.065)}.tile.live{border-color:#e10600;background:rgba(225,6,0,.075)}
    .tile .name{font-size:12px;font-weight:800;margin-top:5px}.badge{font-size:10px;font-weight:800;color:#c27600}
    .badge.live{color:#e10600}.tile.done .badge{color:var(--secondary-text-color)}
    .weathergrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:12px}
    .metric{text-align:center;min-width:0;padding:8px 4px;border-radius:9px;background:rgba(127,127,127,.055)}.metric b{display:block;font-size:16px;margin-top:4px}.metric span{font-size:10px;color:var(--secondary-text-color)}
    .empty{padding:14px;color:var(--secondary-text-color);font-size:12px}.riders{overflow-x:auto}
    .rider{display:grid;grid-template-columns:30px 4px minmax(125px,2fr) 45px 65px 65px 65px 60px;gap:9px;padding:8px 11px;align-items:center;min-width:640px;border-top:1px solid var(--divider-color,#ddd);font-size:11px}
    .rider.labels{font-weight:800;color:var(--secondary-text-color);font-size:10px}
    .rider .person{min-width:0}.rider .person b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rider .person small{display:block;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .line{height:25px;border-radius:5px}.num{text-align:right;font-variant-numeric:tabular-nums}.status{color:#e10600;font-size:11px;font-weight:900}
    .timingheadinfo{display:flex;flex-direction:column;align-items:flex-end;gap:2px;margin-left:auto;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
    .timingheadinfo small{font-size:10px;color:var(--secondary-text-color);font-weight:600}.timingtoggle{font-size:10px;color:var(--secondary-text-color);white-space:nowrap}
    .foot{text-align:right;font-size:10px;color:var(--secondary-text-color);padding:2px 5px}
    @media(max-width:600px){.timingbtn{gap:7px}.timingheadinfo{font-size:11px}.weathergrid{grid-template-columns:repeat(2,minmax(0,1fr))}h2{font-size:18px}}
    @media(max-width:420px){.tiles{grid-template-columns:1fr}}
  `;
  class MotoGPNext extends HTMLElement {
    constructor() {
      super();this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML=`<style>${CSS}</style><div id="app"></div>`;
      this._ids={...IDS};this._hass=null;this._refs=null;this._timer=null;
      this._filter='Total';this._dayOverrides=new Map();this._autoDays=new Set();
      this._today='';this._event='';this._timingManual=null;this._activeKey='';this._snapshot=null;this._live=null;
      this.shadowRoot.addEventListener('click',e=>this._click(e));
    }
    setConfig(config) {
      if (config?.type!==`custom:${TAG}`) throw new Error(`${TAG}: wrong card type`);
      this._ids={...IDS,...(config.entities||{})};this._refs=null;
      if (this._hass) this._render();
    }
    set hass(hass) {
      this._hass=hass;
      const refs=Object.values(this._ids).map(id=>hass.states[id]);
      if (!this._refs || refs.some((x,i)=>x!==this._refs[i])) {this._refs=refs;this._render();}
    }
    connectedCallback() {if (!this._timer) this._timer=setInterval(()=>this._render(),30000);if (this._hass)this._render();}
    disconnectedCallback() {if (this._timer)clearInterval(this._timer);this._timer=null;}
    _spoiler() {
      const states=this._hass?.states||{};
      return states[this._ids.spoiler]?.state==='on' ||
        [this._ids.session,this._ids.status,this._ids.riders].some(id =>
          states[id]?.state==='Hidden' || states[id]?.attributes?.spoiler_mode===true);
    }
    _expanded(day) {return this._dayOverrides.has(day)?this._dayOverrides.get(day):this._autoDays.has(day);}
    _click(e) {
      const button=e.target.closest('button');
      if (!button || !this.shadowRoot.contains(button))return;
      if (button.dataset.category!==undefined)this._filter=button.dataset.category;
      else if (button.dataset.day!==undefined)this._dayOverrides.set(button.dataset.day,!this._expanded(button.dataset.day));
      else if (button.dataset.timing!==undefined && !this._spoiler()) {
        const open=this._timingManual===null?Boolean(this._snapshot||this._live):this._timingManual;
        this._timingManual=!open;
      }
      this._render(); // All clicks local: never call a Home Assistant service.
    }
    _track(now,race) {
      const today=dayKey(now),event=`${race?.state||''}|${race?.attributes?.date_start||''}|${race?.attributes?.date_end||''}`;
      if (event!==this._event) {this._event=event;this._dayOverrides.clear();this._timingManual=null;this._snapshot=null;this._activeKey='';}
      if (today!==this._today) {
        this._today=today;this._dayOverrides.clear();this._timingManual=null;
        if (!active(this._hass?.states?.[this._ids.status]))this._snapshot=null;
      }
      this._live=null;
      if (this._spoiler()) {this._snapshot=null;this._activeKey='';this._timingManual=false;return;}
      const states=this._hass.states,se=states[this._ids.session],st=states[this._ids.status];
      const positions=states[this._ids.riders],live=matchingLive(race,se,st,positions,today);
      if (active(st)) {
        if (!live) {this._snapshot=null;this._activeKey='';this._timingManual=null;return;}
        if (live.key!==this._activeKey) {this._activeKey=live.key;this._timingManual=null;this._snapshot=null;}
        this._live=live;
        const riders=sortedRiders(positions);
        if (riders.length)this._snapshot={...live,day:today,riders};
      } else if (finished(st)&&this._snapshot) {
        const category=cat(se?.attributes?.category||st?.attributes?.category);
        if (valid(se?.state)&&category &&
          `${category}|${keyName(se.state)}`!==`${this._snapshot.category}|${keyName(this._snapshot.name)}`)this._snapshot=null;
      }
    }
    _schedule(race,now) {
      const all=sessionsFor(race),available=[...new Set(all.map(s=>s._cat))];
      if (this._filter!=='Total'&&!available.includes(this._filter))this._filter='Total';
      const sessions=all.filter(s=>this._filter==='Total'||s._cat===this._filter),st=this._hass.states[this._ids.status];
      const isLive=s=>Boolean(this._live)&&s._cat===this._live.category&&keyName(s._name)===keyName(this._live.name)&&s._wall.day===this._today;
      const past=s=>!isLive(s)&&(explicitFinish(s)||s._wall.date<now);
      const current=all.filter(s=>s._wall.day===this._today);
      const tomorrow=dayKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+1));
      const hasTomorrow=all.some(s=>s._wall.day===tomorrow);
      const lastStart=current.length?Math.max(...current.map(s=>s._wall.date.getTime())):Infinity;
      const confirmedDone=current.length>0&&current.every(explicitFinish);
      const presumedDone=current.length>0&&now.getTime()>=lastStart+2*60*60*1000;
      this._autoDays=new Set(current.length?[this._today]:[]);
      if (hasTomorrow&&!active(st)&&(confirmedDone||presumedDone))this._autoDays.add(tomorrow);
      const next=sessions.find(isLive)||sessions.find(s=>!past(s));
      let html=`<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong><span class="muted">${esc(this._filter)} · ${sessions.length} pass`+
        `${next?` · ${isLive(next)?'Pågår':'Nästa'}: ${esc(next._cat)} ${esc(next._name)} ${next._wall.time}`:''}</span></div>`;
      html+=`<div class="cats">${['Total',...available].map(c=>`<button type="button" class="cat" data-category="${esc(c)}" ${this._filter===c?'selected':''} aria-pressed="${this._filter===c}">${esc(c)}</button>`).join('')}</div>`;
      if (!sessions.length)return html+'<div class="empty">Inga pass i aktuell evenemangsdata för valt filter.</div></section>';
      const groups=new Map();
      for(const s of sessions) {if(!groups.has(s._wall.day))groups.set(s._wall.day,[]);groups.get(s._wall.day).push(s);}
      for(const [day,items] of groups) {
        const open=this._expanded(day),upcoming=items.find(s=>!past(s));
        const summary=upcoming?`${isLive(upcoming)?'Pågår':'Nästa'} ${upcoming._cat} ${upcoming._name} · ${upcoming._wall.time}`:
          items.every(explicitFinish)?'Klart':'Inga kommande starter';
        const todayTag=day===this._today?'<span class="today-tag"> · IDAG</span>':'';
        html+=`<div class="day"><button class="daybtn ${day===this._today?'today':''}" type="button" data-day="${day}" aria-expanded="${open}"><span>${dayName(day)}${todayTag}</span><span class="summary">${items.length} pass · ${esc(summary)} ${open?'⌃':'⌄'}</span></button>`;
        if(open)html+=`<div class="tiles">${items.map(s=>{
          const live=isLive(s),elapsed=past(s),status=String(s.status||'').toUpperCase();
          const label=live?'● LIVE':status==='FINISHED'?'✓ KLART':['CANCELLED','CANCELED'].includes(status)?'INSTÄLLT':elapsed?'PASSERAT':'KOMMANDE';
          return `<div class="tile ${live?'live':elapsed?'done':''}"><div class="row"><strong>${s._wall.time}</strong><span class="badge ${live?'live':''}">${label}</span></div><div class="name">${esc(s._cat)} · ${esc(s._name)}</div></div>`;
        }).join('')}</div>`;
        html+='</div>';
      }
      return html+'</section>';
    }
    _weather() {
      const a=this._hass.states[this._ids.weather]?.attributes||{};
      const metrics=[['Luft',reading(a.air,'°C')],['Bana',reading(a.ground,'°C')],
        ['Luftfuktighet',reading(a.humidity,'%')],['Underlag',valid(a.track)&&String(a.track)!=='0'?String(a.track):'—']];
      const desc=valid(a.weather)&&String(a.weather)!=='0'?String(a.weather):'';
      const head='<section class="panel"><div class="head"><strong>🌤️ Banväder</strong><span class="muted">Senast rapporterat · inte livegaranti</span></div>';
      if(metrics.every(([,v])=>v==='—')&&!desc)return head+'<div class="empty">Inga banväderdata rapporterade ännu.</div></section>';
      return head+`<div class="weathergrid">${metrics.map(([label,value])=>`<div class="metric"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div>`+
        `${desc?`<div class="sub" style="padding:0 12px 12px">${esc(desc)}</div>`:''}</section>`;
    }
    _timing() {
      if(this._spoiler())return '<section class="panel"><div class="head"><strong>🏁 Live timing</strong><span class="muted">Spoilerläge – dolt</span></div></section>';
      const states=this._hass.states,st=states[this._ids.status],live=this._live,snap=this._snapshot;
      const online=Boolean(live),name=online?live.name:snap?snap.name:'Ingen aktiv session';
      const category=online?live.category:snap?.category||'';
      const status=online?'● LIVE':active(st)?'VÄNTAR PÅ MATCHANDE DATA':snap?'SENASTE PASS':finished(st)?'AVSLUTAD':'VÄNTAR / OFFLINE';
      const open=this._timingManual===null?Boolean(snap||online):this._timingManual;
      const info=timingInfo(live,states,this._ids);
      const timingHead=info.length?`<span class="timingheadinfo"><span>${esc(info[0])}</span>${info.slice(1).map(v=>`<small>${esc(v)}</small>`).join('')}</span>`:'';
      let html=`<section class="panel"><button type="button" class="timingbtn" data-timing aria-expanded="${open}"><span>🏍️ ${esc(category)} ${esc(name)}<br><span class="status">${esc(status)}</span></span>${timingHead}<span class="timingtoggle">${open?'⌃ Dölj':'⌄ Visa'} förare</span></button>`;
      if(!open)return html+'</section>';
      if(!snap?.riders.length||(!online&&snap.day!==this._today))return html+'<div class="empty">Ingen säkerställd förardata för den aktuella sessionen ännu.</div></section>';
      html+='<div class="riders"><div class="rider labels"><span>Pos</span><span></span><span>Förare / team</span><span>Varv</span><span>Senaste</span><span>Ledare</span><span>Före</span><span>Status</span></div>';
      for(const r of snap.riders) {
        const p=Number(r.position),pos=p>0?p:'—',who=r.surname||r.shortname||r.firstname||'Okänd';
        const riderStatus=r.on_pit?'DEPÅ':valid(r.status_name)?r.status_name:valid(r.status_id)?r.status_id:'—';
        const firstGap=p===1?'LEAD':lapTime(r.gap_first);
        html+=`<div class="rider"><b>${esc(pos)}</b><span class="line" style="background:${safeColor(r.color)}"></span><span class="person"><b>${esc(who)} · #${esc(r.number??'—')}</b><small>${esc(r.team||r.bike||'')}</small></span>`+
          `<span class="num">${esc(nonzero(r.num_lap)??'—')}</span><span class="num">${esc(lapTime(r.last_lap_time))}</span><span class="num">${esc(firstGap)}</span>`+
          `<span class="num">${esc(p===1?'—':lapTime(r.gap_prev))}</span><span class="num">${esc(riderStatus)}</span></div>`;
      }
      return html+'</div></section>';
    }
    _render() {
      if(!this._hass)return;
      const now=new Date(),race=this._hass.states[this._ids.race],a=race?.attributes||{};
      this._track(now,race);
      const event=valid(race?.state)?race.state:'Inget evenemang tillgängligt';
      const meta=[a.circuit,a.country,a.date_start&&a.date_end?dateRange(a.date_start,a.date_end):''].filter(valid);
      this.shadowRoot.getElementById('app').innerHTML=`<div class="root"><section class="panel header"><div class="eyebrow">🏁 MOTOGP · ${esc(VERSION)}</div><h2>${esc(event)}</h2><div class="sub">${meta.map(esc).join(' · ')||'Väntar på evenemangsdata'}</div></section>`+
        this._schedule(race,now)+`<div class="root">${this._weather()}${this._timing()}</div>`+
        `<div class="foot">${esc(TAG)} · ${esc(BUILD)} · testresurs</div></div>`;
    }
    getCardSize(){return 8;}
    getGridOptions(){return {columns:12,rows:'auto',min_columns:6};}
  }
  MotoGPNext.buildInfo=Object.freeze({version:VERSION,buildId:BUILD,tag:TAG});
  customElements.define(TAG,MotoGPNext);
  window.customCards=window.customCards||[];
  window.customCards.push({type:TAG,name:'MotoGP Next – isolerad dev',description:'JS-migrering för motogp-test.'});
  console.info(`[${TAG}] ${VERSION} / ${BUILD}`);
})();
