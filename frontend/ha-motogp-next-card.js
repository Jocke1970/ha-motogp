/* MotoGP Next: isolated JS migration for motogp-test. The original mobile element is untouched. */
(() => {
  'use strict';
  const TAG = 'ha-motogp-next-card';
  const VERSION = '0.2.0-dev.2';
  const BUILD = 'next-20260918-02';
  if (customElements.get(TAG)) {
    console.warn(`[${TAG}] Already registered. Reload the browser to load a changed JS resource.`);
    return;
  }
  const IDS = Object.freeze({
    race: 'sensor.motogp_next_race',
    session: 'sensor.motogp_current_session',
    status: 'sensor.motogp_session_status',
    riders: 'sensor.motogp_rider_positions',
    laps: 'sensor.motogp_race_lap_count',
    remaining: 'sensor.motogp_session_time_remaining',
    weather: 'sensor.motogp_track_weather',
    spoiler: 'switch.motogp_no_spoiler'
  });
  const WD = ['SÖNDAG', 'MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'LÖRDAG'];
  const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
  const valid = v => v != null && !['', 'unknown', 'unavailable', 'none', 'hidden', 'null'].includes(String(v).trim().toLowerCase());
  const cat = v => ({MOTOGP:'MotoGP',MOTO2:'Moto2',MOTO3:'Moto3',MOTOE:'MotoE'})[String(v || '').trim().toUpperCase()] || String(v || '').trim();
  const sess = v => ({RAC:'Race',SPR:'Sprint',PR:'Practice',WUP:'Warm Up'})[String(v || '').toUpperCase()] || String(v || '');
  const keyName = v => String(sess(v)).trim().toUpperCase();
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Pulselive's current strings contain event wall-clock HH:MM with +00:00.
  // Do not run Date.parse(raw) here; that previously shifted the UI by 2h.
  function parseWall(raw) {
    const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    const date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return Number.isNaN(date.getTime()) ? null : {date, day:`${m[1]}-${m[2]}-${m[3]}`, time:`${m[4]}:${m[5]}`};
  }
  const dayName = day => {
    const d = new Date(`${day}T12:00:00`);
    return `${WD[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
  };
  function dateRange(start, end) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(start || ''));
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(end || ''));
    if (!a || !b) return [start,end].filter(valid).join(' – ');
    const ma = MONTH[+a[2]-1], mb = MONTH[+b[2]-1];
    if (a[1] === b[1] && a[2] === b[2]) return `${+a[3]}–${+b[3]} ${ma.toLowerCase()}`;
    return `${+a[3]} ${ma.toLowerCase()} – ${+b[3]} ${mb.toLowerCase()}`;
  }
  function sessionsFor(race) {
    const a = race?.attributes || {};
    const source = Array.isArray(a.sessions_all) ? a.sessions_all : Array.isArray(a.sessions) ? a.sessions : [];
    const start = String(a.date_start || '').slice(0,10), end = String(a.date_end || '').slice(0,10);
    return source.filter(s => s && parseWall(s.date)).map(s => ({
      ...s, _wall:parseWall(s.date), _cat:cat(s.category || 'MotoGP'), _name:sess(s.name || s.type)
    })).filter(s => (!start || s._wall.day >= start) && (!end || s._wall.day <= end))
      .sort((x,y) => x._wall.date - y._wall.date);
  }
  function reading(raw, unit) {
    if (!valid(raw)) return '—';
    const n = Number(String(raw).replace(',', '.').replace(/\s*(°|º|C|%|celsius)\s*$/i, ''));
    // An unvalidated zero from this feed is a placeholder, not a measured 0°C.
    return Number.isFinite(n) && n !== 0 ? `${n}${unit}` : '—';
  }
  const active = st => ['I','S'].includes(String(st?.attributes?.session_status_id || '').toUpperCase()) || st?.state === 'In Progress';
  const finished = st => ['F','C'].includes(String(st?.attributes?.session_status_id || '').toUpperCase()) || st?.state === 'Finished';
  const explicitFinish = s => ['FINISHED','CANCELLED','CANCELED'].includes(String(s.status || '').toUpperCase());
  const sortedRiders = e => Array.isArray(e?.attributes?.riders) ? e.attributes.riders.slice().sort((a,b) =>
    (Number(a.position) > 0 ? Number(a.position) : 999) - (Number(b.position) > 0 ? Number(b.position) : 999)) : [];
  const safeColor = c => /^#?[0-9a-f]{6}$/i.test(String(c || '')) ? `#${String(c).replace('#','')}` : '#94a3b8';
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
    .rider{display:grid;grid-template-columns:30px 4px minmax(125px,2fr) 55px 65px 65px;gap:9px;padding:8px 11px;align-items:center;min-width:410px;border-top:1px solid var(--divider-color,#ddd);font-size:11px}
    .rider .person{min-width:0}.rider .person b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rider .person small{display:block;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .line{height:25px;border-radius:5px}.num{text-align:right;font-variant-numeric:tabular-nums}.status{color:#e10600;font-size:11px;font-weight:900}
    .foot{text-align:right;font-size:10px;color:var(--secondary-text-color);padding:2px 5px}
    @media(max-width:600px){.tiles{grid-template-columns:1fr}.weathergrid{grid-template-columns:repeat(2,minmax(0,1fr))}h2{font-size:18px}}
  `;
  class MotoGPNext extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div id="app"></div>`;
      this._ids = {...IDS}; this._hass = null; this._refs = null; this._timer = null;
      this._filter = 'Total'; this._dayOverrides = new Map(); this._autoDays = new Set();
      this._today = ''; this._event = ''; this._timingManual = null; this._activeKey = ''; this._snapshot = null;
      this.shadowRoot.addEventListener('click', e => this._click(e));
    }
    setConfig(config) {
      if (config?.type !== `custom:${TAG}`) throw new Error(`${TAG}: wrong card type`);
      this._ids = {...IDS, ...(config.entities || {})}; this._refs = null;
      if (this._hass) this._render();
    }
    set hass(hass) {
      this._hass = hass;
      const refs = Object.values(this._ids).map(id => hass.states[id]);
      if (!this._refs || refs.some((x,i) => x !== this._refs[i])) { this._refs = refs; this._render(); }
    }
    connectedCallback() {
      if (!this._timer) this._timer = setInterval(() => this._render(), 30000);
      if (this._hass) this._render();
    }
    disconnectedCallback() { if (this._timer) clearInterval(this._timer); this._timer = null; }
    _spoiler() {
      const s = this._hass?.states || {};
      return s[this._ids.spoiler]?.state === 'on' || [this._ids.session,this._ids.status,this._ids.riders]
        .some(id => s[id]?.state === 'Hidden' || s[id]?.attributes?.spoiler_mode === true);
    }
    _expanded(day) { return this._dayOverrides.has(day) ? this._dayOverrides.get(day) : this._autoDays.has(day); }
    _click(e) {
      const b = e.target.closest('button');
      if (!b || !this.shadowRoot.contains(b)) return;
      if (b.dataset.category !== undefined) this._filter = b.dataset.category;
      else if (b.dataset.day !== undefined) this._dayOverrides.set(b.dataset.day, !this._expanded(b.dataset.day));
      else if (b.dataset.timing !== undefined && !this._spoiler()) {
        const open = this._timingManual === null ? Boolean(this._snapshot || this._isActive()) : this._timingManual;
        this._timingManual = !open;
      }
      this._render(); // All clicks are local: no HA service requests.
    }
    _isActive() { return active(this._hass?.states?.[this._ids.status]); }
    _track(now, race) {
      const today = dayKey(now);
      const event = `${race?.state || ''}|${race?.attributes?.date_start || ''}|${race?.attributes?.date_end || ''}`;
      if (event !== this._event) {
        this._event = event; this._dayOverrides.clear(); this._timingManual = null;
        this._snapshot = null; this._activeKey = '';
      }
      if (today !== this._today) {
        this._today = today; this._dayOverrides.clear(); this._timingManual = null;
        if (!this._isActive()) this._snapshot = null;
      }
      if (this._spoiler()) { this._snapshot = null; this._activeKey = ''; this._timingManual = false; return; }
      const states = this._hass.states, se = states[this._ids.session], st = states[this._ids.status];
      const identity = `${se?.attributes?.event || ''}|${cat(se?.attributes?.category || st?.attributes?.category)}|${keyName(se?.state)}`;
      if (active(st)) {
        if (identity !== this._activeKey) { this._activeKey = identity; this._timingManual = null; this._snapshot = null; }
        const riders = sortedRiders(states[this._ids.riders]);
        if (riders.length) this._snapshot = {identity, day:today, riders,
          name:valid(se?.state) ? sess(se.state) : 'Session', category:cat(se?.attributes?.category || st?.attributes?.category)};
      }
    }
    _schedule(race, now) {
      const all = sessionsFor(race), available = [...new Set(all.map(s => s._cat))];
      if (this._filter !== 'Total' && !available.includes(this._filter)) this._filter = 'Total';
      const sessions = all.filter(s => this._filter === 'Total' || s._cat === this._filter);
      const st = this._hass.states[this._ids.status], se = this._hass.states[this._ids.session];
      const isLive = s => active(st) && s._cat === cat(se?.attributes?.category || st?.attributes?.category) &&
        keyName(s._name) === keyName(se?.state) && s._wall.day === this._today;
      const past = s => !isLive(s) && (explicitFinish(s) || s._wall.date < now);
      // Session data includes scheduled START, not END. Prefer explicit FINISHED.
      // Where the API leaves completed sessions NOT-STARTED, show tomorrow only
      // two hours after the last scheduled start, with no current live feed.
      const current = all.filter(s => s._wall.day === this._today);
      const tomorrow = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      const hasTomorrow = all.some(s => s._wall.day === tomorrow);
      const lastStart = current.length ? Math.max(...current.map(s => s._wall.date.getTime())) : Infinity;
      const confirmedDone = current.length > 0 && current.every(explicitFinish);
      const presumedDone = current.length > 0 && now.getTime() >= lastStart + 2 * 60 * 60 * 1000;
      const previewTomorrow = hasTomorrow && !active(st) && (confirmedDone || presumedDone);
      this._autoDays = new Set(current.length ? [this._today] : []);
      if (previewTomorrow) this._autoDays.add(tomorrow);
      const next = sessions.find(isLive) || sessions.find(s => !past(s));
      let html = `<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong><span class="muted">${esc(this._filter)} · ${sessions.length} pass` +
        `${next ? ` · Nästa: ${esc(next._cat)} ${esc(next._name)} ${next._wall.time}` : ''}</span></div>`;
      html += `<div class="cats">${['Total',...available].map(c => `<button type="button" class="cat" data-category="${esc(c)}" ${this._filter === c ? 'selected' : ''} aria-pressed="${this._filter === c}">${esc(c)}</button>`).join('')}</div>`;
      if (!sessions.length) return html + '<div class="empty">Inga pass i aktuell evenemangsdata för valt filter.</div></section>';
      const groups = new Map();
      for (const s of sessions) { if (!groups.has(s._wall.day)) groups.set(s._wall.day, []); groups.get(s._wall.day).push(s); }
      for (const [day, items] of groups) {
        const open = this._expanded(day), upcoming = items.find(s => !past(s));
        const summary = upcoming ? `Nästa ${upcoming._cat} ${upcoming._name} · ${upcoming._wall.time}` :
          items.every(explicitFinish) ? 'Klart' : 'Inga kommande starter';
        const todayTag = day === this._today ? '<span class="today-tag"> · IDAG</span>' : '';
        html += `<div class="day"><button class="daybtn ${day === this._today ? 'today' : ''}" type="button" data-day="${day}" aria-expanded="${open}"><span>${dayName(day)}${todayTag}</span><span class="summary">${items.length} pass · ${esc(summary)} ${open ? '⌃' : '⌄'}</span></button>`;
        if (open) html += `<div class="tiles">${items.map(s => {
          const live = isLive(s), elapsed = past(s), status = String(s.status || '').toUpperCase();
          const label = live ? '● LIVE' : status === 'FINISHED' ? '✓ KLART' :
            ['CANCELLED','CANCELED'].includes(status) ? 'INSTÄLLT' : elapsed ? 'PASSERAT' : 'KOMMANDE';
          return `<div class="tile ${live ? 'live' : elapsed ? 'done' : ''}"><div class="row"><strong>${s._wall.time}</strong><span class="badge ${live ? 'live' : ''}">${label}</span></div><div class="name">${esc(s._cat)} · ${esc(s._name)}</div></div>`;
        }).join('')}</div>`;
        html += '</div>';
      }
      return html + '</section>';
    }
    _weather() {
      const a = this._hass.states[this._ids.weather]?.attributes || {};
      const metrics = [['Luft',reading(a.air,'°C')],['Bana',reading(a.ground,'°C')],
        ['Luftfuktighet',reading(a.humidity,'%')],['Underlag',valid(a.track) && String(a.track) !== '0' ? String(a.track) : '—']];
      const desc = valid(a.weather) && String(a.weather) !== '0' ? String(a.weather) : '';
      const head = '<section class="panel"><div class="head"><strong>🌤️ Banväder</strong><span class="muted">Senast rapporterat · inte livegaranti</span></div>';
      if (metrics.every(([,v]) => v === '—') && !desc)
        return head + '<div class="empty">Inga banväderdata rapporterade ännu.</div></section>';
      return head + `<div class="weathergrid">${metrics.map(([k,v]) => `<div class="metric"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` +
        `${desc ? `<div class="sub" style="padding:0 12px 12px">${esc(desc)}</div>` : ''}</section>`;
    }
    _timing() {
      if (this._spoiler()) return '<section class="panel"><div class="head"><strong>🏁 Live timing</strong><span class="muted">Spoilerläge – dolt</span></div></section>';
      const states = this._hass.states, st = states[this._ids.status], se = states[this._ids.session];
      const online = active(st), snap = this._snapshot;
      const name = online ? (valid(se?.state) ? sess(se.state) : 'Session') : snap ? snap.name : 'Ingen aktiv session';
      const category = online ? cat(se?.attributes?.category || st?.attributes?.category) : snap?.category || '';
      const status = online ? '● LIVE' : snap ? 'AVSLUTAD / SENASTE PASS' : finished(st) ? 'AVSLUTAD' : 'VÄNTAR / OFFLINE';
      const open = this._timingManual === null ? Boolean(snap || online) : this._timingManual;
      let html = `<section class="panel"><button type="button" class="timingbtn" data-timing aria-expanded="${open}"><span>🏍️ ${esc(category)} ${esc(name)}<br><span class="status">${esc(status)}</span></span><span class="muted">${open ? '⌃ Dölj' : '⌄ Visa'} förare</span></button>`;
      if (!open) return html + '</section>';
      if (!snap?.riders.length) return html + '<div class="empty">Ingen säkerställd förardata för den aktuella sessionen ännu.</div></section>';
      html += '<div class="riders">';
      for (const r of snap.riders) {
        const p = Number(r.position), pos = p > 0 ? p : '—', who = r.surname || r.shortname || r.firstname || 'Okänd';
        html += `<div class="rider"><b>${esc(pos)}</b><span class="line" style="background:${safeColor(r.color)}"></span><span class="person"><b>${esc(who)} · #${esc(r.number || '—')}</b><small>${esc(r.team || r.bike || '')}</small></span>` +
          `<span class="num">${esc(r.num_lap || '—')}</span><span class="num">${esc(r.last_lap_time || '—')}</span><span class="num">${esc(p === 1 ? 'LEAD' : r.gap_first || '—')}</span></div>`;
      }
      return html + '</div></section>';
    }
    _render() {
      if (!this._hass) return;
      const now = new Date(), race = this._hass.states[this._ids.race], a = race?.attributes || {};
      this._track(now,race);
      const event = valid(race?.state) ? race.state : 'Inget evenemang tillgängligt';
      const meta = [a.circuit,a.country,a.date_start && a.date_end ? dateRange(a.date_start,a.date_end) : ''].filter(valid);
      this.shadowRoot.getElementById('app').innerHTML = `<div class="root"><section class="panel header"><div class="eyebrow">🏁 MOTOGP · ${esc(VERSION)}</div><h2>${esc(event)}</h2><div class="sub">${meta.map(esc).join(' · ') || 'Väntar på evenemangsdata'}</div></section>` +
        this._schedule(race,now) + `<div class="root">${this._weather()}${this._timing()}</div>` +
        `<div class="foot">${esc(TAG)} · ${esc(BUILD)} · testresurs</div></div>`;
    }
    getCardSize() { return 8; }
    getGridOptions() { return {columns:12,rows:'auto',min_columns:6}; }
  }
  MotoGPNext.buildInfo = Object.freeze({version:VERSION,buildId:BUILD,tag:TAG});
  customElements.define(TAG,MotoGPNext);
  window.customCards = window.customCards || [];
  window.customCards.push({type:TAG,name:'MotoGP Next – isolerad dev',description:'JS-migrering för motogp-test.'});
  console.info(`[${TAG}] ${VERSION} / ${BUILD}`);
})();
