import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineVariant } from '../web/src/timeline.js';

const code = fs
  .readFileSync(new URL('../web/src/player.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export function', 'function');
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

// Controller unit doubles. Real DOM, decoder, mixer and audio clock are tested by the browser probe.
class Node extends EventTarget {
  children = [];
  dataset = {};
  style = {};
  classList = { toggle() {}, add() {}, remove() {} };
  attrs = new Map();
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  setAttribute(k, v) {
    this.attrs.set(k, v);
  }
  getAttribute(k) {
    return this.attrs.get(k) || null;
  }
  remove() {}
  focus() {}
  blur() {}
  close() {
    this.open = false;
  }
  querySelectorAll() {
    return [];
  }
  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100 };
  }
}
function fixture({ blocked = false, selected = true, fail = false, narration = false } = {}) {
  const nodes = new Map();
  const cleanupOrder = [];
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Node());
    return nodes.get(id);
  };
  const root = new Node();
  const doc = { createElement: () => new Node(), documentElement: new Node() };
  root.ownerDocument = doc;
  root.querySelector = (selector) => get(selector.match(/id="([^"]+)"/)[1]);
  const audio = new Node();
  let time = 0,
    attachments = 0;
  Object.assign(audio, {
    src: '',
    paused: true,
    ended: false,
    readyState: 0,
    duration: 24,
    snapshot: () => ({ time, source: 'unit-clock', audible: !audio.paused }),
    async play() {
      audio.paused = false;
      audio.dispatchEvent(new Event('play'));
    },
    pause() {
      cleanupOrder.push('pause');
      audio.paused = true;
      audio.dispatchEvent(new Event('pause'));
    },
    dispose() {
      cleanupOrder.push('transport');
    },
    load() {},
    getAttribute: () => audio.src || null,
    removeAttribute() {
      audio.src = '';
      audio.readyState = 0;
      time = 0;
    },
    attachPCM(data, repeat) {
      attachments++;
      audio.src = `pcm:${attachments}`;
      audio.readyState = 4;
      audio.duration = data.duration;
      audio.repeat = repeat;
      queueMicrotask(() => audio.dispatchEvent(new Event('loadedmetadata')));
    },
  });
  audio.attachLoop = audio.attachPCM;
  Object.defineProperty(audio, 'currentTime', {
    get: () => time,
    set(value) {
      time = value;
      queueMicrotask(() => audio.dispatchEvent(new Event('seeked')));
    },
  });
  const requests = [];
  const decode = (request) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    const data = { start: request.start || 0, duration: request.end - request.start || 24 };
    requests.push({ request, resolve: () => resolve(data), reject });
    if (!blocked) {
      if (fail) reject(new Error('network'));
      else resolve(data);
    }
    return promise;
  };
  const song = (id) => ({
    id,
    title: id,
    artist: 'test',
    duration: 24,
    audio: Object.fromEntries([1, 0.75, 0.5].map((r) => [String(r), { src: `${id}-${r}` }])),
    lines: [1, 7, 13, 19].map((start) => ({
      start,
      end: start + 3.8,
      tokens: [{ jp: '朝', romaji: 'asa', start, end: start + 1 }],
      ...(narration ? { narration: { verySlow: { src: 'read.wav' } } } : {}),
    })),
  });
  const context = {
    document: doc,
    window: { location: { search: '' }, matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: () => null, setItem() {} },
    DOMException,
    AbortController,
    URLSearchParams,
    console,
    queueMicrotask,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    createDirectory: () => ({ render() {}, highlight() {} }),
    createLyricsView: () => ({
      renderTranslation() {},
      renderNextLine() {},
      renderJapanese() {},
      displayRomaji: (t) => t.romaji,
    }),
    createVocalMixer: () => ({
      setVolume() {},
      setRead() {},
      resume: async () => {},
      dispose: async () => {
        cleanupOrder.push('mixer');
      },
    }),
    createPlaybackTransport: () => audio,
    balanceLyrics() {},
    lineVariant,
  };
  vm.runInNewContext(`${code};this.factory=createPlayer`, context);
  const readings = [];
  const cache = {
    playable: () => new Promise((resolve) => readings.push(resolve)),
  };
  const controller = context.factory({
    songs: [song('a'), song('b')],
    decoder: { full: (r) => decode({ ...r, start: 0, end: 24 }), range: decode },
    root,
    songId: selected ? 'a' : null,
    cache,
  });
  return {
    controller,
    audio,
    requests,
    get,
    readings,
    cleanupOrder,
    attachments: () => attachments,
  };
}

