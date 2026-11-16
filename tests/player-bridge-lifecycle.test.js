import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

test('bridge host replaces the audio DOM node once after controller and layout disposal', () => {
  const order = [];
  const oldAudio = {
    cloneNode(deep) { assert.equal(deep, false); return { fresh: true }; },
    replaceWith(replacement) { order.push('replace'); this.replacement = replacement; },
  };
  const root = { ownerDocument: { getElementById: () => oldAudio }, querySelector: () => oldAudio };
  const scope = {
    createAudioCache: () => ({}), createDecoder: () => ({}),
    createChunkedAudio: () => ({}),
    createPlayer: () => ({ dispose() { order.push('controller'); } }),
    observeLyrics: () => () => order.push('layout'),
    document: {},
  };
  const code = fs.readFileSync(new URL('../web/src/player-bridge.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export function', 'function');
  vm.runInNewContext(`${code};this.create=createPlayerBridge`, scope);
  const bridge = scope.create({ catalog: { schemaVersion: 1, songs: [{ id: 'a' }] }, root });
  bridge.dispose(); bridge.dispose();
  assert.deepEqual(order, ['layout', 'controller', 'replace']);
  assert.equal(oldAudio.replacement.fresh, true);
});
