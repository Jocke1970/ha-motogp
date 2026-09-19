#!/usr/bin/env python3
"""Fail-closed build of ONE MotoGP Next JS resource from pinned dev.4/split.2 sources."""
import hashlib
import pathlib
import sys

EXPECTED = {
    'ha-motogp-next-card.js': 'b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286',
    'ha-motogp-next-split.js': '797594a2440a0818c2551ac2d3f0d502f163111b',
    'ha-motogp-next-split-enhancements.js': '346df5046cc9301e426650cb36cb32449883414c',
    'ha-motogp-next-gap-trends.js': 'c9eba3a6de76237945ac7e37a7db9356e319560e',
}

def git_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def swap(source, old, new, label):
    matches = source.count(old)
    if matches != 1:
        raise SystemExit(f'STOP: {label}: expected exactly one anchor, found {matches}')
    return source.replace(old, new, 1)

def build(directory, destination):
    source = {}
    for name, expected in EXPECTED.items():
        path = directory / name
        if not path.is_file() or path.is_symlink():
            raise SystemExit(f'STOP: missing/unsafe source {path}')
        data = path.read_bytes()
        if git_sha(data) != expected:
            raise SystemExit(f'STOP: unexpected source revision {name}')
        source[name] = data.decode('utf-8')

    base = source['ha-motogp-next-card.js']
    base = swap(base,
        "const past=s=>!isLive(s)&&(explicitFinish(s)||s._wall.date<now);",
        "const past=s=>!isLive(s)&&(explicitFinish(s)|| (s._wall.date<now && "
        "(now-s._wall.date>=2*60*60*1000 || all.some(later=>later._wall.date>s._wall.date && later._wall.date<=now))));",
        'schedule must not mark a just-started session finished')
    base = swap(base, "elapsed?'PASSERAT':'KOMMANDE'",
        "elapsed?'TID PASSERAD':s._wall.date<now?'INVÄNTAR STATUS':'KOMMANDE'",
        'schedule status is not session finish')

    split = source['ha-motogp-next-split.js']
    split = swap(split,
        "item.date.getTime() > now.getTime() &&",
        "(item.date.getTime() > now.getTime() || "
        "(item.date.getTime()+2*60*60*1000 > now.getTime() && "
        "!source.some(other => {const later=parseStart(other?.date); "
        "return later && later>item.date && later<=now;}))) &&",
        'retain latest started unconfirmed session, not previous Q1')
    split = swap(split, "if (seconds < 0) return 'Starttid passerad';",
        "if (seconds < 0) return 'Starttid passerad · inväntar status';",
        'started but no confirmed status')
    split = swap(split,
        'const live=this._live, snap=this._snapshot, status=states[this._ids.status];',
        'const live=this._live, status=states[this._ids.status]; let snap=this._snapshot;',
        'snapshot must be mutable for imminent clearing')
    split = swap(split,
        'const hasRiders=!spoiler && snap?.riders?.length && snap.day===this._today;',
        "const imminent=!live && upcoming && upcoming.date>now && "
        "upcoming.date.getTime()-now.getTime()<=15*60*1000;\n"
        "        if (imminent && snap) {this._snapshot=null;this._activeKey='';snap=null;}\n"
        "        const hasRiders=!spoiler && snap?.riders?.length && snap.day===this._today;",
        'clear old riders 15 min before a new session')
    split = swap(split,
        '.nt-row>span:not(.nt-person){text-align:right}',
        '.nt-heading>span:nth-child(2){text-align:center}.nt-row>span:not(.nt-person){text-align:right}',
        'center driver/team heading only')
    split = swap(split,
        '    .nt-empty{padding:15px;color:var(--secondary-text-color);font-size:12px}',
        '    .nt-empty{padding:15px;color:var(--secondary-text-color);font-size:12px}\n'
        '    .nt-q2{display:inline-block;margin-left:7px;color:#15803d;font-size:10px;font-weight:900;white-space:nowrap}\n'
        '    .nt-q2-cut{padding:7px 14px;border-top:2px dashed #15803d;color:#15803d;'
        'font-size:11px;font-weight:900;letter-spacing:.02em}',
        'Q1 cutoff styles')
    split = swap(split,
        "        for (const rider of snap.riders) {",
        "        const qCut=/^Q1$/i.test(String(snap.name||'')) ? "
        "(snap.category==='MotoGP'?2:['Moto2','Moto3'].includes(snap.category)?4:0):0;\n"
        "        const qPositions=qCut?snap.riders.filter(r=>Number.isInteger(Number(r.position)) && "
        "Number(r.position)>0 && positive(r.num_lap)!==null && lapText(r.last_lap_time)!=='—')"
        ".map(r=>Number(r.position)):[];\n"
        "        const qReady=qCut>0 && qPositions.length>=qCut && "
        "Array.from({length:qCut},(_,i)=>i+1).every(p=>qPositions.filter(x=>x===p).length===1);\n"
        "        for (const rider of snap.riders) {",
        'derive verified provisional Q1 cutoffs')
    split = swap(split,
        "${pit?' <span class=\"nt-pit\">PIT</span>':''}</b><small>",
        "${pit?' <span class=\"nt-pit\">PIT</span>':''}"
        "${qReady&&p&&p<=qCut?' <span class=\"nt-q2\" "
        "title=\"Preliminärt vidare till Q2\">Q2 ↑</span>':''}</b><small>",
        'Q1 rider marker')
    split = swap(split,
        '<span>${esc(prev)}</span><span>${esc(first)}</span><span>${esc(riderStatus)}</span></div>`;',
        '<span>${esc(prev)}</span><span>${esc(first)}</span><span>${esc(riderStatus)}</span></div>`;\n'
        "          if (qReady && p===qCut) html+='<div class=\"nt-q2-cut\" "
        "role=\"note\">Q2-GRÄNS · preliminärt</div>';",
        'visible provisional Q1 boundary')
    split = swap(split,
        '    class CountdownCard extends Base {',
        "    function refreshLiveClock(card) {\n"
        "      if (!card._live || card._spoiler() || !card.shadowRoot?.querySelector) "
        "{card._clockSample=null;return;}\n"
        "      const node=card.shadowRoot.querySelector('[data-live-remaining]');\n"
        "      const state=card._hass?.states?.[card._ids.remaining];\n"
        "      const delay=card._hass?.states?.[card._ids.riders]?.attributes;\n"
        "      if (!node || !state || delay?.tv_delay_ready===false) "
        "{card._clockSample=null;return;}\n"
        "      const seconds=positive(state.state);\n"
        "      if (seconds===null) {card._clockSample=null;node.textContent='—';return;}\n"
        "      const identity=[card._live.key,state.state,state.last_updated||state.last_changed||''].join('|');\n"
        "      if (card._clockSample?.identity!==identity) "
        "card._clockSample={identity,seconds,at:Date.now()};\n"
        "      const elapsed=Date.now()-card._clockSample.at;\n"
        "      if (elapsed>90000) {node.textContent='— · inväntar data';return;}\n"
        "      const left=Math.max(0,Math.ceil(card._clockSample.seconds-elapsed/1000));\n"
        "      node.textContent=`${Math.floor(left/60)}:${pad(left%60)} kvar`;\n"
        "    }\n"
        "    class CountdownCard extends Base {",
        'local verified live clock')
    split = swap(split,
        'setInterval(()=>refreshCountdowns(this.shadowRoot),1000)',
        'setInterval(()=>{refreshCountdowns(this.shadowRoot);refreshLiveClock(this);},1000)',
        'one-second local clock without API polling')
    split = swap(split,
        "${major?`<span>${esc(major)}</span>`:''}",
        "${major?`<span${!isRace&&remaining?' data-live-remaining':''}>${esc(major)}</span>`:''}",
        'target live header seconds only, never race lap counter')
    bundle = ('/* MotoGP Next SINGLE Lovelace resource | build next-one-20260919-01 | read only. */\n' +
              '\n;\n'.join([base, split, source['ha-motogp-next-split-enhancements.js'],
                            source['ha-motogp-next-gap-trends.js']]) + '\n')
    destination.write_text(bundle, encoding='utf-8')
    print(f'Built single resource: {destination} ({len(bundle.encode("utf-8"))} bytes; git blob {git_sha(bundle.encode("utf-8"))})')

if __name__ == '__main__':
    if len(sys.argv)!=3:
        raise SystemExit('Usage: build-next-one.py FRONTEND_SOURCE_DIRECTORY OUTPUT_JS')
    build(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