test('catalog commands validate readiness, indices, scopes and rates', async () => {
  const { controller: c } = fixture({ selected: false });
  assert.equal(c.getSnapshot().songId, null);
  assert.equal(c.getSnapshot().durationSeconds, null);
  assert.throws(() => c.play(), { name: 'InvalidStateError' });
  assert.throws(() => c.loadSong('missing'), /Unknown song/);
  c.loadSong('a');
  await flush();
  assert.throws(() => c.selectLine(-1), /Invalid lyric/);
  assert.throws(() => c.setRate(2), /Unsupported/);
  assert.throws(() => c.seek(NaN), /finite/);
  assert.throws(
    () => c.setPracticeScope({ kind: 'section', startIndex: 3, endIndex: 1 }),
    /Reversed/,
  );
  c.setPracticeScope({ kind: 'section', startIndex: 1, endIndex: 2 });
  assert.throws(() => c.selectLine(0), /outside/);
  c.dispose();
});

test('snapshots use transport seconds mapped to the original song, with scope and loop commands', async () => {
  const { controller: c, audio } = fixture();
  await flush();
  c.setRate(0.5);
  await flush();
  audio.currentTime = 16;
  assert.equal(c.getSnapshot().positionSeconds, 8);
  c.seek(10);
  await flush();
  assert.equal(audio.currentTime, 20);
  c.seek(100);
  await flush();
  assert.ok(c.getSnapshot().positionSeconds <= 24);
  c.setPracticeScope({ kind: 'line', lineIndex: 1 });
  await flush();
  assert.equal(c.getSnapshot().currentLineIndex, 1);
  assert.equal(c.getSnapshot().scope.kind, 'line');
  c.setLoop('none');
  await flush();
  assert.equal(audio.repeat, false);
  await c.play();
  assert.equal(c.getSnapshot().playing, true);
  audio.ended = true;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(c.getSnapshot().playIntent, false);
  c.setPracticeScope({ kind: 'section', startIndex: 1, endIndex: 2 });
  c.setLoop('section');
  await flush();
  assert.equal(audio.repeat, true);
  c.setPracticeScope({ kind: 'full' });
  await flush();
  assert.equal(c.getSnapshot().scope.kind, 'full');
  c.dispose();
});

test('subscriptions unsubscribe, commands and DOM events stop after idempotent disposal', async () => {
  const { controller: c, get, cleanupOrder } = fixture();
  await flush();
  let updates = 0;
  const unsubscribe = c.subscribe(() => updates++);
  c.pause();
  await flush();
  assert.ok(updates > 0);
  unsubscribe();
  const before = updates;
  await c.play();
  await flush();
  assert.equal(updates, before);
  c.dispose();
  c.dispose();
  assert.deepEqual(cleanupOrder.slice(-3), ['pause', 'transport', 'mixer']);
  get('play').dispatchEvent(new Event('click'));
  assert.equal(c.getSnapshot().disposed, true);
  assert.equal(c.getSnapshot().playing, false);
  assert.throws(() => c.seek(2), { name: 'InvalidStateError' });
  assert.throws(() => c.subscribe(() => {}), { name: 'InvalidStateError' });
});

test('late decode success and failure cannot reattach audio after switch/dispose', async () => {
  const f = fixture({ blocked: true });
  const { controller: c, requests } = f;
  c.loadSong('b');
  requests[0].resolve();
  await flush();
  assert.equal(f.attachments(), 0);
  requests[1].resolve();
  await flush();
  assert.equal(f.attachments(), 1);
  c.setRate(0.75);
  c.dispose();
  requests[2].reject(new Error('late network failure'));
  await flush();
  assert.equal(f.attachments(), 1);
  assert.equal(c.getSnapshot().error, null);
  const other = fixture({ blocked: true });
  other.controller.dispose();
  other.requests[0].resolve();
  await flush();
  assert.equal(other.attachments(), 0);
});

test('decode errors surface in snapshots and play retries the existing source', async () => {
  const { controller: c, requests } = fixture({ blocked: true });
  requests[0].reject(new Error('network'));
  await flush();
  assert.equal(c.getSnapshot().error.code, 'PLAYBACK_FAILED');
  await c.play();
  assert.equal(requests.length, 2);
  requests[1].resolve();
  await flush();
  assert.equal(c.getSnapshot().error, null);
  assert.equal(c.getSnapshot().playing, true);
  c.dispose();
});

test('stale narration URLs release after switch/dispose; reading has a separate time domain', async () => {
  const { controller: c, get, readings } = fixture({ narration: true });
  await flush();
  c.setPracticeScope({ kind: 'line', lineIndex: 1 });
  await flush();
  get('mode-read').dispatchEvent(new Event('click'));
  assert.equal(c.getSnapshot().source, 'reading');
  assert.equal(c.getSnapshot().positionSeconds, 7);
  assert.throws(() => c.seek(8), { name: 'NotSupportedError' });
  assert.throws(() => c.setRate(0.5), { name: 'NotSupportedError' });
  c.loadSong('b');
  let releases = 0;
  readings[0]({ url: 'blob:old', release: () => releases++ });
  await flush();
  assert.equal(releases, 1);
  c.setPracticeScope({ kind: 'line', lineIndex: 1 });
  get('mode-read').dispatchEvent(new Event('click'));
  c.dispose();
  readings[1]({ url: 'blob:disposed', release: () => releases++ });
  await flush();
  assert.equal(releases, 2);
});
