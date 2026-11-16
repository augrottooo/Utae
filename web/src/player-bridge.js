import { createAudioCache } from './audio/cache.js';
import { createDecoder } from './audio/decoder.js';
import { createChunkedAudio } from './audio/chunks.js';
import { createPlayer } from './player.js';
import { observeLyrics } from './layout.js';

/** 1A catalog boundary. Input is the existing build's library.json, not a Utae API DTO. */
export function createPlayerBridge({ catalog, root = document, songId }) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.songs) || !catalog.songs.length) {
    throw new TypeError('A nonempty Sorane schema 1 catalog is required');
  }
  const cache = createAudioCache();
  const decoder = createChunkedAudio({
    cache,
    decoder: createDecoder(cache),
    manifests: catalog.chunks || {},
  });
  const controller = createPlayer({ songs: catalog.songs, cache, decoder, root, songId });
  const stopLayout = observeLyrics(root);
  let disposed = false;
  return {
    ...controller,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopLayout();
      try {
        controller.dispose();
      } finally {
        const doc = root.ownerDocument || root;
        const audio = root === doc ? doc.getElementById('audio') : root.querySelector('#audio');
        if (audio) audio.replaceWith(audio.cloneNode(false));
      }
    },
  };
}
