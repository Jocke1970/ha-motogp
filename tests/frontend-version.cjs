/* Run: node tests/frontend-version.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../frontend/ha-motogp-card.js'), 'utf8');
const registry = new Map();
let duplicateWarnings = 0;
class Element {
  attachShadow() {
    const view = { innerHTML: '' };
    this._view = view;
    this.shadowRoot = {
      innerHTML: '',
      addEventListener() {},
      getElementById: id => id === 'view' ? view : null,
    };
    return this.shadowRoot;
  }
}
const window = { customCards: [] };
const context = {
  customElements: {
    get: tag => registry.get(tag),
    define: (tag, klass) => registry.set(tag, klass),
  },
  HTMLElement: Element,
  window,
  Date,
  setInterval: () => 1,
  clearInterval() {},
  console: { info() {}, warn() { duplicateWarnings += 1; } },
};
vm.runInNewContext(source, context, { filename: 'ha-motogp-card.js' });
const Card = registry.get('ha-motogp-card');
assert.ok(Card, 'Card registered');
assert.match(Card.buildInfo.version, /^\d+\.\d+\.\d+-dev\.\d+$/);
assert.equal(Card.buildInfo.branch, 'dev');
assert.match(Card.buildInfo.buildId, /^[0-9a-f]{12}$/);
assert.match(Card.buildInfo.sourceCommit, /^[0-9a-f]{40}$/);
assert.equal(window.haMotogpBuild, Card.buildInfo, 'Console metadata equals registered class metadata');

const card = new Card();
card.setConfig({ mode: 'both' });
card.hass = { states: {} };
assert.match(card._view.innerHTML, new RegExp(`UI v${Card.buildInfo.version.replaceAll('.', '\\.')}`));
assert.ok(card._view.innerHTML.includes(Card.buildInfo.buildId), 'Actual loaded build is shown in footer');
assert.match(card._view.innerHTML, /data-build-info aria-expanded="false"/);
card._click({ target: { closest: () => ({ dataset: { buildInfo: '' } }) } });
assert.match(card._view.innerHTML, /data-build-info aria-expanded="true"/);
assert.ok(card._view.innerHTML.includes(Card.buildInfo.sourceCommit), 'Full source commit visible in details');
assert.ok(card._view.innerHTML.includes(Card.buildInfo.builtAt), 'Build date visible in details');

// Loading a second resource must not falsely claim that the existing class was replaced.
vm.runInNewContext(source, context, { filename: 'duplicate-ha-motogp-card.js' });
assert.equal(registry.get('ha-motogp-card'), Card);
assert.equal(duplicateWarnings, 1);
console.log('PASS: embedded version, visible build ID, details, console metadata and duplicate guard');
