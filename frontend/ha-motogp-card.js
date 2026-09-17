/* ha-motogp-card · dev preview · one self-contained Lovelace resource. */
(() => {
  const TAG = 'ha-motogp-card';
  // HA_MOTOGP_BUILD_METADATA_START: embedded into the actual JS resource.
  const CARD_BUILD = Object.freeze({
    "version": "0.1.0-dev.3",
    "branch": "dev",
    "buildId": "0b493073ef59",
    "sourceCommit": "5900b8d8a2b1937345a26ced142da5a6fa474432",
    "builtAt": "2026-09-17 20:48 UTC"
});
  // HA_MOTOGP_BUILD_METADATA_END
  if (customElements.get(TAG)) {
    const existing = customElements.get(TAG).buildInfo;
    console.warn('[ha-motogp-card] Already registered; cannot replace loaded card. Existing:',
      existing || 'unknown version', 'New resource:', CARD_BUILD);
    return;
  }

  const DEFAULTS = Object.freeze({
    race: 'sensor.motogp_next_race',
    session: 'sensor.motogp_current_session',
    status: 'sensor.motogp_session_status',
    riders: 'sensor.motogp_rider_positions',
    laps: 'sensor.motogp_race_lap_count',
    remaining: 'sensor.motogp_session_time_remaining',
    category: 'input_select.motogp_schedule_category',
    spoiler: 'switch.motogp_no_spoiler'
  });
  const WEEKDAYS = ['SÖNDAG', 'MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'LÖRDAG'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const valueOf = entity => ['unknown', 'unavailable', 'none', 'hidden', ''].includes(
    String(entity?.state ?? '').toLowerCase()) ? '' : entity.state;
  function categoryName(value) {
    const raw = String(value || '').trim();
    return ({ MOTOGP: 'MotoGP', MOTO2: 'Moto2', MOTO3: 'Moto3', MOTOE: 'MotoE' })[
      raw.toUpperCase()] || raw || 'Okänd klass';
  }
  const sessionKey = value => ({ RAC: 'RACE', SPR: 'SPRINT', PR: 'PRACTICE', WUP: 'WARM UP' })[
    String(value || '').trim().toUpperCase()] || String(value || '').trim().toUpperCase();
  const sessionName = value => ({ RAC: 'Race', SPR: 'Sprint', PR: 'Practice', WUP: 'Warm Up' })[
    String(value || '').toUpperCase()] || String(value || 'Timing');
  function wall(raw) {
    // Observed Pulselive timestamps contain event-local HH:MM tagged as UTC.
    // Preserve wall time here; worldwide timezone conversion belongs in backend.
    const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  const dayKey = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  const timeLabel = d => d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—';
  const dayTitle = d => d ? `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
  function until(date, now) {
    if (!date) return '';
    const minutes = Math.ceil((date - now) / 60000);
    if (minutes <= 0) return 'NU';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    if (hours < 24) return `${hours} h${mins ? ` ${mins} min` : ''}`;
    return `${Math.floor(hours / 24)} d${hours % 24 ? ` ${hours % 24} h` : ''}`;
  }
  function duration(raw, laps) {
    const value = Number(raw);
    if (!(value > 0) || !Number.isFinite(value)) return '';
    return laps ? `${Math.round(value)} varv` : `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  }
  function lapSeconds(raw) {
    const parts = String(raw || '').replace(/'/g, ':').split(':').map(Number);
    if (!parts.every(Number.isFinite)) return Infinity;
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 1 ? parts[0] : Infinity;
  }
  const active = status => ['I', 'S'].includes(String(status?.attributes?.session_status_id || '')) || valueOf(status) === 'In Progress';
  function statusLabel(status) {
    if (active(status)) return 'LIVE';
    return ({ N: 'VÄNTAR', F: 'AVSLUTAD', R: 'RÖD FLAGG', D: 'FÖRSENAD', C: 'INSTÄLLD' })[
      String(status?.attributes?.session_status_id || '')] ||
      ({ 'Not Started': 'VÄNTAR', Finished: 'AVSLUTAD', 'Red Flag': 'RÖD FLAGG',
        Delayed: 'FÖRSENAD', Cancelled: 'INSTÄLLD' })[valueOf(status)] || 'INGEN AKTIV SESSION';
  }
  function normalize(race, selection) {
    const attrs = race?.attributes || {};
    const source = Array.isArray(attrs.sessions_all) ? attrs.sessions_all :
      Array.isArray(attrs.sessions) ? attrs.sessions : [];
    return source.filter(s => s && wall(s.date)).map(s => ({ ...s,
      _date: wall(s.date), _category: categoryName(s.category || attrs.category),
      _name: sessionName(s.name || s.type)
    })).filter(s => selection === 'Total' || s._category === selection)
      .sort((a, b) => a._date - b._date);
  }
  function liveIdentity(hass, ids) {
    const session = hass?.states?.[ids.session], status = hass?.states?.[ids.status];
    const category = categoryName(session?.attributes?.category || status?.attributes?.category ||
      hass?.states?.[ids.riders]?.attributes?.category);
    const name = sessionName(valueOf(session));
    const event = String(session?.attributes?.event || status?.attributes?.event || '');
    return { category, name, key: `${event}|${category}|${sessionKey(name)}`,
      active: active(status), status: statusLabel(status),
      statusId: status?.attributes?.session_status_id || '' };
  }
  function orderedRiders(entity) {
    const raw = entity?.attributes?.riders;
    if (!Array.isArray(raw)) return [];
    return raw.slice().sort((a, b) => {
      const aa = Number(a.position), bb = Number(b.position);
      return (aa > 0 ? aa : Infinity) - (bb > 0 ? bb : Infinity);
    });
  }
  const matchSession = (s, identity) => s._category === identity.category &&
    sessionKey(s._name) === sessionKey(identity.name);
  function countryFlag(value) {
    const raw = String(value || '').toUpperCase();
    const codes = { ITA: 'IT', SPA: 'ES', ESP: 'ES', AUS: 'AU', FRA: 'FR', GBR: 'GB', JPN: 'JP',
      NED: 'NL', BEL: 'BE', CZE: 'CZ', COL: 'CO', INA: 'ID', IDN: 'ID', ARG: 'AR',
      BRA: 'BR', USA: 'US', TUR: 'TR', THA: 'TH', GER: 'DE', POR: 'PT' };
    const iso = /^[A-Z]{2}$/.test(raw) ? raw : codes[raw];
    return iso ? String.fromCodePoint(...Array.from(iso, c => 127397 + c.charCodeAt(0))) : '';
  }
  function riderColor(rider) {
    const value = String(rider.color || '').replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(value)) return `#${value}`;
    const team = `${rider.team || ''} ${rider.bike || ''}`.toLowerCase();
    return Object.entries({ gresini: '#60a5fa', vr46: '#facc15', ktm: '#f97316',
      yamaha: '#2563eb', honda: '#ef4444', aprilia: '#64748b', ducati: '#e10600' })
      .find(([key]) => team.includes(key))?.[1] || '#94a3b8';
  }

  const CSS = `
    :host{display:block;min-width:0;color:var(--primary-text-color)}
    *{box-sizing:border-box}
    .panel{border-radius:16px;background:var(--ha-card-background,var(--card-background-color,#fff));border:1px solid var(--divider-color,rgba(127,127,127,.2));overflow:hidden}
    .panel+.panel{margin-top:12px}
    .head{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:42px;padding:8px 12px;border-bottom:1px solid var(--divider-color,rgba(127,127,127,.2))}
    .head strong{font-size:14px;font-weight:850}
    .head-right{display:flex;flex-direction:column;align-items:flex-end;font-size:11px;font-weight:700;text-align:right;color:var(--secondary-text-color)}
    .day{border-top:1px solid var(--divider-color,rgba(127,127,127,.12))}
    .day:first-child{border-top:0}
    button{font:inherit;color:inherit;cursor:pointer}
    .day-button{width:100%;background:transparent;border:0;text-align:left;padding:12px;display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,1fr) 22px;gap:10px;align-items:center}
    .day-button:hover,.timing-button:hover{background:rgba(127,127,127,.045)}
    .day-label{font-size:12px;font-weight:900}
    .day-summary{font-size:11px;color:var(--secondary-text-color)}
    .chevron{text-align:center;font-size:16px;color:var(--secondary-text-color)}
    .tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:0 10px 10px}
    .tile{min-width:0;padding:8px 10px;min-height:52px;border:1px solid var(--divider-color,rgba(127,127,127,.16));border-radius:11px;background:rgba(127,127,127,.015)}
    .tile-top{display:flex;align-items:center;justify-content:space-between;gap:5px}
    .tile-time{font-weight:900;font-size:12px;font-variant-numeric:tabular-nums}
    .tile-main{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px;font-size:12px;font-weight:900}
    .cat{color:var(--secondary-text-color);font-size:11px}
    .pill{padding:1px 5px;border-radius:12px;font-size:10px;font-weight:900;white-space:nowrap;color:#ad6500;background:rgba(245,158,11,.14)}
    .live{color:#e10600}.pill.live{background:rgba(225,6,0,.12)}
    .tile.live-tile{border-color:rgba(225,6,0,.5);background:rgba(225,6,0,.055)}
    .tile.waiting{border-color:rgba(245,158,11,.6);background:rgba(245,158,11,.05)}
    .tile.done{opacity:.58}.pill.done{color:var(--secondary-text-color);background:rgba(127,127,127,.09)}
    .weather{font-size:10px;margin-top:3px;color:var(--secondary-text-color)}
    .empty{padding:18px 12px;color:var(--secondary-text-color);font-size:12px}
    .timing-button{width:100%;border:0;background:transparent;text-align:left;padding:11px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .timing-title{font-size:15px;font-weight:950}.timing-status{font-size:13px;font-weight:900}
    .timing-info{text-align:right;font-size:11px;font-weight:700;color:var(--secondary-text-color)}
    .timing-info span{display:block}.hint{margin-top:3px}
    .snapshot{padding:6px 13px;font-size:11px;color:var(--secondary-text-color);background:rgba(127,127,127,.05)}
    .timing-columns,.timing-row{display:grid;grid-template-columns:40px 4px minmax(180px,1fr) 60px 110px 95px 95px 100px;gap:8px;align-items:center}
    .timing-columns{font-size:10px;font-weight:900;color:var(--secondary-text-color);padding:10px 14px;border-bottom:1px solid var(--divider-color,rgba(127,127,127,.2))}
    .timing-row{padding:9px 14px;min-height:56px;border-bottom:1px solid rgba(127,127,127,.075)}
    .timing-row:last-child{border-bottom:0}.pos{font-weight:900;text-align:center}
    .teamline{width:4px;height:36px;border-radius:8px}.rider{min-width:0}
    .name{font-size:14px;font-weight:900;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .meta{font-size:11px;color:var(--secondary-text-color);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .num{text-align:right;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
    .last-fast{color:#e10600}.status-pill{display:inline-block;padding:2px 6px;background:rgba(127,127,127,.1);border-radius:11px;font-size:10px;font-weight:850}
    .status-pill.pit{color:#ad6500;background:rgba(245,158,11,.12)}.center{text-align:center}
    @media(max-width:1100px){
      .timing-columns,.timing-row{grid-template-columns:35px 4px minmax(120px,1fr) 55px 90px 75px;gap:6px}
      .timing-columns>:nth-child(7),.timing-row>:nth-child(7),.timing-columns>:nth-child(8),.timing-row>:nth-child(8){display:none}
    }
    @media(max-width:700px){
      .day-button{grid-template-columns:minmax(90px,1fr) minmax(0,1fr) 18px;gap:5px}.day-summary{font-size:10px}
      .timing-columns,.timing-row{grid-template-columns:27px 3px minmax(0,1fr) 76px 70px;gap:5px;padding-left:8px;padding-right:8px}
      .timing-columns>:nth-child(4),.timing-row>:nth-child(4),.timing-columns>:nth-child(7),.timing-row>:nth-child(7),.timing-columns>:nth-child(8),.timing-row>:nth-child(8){display:none}
      .name{font-size:12px}.num{font-size:11px}.meta{font-size:9px}
    }
    @media(max-width:360px){.tiles{grid-template-columns:1fr}}
    .build-version{padding:7px 12px;text-align:right;font-size:10px;color:var(--secondary-text-color)}
    .build-version button{border:0;background:transparent;color:inherit;font-size:10px;padding:3px 0}
    .build-version button:hover{text-decoration:underline}
    .build-details{margin-top:4px;line-height:1.6;overflow-wrap:anywhere}
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
      this._showBuildInfo = false;
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div id="view"></div>`;
      this.shadowRoot.addEventListener('click', e => this._click(e));
    }
    setConfig(config) {
      if (!config || !['schedule', 'timing', 'both', undefined].includes(config.mode)) {
        throw new Error('ha-motogp-card: mode ska vara schedule, timing eller both.');
      }
      this._mode = config.mode || 'both';
      this._ids = { ...DEFAULTS, ...(config.entities || {}) };
      this._refs = null;
      if (this._hass) this._render();
    }
    set hass(hass) {
      this._hass = hass;
      const refs = Object.values(this._ids).map(id => hass.states[id]);
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
    _spoilerOn() {
      const states = this._hass?.states || {};
      if (states[this._ids.spoiler]?.state === 'on') return true;
      return [this._ids.session, this._ids.status, this._ids.riders].some(id => {
        const entity = states[id];
        return entity?.attributes?.spoiler_mode === true ||
          String(entity?.state || '').toLowerCase() === 'hidden';
      });
    }
    _click(e) {
      const button = e.target.closest('button[data-day],button[data-timing],button[data-build-info]');
      if (!button) return;
      if (button.dataset.buildInfo !== undefined) {
        this._showBuildInfo = !this._showBuildInfo;
        this._render();
        return;
      }
      if (button.dataset.day !== undefined) {
        this._manualDay = this._openDay() === button.dataset.day ? '' : button.dataset.day;
      } else if (!this._spoilerOn()) {
        this._manualTiming = !this._timingOpen();
      }
      this._render(); // UI click never waits for Home Assistant helper/service.
    }
    _openDay() { return this._manualDay === null ? this._today : this._manualDay; }
    _timingOpen() { return !this._spoilerOn() &&
      (this._manualTiming === null ? Boolean(this._snapshot) : this._manualTiming); }
    _refreshState(now) {
      const today = dayKey(now);
      const identity = this._hass ? liveIdentity(this._hass, this._ids) : null;
      if (today !== this._today) {
        this._today = today;
        this._manualDay = null;
        this._manualTiming = null;
        // Keep a snapshot across midnight ONLY for an ongoing session.
        if (!identity?.active) this._snapshot = null;
      }
      if (!this._hass) return;
      if (this._spoilerOn()) {
        // Clearing cached rows is critical: a no-spoiler toggle must not leak
        // previously visible positions when source sensor attributes disappear.
        this._snapshot = null;
        this._manualTiming = false;
        this._identityKey = '';
        return;
      }
      const key = identity.key;
      const riders = orderedRiders(this._hass.states[this._ids.riders]);
      const schedule = normalize(this._hass.states[this._ids.race], 'Total');
      const matching = schedule.find(s => matchSession(s, identity) && dayKey(s._date) === today);
      if (identity.active && key !== this._identityKey) {
        this._manualTiming = null;
        this._identityKey = key;
      }
      if (riders.length && (identity.active || identity.statusId === 'F') &&
          (Boolean(matching) || identity.active && !schedule.length)) {
        if (identity.active || !this._snapshot || this._snapshot.identity.key === key) {
          this._snapshot = { identity: { ...identity }, riders, day: today, saved: now.getTime() };
        }
      }
    }
    _render() {
      if (!this._hass) return;
      const now = new Date();
      this._refreshState(now);
      const ids = this._ids, race = this._hass.states[ids.race];
      const raw = valueOf(this._hass.states[ids.category]) || 'Total';
      const categories = race?.attributes?.schedule_categories;
      const selected = raw === 'Total' || !Array.isArray(categories) || categories.includes(raw) ? raw : 'Total';
      const sessions = normalize(race, selected);
      const identity = liveIdentity(this._hass, ids);
      const content = [];
      if (this._mode !== 'timing') content.push(this._scheduleMarkup(sessions, selected, identity, now));
      if (this._mode !== 'schedule') content.push(this._timingMarkup(identity));
      this.shadowRoot.getElementById('view').innerHTML = content.join('') + this._versionFooter();
    }
    _versionFooter() {
      const v = CARD_BUILD;
      const expanded = this._showBuildInfo;
      return `<div class="build-version"><button type="button" data-build-info aria-expanded="${expanded}" ` +
        `title="Visa inladdad frontendversion">UI v${escapeHTML(v.version)} · ${escapeHTML(v.buildId)} ${expanded ? '⌃' : 'ⓘ'}</button>` +
        (expanded ? `<div class="build-details">Branch: ${escapeHTML(v.branch)} · ` +
          `Källcommit: ${escapeHTML(v.sourceCommit)} · Byggd: ${escapeHTML(v.builtAt)} · ` +
          `JS-fingeravtryck: ${escapeHTML(v.buildId)}<br>Backend-version visas separat.</div>` : '') + '</div>';
    }
    _scheduleMarkup(sessions, selected, identity, now) {
      if (!sessions.length) return `<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong>` +
        `<span class="head-right">${escapeHTML(selected)}</span></div><div class="empty">Inga pass för valt filter.</div></section>`;
      const grouped = new Map();
      for (const s of sessions) {
        const day = dayKey(s._date);
        if (!grouped.has(day)) grouped.set(day, []);
        grouped.get(day).push(s);
      }
      const live = s => identity.active && matchSession(s, identity) && dayKey(s._date) === dayKey(now);
      const waiting = s => identity.status === 'VÄNTAR' && matchSession(s, identity) && dayKey(s._date) === dayKey(now);
      const done = s => String(s.status || '').toUpperCase() === 'FINISHED' ||
        (s._date < now && !live(s) && !waiting(s));
      const next = sessions.find(s => live(s)) || sessions.find(s => waiting(s)) || sessions.find(s => !done(s));
      const head = next ? `${live(next) ? '● LIVE:' : 'Nästa:'} ${next._category} · ${next._name} · ${timeLabel(next._date)}` : 'Inga kommande pass';
      let html = `<section class="panel"><div class="head"><strong>🗓️ Helgens schema</strong>` +
        `<span class="head-right"><strong>${escapeHTML(selected)}</strong>${escapeHTML(head)}</span></div>`;
      for (const [day, items] of grouped) {
        const open = this._openDay() === day;
        const nextInDay = items.find(s => !done(s));
        const summary = nextInDay ? `nästa ${nextInDay._category} ${nextInDay._name}` : 'klar';
        let tiles = '';
        if (open) tiles = `<div class="tiles">${items.map(s => {
          const isLive = live(s), isWaiting = waiting(s), isDone = done(s);
          const cls = isLive ? 'live-tile' : isWaiting ? 'waiting' : isDone ? 'done' : '';
          const badge = isLive ? 'LIVE' : isWaiting ? 'VÄNTAR' : isDone ? '✓' : until(s._date, now);
          const bcls = isLive ? 'live' : isDone ? 'done' : '';
          const weather = [s.air && `Luft ${s.air}`, s.ground && `Bana ${s.ground}`].filter(Boolean).join(' · ');
          return `<div class="tile ${cls}"><div class="tile-top"><span class="tile-time">${timeLabel(s._date)}</span>` +
            `<span class="pill ${bcls}">${escapeHTML(badge)}</span></div><div class="tile-main">` +
            `<span class="cat">${escapeHTML(s._category)}</span>${escapeHTML(s._name)}</div>` +
            `${weather ? `<div class="weather">${escapeHTML(weather)}</div>` : ''}</div>`;
        }).join('')}</div>`;
        html += `<div class="day"><button type="button" class="day-button" data-day="${escapeHTML(day)}" ` +
          `aria-expanded="${open}"><span class="day-label">${escapeHTML(dayTitle(items[0]._date))}</span>` +
          `<span class="day-summary">${items.length} pass · ${escapeHTML(summary)}</span>` +
          `<span class="chevron">${open ? '⌃' : '⌄'}</span></button>${tiles}</div>`;
      }
      return html + '</section>';
    }
    _timingMarkup(identity) {
      if (this._spoilerOn()) return `<section class="panel" aria-label="MotoGP live timing">` +
        `<div class="head"><strong>Spoilerläge aktivt</strong><span class="head-right">Live timing dold</span></div></section>`;
      const states = this._hass.states, ids = this._ids, snapshot = this._snapshot;
      const open = this._timingOpen();
      const same = snapshot && snapshot.identity.key === identity.key &&
        (identity.active || identity.statusId === 'F');
      const riders = snapshot?.riders || (identity.active ? orderedRiders(states[ids.riders]) : []);
      const lapEntity = states[ids.laps];
      const total = Number(lapEntity?.attributes?.num_laps || 0);
      const race = ['Race', 'Sprint'].includes(identity.name) && total > 0;
      const remaining = duration(valueOf(states[ids.remaining]), race);
      const lap = Number(valueOf(lapEntity) || 0);
      const info = identity.active ? [lap > 0 ? `Varv ${lap}${total ? ` / ${total}` : ''}` : '',
        remaining && `${remaining} kvar`].filter(Boolean).join(' · ') : `${remaining}${remaining ? ' session' : ''}`;
      let html = `<section class="panel" aria-label="MotoGP live timing"><button type="button" class="timing-button" data-timing ` +
        `aria-expanded="${open}"><span><span class="timing-title">${escapeHTML(identity.category)} · ${escapeHTML(identity.name)}</span>` +
        `<span class="timing-status ${identity.active ? 'live' : ''}" style="display:block">${escapeHTML(identity.status)}</span></span>` +
        `<span class="timing-info"><span>${escapeHTML(info)}</span><span class="hint">${open ? '⌃ Dölj förare' : '⌄ Visa förare'}</span></span></button>`;
      if (!open) return html + '</section>';
      if (snapshot && !same) html += `<div class="snapshot">Senaste timing: ` +
        `${escapeHTML(snapshot.identity.category)} · ${escapeHTML(snapshot.identity.name)} (föregående pass)</div>`;
      if (!riders.length) return html + '<div class="empty">Ingen timingdata tillgänglig än.</div></section>';
      const names = {};
      for (const r of riders) {
        const name = String(r.surname || '').toUpperCase();
        names[name] = (names[name] || 0) + 1;
      }
      const laps = riders.map(r => lapSeconds(r.last_lap_time)).filter(s => s > 0 && Number.isFinite(s));
      const fastest = laps.length ? Math.min(...laps) : Infinity;
      html += `<div class="timing-columns"><span>POS</span><span></span><span>FÖRARE / TEAM</span>` +
        `<span>VARV</span><span>SENASTE</span><span>Δ FRAMFÖR</span><span>Δ LEDARE</span><span>STATUS</span></div>`;
      for (const r of riders) {
        const p = Number(r.position), valid = p > 0;
        let name = String(r.surname || r.shortname || r.firstname || '?');
        if (names[String(r.surname || '').toUpperCase()] > 1 && r.firstname) {
          name = `${String(r.firstname).charAt(0).toUpperCase()}. ${name}`;
        }
        const last = String(r.last_lap_time || ''), fast = last && lapSeconds(last) === fastest;
        const status = [String(r.status_name || '') !== 'CL' ? r.status_name : '', r.on_pit ? 'PIT' : '']
          .filter(Boolean).join(' · ');
        const bike = String(r.bike || ''), team = String(r.team || '');
        const details = [`#${r.number || '—'}`, bike && !team.toLowerCase().includes(bike.toLowerCase()) && bike,
          team].filter(Boolean).join(' · ');
        html += `<div class="timing-row"><span class="pos">${valid ? p : '—'}</span>` +
          `<span class="teamline" style="background:${riderColor(r)}"></span>` +
          `<span class="rider"><span class="name" style="display:block">${countryFlag(r.nation)} ${escapeHTML(name)}</span>` +
          `<span class="meta" style="display:block">${escapeHTML(details)}</span></span>` +
          `<span class="num">${r.num_lap > 0 ? `L${Number(r.num_lap)}` : '—'}</span>` +
          `<span class="num ${fast ? 'last-fast' : ''}">${fast ? '⚡ ' : ''}${escapeHTML(last || '—')}</span>` +
          `<span class="num">${escapeHTML(valid && p > 1 ? r.gap_prev || '—' : '—')}</span>` +
          `<span class="num">${escapeHTML(valid ? p === 1 ? 'LEADER' : r.gap_first || '—' : '—')}</span>` +
          `<span class="center">${status ? `<span class="status-pill ${r.on_pit ? 'pit' : ''}">${escapeHTML(status)}</span>` : '—'}</span></div>`;
      }
      return html + '</section>';
    }
    getCardSize() { return this._mode === 'timing' ? 5 : 4; }
    getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 4 }; }
  }
  HaMotogpCard.buildInfo = CARD_BUILD;
  customElements.define(TAG, HaMotogpCard);
  window.haMotogpBuild = CARD_BUILD;
  console.info('[ha-motogp-card] Loaded frontend', CARD_BUILD);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: TAG, name: 'MotoGP Card (dev)', description: 'Schema och timing med lokala expanders.' });
})();
