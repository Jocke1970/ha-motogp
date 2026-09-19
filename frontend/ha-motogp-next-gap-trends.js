/* Isolated MotoGP Next split.2 timing patch: verified fastest lap + gap-to-ahead trends.
 * Load AFTER ha-motogp-next-split-enhancements.js. Read-only; no HA service calls. */
(() => {
  'use strict';
  const TAG='ha-motogp-next-timing-card', REQUIRED='0.2.0-split.2';
  const BUILD='gap-trends-20260919-01';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function gap(raw) {
    const s=String(raw??'').trim().replace(',','.');
    if (!/^(?:\+)?\d+(?:\.\d+)?$/.test(s)) return null;
    const n=Number(s);
    return Number.isFinite(n) && n>0 ? n : null;
  }
  function lap(raw) {
    const s=String(raw??'').trim().replace("'",':').replace('"','');
    if (!/^(?:\d+:)?\d{1,3}\.\d{3}$/.test(s)) return null;
    const p=s.split(':');
    if (p.length===2 && Number(p[1])>=60) return null;
    const n=p.length===2 ? Number(p[0])*60+Number(p[1]) : Number(p[0]);
    return n>0&&Number.isFinite(n)?n:null;
  }
  const riderKey=r=>String(r.rider_id||r.number||r.surname||r.shortname||'');
  const styleText=`
    .nt-gap-trend{display:inline-flex;align-items:center;justify-content:flex-end;gap:5px;white-space:nowrap;font-weight:850}
    .nt-gap-trend.up{color:#dc2626!important}.nt-gap-trend.down{color:#16a34a!important}
    .nt-gap-arrow{font-size:11px;line-height:1}
    .nt-fast-lap{color:#e10600!important;font-weight:950!important}
  `;
  function install() {
    const Timing=customElements.get(TAG);
    if (Timing?.buildInfo?.version!==REQUIRED) {
      console.error(`[MotoGP gap trends] Requires ${REQUIRED}; no patch applied.`);return;
    }
    if (Timing.prototype._motogpGapTrends) return;
    const original=Timing.prototype._timing;
    Timing.prototype._timing=function() {
      const html=original.call(this);
      if (this._spoiler() || !this._hass || !this._snapshot?.riders?.length ||
          this._snapshot.day!==this._today) return html;
      const live=this._live, snap=this._snapshot;
      const attrs=this._hass.states[this._ids.riders]?.attributes||{};
      const event=String(this._event||attrs.event||'');
      const session=String(live?.key||`${snap.category}|${snap.name}`);
      const sessionKey=[event,snap.day,snap.category,snap.name,session].join('|');
      // Never ingest a raw, unapproved feed. _live only exists after base-card
      // category/session/event checks and its TV-delay-ready gate pass.
      if (live && this._gapTrendSession!==sessionKey) {
        this._gapTrendSession=sessionKey;this._gapTrendValues=new Map();
      }
      const values=this._gapTrendValues||new Map();
      const permitted=Boolean(live && this._gapTrendSession===sessionKey);
      let index=0;
      const parts=("\u0000"+html).split(/(?=<div class="nt-row(?: unclassified)?">)/);
      const out=parts.map((part,i)=>{
        if (i===0 || !part.startsWith('<div class="nt-row')) return part;
        const r=snap.riders[index++];if (!r) return part;
        const p=Number(r.position), key=riderKey(r);
        const prev=p>1?gap(r.gap_prev):null;
        const displayPrev=p===1?'—':String(r.gap_prev??'—');
        const safePrev=(!displayPrev.trim()||displayPrev==='0.000')?'—':displayPrev;
        const first=p===1?'LEDARE':String(r.gap_first??'—');
        const safeFirst=(!first.trim()||first==='0.000')?'—':first;
        // Target the adjacent, explicit prev/leader columns. Never parse nested divs.
        const needle=`<span>${esc(safePrev)}</span><span>${esc(safeFirst)}</span>`;
        if (prev!==null && key && part.includes(needle)) {
          const old=values.get(key);
          let trend=old?.position===p ? old.trend : '';
          if (permitted) {
            if (old?.position!==p) trend='';
            else if (Math.abs(prev-old.value)>=0.0005) trend=prev>old.value?'up':'down';
            values.set(key,{value:prev,position:p,trend});
          } else if (old?.position!==p) trend='';
          const arrow=trend==='up'?'▼':trend==='down'?'▲':'';
          const cls=trend?` ${trend}`:'';
          const decorated=`<span><span class="nt-gap-trend${cls}">`+
            `${arrow?`<span class="nt-gap-arrow">${arrow}</span>`:''}`+
            `<span>${esc(safePrev)}</span></span></span><span>${esc(safeFirst)}</span>`;
          part=part.replace(needle,decorated);
        }
        // Fix split-enhancements.1 shallow nested-div regex: target adjacent
        // latest-lap and prev-gap columns, not a guessed HTML subtree.
        const last=lap(r.last_lap_time),best=lap(r.best_lap_time);
        const record=last!==null&&best!==null&&r.is_session_fastest===true&&
          Math.abs(last-best)<0.0001&&
          !(Number(r.best_lap_number)>0&&Number(r.last_lap)>0&&
            Number(r.best_lap_number)!==Number(r.last_lap))&&
          (!live||(lap(attrs.session_fastest_lap)!==null&&
            Math.abs(last-lap(attrs.session_fastest_lap))<0.0001));
        if (record) {
          const lastText=esc(String(r.last_lap_time));
          const target=`<span>${lastText}</span>`;
          if (part.includes(target)) part=part.replace(target,
            `<span class="nt-fast-lap" title="Snabbaste verifierade senaste varv">⚡ ${lastText}</span>`);
        }
        return part;
      }).join('');
      if (!this.shadowRoot?.querySelector('[data-motogp-gap-trends]')) {
        const style=document.createElement('style');
        style.setAttribute('data-motogp-gap-trends','');style.textContent=styleText;
        this.shadowRoot?.appendChild(style);
      }
      return out.slice(1);
    };
    Timing.prototype._motogpGapTrends=BUILD;
    console.info(`[MotoGP gap trends] ${BUILD} installed only on isolated split timing card`);
  }
  customElements.whenDefined(TAG).then(install);
})();
