#!/usr/bin/env python3
"""Read-only MotoGP Lovelace layout audit. Prints structure, never YAML/JSON content."""
from __future__ import annotations
import json
import os
from pathlib import Path

ROOT = Path(os.environ.get('MOTOGP_HA_CONFIG', '/config'))
NEEDLES = ('motogp', 'helgens schema', 'sessions_all', 'today', 'track')
MAX_CARDS = 80

def flags(value):
    text = json.dumps(value, ensure_ascii=False, default=str).lower()
    return {
        'schedule': 'helgens schema' in text or 'motogp_schedule_day_override' in text,
        'sessions_all': 'sessions_all' in text,
        'weekend_gate': 'motogp_weekend_view' in text,
        'calendar_gate': 'motogp_calendar_view' in text,
        'today_track': 'today' in text and 'track' in text,
        'motogp': 'motogp' in text or 'helgens schema' in text,
    }

def show_cards(node, label, results):
    if len(results) >= MAX_CARDS:
        return
    if isinstance(node, dict):
        if isinstance(node.get('type'), str) and any(x in node for x in ('entity', 'entities', 'card', 'cards', 'custom_fields', 'visibility', 'conditions', 'title', 'content')):
            match = flags(node)
            if match['motogp'] or match['schedule'] or match['today_track']:
                conditions = node.get('visibility', node.get('conditions', []))
                vis = 'weekend' if 'motogp_weekend_view' in str(conditions) else ('calendar' if 'motogp_calendar_view' in str(conditions) else ('other' if conditions else 'none'))
                results.append((label, node['type'], match, vis))
        for key, val in node.items():
            if isinstance(val, (dict, list)):
                show_cards(val, f'{label}.{key}', results)
                if len(results) >= MAX_CARDS: return
    elif isinstance(node, list):
        for i, val in enumerate(node):
            show_cards(val, f'{label}[{i}]', results)
            if len(results) >= MAX_CARDS: return

def main():
    print('=== MOTOGP LOVELACE LAYOUT – ENBART LÄSNING ===')
    print('Config:', ROOT)
    print('Utdata: filnamn, korttyper, placering och indikatorer; inga kortmallar eller hemligheter.')
    store = ROOT / '.storage'
    storage_count = 0
    all_results = []
    if store.is_dir():
        for path in sorted(store.glob('lovelace*')):
            if path.is_symlink() or not path.is_file(): continue
            storage_count += 1
            try:
                obj = json.loads(path.read_text(encoding='utf-8'))
            except (OSError, UnicodeError, ValueError) as exc:
                print('STORAGE SKIPPED:', path.name, type(exc).__name__)
                continue
            data = obj.get('data', {}) if isinstance(obj, dict) else {}
            config = data.get('config', data) if isinstance(data, dict) else {}
            if isinstance(config, dict) and isinstance(config.get('views'), list):
                print('\nDASHBOARD:', path.name, 'views:', len(config['views']))
                for i, view in enumerate(config['views']):
                    if not isinstance(view, dict): continue
                    title = str(view.get('title') or view.get('path') or 'unnamed')[:90]
                    results = []
                    show_cards(view, f'view[{i}]', results)
                    if results:
                        print(' VIEW:', title, 'MotoGP-related cards:', len(results))
                        for loc, kind, fl, vis in results:
                            if len(all_results) >= MAX_CARDS: break
                            print('  CARD:', loc, 'type=', kind, 'schedule=', fl['schedule'], 'sessions_all=', fl['sessions_all'], 'visibility=', vis, 'today_track=', fl['today_track'])
                            all_results.append((path.name, loc, fl))
            elif 'dashboards' in str(data)[:1500].lower():
                print('DASHBOARD REGISTRY:', path.name, '(configuration stored in other lovelace files or YAML)')
    print('\nSTORAGE:', storage_count, 'lovelace files examined;', len(all_results), 'matching card nodes (limit', MAX_CARDS, ')')

    skip_dirs = {'.storage', '.ha-git', '.git', '.motogp_cleanup_quarantine', 'custom_components', 'www', 'deps', 'backup', 'backups', 'node_modules', '__pycache__'}
    found, files = [], 0
    for dirpath, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.git')]
        for name in names:
            if not name.endswith(('.yaml', '.yml')) or name.lower() == 'secrets.yaml': continue
            path = Path(dirpath) / name
            if path.is_symlink() or not path.is_file(): continue
            try:
                if path.stat().st_size > 2_000_000: continue
                text = path.read_text('utf-8').lower()
            except (OSError, UnicodeError): continue
            files += 1
            if 'motogp' not in text and 'helgens schema' not in text: continue
            found.append((path.relative_to(ROOT), text))
    print('\nYAML FILES:', files, 'examined;', len(found), 'with MotoGP markers')
    for rel, text in found[:40]:
        print(' YAML:', rel, 'schedule=', 'helgens schema' in text or 'motogp_schedule_day_override' in text, 'sessions_all=', 'sessions_all' in text, 'weekend_gate=', 'motogp_weekend_view' in text, 'today_track=', 'today' in text and 'track' in text)
    if len(found) > 40: print(' Further YAML matches omitted:', len(found)-40)
    print('\nSUMMARY: legacy v10 requires a schedule card with Helgens schema / sessions_all and binary_sensor.motogp_weekend_view=on.')
    print('If no such card appears in the actual dashboard file, it is missing or located in a different view.')
    print('READ ONLY: no files created or changed.')

if __name__ == '__main__':
    main()
