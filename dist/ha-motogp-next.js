/* MotoGP Next SINGLE Lovelace resource | build next-one-20260920-04 | read only. */
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
      const past=s=>!isLive(s)&&(explicitFinish(s)|| (s._wall.date<now && (now-s._wall.date>=2*60*60*1000 || all.some(later=>later._wall.date>s._wall.date && later._wall.date<=now))));
      const current=all.filter(s=>s._wall.day===this._today);
      const tomorrow=dayKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+1));
      const hasTomorrow=all.some(s=>s._wall.day===tomorrow);
      const lastStart=current.length?Math.max(...current.map(s=>s._wall.date.getTime())):Infinity;
      const confirmedDone=current.length>0&&current.every(explicitFinish);
      const presumedDone=current.length>0&&now.getTime()>=lastStart+2*60*60*1000;
      this._autoDays=new Set(current.length?[this._today]:[]);
      if (hasTomorrow&&!active(st)&&(confirmedDone||presumedDone))this._autoDays.add(tomorrow);
      const next=sessions.find(isLive)||sessions.find(s=>s._wall.date>now&&!explicitFinish(s));
      let html=`<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong><span class="muted">${esc(this._filter)} · ${sessions.length} pass`+
        `${next?` · ${isLive(next)?'Pågår':'Nästa'}: ${esc(next._cat)} ${esc(next._name)} ${next._wall.time}`:''}</span></div>`;
      html+=`<div class="cats">${['Total',...available].map(c=>`<button type="button" class="cat" data-category="${esc(c)}" ${this._filter===c?'selected':''} aria-pressed="${this._filter===c}">${esc(c)}</button>`).join('')}</div>`;
      if (!sessions.length)return html+'<div class="empty">Inga pass i aktuell evenemangsdata för valt filter.</div></section>';
      const groups=new Map();
      for(const s of sessions) {if(!groups.has(s._wall.day))groups.set(s._wall.day,[]);groups.get(s._wall.day).push(s);}
      for(const [day,items] of groups) {
        const open=this._expanded(day),upcoming=items.find(isLive)||items.find(s=>s._wall.date>now&&!explicitFinish(s));
        const summary=upcoming?`${isLive(upcoming)?'Pågår':'Nästa'} ${upcoming._cat} ${upcoming._name} · ${upcoming._wall.time}`:
          items.every(explicitFinish)?'Klart':'Inga kommande starter';
        const todayTag=day===this._today?'<span class="today-tag"> · IDAG</span>':'';
        html+=`<div class="day"><button class="daybtn ${day===this._today?'today':''}" type="button" data-day="${day}" aria-expanded="${open}"><span>${dayName(day)}${todayTag}</span><span class="summary">${items.length} pass · ${esc(summary)} ${open?'⌃':'⌄'}</span></button>`;
        if(open)html+=`<div class="tiles">${items.map(s=>{
          const live=isLive(s),elapsed=past(s),status=String(s.status||'').toUpperCase();
          const label=live?'● LIVE':status==='FINISHED'?'✓ KLART':['CANCELLED','CANCELED'].includes(status)?'INSTÄLLT':elapsed?'TID PASSERAD':s._wall.date<now?'INVÄNTAR STATUS':'KOMMANDE';
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
      this.shadowRoot.getElementById('app').innerHTML=`<div class="root"><section class="panel header"><div class="eyebrow">🏁 MOTOGP NEXT · 0.3.0-dev.4</div><h2>${esc(event)}</h2><div class="sub">${meta.map(esc).join(' · ')||'Väntar på evenemangsdata'}</div></section>`+
        this._schedule(race,now)+`<div class="root">${this._weather()}${this._timing()}</div>`+
        `<div class="foot">ha-motogp-next.js · 0.3.0-dev.4 · UI-preview</div></div>`;
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

;
/* MotoGP Next: two isolated HA cards; pinned dev.4 backend matching, independent layout.
 * No changes to the original desktop/mobile card, existing Next dev.4 or HA services. */
(() => {
  'use strict';
  const BASE_TAG = 'ha-motogp-next-card';
  const OVERVIEW_TAG = 'ha-motogp-next-overview-card';
  const TIMING_TAG = 'ha-motogp-next-timing-card';
  const BASE_VERSION = '0.2.0-dev.4';
  const VERSION = '0.2.0-split.2';
  const BUILD = 'split-20260919-02';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pad = number => String(number).padStart(2, '0');
  const valid = value => value !== null && value !== undefined &&
    !['', 'unknown', 'unavailable', 'none', 'hidden', 'null'].includes(String(value).trim().toLowerCase());
  const positive = value => valid(value) && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const category = value => {
    const m = /moto\s*(gp|2|3|e)/i.exec(String(value || ''));
    return m ? ({gp:'MotoGP','2':'Moto2','3':'Moto3',e:'MotoE'})[m[1].toLowerCase()] : String(value || '');
  };
  const sessionName = value => ({SPR:'Sprint',RAC:'Race',PR:'Practice',WUP:'Warm Up'})[String(value || '').toUpperCase()] || String(value || '');
  const safeColor = value => /^#?[0-9a-f]{6}$/i.test(String(value || '')) ? `#${String(value).replace('#', '')}` : '#94a3b8';
  const numberText = value => positive(value) === null ? '—' : String(value);
  const lapText = value => !valid(value) || /^0+(?:[.:']0+)?$/.test(String(value).trim()) ? '—' : String(value);
  // The source marks local schedule wall times with +00:00. Match dev.4's wall-clock
  // convention instead of parsing the suffix as a true UTC timestamp.
  function parseStart(raw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(raw || ''));
    if (!m) return null;
    const date = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== +m[1] ||
        date.getMonth() !== +m[2]-1 || date.getDate() !== +m[3] ||
        date.getHours() !== +m[4] || date.getMinutes() !== +m[5]) return null;
    return date;
  }
  function nextPass(race, now, filter = 'Total') {
    const a = race?.attributes || {};
    const source = Array.isArray(a.sessions_all) ? a.sessions_all : Array.isArray(a.sessions) ? a.sessions : [];
    const start = String(a.date_start || '').slice(0, 10), end = String(a.date_end || '').slice(0, 10);
    return source.map(pass => {
      const date = parseStart(pass?.date);
      return date && pass ? {date, pass, category:category(pass.category || 'MotoGP'),
        name:sessionName(pass.name || pass.type || ''),
        day:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,
        time:`${pad(date.getHours())}:${pad(date.getMinutes())}`} : null;
    }).filter(item => item && (!start || item.day >= start) && (!end || item.day <= end) &&
      (filter === 'Total' || item.category === filter) && item.date.getTime() > now.getTime() &&
      !['FINISHED','CANCELLED','CANCELED'].includes(String(item.pass.status || '').toUpperCase()))
      .sort((a,b) => a.date-b.date)[0] || null;
  }
  function countdown(timestamp, now = Date.now()) {
    if (!Number.isFinite(timestamp)) return '—';
    const seconds = Math.ceil((timestamp-now)/1000);
    if (seconds < 0) return 'Starttid passerad · inväntar status';
    if (seconds === 0) return 'Startar nu';
    const h = Math.floor(seconds/3600), m = Math.floor(seconds%3600/60), s = seconds%60;
    return `${h ? `${h}:${pad(m)}` : String(m)}:${pad(s)} till start`;
  }
  const countdownHtml = item => item ?
    `<span class="next-countdown" data-next-start="${item.date.getTime()}">${esc(countdown(item.date.getTime()))}</span>` : '';
  function refreshCountdowns(root) {
    if (typeof root?.querySelectorAll !== 'function') return;
    for (const node of root.querySelectorAll('[data-next-start]')) {
      const timestamp = Number(node.getAttribute('data-next-start'));
      node.textContent = countdown(timestamp);
    }
  }
  const countdownStyles = `
    .next-countdown{font-variant-numeric:tabular-nums;font-weight:900;color:var(--primary-text-color)}
    .schedule-clock{display:inline-block;margin-left:8px;white-space:nowrap;color:#d97706}
  `;
  const timingStyles = `
    ${countdownStyles}
    .nt-card{background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--primary-text-color);
      border:1px solid var(--divider-color,#ddd);border-radius:16px;overflow:hidden;min-width:0}
    .nt-head{display:flex;gap:18px;align-items:center;justify-content:space-between;width:100%;padding:14px 16px;
      border:0;background:transparent;text-align:left;color:inherit;font:inherit;cursor:pointer}
    .nt-head:hover{background:rgba(127,127,127,.06)}
    .nt-label{display:block;font-size:17px;font-weight:900;line-height:1.4}
    .nt-status{display:block;margin-top:4px;font-size:11px;font-weight:900;color:#e10600}
    .nt-status.finished{color:var(--secondary-text-color)}
    .nt-clock{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:13px;
      white-space:nowrap;font-weight:900;font-variant-numeric:tabular-nums}
    .nt-clock small{font-size:11px;font-weight:600;color:var(--secondary-text-color)}
    .nt-toggle{font-size:11px;color:var(--secondary-text-color);white-space:nowrap}
    .nt-scroll{overflow-x:auto;width:100%}.nt-table{min-width:920px;width:100%}
    .nt-row{display:grid;grid-template-columns:44px minmax(235px,1fr) 58px 94px 91px 91px 96px;
      gap:12px;min-height:52px;align-items:center;padding:9px 14px;border-top:1px solid var(--divider-color,#ddd);
      font-size:12px;font-variant-numeric:tabular-nums}
    .nt-heading{min-height:34px;font-size:10px;letter-spacing:.025em;font-weight:900;color:var(--secondary-text-color)}
    .nt-heading>span:nth-child(2){text-align:center}.nt-row>span:not(.nt-person){text-align:right}.nt-row>span:first-child{text-align:center}
    .nt-person{display:flex;min-width:0;align-items:center;gap:10px}.nt-color{height:31px;width:4px;flex:none;border-radius:3px}
    .nt-person-text{min-width:0}.nt-person-text b{display:block;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nt-person-text small{display:block;color:var(--secondary-text-color);font-size:11px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nt-pit{font-size:9px;color:#c27600;background:rgba(245,158,11,.12);border-radius:4px;padding:2px 4px}
    .nt-row.unclassified{opacity:.6}.nt-results{font-size:11px;font-weight:800;color:var(--secondary-text-color);padding:9px 14px}
    .nt-empty{padding:15px;color:var(--secondary-text-color);font-size:12px}
    .nt-q2{display:inline-block;margin-left:7px;color:#15803d;font-size:10px;font-weight:900;white-space:nowrap}
    .nt-q2-cut{padding:7px 14px;border-top:2px dashed #15803d;color:#15803d;font-size:11px;font-weight:900;letter-spacing:.02em}
    @media(max-width:680px){.nt-head{gap:8px;flex-wrap:wrap}.nt-label{font-size:14px}.nt-clock{font-size:12px}}
  `;
  function register() {
    const Base = customElements.get(BASE_TAG);
    if (!Base || Base.buildInfo?.version !== BASE_VERSION) {
      console.error(`[MotoGP Next Split] Requires ${BASE_TAG} ${BASE_VERSION}; no cards registered.`);
      return;
    }
    function refreshLiveClock(card) {
      if (!card._live || card._spoiler() || !card.shadowRoot?.querySelector) {card._clockSample=null;return;}
      const node=card.shadowRoot.querySelector('[data-live-remaining]');
      const state=card._hass?.states?.[card._ids.remaining];
      const delay=card._hass?.states?.[card._ids.riders]?.attributes;
      if (!node || !state || delay?.tv_delay_ready===false) {card._clockSample=null;return;}
      const seconds=positive(state.state);
      if (seconds===null) {card._clockSample=null;node.textContent='—';return;}
      const identity=[card._live.key,state.state,state.last_updated||state.last_changed||''].join('|');
      if (card._clockSample?.identity!==identity) card._clockSample={identity,seconds,at:Date.now()};
      const elapsed=Date.now()-card._clockSample.at;
      if (elapsed>90000) {node.textContent='— · inväntar data';return;}
      const left=Math.max(0,Math.ceil(card._clockSample.seconds-elapsed/1000));
      node.textContent=`${Math.floor(left/60)}:${pad(left%60)} kvar`;
    }
    class CountdownCard extends Base {
      constructor() {super();this._countTimer=null;}
      connectedCallback() {
        super.connectedCallback();
        if (!this._countTimer) this._countTimer=setInterval(()=>{refreshCountdowns(this.shadowRoot);refreshLiveClock(this);},1000);
      }
      disconnectedCallback() {
        super.disconnectedCallback();
        if (this._countTimer) clearInterval(this._countTimer);
        this._countTimer=null;
      }
    }
    class OverviewCard extends CountdownCard {
      constructor() {
        super();this.shadowRoot.innerHTML=this.shadowRoot.innerHTML.replace('</style>',`${countdownStyles}</style>`);
      }
      setConfig(config) {
        if (config?.type !== `custom:${OVERVIEW_TAG}`) throw new Error('Incorrect MotoGP overview card type');
        super.setConfig({...config,type:`custom:${BASE_TAG}`});
      }
      _timing() {return '';}
      _schedule(race,now) {
        const original=super._schedule(race,now);
        const next=nextPass(race,now,this._filter);
        if (!next) return original;
        const marker='<div class="head"><strong>🗓️ Helgens schema</strong><span class="muted">';
        if (!original.includes(marker)) return original;
        return original.replace(marker,marker+`<span class="schedule-clock">${countdownHtml(next)}</span> · `);
      }
      getGridOptions() {return {columns:12,rows:'auto',min_columns:6};}
    }
    class TimingCard extends CountdownCard {
      constructor() {
        super();this.shadowRoot.innerHTML=this.shadowRoot.innerHTML.replace('</style>',`${timingStyles}</style>`);
      }
      setConfig(config) {
        if (config?.type !== `custom:${TIMING_TAG}`) throw new Error('Incorrect MotoGP timing card type');
        super.setConfig({...config,type:`custom:${BASE_TAG}`});
      }
      _timing() {
        const states=this._hass.states;
        const race=states[this._ids.race];
        const now=new Date(), upcoming=nextPass(race,now);
        const live=this._live, status=states[this._ids.status]; let snap=this._snapshot;
        const spoiler=this._spoiler();
        // A passed start time does not establish a live or finished status.
        // Never inspect unapproved rider data to infer session state.
        const schedule=race?.attributes||{};
        const entries=Array.isArray(schedule.sessions_all)?schedule.sessions_all:
          Array.isArray(schedule.sessions)?schedule.sessions:[];
        const pending=entries.map(s=>({pass:s,date:parseStart(s?.date)}))
          .filter(x=>x.date && x.date<=now && x.date.toDateString()===now.toDateString() &&
            now-x.date<2*60*60*1000 &&
            !['FINISHED','CANCELLED','CANCELED'].includes(String(x.pass.status||'').toUpperCase()) &&
            !((status?.state==='Finished'||String(status?.attributes?.session_status_id||'').toUpperCase()==='F') &&
              category(status?.attributes?.category)===category(x.pass.category||'MotoGP') &&
              sessionName(status?.attributes?.session_shortname)===sessionName(x.pass.name||x.pass.type||'')))
          .sort((a,b)=>b.date-a.date)[0]||null;
        const started=pending && now-pending.date<15*60*1000?pending:null;
        const imminent=!live && upcoming && upcoming.date>now && upcoming.date.getTime()-now.getTime()<=15*60*1000;
        if (imminent && snap) {this._snapshot=null;this._activeKey='';snap=null;}
        const hasRiders=!spoiler && snap?.riders?.length && snap.day===this._today;
        const expanded=!spoiler && (this._timingManual===null ? Boolean(hasRiders || live) : this._timingManual);
        let title, statusText, clockHtml='';
        if (live && !spoiler) {
          title=`${live.category} · ${live.name}`;
          statusText='● LIVE';
          const lap=positive(states[this._ids.laps]?.state);
          const total=positive(states[this._ids.laps]?.attributes?.num_laps);
          const remaining=positive(states[this._ids.remaining]?.state);
          const isRace=/^(sprint|race)$/i.test(live.name);
          let major='';
          if (isRace && total) major=lap?`Varv ${lap}/${total} · ${Math.max(0,total-lap)} kvar`:`${total} varv`;
          else if (remaining) major=`${Math.floor(remaining/60)}:${pad(Math.floor(remaining%60))} kvar`;
          else if (lap) major=`Varv ${lap}`;
          const delay=positive(status?.attributes?.tv_delay_effective_seconds);
          clockHtml=`<span class="nt-clock">${major?`<span${!isRace&&remaining?' data-live-remaining':''}>${esc(major)}</span>`:''}`+
            `${delay?`<small>TV-delay ${delay} s</small>`:''}</span>`;
        } else if (started && !spoiler) {
          title=`Schemalagd: ${category(started.pass.category||'MotoGP')} · ${sessionName(started.pass.name||started.pass.type||'')}`;
          statusText='STARTTID PASSERAD · INVÄNTAR MATCHANDE DATA';
          clockHtml=`<span class="nt-clock"><span>${esc(pad(started.date.getHours())+':'+pad(started.date.getMinutes()))}</span>`+
            `${upcoming?`<small>Nästa: ${esc(upcoming.category)} ${esc(upcoming.name)} ${esc(upcoming.time)}</small>`:''}</span>`;
        } else if (upcoming) {
          title=`Nästa: ${upcoming.category} · ${upcoming.name}`;
          statusText=spoiler?'SPOILERLÄGE':hasRiders?'SENASTE PASS · EJ LIVE':pending?
            `STATUS OKÄND: ${category(pending.pass.category||'MotoGP')} ${sessionName(pending.pass.name||pending.pass.type||'')}`:'MELLAN PASSEN';
          clockHtml=`<span class="nt-clock"><span>${esc(upcoming.time)}</span>`+
            `<small>${countdownHtml(upcoming)}</small></span>`;
        } else {
          title=hasRiders?`${snap.category} · ${snap.name}`:'Ingen aktiv session';
          statusText=spoiler?'SPOILERLÄGE':hasRiders?'SENASTE PASS':'VÄNTAR / OFFLINE';
        }
        const textClass=live&&!spoiler?'':' finished';
        let html=`<section class="nt-card"><button type="button" class="nt-head" data-timing aria-expanded="${expanded}">`+
          `<span><span class="nt-label">🏁 ${esc(title)}</span><span class="nt-status${textClass}">${esc(statusText)}</span></span>`+
          `${clockHtml}<span class="nt-toggle">${expanded?'⌃ Dölj':'⌄ Visa'} förare</span></button>`;
        if (!expanded) return html+'</section>';
        if (!hasRiders) return html+'<div class="nt-empty">Ingen säkerställd förardata från det aktuella eller föregående passet.</div></section>';
        if (!live) html+=`<div class="nt-results">Senaste passets förardata: ${esc(snap.category)} · ${esc(snap.name)} (ej live)</div>`;
        html+='<div class="nt-scroll"><div class="nt-table"><div class="nt-row nt-heading"><span>POS</span><span>FÖRARE / TEAM</span><span>VARV</span><span>SENASTE</span><span>Δ FRAMFÖR</span><span>Δ LEDARE</span><span>STATUS</span></div>';
        const qCut=/^Q1$/i.test(String(snap.name||'')) ? (snap.category==='MotoGP'?2:['Moto2','Moto3'].includes(snap.category)?4:0):0;
        const qPositions=qCut?snap.riders.filter(r=>Number.isInteger(Number(r.position)) && Number(r.position)>0 && positive(r.num_lap)!==null && lapText(r.last_lap_time)!=='—').map(r=>Number(r.position)):[];
        const qReady=qCut>0 && qPositions.length>=qCut && Array.from({length:qCut},(_,i)=>i+1).every(p=>qPositions.filter(x=>x===p).length===1);
        for (const rider of snap.riders) {
          const p=positive(rider.position),who=rider.surname||rider.shortname||rider.firstname||'Okänd';
          const pit=Boolean(rider.on_pit);
          const riderStatus=pit?'PIT':valid(rider.status_name)?rider.status_name:valid(rider.status_id)?rider.status_id:'—';
          const prev=p===1?'—':lapText(rider.gap_prev);
          const first=p===1?'LEDARE':lapText(rider.gap_first);
          html+=`<div class="nt-row${p?'':' unclassified'}"><span>${esc(p??'—')}</span>`+
            `<span class="nt-person"><span class="nt-color" style="background:${safeColor(rider.color)}"></span>`+
            `<span class="nt-person-text"><b>${esc(who)} · #${esc(rider.number??'—')}`+
            `${pit?' <span class="nt-pit">PIT</span>':''}${qReady&&p&&p<=qCut?' <span class="nt-q2" title="Preliminärt vidare till Q2">Q2 ↑</span>':''}</b><small>${esc(rider.team||rider.bike||'')}</small></span></span>`+
            `<span>${esc(numberText(rider.num_lap))}</span><span>${esc(lapText(rider.last_lap_time))}</span>`+
            `<span>${esc(prev)}</span><span>${esc(first)}</span><span>${esc(riderStatus)}</span></div>`;
          if (qReady && p===qCut) html+='<div class="nt-q2-cut" role="note">Q2-GRÄNS · preliminärt</div>';
        }
        return html+'</div></div></section>';
      }
      _render() {
        if (!this._hass) return;
        const race=this._hass.states[this._ids.race];
        this._track(new Date(),race);
        this.shadowRoot.getElementById('app').innerHTML=`<div class="root">${this._timing()}</div>`;
      }
      getCardSize() {return 10;}
      getGridOptions() {return {columns:12,rows:'auto',min_columns:12};}
    }
    OverviewCard.buildInfo=Object.freeze({version:VERSION,buildId:BUILD,tag:OVERVIEW_TAG});
    TimingCard.buildInfo=Object.freeze({version:VERSION,buildId:BUILD,tag:TIMING_TAG});
    if (!customElements.get(OVERVIEW_TAG)) customElements.define(OVERVIEW_TAG,OverviewCard);
    if (!customElements.get(TIMING_TAG)) customElements.define(TIMING_TAG,TimingCard);
    window.customCards=window.customCards||[];
    for (const [tag,name] of [[OVERVIEW_TAG,'MotoGP Next – schema och väder'],[TIMING_TAG,'MotoGP Next – separat live timing']]) {
      if (!window.customCards.some(card=>card.type===tag))
        window.customCards.push({type:tag,name,description:`MotoGP Next split · ${VERSION}`});
    }
    console.info(`[MotoGP Next Split] ${VERSION} / ${BUILD}; dev.4 untouched`);
  }
  if (customElements.get(BASE_TAG)) register();
  else customElements.whenDefined(BASE_TAG).then(register);
})();

