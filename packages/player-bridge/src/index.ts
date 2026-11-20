import { createPlayerBridge } from '../../../web/src/player-bridge.js';
import type { BridgeFactory, Catalog, PlayerBridge, PlayerSnapshot } from './types.ts';
export type * from './types.ts';
export { rebaseCatalog } from './catalog.ts';
export { validateCatalog, songAssets } from './validate.ts';
export { loadCatalog, checkSongAssets } from './load.ts';
export { apiCatalog } from './api-catalog.ts';

export interface PlayerSession {
  bridge: PlayerBridge;
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

// The retained fixed IDs/global styles permit one player host per document.
const activeHosts = new WeakMap<Document, HTMLElement>();
const createBridge: BridgeFactory = (options) => {
  const protectedAudio = Object.values(options.catalog.songs[0].audio).some((entry) =>
    new URL(entry.src, location.href).pathname.startsWith('/api/assets/'),
  );
  return createPlayerBridge({
    ...options,
    ...(protectedAudio ? { cache: createAuthorizedAudioCache() } : {}),
  }) as PlayerBridge;
};

/** Authorized audio stays in the current decoder session, never Cache Storage. */
export function createAuthorizedAudioCache() {
  return {
    async get(src: string) {
      const response = await fetch(src, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(`音频访问失败（HTTP ${response.status}）。`);
      return response;
    },
    async playable(src: string) {
      const response = await this.get(src);
      const url = URL.createObjectURL(await response.blob());
      return { url, release: () => URL.revokeObjectURL(url) };
    },
    persist: async () => false,
    invalidate: async () => {},
    getDiagnostics: async () => ({ storedFiles: 0, bytes: 0, persistent: false }),
  };
}

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
  // React owns the song route/title; retain upstream's lyric-directory button for range selection.
  const heading = parsed.querySelector<HTMLElement>('.song-title');
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
