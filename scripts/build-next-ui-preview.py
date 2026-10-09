#!/usr/bin/env python3
"""Compose a preview UI onto the verified Next dev.3 single resource."""
import hashlib
import importlib.util
import pathlib
import sys
import tempfile

BASE_BLOB = 'b15fb60af3a8140c191261f9ec0eac224b530d7b'
UI_BLOB = '928d89e5df8bc32dcc90244c27bf4dae89b81e7e'
BUILD = 'next-one-20260920-04'
VERSION = '0.3.0-dev.4'


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def replace_one(text, original, replacement):
    if text.count(original) != 1:
        raise SystemExit('STOP: unexpected dev.3 template: ' + original[:60])
    return text.replace(original, replacement, 1)


def main(frontend, target):
    script = pathlib.Path(__file__).with_name('build-next-one.py')
    spec = importlib.util.spec_from_file_location('motogp_pinned_next', script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    frontend = pathlib.Path(frontend)
    addon = frontend / 'ha-motogp-next-ui-preview.js'
    if not addon.is_file() or addon.is_symlink():
        raise SystemExit('STOP: UI addon missing or symlink')
    ui = addon.read_bytes()
    if blob(ui) != UI_BLOB:
        raise SystemExit('STOP: unexpected UI source revision')
    with tempfile.TemporaryDirectory() as temp:
        base = pathlib.Path(temp) / 'base.js'
        module.build(frontend, base)
        data = base.read_bytes()
        if blob(data) != BASE_BLOB:
            raise SystemExit('STOP: dev.3 baseline bundle hash differs')
        text = data.decode('utf-8')
    text = replace_one(text, 'build next-one-20260920-03', 'build ' + BUILD)
    text = replace_one(text, '🏁 MOTOGP NEXT · 0.3.0-dev.3', '🏁 MOTOGP NEXT · ' + VERSION)
    text = replace_one(text, 'ha-motogp-next.js · 0.3.0-dev.3 · samlad testversion',
                       'ha-motogp-next.js · ' + VERSION + ' · UI-preview')
    result = (text + '\n;\n' + ui.decode('utf-8')).encode('utf-8')
    pathlib.Path(target).write_bytes(result)
    print(f'UI preview built: {target} ({len(result)} bytes, git blob {blob(result)})')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: build-next-ui-preview.py FRONTEND OUTPUT_JS')
    main(sys.argv[1], sys.argv[2])
