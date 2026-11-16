import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const loadFactory = (path, name, scope) => {
  const code = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace('export function', 'function');
  vm.runInNewContext(`${code};this.factory=${name}`, scope);
  return scope.factory;
};

function mixerFixture({ rejectClose = false } = {}) {
  const contexts = [], associations = new WeakSet(), createdNodes = [];
  class AudioNode {
    constructor(kind) {
      this.kind = kind;
      this.disconnectCount = 0;
      this.gain = { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} };
      createdNodes.push(this);
    }
    connect() {}
    disconnect() { this.disconnectCount++; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }
  class Context extends EventTarget {
    constructor() {
      super();
      this.state = 'suspended'; this.currentTime = 1; this.sampleRate = 44100;
      this.destination = new AudioNode('destination'); contexts.push(this);
    }
    createMediaElementSource(media) {
      if (associations.has(media)) throw new DOMException('Media element already connected', 'InvalidStateError');
      associations.add(media); return new AudioNode('media-source');
    }
    createChannelSplitter() { return new AudioNode('splitter'); }
    createChannelMerger() { return new AudioNode('merger'); }
    createGain() { return new AudioNode('gain'); }
    createBufferSource() { return new AudioNode('buffer-source'); }
    createBuffer(_channels, length) { return { length, sampleRate: 44100 }; }
    async resume() { this.state = 'running'; }
    async close() {
      this.closeCalls = (this.closeCalls || 0) + 1;
      if (rejectClose) throw new Error('close rejected');
      this.state = 'closed';
    }
  }
  const scope = {
    window: { AudioContext: Context, navigator: {} }, DOMException,
    setTimeout, clearTimeout, Promise,
  };
  const createMixer = loadFactory('../web/src/audio/mixer.js', 'createVocalMixer', scope);
  return { createMixer, contexts, createdNodes };
}

test('mixer disposal disconnects its persistent graph, stops priming, closes once, and rejects later use', async () => {
  const f = mixerFixture(), media = {};
  const mixer = f.createMixer(media);
  const context = mixer.getContext();
  await mixer.resume();
  const priming = f.createdNodes.find((node) => node.kind === 'buffer-source');
  assert.ok(priming?.started);
  assert.equal(context.state, 'running');
  await mixer.dispose();
  await mixer.dispose();
  assert.equal(context.state, 'closed');
  assert.ok(f.createdNodes.filter((node) => !['destination', 'buffer-source'].includes(node.kind))
    .every((node) => node.disconnectCount > 0));
  assert.equal(priming.stopped, true);
  assert.equal(priming.disconnectCount, 1);
  assert.throws(() => mixer.getContext(), { name: 'InvalidStateError' });
  assert.throws(() => mixer.connectSource({}), { name: 'InvalidStateError' });
  assert.throws(() => mixer.setRead(true), { name: 'InvalidStateError' });
  assert.throws(() => mixer.setVolume(0.5), { name: 'InvalidStateError' });
});

test('mixer instances own independent contexts; closing one does not affect another', async () => {
  const f = mixerFixture();
  const one = f.createMixer({}), two = f.createMixer({});
  const contextOne = one.getContext(), contextTwo = two.getContext();
  await one.dispose();
  assert.equal(contextOne.state, 'closed');
  assert.notEqual(contextTwo.state, 'closed');
  await two.dispose();
});

test('mixer absorbs asynchronous close rejection and media-element association survives context close', async () => {
  const f = mixerFixture({ rejectClose: true });
  const sameMedia = {};
  const first = f.createMixer(sameMedia);
  first.getContext();
  await assert.doesNotReject(first.dispose());
  const second = f.createMixer(sameMedia);
  assert.throws(() => second.getContext(), { name: 'InvalidStateError' });
  assert.equal(f.contexts.at(-1).closeCalls, 1);
  const freshMedia = {};
  const fresh = f.createMixer(freshMedia);
  assert.doesNotThrow(() => fresh.getContext());
  await fresh.dispose();
});

function transportFixture() {
  const media = new EventTarget(), native = { added: [], removed: [] };
  const add = media.addEventListener.bind(media), remove = media.removeEventListener.bind(media);
  media.addEventListener = (type, fn, options) => { native.added.push([type, fn]); add(type, fn, options); };
  media.removeEventListener = (type, fn, options) => { native.removed.push([type, fn]); remove(type, fn, options); };
  Object.assign(media, {
    muted: false, paused: true, currentTime: 0, duration: 2, src: '',
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); },
    load() {}, removeAttribute(name) { if (name === 'src') this.src = ''; },
    getAttribute(name) { return name === 'src' ? this.src || null : null; },
    async play() { this.paused = false; this.dispatchEvent(new Event('play')); },
  });
  const context = new EventTarget();
  Object.assign(context, {
    currentTime: 1, state: 'running', createGain() {
      return {
        gain: { value: 1, setValueAtTime() {} },
        connect() {}, disconnect() { this.disconnected = true; },
      };
    },
    createBufferSource() {
      const node = {
        playbackRate: { value: 1 }, connect() {}, disconnect() { this.disconnected = true; },
        start() {}, stop() { this.stopped = true; },
      };
      sources.push(node); return node;
    },
  });
  const sources = [];
  const mixer = { getContext: () => context, connectSource() {}, resume: async () => {} };
  const createTransport = loadFactory('../web/src/audio/transport.js', 'createPlaybackTransport', {
    DOMException, Promise, setTimeout, clearTimeout,
  });
  const transport = createTransport({ media, mixer, createChunkedSession() { throw Error('unused'); } });
  return { media, native, context, sources, transport };
}

test('transport dispose unregisters media listeners, stops PCM session, and ignores later media events', async () => {
  const f = transportFixture();
  let events = 0;
  f.transport.addEventListener('play', () => events++);
  const audio = { first: 0, last: 44100, audio: { length: 44100, duration: 1, sampleRate: 44100, numberOfChannels: 1 } };
  f.transport.attachLoop(audio, true);
  await f.transport.play();
  assert.equal(events, 1);
  const source = f.sources[0];
  const added = [...f.native.added];
  f.transport.dispose();
  f.transport.dispose();
  assert.equal(source.stopped, true);
  assert.equal(source.disconnected, true);
  assert.equal(f.native.removed.length, added.length);
  assert.deepEqual(f.native.removed.map(([type]) => type).sort(), added.map(([type]) => type).sort());
  f.media.dispatchEvent(new Event('play'));
  assert.equal(events, 1);
  assert.throws(() => f.transport.attachLoop(audio), { name: 'InvalidStateError' });
  await assert.rejects(f.transport.play(), { name: 'InvalidStateError' });
});

test('transport dispose removes listeners when the native media path is active too', () => {
  const f = transportFixture();
  let received = 0;
  f.transport.addEventListener('timeupdate', () => received++);
  f.media.dispatchEvent(new Event('timeupdate'));
  assert.equal(received, 1);
  f.transport.dispose();
  f.media.dispatchEvent(new Event('timeupdate'));
  assert.equal(received, 1);
  assert.equal(f.native.removed.length, f.native.added.length);
});
