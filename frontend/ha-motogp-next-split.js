/* MotoGP Next split layout: two separate HA cards, relying on pinned dev.4 data logic.
 * New tags, no changes to the original dashboard, mobile card, or backend. */
(() => {
  'use strict';
  const BASE_TAG = 'ha-motogp-next-card';
  const OVERVIEW_TAG = 'ha-motogp-next-overview-card';
  const TIMING_TAG = 'ha-motogp-next-timing-card';
  const BASE_VERSION = '0.2.0-dev.4';
  const VERSION = '0.2.0-split.1';
  const BUILD = 'split-20260919-01';

  function register() {
    const Base = customElements.get(BASE_TAG);
    if (!Base || Base.buildInfo?.version !== BASE_VERSION) {
      console.error(`[MotoGP Next Split] Requires ${BASE_TAG} ${BASE_VERSION}; no cards registered.`);
      return;
    }

    // Reuse *exactly* the tested schedule, weather, entity matching and spoiler logic.
    // Suppress only the embedded timing panel, leaving the original dev.4 card unchanged.
    class OverviewCard extends Base {
      setConfig(config) {
        if (config?.type !== `custom:${OVERVIEW_TAG}`) throw new Error('Incorrect MotoGP overview card type');
        super.setConfig({...config, type:`custom:${BASE_TAG}`});
      }
      _timing() { return ''; }
      getGridOptions() { return {columns:12, rows:'auto', min_columns:6}; }
    }

    // A standalone full-width card, with its OWN snapshot and manual expander state.
    // All live-event/session checks, delayed data and HTML escaping remain inherited.
    class TimingCard extends Base {
      constructor() {
        super();
        this.shadowRoot.innerHTML = this.shadowRoot.innerHTML.replace('</style>', `
          .rider {grid-template-columns:40px 5px minmax(230px,2fr) 60px 90px 90px 90px 85px;
            min-width:900px;gap:12px;padding:10px 14px;font-size:12px;}
          .rider.labels {font-size:11px;}
          .rider .person b {font-size:12px;}
          .rider .person small {font-size:11px;}
          .timingbtn {padding:14px 16px;}
          @media(max-width:950px){.rider {min-width:900px;}}
          </style>`);
      }
      setConfig(config) {
        if (config?.type !== `custom:${TIMING_TAG}`) throw new Error('Incorrect MotoGP timing card type');
        super.setConfig({...config, type:`custom:${BASE_TAG}`});
      }
      _render() {
        if (!this._hass) return;
        const race = this._hass.states[this._ids.race];
        this._track(new Date(), race);
        this.shadowRoot.getElementById('app').innerHTML =
          `<div class="root">${this._timing()}</div>`;
      }
      getCardSize() { return 10; }
      getGridOptions() { return {columns:12, rows:'auto', min_columns:12}; }
    }

    OverviewCard.buildInfo = Object.freeze({version:VERSION, buildId:BUILD, tag:OVERVIEW_TAG});
    TimingCard.buildInfo = Object.freeze({version:VERSION, buildId:BUILD, tag:TIMING_TAG});
    if (!customElements.get(OVERVIEW_TAG)) customElements.define(OVERVIEW_TAG, OverviewCard);
    if (!customElements.get(TIMING_TAG)) customElements.define(TIMING_TAG, TimingCard);
    window.customCards = window.customCards || [];
    for (const [tag, name] of [[OVERVIEW_TAG,'MotoGP Next – schema och väder'],[TIMING_TAG,'MotoGP Next – live timing, fullbredd']]) {
      if (!window.customCards.some(card => card.type === tag)) {
        window.customCards.push({type:tag, name, description:`Isolerad MotoGP Next split · ${VERSION}`});
      }
    }
    console.info(`[MotoGP Next Split] ${VERSION} / ${BUILD}; dev.4 remains untouched`);
  }

  if (customElements.get(BASE_TAG)) register();
  else customElements.whenDefined(BASE_TAG).then(register);
})();
