import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

test('directory abort removes handlers on retained and detached buttons', () => {
  class Node extends EventTarget {
    children = [];
    dataset = {};
    classList = { toggle() {} };
    append(...nodes) {
      this.children.push(...nodes);
    }
    replaceChildren() {
      this.children = [];
    }
    querySelectorAll() {
      return [];
    }
    setAttribute() {}
  }
  const list = new Node(),
    total = new Node();
  const root = {
    ownerDocument: { createElement: () => new Node() },
    querySelector: (selector) => (selector.includes('lyric-list') ? list : total),
  };
  const scope = {};
  const code = fs
    .readFileSync(new URL('../web/src/directory.js', import.meta.url), 'utf8')
    .replace('export function', 'function');
  vm.runInNewContext(`${code};this.create=createDirectory`, scope);
  const abort = new AbortController();
  let clicks = 0;
  const view = scope.create({
    root,
    eventSignal: abort.signal,
    context: () => ({ lines: [{ section: 'A', jp: '朝' }], mode: 'line' }),
    chooseLine: () => clicks++,
    chooseGroup: () => clicks++,
  });
  view.render();
  const [group, line] = list.children;
  group.dispatchEvent(new Event('click'));
  line.dispatchEvent(new Event('click'));
  assert.equal(clicks, 2);
  view.render();
  const newLine = list.children[1];
  abort.abort();
  for (const node of [group, line, newLine]) node.dispatchEvent(new Event('click'));
  assert.equal(clicks, 2);
});

test('layout observer, fonts and resize handlers stop on disposal, including late font readiness', async () => {
  const fonts = new EventTarget(),
    window = new EventTarget();
  let finishFonts,
    disconnects = 0,
    touches = 0,
    callback;
  fonts.ready = new Promise((resolve) => {
    finishFonts = resolve;
  });
  const container = {
    getClientRects: () => {
      touches++;
      return [];
    },
  };
  const root = {
    querySelector: (selector) => (selector.includes('next-tokens') ? null : container),
  };
  class ResizeObserver {
    constructor(fn) {
      callback = fn;
    }
    observe() {}
    disconnect() {
      disconnects++;
    }
  }
  window.ResizeObserver = ResizeObserver;
  const scope = { document: { fonts }, window, ResizeObserver };
  const code = fs
    .readFileSync(new URL('../web/src/layout.js', import.meta.url), 'utf8')
    .replaceAll('export ', '');
  vm.runInNewContext(`${code};this.observe=observeLyrics`, scope);
  const stop = scope.observe(root);
  callback([{ contentRect: { width: 100 } }]);
  assert.equal(touches, 1);
  stop();
  finishFonts();
  await Promise.resolve();
  fonts.dispatchEvent(new Event('loadingdone'));
  callback([{ contentRect: { width: 200 } }]);
  assert.equal(touches, 1);
  assert.equal(disconnects, 1);
});
