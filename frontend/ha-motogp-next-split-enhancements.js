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
