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
