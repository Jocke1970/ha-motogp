#!/usr/bin/env python3
"""Fail-closed build of the one MotoGP Next Lovelace resource from pinned sources."""
import hashlib
import pathlib
import sys

EXPECTED = {
    'ha-motogp-next-card.js': 'b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286',
    'ha-motogp-next-split.js': '797594a2440a0818c2551ac2d3f0d502f163111b',
    'ha-motogp-next-split-enhancements.js': '346df5046cc9301e426650cb36cb32449883414c',
    'ha-motogp-next-gap-trends.js': '7da9eb365964138c598691033248f8a5b7554b2c',
}
BUILD = 'next-one-20260920-03'
DISPLAY_VERSION = '0.3.0-dev.3'


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
    base = swap(base,
        'const next=sessions.find(isLive)||sessions.find(s=>!past(s));',
        'const next=sessions.find(isLive)||sessions.find(s=>s._wall.date>now&&!explicitFinish(s));',
        'overview next session must actually be in the future')
    base = swap(base,
        'const open=this._expanded(day),upcoming=items.find(s=>!past(s));',
        'const open=this._expanded(day),upcoming=items.find(isLive)||items.find(s=>s._wall.date>now&&!explicitFinish(s));',
        'day next session must actually be in the future')
    base = swap(base, '🏁 MOTOGP · ${esc(VERSION)}',
                f'🏁 MOTOGP NEXT · {DISPLAY_VERSION}', 'unified version header')
    base = swap(base, '${esc(TAG)} · ${esc(BUILD)} · testresurs',
                f'ha-motogp-next.js · {DISPLAY_VERSION} · samlad testversion',
                'unified footer')

    split = source['ha-motogp-next-split.js']
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
        'const spoiler=this._spoiler();',
        "const spoiler=this._spoiler();\n"
        "        // A passed start time does not establish a live or finished status.\n"
        "        // Never inspect unapproved rider data to infer session state.\n"
        "        const schedule=race?.attributes||{};\n"
        "        const entries=Array.isArray(schedule.sessions_all)?schedule.sessions_all:\n"
        "          Array.isArray(schedule.sessions)?schedule.sessions:[];\n"
        "        const pending=entries.map(s=>({pass:s,date:parseStart(s?.date)}))\n"
        "          .filter(x=>x.date && x.date<=now && x.date.toDateString()===now.toDateString() &&\n"
        "            now-x.date<2*60*60*1000 &&\n"
        "            !['FINISHED','CANCELLED','CANCELED'].includes(String(x.pass.status||'').toUpperCase()) &&\n"
        "            !((status?.state==='Finished'||String(status?.attributes?.session_status_id||'').toUpperCase()==='F') &&\n"
        "              category(status?.attributes?.category)===category(x.pass.category||'MotoGP') &&\n"
        "              sessionName(status?.attributes?.session_shortname)===sessionName(x.pass.name||x.pass.type||'')))\n"
        "          .sort((a,b)=>b.date-a.date)[0]||null;\n"
        "        const started=pending && now-pending.date<15*60*1000?pending:null;",
        'separate unverified started pass from future next pass')
    split = swap(split,
        "        } else if (upcoming) {\n          title=`Nästa: ${upcoming.category} · ${upcoming.name}`;\n          statusText=spoiler?'SPOILERLÄGE':hasRiders?'SENASTE PASS AVSLUTAT':'MELLAN PASSEN';",
        "        } else if (started && !spoiler) {\n"
        "          title=`Schemalagd: ${category(started.pass.category||'MotoGP')} · ${sessionName(started.pass.name||started.pass.type||'')}`;\n"
        "          statusText='STARTTID PASSERAD · INVÄNTAR MATCHANDE DATA';\n"
        "          clockHtml=`<span class=\"nt-clock\"><span>${esc(pad(started.date.getHours())+':'+pad(started.date.getMinutes()))}</span>`+\n"
        "            `${upcoming?`<small>Nästa: ${esc(upcoming.category)} ${esc(upcoming.name)} ${esc(upcoming.time)}</small>`:''}</span>`;\n"
        "        } else if (upcoming) {\n"
        "          title=`Nästa: ${upcoming.category} · ${upcoming.name}`;\n"
        "          statusText=spoiler?'SPOILERLÄGE':hasRiders?'SENASTE PASS · EJ LIVE':pending?\n"
        "            `STATUS OKÄND: ${category(pending.pass.category||'MotoGP')} ${sessionName(pending.pass.name||pending.pass.type||'')}`:'MELLAN PASSEN';",
        'show genuine next start and accurately label unknown previous status')
    split = swap(split,
        '.nt-row>span:not(.nt-person){text-align:right}',
        '.nt-heading>span:nth-child(2){text-align:center}.nt-row>span:not(.nt-person){text-align:right}',
        'center driver/team heading')
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
        'verified provisional Q1 cutoff')
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
        'Q1 cutoff line')
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
        'one-second local clock')
    split = swap(split,
        "${major?`<span>${esc(major)}</span>`:''}",
        "${major?`<span${!isRace&&remaining?' data-live-remaining':''}>${esc(major)}</span>`:''}",
        'live countdown span only, never race lap counter')
    bundle = (f'/* MotoGP Next SINGLE Lovelace resource | build {BUILD} | read only. */\n' +
              '\n;\n'.join([base, split, source['ha-motogp-next-split-enhancements.js'],
                            source['ha-motogp-next-gap-trends.js']]) + '\n')
    destination.write_text(bundle, encoding='utf-8')
    print(f'Built single resource: {destination} ({len(bundle.encode("utf-8"))} bytes; git blob {git_sha(bundle.encode("utf-8"))})')

if __name__ == '__main__':
    if len(sys.argv)!=3:
        raise SystemExit('Usage: build-next-one.py FRONTEND_SOURCE_DIRECTORY OUTPUT_JS')
    build(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
