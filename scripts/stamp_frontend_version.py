#!/usr/bin/env python3
"""One-time guarded version stamp for the existing dev card.

The GitHub workflow runs this after the file lands in dev. It only touches the
existing frontend resource, never the HA install or beta/main branches.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CARD = ROOT / "frontend" / "ha-motogp-card.js"
EXPECTED_BLOB = "fed6922732e53c6ae0408873b05a8856849c92e6"
VERSION = "0.1.0-dev.3"
MARKER = "HA_MOTOGP_BUILD_METADATA_START"


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"STOPP: {label}: expected exactly one anchor, got {count}. File untouched.")
    return text.replace(old, new, 1)


original = CARD.read_bytes()
text = original.decode("utf-8")
if MARKER in text:
    print("Already version-stamped: no changes.")
    raise SystemExit(0)

blob = hashlib.sha1(b"blob " + str(len(original)).encode() + b"\0" + original).hexdigest()
if blob != EXPECTED_BLOB:
    raise SystemExit(f"STOPP: unexpected frontend Git blob {blob}; expected {EXPECTED_BLOB}. No files modified.")

source_commit = os.environ.get("GITHUB_SHA", "local-uncommitted")
branch = os.environ.get("GITHUB_REF_NAME", "dev")
if branch != "dev":
    raise SystemExit("STOPP: stamp may only run on dev.")
build_id = hashlib.sha256(original).hexdigest()[:12]
built_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
info = {
    "version": VERSION,
    "branch": branch,
    "buildId": build_id,
    "sourceCommit": source_commit,
    "builtAt": built_at,
}
info_js = json.dumps(info, ensure_ascii=False, indent=4)

text = replace_exact(
    text,
    "  const TAG = 'ha-motogp-card';\n  if (customElements.get(TAG)) return;",
    "  const TAG = 'ha-motogp-card';\n"
    "  // HA_MOTOGP_BUILD_METADATA_START: embedded into the actual JS resource.\n"
    f"  const CARD_BUILD = Object.freeze({info_js});\n"
    "  // HA_MOTOGP_BUILD_METADATA_END\n"
    "  if (customElements.get(TAG)) {\n"
    "    const existing = customElements.get(TAG).buildInfo;\n"
    "    console.warn('[ha-motogp-card] Already registered; cannot replace loaded card. Existing:',\n"
    "      existing || 'unknown version', 'New resource:', CARD_BUILD);\n"
    "    return;\n"
    "  }",
    "metadata and duplicate-registration guard",
)

text = replace_exact(
    text,
    "    @media(max-width:360px){.tiles{grid-template-columns:1fr}}\n  `;",
    "    @media(max-width:360px){.tiles{grid-template-columns:1fr}}\n"
    "    .build-version{padding:7px 12px;text-align:right;font-size:10px;color:var(--secondary-text-color)}\n"
    "    .build-version button{border:0;background:transparent;color:inherit;font-size:10px;padding:3px 0}\n"
    "    .build-version button:hover{text-decoration:underline}\n"
    "    .build-details{margin-top:4px;line-height:1.6;overflow-wrap:anywhere}\n"
    "  `;",
    "version footer CSS",
)

text = replace_exact(
    text,
    "      this._timer = null;\n      this.shadowRoot.innerHTML =",
    "      this._timer = null;\n      this._showBuildInfo = false;\n      this.shadowRoot.innerHTML =",
    "version panel state",
)

text = replace_exact(
    text,
    "      const button = e.target.closest('button[data-day],button[data-timing]');\n"
    "      if (!button) return;\n      if (button.dataset.day !== undefined) {",
    "      const button = e.target.closest('button[data-day],button[data-timing],button[data-build-info]');\n"
    "      if (!button) return;\n"
    "      if (button.dataset.buildInfo !== undefined) {\n"
    "        this._showBuildInfo = !this._showBuildInfo;\n"
    "        this._render();\n"
    "        return;\n"
    "      }\n"
    "      if (button.dataset.day !== undefined) {",
    "version info click handling",
)

text = replace_exact(
    text,
    "      this.shadowRoot.getElementById('view').innerHTML = content.join('');\n"
    "    }\n    _scheduleMarkup(sessions, selected, identity, now) {",
    "      this.shadowRoot.getElementById('view').innerHTML = content.join('') + this._versionFooter();\n"
    "    }\n"
    "    _versionFooter() {\n"
    "      const v = CARD_BUILD;\n"
    "      const expanded = this._showBuildInfo;\n"
    "      return `<div class=\"build-version\"><button type=\"button\" data-build-info aria-expanded=\"${expanded}\" ` +\n"
    "        `title=\"Visa inladdad frontendversion\">UI v${escapeHTML(v.version)} · ${escapeHTML(v.buildId)} ${expanded ? '⌃' : 'ⓘ'}</button>` +\n"
    "        (expanded ? `<div class=\"build-details\">Branch: ${escapeHTML(v.branch)} · ` +\n"
    "          `Källcommit: ${escapeHTML(v.sourceCommit)} · Byggd: ${escapeHTML(v.builtAt)} · ` +\n"
    "          `JS-fingeravtryck: ${escapeHTML(v.buildId)}<br>Backend-version visas separat.</div>` : '') + '</div>';\n"
    "    }\n    _scheduleMarkup(sessions, selected, identity, now) {",
    "visible footer and version details",
)

text = replace_exact(
    text,
    "  customElements.define(TAG, HaMotogpCard);\n  window.customCards =",
    "  HaMotogpCard.buildInfo = CARD_BUILD;\n"
    "  customElements.define(TAG, HaMotogpCard);\n"
    "  window.haMotogpBuild = CARD_BUILD;\n"
    "  console.info('[ha-motogp-card] Loaded frontend', CARD_BUILD);\n"
    "  window.customCards =",
    "runtime build metadata and console",
)

# Validate replacement anchors before modifying the file. The workflow then
# runs node --check and all existing JavaScript tests prior to committing.
with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=CARD.parent, delete=False) as temp:
    temp.write(text)
    new_file = Path(temp.name)
new_file.chmod(CARD.stat().st_mode)
os.replace(new_file, CARD)
print("Stamped", VERSION, "branch", branch, "build ID", build_id)
print("Source commit", source_commit, "built", built_at)
