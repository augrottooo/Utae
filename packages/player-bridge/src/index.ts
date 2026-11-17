import { createPlayerBridge } from '../../../web/src/player-bridge.js';
import type { BridgeFactory, Catalog, PlayerBridge, PlayerSnapshot } from './types.ts';
export type * from './types.ts';
export { rebaseCatalog } from './catalog.ts';

export interface PlayerSession {
  bridge: PlayerBridge;
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

// The retained fixed IDs/global styles permit one player host per document.
const activeHosts = new WeakMap<Document, HTMLElement>();
const createBridge: BridgeFactory = (options) => createPlayerBridge(options) as PlayerBridge;

export function mountPlayerHost(
  {
    container,
    markup,
    catalog,
    songId,
  }: {
    container: HTMLElement;
    markup: string;
    catalog: Catalog;
    songId: string;
  },
  factory: BridgeFactory = createBridge,
): PlayerSession {
  if (activeHosts.has(container.ownerDocument)) throw new Error('每个页面只允许一个播放器宿主。');
  if (!catalog.songs.some((song) => song.id === songId))
    throw new RangeError('歌曲不在本地曲库中。');
  const doc = container.ownerDocument;
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  parsed.querySelectorAll('script').forEach((node) => node.remove());
  // React owns the song route and heading; the hidden nodes remain available to createPlayer.
  const heading = parsed.querySelector<HTMLElement>('.topbar');
  if (heading) heading.hidden = true;
  container.replaceChildren(
    ...Array.from(parsed.body.children, (node) => doc.importNode(node, true)),
  );
  activeHosts.set(doc, container);
  let bridge: PlayerBridge | undefined;
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  const listeners = new Set<() => void>();
  try {
    bridge = factory({ catalog, root: container, songId });
    const player = bridge;
    // getSnapshot creates a fresh object in upstream; cache notifications for useSyncExternalStore.
    let snapshot = player.getSnapshot();
    unsubscribe = player.subscribe((next) => {
      if (disposed) return;
      snapshot = next;
      for (const listener of listeners) listener();
    });
    return {
      bridge: player,
      getSnapshot: () => snapshot,
      subscribe(listener) {
        if (disposed) return () => {};
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        try {
          unsubscribe?.();
          listeners.clear();
          player.dispose();
          snapshot = player.getSnapshot();
        } finally {
          // Bridge replaces audio first; this host discards all old nodes before the next setup.
          container.replaceChildren();
          activeHosts.delete(doc);
        }
      },
    };
  } catch (error) {
    try {
      unsubscribe?.();
      bridge?.dispose();
    } finally {
      container.replaceChildren();
      activeHosts.delete(doc);
    }
    throw error;
  }
}
