import { createPlayerBridge } from './player-bridge.js';

const result = document.getElementById('probe-result');
const snapshot = document.getElementById('probe-snapshot');
const host = document.getElementById('probe-host');
const mode = new URLSearchParams(location.search).get('root') || 'container';
let bridge,
  unsubscribe,
  catalog,
  template,
  notifications = 0;
const NativeAudioContext = window.AudioContext;
window.__bridgeProbeContexts = [];
if (NativeAudioContext) {
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      window.__bridgeProbeContexts.push(this);
    }
  };
}
const waitForPlayback = async () => {
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline) {
    if (bridge.getSnapshot().playing) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Playback did not start within 10 seconds');
};

function show() {
  snapshot.textContent = JSON.stringify(bridge.getSnapshot(), null, 2);
}
function mount() {
  unsubscribe?.();
  bridge?.dispose();
  host.replaceChildren(...[...template.body.children].map((node) => node.cloneNode(true)));
  mountExisting();
}
function mountExisting() {
  bridge = createPlayerBridge({
    catalog,
    root: mode === 'global' ? document : host,
    songId: catalog.songs[0].id,
  });
  notifications = 0;
  unsubscribe = bridge.subscribe(() => {
    notifications++;
    show();
  });
  // Test-only observability; never used by the production page.
  window.bridgeProbe = {
    bridge,
    catalog,
    host,
    get notifications() {
      return notifications;
    },
  };
  result.textContent = `已挂载：${mode}；命令使用原曲秒数。新 DOM 挂载不代表 AudioContext 已完整释放。`;
  show();
}
const actions = {
  play: () => bridge.play(),
  pause: () => bridge.pause(),
  seek: () => bridge.seek(8),
  line: () => bridge.setPracticeScope({ kind: 'line', lineIndex: 1 }),
  section: () => bridge.setPracticeScope({ kind: 'section', startIndex: 1, endIndex: 2 }),
  full: () => bridge.setPracticeScope({ kind: 'full' }),
  rate: () => bridge.setRate(0.75),
  loop: () =>
    bridge.setLoop(
      bridge.getSnapshot().loop.kind === 'none' ? bridge.getSnapshot().scope.kind : 'none',
    ),
  unsubscribe: () => unsubscribe(),
  dispose: () => {
    bridge.dispose();
    show();
  },
  remount: mount,
  sameHost: async () => {
    await bridge.play();
    await waitForPlayback();
    const oldContext = window.__bridgeProbeContexts.at(-1);
    unsubscribe();
    bridge.dispose();
    const closeDeadline = performance.now() + 5000;
    while (oldContext && oldContext.state !== 'closed' && performance.now() < closeDeadline)
      await new Promise((resolve) => setTimeout(resolve, 25));
    if (oldContext && oldContext.state !== 'closed') throw new Error('AudioContext did not close');
    mountExisting();
    await bridge.play();
    await waitForPlayback();
    if (window.__bridgeProbeContexts.at(-1) === oldContext)
      throw new Error('New audio host unexpectedly reused its previous AudioContext');
  },
};
for (const [name, action] of Object.entries(actions)) {
  document.getElementById(`probe-${name}`).addEventListener('click', async () => {
    try {
      await action();
      result.textContent =
        name === 'sameHost'
          ? `旧 AudioContext=${window.__bridgeProbeContexts.at(-2)?.state || 'not-created'}；已替换 audio 节点，新实例播放中（${bridge.getSnapshot().clockSource}）`
          : `${name} 已执行（订阅通知 ${notifications} 次）`;
      show();
    } catch (error) {
      result.textContent = `${error.name}: ${error.message}`;
    }
  });
}
try {
  const responses = await Promise.all([fetch('library.json'), fetch('index.html')]);
  for (const response of responses) if (!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = await responses[0].json();
  template = new DOMParser().parseFromString(await responses[1].text(), 'text/html');
  template.querySelectorAll('script').forEach((node) => node.remove());
  mount();
} catch (error) {
  result.textContent = `${error.name}: ${error.message}`;
}