;
/* MotoGP Next split.2 additive, reversible test-only visual enhancements.
 * Requires dev.4 base and split.2; never changes the original/mobile cards. */
(() => {
  'use strict';
  const OVERVIEW = 'ha-motogp-next-overview-card';
  const TIMING = 'ha-motogp-next-timing-card';
  const REQUIRED = '0.2.0-split.2';
  const BUILD = 'split-enhancements-20260919-01';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const cat = raw => {
    const m = /moto\s*(gp|2|3|e)/i.exec(String(raw || ''));
    return m ? ({gp:'MotoGP','2':'Moto2','3':'Moto3',e:'MotoE'})[m[1].toLowerCase()] : String(raw || '');
  };
  const sess = raw => ({SPR:'Sprint',RAC:'Race',PR:'Practice',WUP:'Warm Up'})[String(raw || '').toUpperCase()] || String(raw || '');
  function wall(raw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(raw || ''));
    if (!m) return null;
    const d = new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
    return Number.isNaN(d.getTime()) || d.getFullYear()!==+m[1] ||
      d.getMonth()!==+m[2]-1 || d.getDate()!==+m[3] ||
      d.getHours()!==+m[4] || d.getMinutes()!==+m[5] ? null : d;
  }
  const day = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  function nextPass(race, now, filter) {
    const a = race?.attributes || {};
    const source = Array.isArray(a.sessions_all) ? a.sessions_all : Array.isArray(a.sessions) ? a.sessions : [];
    return source.map(s => ({s,d:wall(s?.date)})).filter(({s,d}) => s && d &&
      (!a.date_start || day(d)>=String(a.date_start).slice(0,10)) &&
      (!a.date_end || day(d)<=String(a.date_end).slice(0,10)) &&
      (filter==='Total' || cat(s.category||'MotoGP')===filter) && d>now &&
      !['FINISHED','CANCELLED','CANCELED'].includes(String(s.status||'').toUpperCase()))
      .sort((a,b)=>a.d-b.d)[0] || null;
  }
  function remaining(ms) {
    const sec=Math.max(0,Math.ceil(ms/1000));
    const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
    return `${h?`${h}:${pad(m)}`:m}:${pad(s)} till start`;
  }
  // Parse only valid positive lap times; never treat 0.000 or unknown as a record.
  function lapSeconds(raw) {
    const m=/^(?:(\d+)[:'])?(\d{1,3})\.(\d{3})$/.exec(String(raw??'').trim());
    if (!m || (m[1] && +m[2]>=60)) return null;
    const seconds=(m[1]?60*Number(m[1]):0)+Number(m[2])+Number(m[3])/1000;
    return seconds>0&&Number.isFinite(seconds)?seconds:null;
  }
  function fastLap(r, attr, live) {
    if (r?.is_session_fastest !== true) return false;
    const last=lapSeconds(r.last_lap_time),best=lapSeconds(r.best_lap_time);
    if (last===null || best===null || Math.abs(last-best)>0.0001) return false;
    if (Number(r.best_lap_number)>0 && Number(r.last_lap)>0 &&
        Number(r.best_lap_number)!==Number(r.last_lap)) return false;
    if (live) {
      const sessionBest=lapSeconds(attr?.session_fastest_lap);
      if (sessionBest===null || Math.abs(last-sessionBest)>0.0001) return false;
    }
    return true;
  }
  const CSS = `
    .nt-heading{color:var(--primary-text-color)!important;opacity:1;font-weight:900}
    .nt-row.unclassified{opacity:1!important;background:rgba(127,127,127,.065)}
    .nt-person-text small,.nt-clock small,.nt-toggle,.nt-results,.nt-empty{
      color:var(--primary-text-color)!important;opacity:.84}
    .nt-row.unclassified .nt-person-text b{color:var(--primary-text-color)}
    .nt-fast-lap{color:var(--motogp-fastest-lap-color,var(--error-color,#b71c1c));font-weight:900}
    .next-tile-clock{margin-top:6px;font-size:12px;font-weight:900;
      color:var(--primary-text-color);font-variant-numeric:tabular-nums}
  `;
  function styleOnce(card) {
    if (!card.shadowRoot || card.shadowRoot.querySelector('[data-motogp-split-enhancements]')) return;
    const style=document.createElement('style');
    style.setAttribute('data-motogp-split-enhancements','');
    style.textContent=CSS;
    card.shadowRoot.appendChild(style);
  }
  function install() {
    const Overview=customElements.get(OVERVIEW),Timing=customElements.get(TIMING);
    if (Overview?.buildInfo?.version!==REQUIRED || Timing?.buildInfo?.version!==REQUIRED) {
      console.error(`[MotoGP enhancements] Requires exact ${REQUIRED}; no patch applied.`);
      return;
    }
    if (Overview.prototype._motogpEnhancements || Timing.prototype._motogpEnhancements) return;
    const oldSchedule=Overview.prototype._schedule;
    Overview.prototype._schedule=function(race,now) {
      const html=oldSchedule.call(this,race,now);
      styleOnce(this);
      const next=nextPass(race,now,this._filter);
      if (!next) return html;
      const s=next.s,d=next.d;
      // Scope the lookup to the exact day so matching session names on other days stay untouched.
      const token=`data-day="${esc(day(d))}"`;
      const begin=html.indexOf(token);
      if (begin<0) return html; // Closed days do not get hidden markup.
      const end=html.indexOf('<div class="day"><button',begin+token.length);
      const boundary=end<0?html.length:end;
      const section=html.slice(begin,boundary);
      const tile=`<div class="tile "><div class="row"><strong>${pad(d.getHours())}:${pad(d.getMinutes())}</strong>`+
        `<span class="badge ">KOMMANDE</span></div><div class="name">${esc(cat(s.category||'MotoGP'))} · ${esc(sess(s.name||s.type||''))}</div></div>`;
      if (!section.includes(tile)) return html;
      const stamp=d.getTime();
      const expanded=tile.slice(0,-6)+`<div class="next-tile-clock" data-next-start="${stamp}">`+
        `${esc(remaining(stamp-Date.now()))}</div></div>`;
      return html.slice(0,begin)+section.replace(tile,expanded)+html.slice(boundary);
    };
    const oldTiming=Timing.prototype._timing;
    Timing.prototype._timing=function() {
      const html=oldTiming.call(this);
      styleOnce(this);
      const snap=this._snapshot;
      if (this._spoiler() || !snap?.riders?.length || snap.day!==this._today) return html;
      const attrs=this._hass?.states?.[this._ids.riders]?.attributes || {};
      let index=0;
      return html.replace(/<div class="nt-row(?: unclassified)?">[\s\S]*?<\/div>/g, row => {
        const r=snap.riders[index++];
        if (!r || !fastLap(r,attrs,Boolean(this._live))) return row;
        const last=String(r.last_lap_time).trim();
        const target=`<span>${esc(last)}</span>`;
        if (!row.includes(target)) return row;
        const partial=this._live && attrs.lap_history_partial===true;
        return row.replace(target,`<span class="nt-fast-lap" title="${partial?'Snabbaste observerade varv, partiell historik':'Snabbaste verifierade varv'}">⚡ ${esc(last)}</span>`);
      });
    };
    Overview.prototype._motogpEnhancements=BUILD;
    Timing.prototype._motogpEnhancements=BUILD;
    console.info(`[MotoGP enhancements] ${BUILD} installed on isolated split cards only`);
  }
  Promise.all([customElements.whenDefined(OVERVIEW),customElements.whenDefined(TIMING)]).then(install);
})();

;
/* MotoGP Next: approved lap records, personal bests, gap trends and feed freshness.
 * Bundled into the one Next resource. Read-only; no independent HA resource. */
(() => {
  'use strict';
  const TAG='ha-motogp-next-timing-card', REQUIRED='0.2.0-split.2';
  const BUILD='lap-stats-20260920-01';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function gap(raw) {
    const s=String(raw??'').trim().replace(',','.');
    if (!/^(?:\+)?\d+(?:\.\d+)?$/.test(s)) return null;
    const n=Number(s);
    return Number.isFinite(n)&&n>0?n:null;
  }
  function lap(raw) {
    const s=String(raw??'').trim().replace("'",':').replace('"','');
    if (!/^(?:\d+:)?\d{1,3}\.\d{3}$/.test(s)) return null;
    const p=s.split(':');
    if (p.length===2&&Number(p[1])>=60) return null;
    const n=p.length===2?Number(p[0])*60+Number(p[1]):Number(p[0]);
    return n>0&&Number.isFinite(n)?n:null;
  }
  const riderKey=r=>String(r.rider_id||r.number||r.surname||r.shortname||'');
  const sameLap=(a,b)=>a!==null&&b!==null&&Math.abs(a-b)<0.0001;
  const styleText=`
    .nt-gap-trend{display:inline-flex;align-items:center;justify-content:flex-end;gap:5px;white-space:nowrap;font-weight:850}
    .nt-gap-trend.up{color:#dc2626!important}.nt-gap-trend.down{color:#16a34a!important}
    .nt-gap-arrow{font-size:11px;line-height:1}
    .nt-fast-lap{color:#e10600!important;font-weight:950!important}
    .nt-personal-best{color:#128349!important;font-weight:900!important}
    .nt-pb-chip{display:inline-block;margin-left:5px;border:1px solid currentColor;border-radius:4px;padding:0 3px;font-size:9px;vertical-align:middle}
    .nt-session-record{padding:9px 14px;border-top:1px solid var(--divider-color,#ddd);font-size:12px;font-weight:900;color:var(--primary-text-color);background:rgba(127,127,127,.045)}
    .nt-session-record strong{color:#e10600}.nt-session-record small{display:block;font-size:10px;color:var(--secondary-text-color);font-weight:600;margin-top:3px}
    .nt-feed-age{display:inline-block;border:1px solid var(--divider-color,#ddd);border-radius:12px;padding:2px 7px;font-size:10px;color:var(--primary-text-color);font-weight:800;background:rgba(127,127,127,.07);white-space:nowrap}
    .nt-feed-age.stale{color:#9a5400;border-color:#d97706;background:rgba(217,119,6,.12)}
  `;
  function refreshAge(card) {
    const badge=card.shadowRoot?.querySelector('[data-motogp-feed-age]');
    if (!badge) return;
    if (!card._live||card._spoiler()) {badge.textContent='Tid okänd';return;}
    const stamp=Number(badge.getAttribute('data-motogp-feed-age'));
    if (!Number.isFinite(stamp)||stamp<=0||stamp>Date.now()+5000) {
      badge.textContent='Uppdateringstid okänd';badge.classList.remove('stale');return;
    }
    const age=Math.max(0,Math.floor((Date.now()-stamp)/1000));
    badge.textContent=age<120?`Uppdaterad ${age} s sedan`:
      `Gammal data · ${Math.floor(age/60)} min ${age%60} s`;
    badge.classList.toggle('stale',age>=120);
  }
  function install() {
    const Timing=customElements.get(TAG);
    if (Timing?.buildInfo?.version!==REQUIRED) {
      console.error(`[MotoGP lap stats] Requires ${REQUIRED}; no patch applied.`);return;
    }
    if (Timing.prototype._motogpGapTrends) return;
    const original=Timing.prototype._timing;
    Timing.prototype._timing=function() {
      const html=original.call(this);
      if (this._spoiler()||!this._hass||!this._live||!this._snapshot?.riders?.length||
          this._snapshot.day!==this._today) return html;
      const snap=this._snapshot,live=this._live;
      const positions=this._hass.states[this._ids.riders];
      const attrs=positions?.attributes||{};
      const event=String(this._event||attrs.event||'');
      const sessionKey=[event,snap.day,snap.category,snap.name,live.key].join('|');
      if (this._gapTrendSession!==sessionKey) {
        this._gapTrendSession=sessionKey;this._gapTrendValues=new Map();
      }
      const values=this._gapTrendValues;
      const sessionLap=lap(attrs.session_fastest_lap);
      const sessionRider=String(attrs.session_fastest_rider||'').trim();
      const fastestNumber=String(attrs.session_fastest_rider_number||'').trim();
      const fastestLapNo=Number(attrs.session_fastest_lap_number);
      const partial=attrs.lap_history_partial===true;
      let index=0;
      // Split at row starts: each row contains nested spans. A shallow div regex is unsafe.
      const parts=('\u0000'+html).split(/(?=<div class="nt-row(?: unclassified)?">)/);
      let out=parts.map((part,i)=>{
        if(i===0||!part.startsWith('<div class="nt-row'))return part;
        const r=snap.riders[index++];if(!r)return part;
        const p=Number(r.position),key=riderKey(r);
        const prev=p>1?gap(r.gap_prev):null;
        const rawPrev=p===1?'—':String(r.gap_prev??'—');
        const safePrev=(!rawPrev.trim()||rawPrev==='0.000')?'—':rawPrev;
        const rawFirst=p===1?'LEDARE':String(r.gap_first??'—');
        const safeFirst=(!rawFirst.trim()||rawFirst==='0.000')?'—':rawFirst;
        const needle=`<span>${esc(safePrev)}</span><span>${esc(safeFirst)}</span>`;
        if(prev!==null&&key&&part.includes(needle)) {
          const old=values.get(key);
          let trend=old?.position===p?old.trend:'';
          if(old?.position!==p)trend='';
          else if(Math.abs(prev-old.value)>=0.0005)trend=prev>old.value?'up':'down';
          values.set(key,{value:prev,position:p,trend});
          const arrow=trend==='up'?'▼':trend==='down'?'▲':'';
          part=part.replace(needle,`<span><span class="nt-gap-trend${trend?` ${trend}`:''}">`+
            `${arrow?`<span class="nt-gap-arrow">${arrow}</span>`:''}<span>${esc(safePrev)}</span>`+
            `</span></span><span>${esc(safeFirst)}</span>`);
        }
        const last=lap(r.last_lap_time),best=lap(r.best_lap_time);
        const lastNo=Number(r.last_lap),bestNo=Number(r.best_lap_number);
        // Never call an equal but historical fastest lap a NEW personal best.
        const pb=sameLap(last,best)&&Number.isInteger(lastNo)&&lastNo>0&&
          Number.isInteger(bestNo)&&bestNo===lastNo;
        const record=pb&&r.is_session_fastest===true&&sameLap(last,sessionLap);
        const lastSpan=`<span>${esc(String(r.last_lap_time??''))}</span>`;
        if(part.includes(lastSpan)&&record)part=part.replace(lastSpan,
          `<span class="nt-fast-lap" title="Sessionens snabbaste varv och nytt personbästa">`+
          `⚡ ${esc(r.last_lap_time)} <span class="nt-pb-chip">PB</span></span>`);
        else if(part.includes(lastSpan)&&pb)part=part.replace(lastSpan,
          `<span class="nt-personal-best" title="Nytt personbästa">${esc(r.last_lap_time)}`+
          ` <span class="nt-pb-chip">PB</span></span>`);
        return part;
      }).join('').slice(1);
      if(sessionLap!==null&&sessionRider&&
          snap.riders.some(r=>String(r.number??'')===fastestNumber||
            String(r.surname||r.shortname||'').trim()===sessionRider)) {
        const no=fastestNumber?` #${esc(fastestNumber)}`:'';
        const which=Number.isInteger(fastestLapNo)&&fastestLapNo>0?` · varv ${fastestLapNo}`:'';
        const label=partial?'Snabbaste observerade varv':'Sessionens snabbaste varv';
        const summary=`<div class="nt-session-record" role="status">${label}: `+
          `<strong>⚡ ${esc(sessionRider)}${no} · ${esc(attrs.session_fastest_lap)}${which}</strong>`+
          `${partial?'<small>Historiken är ofullständig – inte ett bekräftat sessionsrekord.</small>':''}</div>`;
        const table='<div class="nt-scroll">';
        if(out.includes(table))out=out.replace(table,summary+table);
      }
      const timestamp=Date.parse(positions?.last_updated||positions?.last_changed||'');
      const age=Number.isFinite(timestamp)&&timestamp>0?timestamp:0;
      const clockEnd='<span class="nt-toggle">';
      if(out.includes(clockEnd))out=out.replace(clockEnd,
        `<span class="nt-feed-age" data-motogp-feed-age="${age}" title="Tid sedan senast ändrade, verifierade livetimingdata">`+
        `Uppdateringstid okänd</span>`+clockEnd);
      if(!this.shadowRoot?.querySelector('[data-motogp-gap-trends]')) {
        const style=document.createElement('style');
        style.setAttribute('data-motogp-gap-trends','');style.textContent=styleText;
        this.shadowRoot?.appendChild(style);
      }
      return out;
    };
    const on=Timing.prototype.connectedCallback,off=Timing.prototype.disconnectedCallback;
    Timing.prototype.connectedCallback=function() {
      on.call(this);
      if(!this._motogpAgeTimer)this._motogpAgeTimer=setInterval(()=>refreshAge(this),1000);
      refreshAge(this);
    };
    Timing.prototype.disconnectedCallback=function() {
      if(this._motogpAgeTimer)clearInterval(this._motogpAgeTimer);
      this._motogpAgeTimer=null;off.call(this);
    };
    Timing.prototype._motogpGapTrends=BUILD;
    console.info(`[MotoGP lap stats] ${BUILD} installed in the single Next timing card`);
  }
  customElements.whenDefined(TAG).then(install);
})();


;
/* MotoGP Next UI preview: bundled after lap-stats. Read-only; no new HA resource. */
(() => {
  'use strict';
  const OVERVIEW='ha-motogp-next-overview-card';
  const TIMING='ha-motogp-next-timing-card';
  const REQUIRED='0.2.0-split.2';
  const BUILD='ui-preview-20260920-01';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid=v=>v!==null&&v!==undefined&&!['','unknown','unavailable','none','null','hidden'].includes(String(v).trim().toLowerCase());
  const cat=v=>{const m=/moto\s*(gp|2|3|e)/i.exec(String(v||''));return m?({gp:'MotoGP','2':'Moto2','3':'Moto3',e:'MotoE'})[m[1].toLowerCase()]:String(v||'');};
  const session=v=>({RAC:'Race',SPR:'Sprint'})[String(v||'').toUpperCase()]||String(v||'');
  const number=v=>/^#?\d+$/.test(String(v??'').trim())?String(Number(String(v).replace('#',''))):'';
  const lap=v=>valid(v)&&!/^0+(?:[.:']0+)?$/.test(String(v).trim())?String(v):'—';
  const style=`
    .nt-live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e10600;margin-right:9px;box-shadow:0 0 0 3px rgba(225,6,0,.13)}
    .nt-table{min-width:1040px!important}
    .nt-row{grid-template-columns:44px minmax(230px,1.7fr) 58px minmax(145px,1fr) 92px 92px minmax(108px,.8fr)!important}
    .nt-heading>span:nth-child(2){text-align:left!important}
    .nt-lap-pair{display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:0}
    .nt-lap-pair>small{font-size:10px;color:var(--secondary-text-color);font-weight:650;white-space:nowrap}
    .nt-lap-pair .nt-last-main{font-weight:850;white-space:nowrap}
    .nt-status-pair{display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:0}
    .nt-status-pair small{font-size:10px;color:var(--secondary-text-color)}
    .nt-position-up{color:#16803b;font-weight:900}.nt-position-down{color:#dc2626;font-weight:900}
    .nt-position-zero{color:var(--secondary-text-color);font-weight:750}
    .nt-position-empty{color:var(--secondary-text-color)}
    .nt-session-record strong{color:var(--motogp-fastest-lap-color,var(--error-color,#b71c1c))}
    .np-card{background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--primary-text-color);border:1px solid var(--divider-color,#ddd);border-radius:15px;overflow:hidden;min-width:0}
    .np-heading{display:flex;align-items:center;justify-content:space-between;gap:9px;border-bottom:1px solid var(--divider-color,#ddd);padding:11px 13px;font-size:14px;font-weight:900}
    .np-note{font-size:11px;color:var(--secondary-text-color);font-weight:550}
    .np-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;padding:10px}
    .np-slot{border:1px solid var(--divider-color,#ddd);border-radius:9px;padding:9px;min-width:0}
    .np-slot b{font-size:12px}.np-slot small{display:block;font-size:10px;color:var(--secondary-text-color);margin-top:3px;overflow:hidden;text-overflow:ellipsis}
    .np-tabs{display:flex;gap:7px;padding:10px 12px;flex-wrap:wrap}
    .np-tab{border:1px solid var(--divider-color,#ddd);background:transparent;border-radius:15px;padding:6px 12px;color:inherit;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
    .np-tab[aria-selected=true]{border-color:#0099dc;background:rgba(0,153,220,.12)}
    .np-standings{width:100%;border-collapse:collapse;font-size:12px}
    .np-standings th,.np-standings td{padding:8px 13px;border-top:1px solid var(--divider-color,#ddd);text-align:left}
    .np-standings td:last-child,.np-standings th:last-child{text-align:right}
    .np-empty{padding:13px;color:var(--secondary-text-color);font-size:12px}
    @media(max-width:600px){.np-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.np-note{font-size:10px}}
  `;
  function ensureStyle(card) {
    if(!card.shadowRoot||card.shadowRoot.querySelector('[data-motogp-ui-preview]'))return;
    const s=document.createElement('style');s.setAttribute('data-motogp-ui-preview','');s.textContent=style;
    card.shadowRoot.appendChild(s);
  }
  // One grid entry for one number only. Refuse duplicates rather than attributing a
  // rider's start position to the wrong competitor or another class.
  function startPosition(card,r) {
    const snap=card._snapshot,live=card._live;
    if(!live||!snap||!['Race','Sprint'].includes(session(snap.name)))return null;
    if(snap.category!==live.category||session(snap.name)!==session(live.name))return null;
    const race=card._hass?.states?.[card._ids.race],a=race?.attributes||{};
    const grids=a.start_grids||{};
    const grid=grids[snap.category],num=number(r.number),position=Number(r.position);
    if(!Array.isArray(grid)||!num||!Number.isInteger(position)||position<=0)return null;
    const candidates=grid.filter(x=>number(x?.number)===num);
    if(candidates.length!==1)return null;
    const start=Number(candidates[0].position);
    if(!Number.isInteger(start)||start<=0||grid.filter(x=>Number(x?.position)===start).length!==1)return null;
    return start-position;
  }
  // The old lap cell can include nested PB spans. Find its balanced closing tag
  // instead of matching against a regex that truncates the PB badge.
  function lapCellRange(row,r) {
    const count=Number(r.num_lap),shown=Number.isFinite(count)&&count>0?String(r.num_lap):'—';
    const anchor=`</span></span><span>${esc(shown)}</span>`;
    const offset=row.indexOf(anchor);
    if(offset<0)return null;
    const begin=row.indexOf('<span',offset+anchor.length);
    if(begin<0)return null;
    const tags=/<\/?span\b[^>]*>/g;tags.lastIndex=begin;
    let depth=0,match;
    while((match=tags.exec(row))) {
      depth+=match[0].startsWith('</')?-1:1;
      if(depth===0)return {begin,end:tags.lastIndex};
    }
    return null;
  }
  function install() {
    const Overview=customElements.get(OVERVIEW),Timing=customElements.get(TIMING);
    if(Overview?.buildInfo?.version!==REQUIRED||Timing?.buildInfo?.version!==REQUIRED) {
      console.error(`[MotoGP UI preview] Expected ${REQUIRED}; no changes`);return;
    }
    if(Timing.prototype._motogpUiPreview)return;
    const oldTiming=Timing.prototype._timing;
    Timing.prototype._timing=function() {
      let html=oldTiming.call(this);
      ensureStyle(this);
      if(this._spoiler()||!this._snapshot?.riders?.length||this._snapshot.day!==this._today)return html;
      if(this._live)html=html.replace('<span class="nt-label">🏁 ',
        '<span class="nt-label"><span class="nt-live-dot" aria-label="Live"></span>');
      // In the single-file lap-stats addon the lightning bolt only denotes
      // a session record; personal-best labels remain unchanged.
      html=html.replace(/⚡/g,'⏱');
      html=html.replace('<span>SENASTE</span>','<span>SENASTE VARV</span>')
        .replace('<span>Δ FRAMFÖR</span>','<span>FRAMFÖR</span>')
        .replace('<span>Δ LEDARE</span>','<span>LEDARE</span>');
      let n=0;
      const parts=('\u0000'+html).split(/(?=<div class="nt-row(?: unclassified)?">)/);
      html=parts.map((row,i)=>{
        if(!i||!row.startsWith('<div class="nt-row'))return row;
        const r=this._snapshot.riders[n++];if(!r)return row;
        const range=lapCellRange(row,r);
        if(range) {
          const original=row.slice(range.begin,range.end),best=lap(r.best_lap_time);
          const cell=`<span class="nt-lap-pair"><span class="nt-last-main">${original}</span>`+
            `<small>Snabbaste: ${esc(best)}</small></span>`;
          row=row.slice(0,range.begin)+cell+row.slice(range.end);
        }
        const status=r.on_pit?'PIT':valid(r.status_name)?String(r.status_name):valid(r.status_id)?String(r.status_id):'—';
        const change=startPosition(this,r);
        const text=change===null?'—':change>0?`▲ +${change}`:change<0?`▼ −${Math.abs(change)}`:'= 0';
        const cl=change===null?'nt-position-empty':change>0?'nt-position-up':change<0?'nt-position-down':'nt-position-zero';
        const end=`<span>${esc(status)}</span></div>`;
        if(row.includes(end))row=row.replace(end,`<span class="nt-status-pair"><strong class="${cl}">${text}</strong>`+
          `<small>${esc(status)}</small></span></div>`);
        return row;
      }).join('').slice(1);
      return html;
    };
    const oldClick=Overview.prototype._click;
    Overview.prototype._click=function(e) {
      const tab=e.target?.closest?.('[data-motogp-standing]');
      if(tab){this._standingTab=tab.getAttribute('data-motogp-standing');this._render();return;}
      return oldClick.call(this,e);
    };
    function gridHtml(card,now) {
      if(card._spoiler())return '';
      const race=card._hass?.states?.[card._ids.race],a=race?.attributes||{};
      const schedule=Array.isArray(a.sessions_all)?a.sessions_all:Array.isArray(a.sessions)?a.sessions:[];
      const available=schedule.map(s=>{
        if(!s||!['Race','Sprint'].includes(session(s.name||s.type))||
          ['FINISHED','CANCELLED','CANCELED'].includes(String(s.status||'').toUpperCase()))return null;
        const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s.date||''));
        if(!m)return null;
        const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
        if(Number.isNaN(d.getTime())||d.getFullYear()!==+m[1]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[3]||d.getHours()!==+m[4]||d.getMinutes()!==+m[5])return null;
        const delta=d.getTime()-now.getTime();
        return delta>=0&&delta<=15*60000?{s,d,delta,category:cat(s.category)}:null;
      }).filter(Boolean).sort((x,y)=>x.delta-y.delta)[0];
      if(!available)return '';
      const {s,category}=available,grids=a.start_grids||{},items=grids[category];
      const name=session(s.name||s.type);
      const head=`<section class="np-card" aria-label="Startgrid"><div class="np-heading">`+
        `<span>🏁 Startgrid · ${esc(category)} ${esc(name)}</span><span class="np-note">Från 15 min före start</span></div>`;
      if(!Array.isArray(items)||!items.length)return head+'<div class="np-empty">Startgriden är inte publicerad ännu.</div></section>';
      const rows=items.slice().sort((a,b)=>Number(a.position)-Number(b.position));
      return head+`<div class="np-grid">${rows.map(r=>`<div class="np-slot"><b>P${esc(r.position??'—')} · #${esc(r.number??'—')}</b>`+
        `<small>${esc(r.rider||'Okänd')}</small><small>${esc(r.team||'')}</small></div>`).join('')}</div></section>`;
    }
    function standingsHtml(card) {
      if(card._spoiler())return '';
      const tab=['Moto3','Moto2','MotoGP'].includes(card._standingTab)?card._standingTab:'MotoGP';
      const state=card._hass?.states?.['sensor.motogp_rider_standings'];
      const live=card._live;
      const buttons=['Moto3','Moto2','MotoGP'].map(c=>`<button type="button" class="np-tab"`+
        ` data-motogp-standing="${c}" role="tab" aria-selected="${c===tab}">${c}</button>`).join('');
      const head=`<section class="np-card" aria-label="VM-ställning"><div class="np-heading">`+
        `<span>🏆 VM-ställning</span><span class="np-note">Moto3 · Moto2 · MotoGP</span></div>`+
        `<div class="np-tabs" role="tablist" aria-label="VM-klass">${buttons}</div>`;
      if(live)return head+'<div class="np-empty">VM-ställningen döljs under livepass för att undvika förtida resultat.</div></section>';
      if(tab!=='MotoGP')return head+`<div class="np-empty">${esc(tab)}: inväntar verifierad klassvis data från backend.</div></section>`;
      const rows=state?.attributes?.standings;
      if(!Array.isArray(rows)||!rows.length)return head+'<div class="np-empty">MotoGP: inga verifierade VM-data tillgängliga.</div></section>';
      return head+'<table class="np-standings"><thead><tr><th>Pos</th><th>Förare</th><th>Poäng</th></tr></thead><tbody>'+
        rows.slice(0,10).map(r=>`<tr><td>${esc(r.position??'—')}</td><td>${esc(r.rider||'—')}</td>`+
          `<td>${esc(r.points??'—')}</td></tr>`).join('')+'</tbody></table></section>';
    }
    const oldRender=Overview.prototype._render;
    Overview.prototype._render=function() {
      oldRender.call(this);ensureStyle(this);
      if(!this._hass)return;
      const view=this.shadowRoot?.getElementById('app');if(!view)return;
      const insert=gridHtml(this,new Date())+standingsHtml(this);
      const marker='<div class="foot">';
      view.innerHTML=view.innerHTML.includes(marker)?view.innerHTML.replace(marker,insert+marker):view.innerHTML+insert;
    };
    Timing.prototype._motogpUiPreview=BUILD;
    Overview.prototype._motogpUiPreview=BUILD;
    console.info(`[MotoGP UI preview] ${BUILD} installed in the existing one-file Next resource`);
  }
  Promise.all([customElements.whenDefined(OVERVIEW),customElements.whenDefined(TIMING)]).then(install);
})();
