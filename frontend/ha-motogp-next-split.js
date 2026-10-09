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
    if (seconds < 0) return 'Starttid passerad';
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
    .nt-row>span:not(.nt-person){text-align:right}.nt-row>span:first-child{text-align:center}
    .nt-person{display:flex;min-width:0;align-items:center;gap:10px}.nt-color{height:31px;width:4px;flex:none;border-radius:3px}
    .nt-person-text{min-width:0}.nt-person-text b{display:block;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nt-person-text small{display:block;color:var(--secondary-text-color);font-size:11px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nt-pit{font-size:9px;color:#c27600;background:rgba(245,158,11,.12);border-radius:4px;padding:2px 4px}
    .nt-row.unclassified{opacity:.6}.nt-results{font-size:11px;font-weight:800;color:var(--secondary-text-color);padding:9px 14px}
    .nt-empty{padding:15px;color:var(--secondary-text-color);font-size:12px}
    @media(max-width:680px){.nt-head{gap:8px;flex-wrap:wrap}.nt-label{font-size:14px}.nt-clock{font-size:12px}}
  `;
  function register() {
    const Base = customElements.get(BASE_TAG);
    if (!Base || Base.buildInfo?.version !== BASE_VERSION) {
      console.error(`[MotoGP Next Split] Requires ${BASE_TAG} ${BASE_VERSION}; no cards registered.`);
      return;
    }
    class CountdownCard extends Base {
      constructor() {super();this._countTimer=null;}
      connectedCallback() {
        super.connectedCallback();
        if (!this._countTimer) this._countTimer=setInterval(()=>refreshCountdowns(this.shadowRoot),1000);
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
        const live=this._live, snap=this._snapshot, status=states[this._ids.status];
        const spoiler=this._spoiler();
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
          clockHtml=`<span class="nt-clock">${major?`<span>${esc(major)}</span>`:''}`+
            `${delay?`<small>TV-delay ${delay} s</small>`:''}</span>`;
        } else if (upcoming) {
          title=`Nästa: ${upcoming.category} · ${upcoming.name}`;
          statusText=spoiler?'SPOILERLÄGE':hasRiders?'SENASTE PASS AVSLUTAT':'MELLAN PASSEN';
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
        for (const rider of snap.riders) {
          const p=positive(rider.position),who=rider.surname||rider.shortname||rider.firstname||'Okänd';
          const pit=Boolean(rider.on_pit);
          const riderStatus=pit?'PIT':valid(rider.status_name)?rider.status_name:valid(rider.status_id)?rider.status_id:'—';
          const prev=p===1?'—':lapText(rider.gap_prev);
          const first=p===1?'LEDARE':lapText(rider.gap_first);
          html+=`<div class="nt-row${p?'':' unclassified'}"><span>${esc(p??'—')}</span>`+
            `<span class="nt-person"><span class="nt-color" style="background:${safeColor(rider.color)}"></span>`+
            `<span class="nt-person-text"><b>${esc(who)} · #${esc(rider.number??'—')}`+
            `${pit?' <span class="nt-pit">PIT</span>':''}</b><small>${esc(rider.team||rider.bike||'')}</small></span></span>`+
            `<span>${esc(numberText(rider.num_lap))}</span><span>${esc(lapText(rider.last_lap_time))}</span>`+
            `<span>${esc(prev)}</span><span>${esc(first)}</span><span>${esc(riderStatus)}</span></div>`;
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
