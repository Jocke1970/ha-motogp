/* ha-motogp-card: development preview, no external JavaScript dependencies.
 * Source data: the existing motogp_sensor entities. This file is the complete
 * Lovelace resource; add it as a JavaScript module in Settings > Dashboards.
 */
(() => {
  const TAG = 'ha-motogp-card';
  if (customElements.get(TAG)) return;

  const DEFAULTS = Object.freeze({
    race: 'sensor.motogp_next_race',
    session: 'sensor.motogp_current_session',
    status: 'sensor.motogp_session_status',
    riders: 'sensor.motogp_rider_positions',
    laps: 'sensor.motogp_race_lap_count',
    remaining: 'sensor.motogp_session_time_remaining',
    category: 'input_select.motogp_schedule_category'
  });
  const WEEKDAYS = ['SÖNDAG', 'MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'LÖRDAG'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
  const BAD = new Set(['unknown', 'unavailable', 'none', '']);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const stateOf = entity => BAD.has(String(entity?.state ?? '').toLowerCase()) ? '' : entity.state;
  const categoryName = value => {
    const raw = String(value ?? '').trim();
    const names = { MOTOGP: 'MotoGP', MOTO2: 'Moto2', MOTO3: 'Moto3', MOTOE: 'MotoE' };
    return names[raw.toUpperCase()] || raw || 'Okänd klass';
  };
  const sessionKey = value => {
    const key = String(value || '').trim().toUpperCase();
    return ({ RAC: 'RACE', SPR: 'SPRINT', PR: 'PRACTICE', WUP: 'WARM UP' })[key] || key;
  };
  const sessionName = value => ({ RAC: 'Race', SPR: 'Sprint', PR: 'Practice', WUP: 'Warm Up' })[
    String(value || '').toUpperCase()
  ] || String(value || 'Timing');
  function wall(raw) {
    // API session dates have been observed as event-local wall times tagged UTC.
    // Preserve their visible HH:MM; do NOT silently use new Date(raw).
    const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    const [, y, month, day, h, min] = m.map(Number);
    return new Date(y, month - 1, day, h, min);
  }
  const dayKey = date => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
  const timeLabel = date => date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '—';
  const dayTitle = date => date ? `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}` : '';
  function until(date, now) {
    if (!date) return '';
    const min = Math.ceil((date - now) / 60000);
    if (min <= 0) return 'NU';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), rest = min % 60;
    if (h < 24) return `${h} h${rest ? ` ${rest} min` : ''}`;
    const days = Math.floor(h / 24);
    return `${days} d${h % 24 ? ` ${h % 24} h` : ''}`;
  }
  function duration(raw, lapBased) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (lapBased) return `${Math.round(n)} varv`;
    return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  }
  function secs(raw) {
    const parts = String(raw || '').replace(/'/g, ':').split(':');
    const nums = parts.map(Number);
    if (!nums.every(Number.isFinite)) return Infinity;
    return nums.length === 2 ? nums[0] * 60 + nums[1] : nums.length === 1 ? nums[0] : Infinity;
  }
  function isActive(statusEntity) {
    return ['I', 'S'].includes(String(statusEntity?.attributes?.session_status_id || '')) ||
      stateOf(statusEntity) === 'In Progress';
  }
  function statusText(entity) {
    if (isActive(entity)) return 'LIVE';
    const id = String(entity?.attributes?.session_status_id || '');
    return ({ N: 'VÄNTAR', F: 'AVSLUTAD', R: 'RÖD FLAGG', D: 'FÖRSENAD', C: 'INSTÄLLD' })[id] ||
      ({ 'Not Started': 'VÄNTAR', Finished: 'AVSLUTAD', 'Red Flag': 'RÖD FLAGG', Delayed: 'FÖRSENAD', Cancelled: 'INSTÄLLD' })[stateOf(entity)] || 'INGEN AKTIV SESSION';
  }
  function normalizedSchedule(race, selected) {
    const attrs = race?.attributes || {};
    const source = Array.isArray(attrs.sessions_all) ? attrs.sessions_all :
      Array.isArray(attrs.sessions) ? attrs.sessions : [];
    return source.filter(s => s && typeof s === 'object' && wall(s.date))
      .map(s => ({ ...s, _date: wall(s.date), _category: categoryName(s.category || attrs.category),
        _name: sessionName(s.name || s.type) }))
      .filter(s => selected === 'Total' || s._category === selected)
      .sort((a, b) => a._date - b._date);
  }
  function liveIdentity(hass, ids) {
    const session = hass?.states?.[ids.session], status = hass?.states?.[ids.status];
    const category = categoryName(session?.attributes?.category || status?.attributes?.category ||
      hass?.states?.[ids.riders]?.attributes?.category);
    const name = sessionName(stateOf(session));
    const event = String(session?.attributes?.event || status?.attributes?.event || '');
    return { category, name, key: `${event}|${category}|${sessionKey(name)}`, active: isActive(status),
      status: statusText(status), statusId: status?.attributes?.session_status_id || '' };
  }
  function riderRows(entity) {
    const source = Array.isArray(entity?.attributes?.riders) ? entity.attributes.riders : [];
    return source.slice().sort((a, b) => {
      const ap = Number(a.position), bp = Number(b.position);
      return (ap > 0 ? ap : Infinity) - (bp > 0 ? bp : Infinity);
    });
  }
  function flag(value) {
    const iso = String(value || '').toUpperCase();
    const countries = { ITA: 'IT', SPA: 'ES', ESP: 'ES', AUS: 'AU', FRA: 'FR', GBR: 'GB',
      JPN: 'JP', NED: 'NL', BEL: 'BE', CZE: 'CZ', COL: 'CO', INA: 'ID', IDN: 'ID',
      ARG: 'AR', BRA: 'BR', USA: 'US', TUR: 'TR', THA: 'TH', GER: 'DE', POR: 'PT' };
    const code = /^[A-Z]{2}$/.test(iso) ? iso : countries[iso];
    return code ? String.fromCodePoint(...Array.from(code, c => 127397 + c.charCodeAt(0))) : '';
  }
  const colorOf = rider => {
    const api = String(rider.color || '').replace(/^#/, '');
    if (/^[a-f0-9]{6}$/i.test(api)) return `#${api}`;
    const team = `${rider.team || ''} ${rider.bike || ''}`.toLowerCase();
    return Object.entries({ gresini: '#60a5fa', vr46: '#facc15', ktm: '#f97316',
      yamaha: '#2563eb', honda: '#ef4444', aprilia: '#64748b', ducati: '#e10600' })
      .find(([key]) => team.includes(key))?.[1] || '#94a3b8';
  };
  function matchingSession(session, identity) {
    return session._category === identity.category && sessionKey(session._name) === sessionKey(identity.name);
  }

  const CSS = `
    :host { display:block; min-width:0; color:var(--primary-text-color); }
    * { box-sizing:border-box; }
    .panel { border-radius:16px; background:var(--ha-card-background,var(--card-background-color,#fff));
      border:1px solid var(--divider-color,rgba(127,127,127,.2)); overflow:hidden; }
    .head { display:flex; justify-content:space-between; align-items:center; gap:12px;
      min-height:42px; padding:8px 12px; border-bottom:1px solid var(--divider-color,rgba(127,127,127,.2)); }
    .head strong { font-size:14px; font-weight:850; }
    .head-right { display:flex; flex-direction:column; align-items:flex-end; font-size:11px;
      font-weight:700; text-align:right; color:var(--secondary-text-color); }
    .day { border-top:1px solid var(--divider-color,rgba(127,127,127,.12)); }
    .day:first-child { border-top:0; }
    button { font:inherit; color:inherit; cursor:pointer; }
    .day-button { width:100%; background:transparent; border:0; text-align:left; padding:12px;
      display:grid; grid-template-columns:minmax(120px,1fr) minmax(0,1fr) 22px; gap:10px; align-items:center; }
    .day-button:hover, .timing-button:hover { background:rgba(127,127,127,.045); }
    .day-label { font-size:12px; font-weight:900; }
    .day-summary { font-size:11px; color:var(--secondary-text-color); }
    .chevron { text-align:center; font-size:16px; color:var(--secondary-text-color); }
    .tiles { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; padding:0 10px 10px; }
    .tile { min-width:0; padding:8px 10px; min-height:52px; border:1px solid var(--divider-color,rgba(127,127,127,.16));
      border-radius:11px; background:rgba(127,127,127,.015); }
    .tile-top { display:flex; align-items:center; justify-content:space-between; gap:5px; }
    .tile-time { font-weight:900; font-size:12px; font-variant-numeric:tabular-nums; }
    .tile-main { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:4px; font-size:12px; font-weight:900; }
    .cat { color:var(--secondary-text-color); font-size:11px; }
    .pill { padding:1px 5px; border-radius:12px; font-size:10px; font-weight:900; white-space:nowrap;
      color:#ad6500; background:rgba(245,158,11,.14); }
    .live { color:#e10600; } .pill.live { background:rgba(225,6,0,.12); }
    .tile.live-tile { border-color:rgba(225,6,0,.5); background:rgba(225,6,0,.055); }
    .tile.waiting { border-color:rgba(245,158,11,.6); background:rgba(245,158,11,.05); }
    .tile.done { opacity:.58; } .pill.done { color:var(--secondary-text-color); background:rgba(127,127,127,.09); }
    .weather { font-size:10px; margin-top:3px; color:var(--secondary-text-color); }
    .empty { padding:18px 12px; color:var(--secondary-text-color); font-size:12px; }
    .timing-button { width:100%; border:0; background:transparent; text-align:left; padding:11px 14px;
      display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .timing-title { font-size:15px; font-weight:950; } .timing-status { font-size:13px; font-weight:900; }
    .timing-info { text-align:right; font-size:11px; font-weight:700; color:var(--secondary-text-color); }
    .timing-info span { display:block; } .hint { margin-top:3px; }
    .snapshot { padding:6px 13px; font-size:11px; color:var(--secondary-text-color); background:rgba(127,127,127,.05); }
    .timing-columns,.timing-row { display:grid; grid-template-columns:40px 4px minmax(180px,1fr) 60px 110px 95px 95px 100px;
      gap:8px; align-items:center; }
    .timing-columns { font-size:10px; font-weight:900; color:var(--secondary-text-color); padding:10px 14px;
      border-bottom:1px solid var(--divider-color,rgba(127,127,127,.2)); }
    .timing-row { padding:9px 14px; min-height:56px; border-bottom:1px solid rgba(127,127,127,.075); }
    .timing-row:last-child { border-bottom:0; } .pos { font-weight:900; text-align:center; }
    .teamline { width:4px; height:36px; border-radius:8px; } .rider { min-width:0; }
    .name { font-size:14px; font-weight:900; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .meta { font-size:11px; color:var(--secondary-text-color); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .num { text-align:right; font-size:13px; font-weight:800; font-variant-numeric:tabular-nums; }
    .last-fast { color:#e10600; } .status-pill { display:inline-block; padding:2px 6px;
      background:rgba(127,127,127,.1); border-radius:11px; font-size:10px; font-weight:850; }
    .status-pill.pit { color:#ad6500; background:rgba(245,158,11,.12); }
    .center { text-align:center; }
    @media (max-width:1100px) {
      .timing-columns,.timing-row { grid-template-columns:35px 4px minmax(120px,1fr) 55px 90px 75px; gap:6px; }
      .timing-columns > :nth-child(7),.timing-row > :nth-child(7),
      .timing-columns > :nth-child(8),.timing-row > :nth-child(8) { display:none; }
    }
    @media (max-width:700px) {
      .tiles { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .day-button { grid-template-columns:minmax(90px,1fr) minmax(0,1fr) 18px; gap:5px; }
      .day-summary { font-size:10px; }
      .timing-columns,.timing-row { grid-template-columns:27px 3px minmax(0,1fr) 76px 70px; gap:5px; padding-left:8px; padding-right:8px; }
      .timing-columns > :nth-child(4),.timing-row > :nth-child(4),
      .timing-columns > :nth-child(7),.timing-row > :nth-child(7),
      .timing-columns > :nth-child(8),.timing-row > :nth-child(8) { display:none; }
      .name { font-size:12px; } .num { font-size:11px; } .meta { font-size:9px; }
    }
    @media (max-width:360px) { .tiles { grid-template-columns:1fr; } }
  `;

  class HaMotogpCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._ids = { ...DEFAULTS };
      this._mode = 'both';
      this._hass = null;
      this._refs = null;
      this._manualDay = null;
      this._manualTiming = null;
      this._snapshot = null;
      this._identityKey = '';
      this._today = '';
      this._timer = null;
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div id="view"></div>`;
      this.shadowRoot.addEventListener('click', e => this._click(e));
    }
    setConfig(config) {
      if (!config || !['schedule', 'timing', 'both', undefined].includes(config.mode)) {
        throw new Error('ha-motogp-card: mode ska vara schedule, timing eller both.');
      }
      this._mode = config.mode || 'both';
      this._ids = { ...DEFAULTS, ...(config.entities || {}) };
      if (this._hass) this._render();
    }
    set hass(hass) {
      this._hass = hass;
      const ids = Object.values(this._ids);
      const refs = ids.map(id => hass.states[id]);
      if (!this._refs || refs.some((ref, i) => ref !== this._refs[i])) {
        this._refs = refs;
        this._render();
      }
    }
    connectedCallback() {
      if (!this._timer) this._timer = setInterval(() => this._render(), 30000);
      if (this._hass) this._render();
    }
    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
    }
    _click(e) {
      const button = e.target.closest('button[data-day],button[data-timing]');
      if (!button) return;
      if (button.dataset.day !== undefined) {
        const current = this._openDay();
        this._manualDay = current === button.dataset.day ? '' : button.dataset.day;
      } else {
        this._manualTiming = !this._timingOpen();
      }
      this._render(); // Client-side only: no HA helper/service call.
    }
    _openDay() { return this._manualDay === null ? this._today : this._manualDay; }
    _timingOpen() { return this._manualTiming === null ? Boolean(this._snapshot) : this._manualTiming; }
    _refreshState(now) {
      const today = dayKey(now);
      if (today !== this._today) {
        this._today = today;
        this._manualDay = null;
        this._manualTiming = null;
        if (this._snapshot && !this._snapshot.identity.active) this._snapshot = null;
      }
      if (!this._hass) return;
      const identity = liveIdentity(this._hass, this._ids);
      const rowEntity = this._hass.states[this._ids.riders];
      const riders = riderRows(rowEntity);
      const key = identity.key;
      const schedule = normalizedSchedule(this._hass.states[this._ids.race], 'Total');
      const matching = schedule.find(s => matchingSession(s, identity));
      const matchingToday = matching && dayKey(matching._date) === today;
      if (identity.active && key !== this._identityKey) {
        this._manualTiming = null;
        this._identityKey = key;
      }
      // The last complete session stays visible while the next feed is waiting.
      // A new live session replaces it; a finished update of that same session
      // may replace the snapshot to capture final classification.
      if (riders.length && (identity.active || identity.statusId === 'F') &&
          (matchingToday || identity.active && (!matching || dayKey(matching._date) === today))) {
        if (identity.active || !this._snapshot || this._snapshot.identity.key === key) {
          this._snapshot = { identity: { ...identity }, riders, day: today,
            event: identity.key, saved: now.getTime() };
        }
      }
    }
    _render() {
      if (!this._hass) return;
      const now = new Date();
      this._refreshState(now);
      const ids = this._ids;
      const selectedRaw = stateOf(this._hass.states[ids.category]) || 'Total';
      const race = this._hass.states[ids.race];
      const categories = race?.attributes?.schedule_categories;
      const selected = selectedRaw === 'Total' || !Array.isArray(categories) ||
        categories.includes(selectedRaw) ? selectedRaw : 'Total';
      const schedule = normalizedSchedule(race, selected);
      const identity = liveIdentity(this._hass, ids);
      const parts = [];
      if (this._mode !== 'timing') parts.push(this._scheduleMarkup(schedule, selected, identity, now));
      if (this._mode !== 'schedule') parts.push(this._timingMarkup(identity));
      const root = this.shadowRoot.getElementById('view');
      root.innerHTML = parts.join('');
    }
    _scheduleMarkup(sessions, selected, identity, now) {
      if (!sessions.length) return `<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong>` +
        `<span class="head-right">${safe(selected)}</span></div><div class="empty">Inga pass för valt filter.</div></section>`;
      const grouped = new Map();
      for (const s of sessions) {
        const day = dayKey(s._date);
        if (!grouped.has(day)) grouped.set(day, []);
        grouped.get(day).push(s);
      }
      const live = s => identity.active && matchingSession(s, identity) &&
        dayKey(s._date) === dayKey(now);
      const currentWaiting = s => identity.status === 'VÄNTAR' && matchingSession(s, identity) &&
        dayKey(s._date) === dayKey(now);
      const done = s => String(s.status || '').toUpperCase() === 'FINISHED' ||
        (s._date < now && !live(s) && !currentWaiting(s));
      const next = sessions.find(s => live(s)) || sessions.find(s => currentWaiting(s)) ||
        sessions.find(s => !done(s));
      const headText = next ? `${live(next) ? '● LIVE:' : 'Nästa:'} ${next._category} · ${next._name} · ${timeLabel(next._date)}` : 'Inga kommande pass';
      let html = `<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong>` +
        `<span class="head-right"><strong>${safe(selected)}</strong>${safe(headText)}</span></div>`;
      for (const [day, items] of grouped) {
        const open = this._openDay() === day;
        const unfinished = items.find(s => !done(s));
        const summary = unfinished ? `nästa ${unfinished._category} ${unfinished._name}` : 'klar';
        const tiles = open ? `<div class="tiles">${items.map(s => {
          const isLive = live(s), waiting = currentWaiting(s), finished = done(s);
          const badge = isLive ? 'LIVE' : waiting ? 'VÄNTAR' : finished ? '✓' : until(s._date, now);
          const cls = isLive ? 'live-tile' : waiting ? 'waiting' : finished ? 'done' : '';
          const bcls = isLive ? 'live' : finished ? 'done' : '';
          const cond = [s.air && `Luft ${s.air}`, s.ground && `Bana ${s.ground}`].filter(Boolean).join(' · ');
          return `<div class="tile ${cls}"><div class="tile-top"><span class="tile-time">${timeLabel(s._date)}</span>` +
            `<span class="pill ${bcls}">${safe(badge)}</span></div><div class="tile-main">` +
            `<span class="cat">${safe(s._category)}</span>${safe(s._name)}</div>` +
            `${cond ? `<div class="weather">${safe(cond)}</div>` : ''}</div>`;
        }).join('')}</div>` : '';
        html += `<div class="day"><button type="button" class="day-button" data-day="${safe(day)}" ` +
          `aria-expanded="${open}"><span class="day-label">${safe(dayTitle(items[0]._date))}</span>` +
          `<span class="day-summary">${items.length} pass · ${safe(summary)}</span>` +
          `<span class="chevron">${open ? '⌃' : '⌄'}</span></button>${tiles}</div>`;
      }
      return html + '</section>';
    }
    _timingMarkup(identity) {
      const hass = this._hass, ids = this._ids;
      const rawRiders = riderRows(hass.states[ids.riders]);
      const snapshot = this._snapshot;
      const open = this._timingOpen();
      const current = snapshot && (identity.active && snapshot.identity.key === identity.key ||
        identity.statusId === 'F' && snapshot.identity.key === identity.key);
      const visibleRiders = snapshot?.riders || (identity.active ? rawRiders : []);
      const lapEntity = hass.states[ids.laps];
      const totalLaps = Number(lapEntity?.attributes?.num_laps || 0);
      const race = ['Race', 'Sprint'].includes(identity.name) && totalLaps > 0;
      const count = duration(stateOf(hass.states[ids.remaining]), race);
      const lap = Number(stateOf(lapEntity) || 0);
      const info = identity.active ? [lap > 0 ? `Varv ${lap}${totalLaps ? ` / ${totalLaps}` : ''}` : '',
        count && `${count} kvar`].filter(Boolean).join(' · ') : `${count}${count ? ' session' : ''}`;
      const status = identity.status;
      let html = `<section class="panel" aria-label="MotoGP live timing"><button type="button" class="timing-button" data-timing ` +
        `aria-expanded="${open}"><span><span class="timing-title">${safe(identity.category)} · ${safe(identity.name)}</span>` +
        `<span class="timing-status ${identity.active ? 'live' : ''}" style="display:block">${safe(status)}</span></span>` +
        `<span class="timing-info"><span>${safe(info)}</span><span class="hint">${open ? '⌃ Dölj förare' : '⌄ Visa förare'}</span></span></button>`;
      if (!open) return html + '</section>';
      if (snapshot && !current) html += `<div class="snapshot">Senaste timing: ` +
        `${safe(snapshot.identity.category)} · ${safe(snapshot.identity.name)} (föregående pass)</div>`;
      if (!visibleRiders.length) return html + `<div class="empty">Ingen timingdata tillgänglig än.</div></section>`;
      const names = {};
      visibleRiders.forEach(r => { const name = String(r.surname || '').toUpperCase(); names[name] = (names[name] || 0) + 1; });
      const latest = visibleRiders.map(r => secs(r.last_lap_time)).filter(x => x > 0 && Number.isFinite(x));
      const fastest = latest.length ? Math.min(...latest) : Infinity;
      html += `<div class="timing-columns"><span>POS</span><span></span><span>FÖRARE / TEAM</span>` +
        `<span>VARV</span><span>SENASTE</span><span>Δ FRAMFÖR</span><span>Δ LEDARE</span><span>STATUS</span></div>`;
      for (const r of visibleRiders) {
        const p = Number(r.position); const valid = p > 0;
        let name = String(r.surname || r.shortname || r.firstname || '?');
        if (names[String(r.surname || '').toUpperCase()] > 1 && r.firstname) name =
          `${String(r.firstname).charAt(0).toUpperCase()}. ${name}`;
        const last = String(r.last_lap_time || '');
        const fast = last && secs(last) === fastest;
        const statusText = String(r.status_name || '');
        const riderStatus = [statusText !== 'CL' ? statusText : '', r.on_pit ? 'PIT' : ''].filter(Boolean).join(' · ');
        const bike = String(r.bike || ''); const team = String(r.team || '');
        const details = [`#${r.number || '—'}`, bike && !team.toLowerCase().includes(bike.toLowerCase()) && bike,
          team].filter(Boolean).join(' · ');
        html += `<div class="timing-row"><span class="pos">${valid ? p : '—'}</span>` +
          `<span class="teamline" style="background:${colorOf(r)}"></span>` +
          `<span class="rider"><span class="name" style="display:block">${flag(r.nation)} ${safe(name)}</span>` +
          `<span class="meta" style="display:block">${safe(details)}</span></span>` +
          `<span class="num">${r.num_lap > 0 ? `L${Number(r.num_lap)}` : '—'}</span>` +
          `<span class="num ${fast ? 'last-fast' : ''}">${fast ? '⚡ ' : ''}${safe(last || '—')}</span>` +
          `<span class="num">${safe(valid && p > 1 ? r.gap_prev || '—' : '—')}</span>` +
          `<span class="num">${safe(valid ? p === 1 ? 'LEADER' : r.gap_first || '—' : '—')}</span>` +
          `<span class="center">${riderStatus ? `<span class="status-pill ${r.on_pit ? 'pit' : ''}">${safe(riderStatus)}</span>` : '—'}</span></div>`;
      }
      return html + '</section>';
    }
    getCardSize() { return this._mode === 'timing' ? 5 : 4; }
    getGridOptions() { return { columns: this._mode === 'timing' ? 12 : 12, rows: 'auto', min_columns: 4 }; }
  }

  customElements.define(TAG, HaMotogpCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: TAG, name: 'MotoGP Card (dev)', description: 'Helgschema och live timing med snabba lokala expanders.' });
})();
