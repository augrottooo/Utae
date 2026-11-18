import type { Catalog, ReadSpeed } from './types.ts';
import { validateCatalog } from './validate.ts';

/** Rebase the actual build output, including chunk lookup keys and stereo parts. */
export function rebaseCatalog(input: unknown, catalogUrl: string): Catalog {
  validateCatalog(input);
  const base = new URL('.', catalogUrl);
  const asset = (src: string) => {
    const url = new URL(src, base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname)
    ) {
      throw new TypeError('本地歌曲资产必须位于静态曲库目录内。');
    }
    return url.href;
  };
  return {
    ...input,
    songs: input.songs.map((song) => ({
      ...song,
      audio: Object.fromEntries(
        Object.entries(song.audio).map(([rate, audio]) => [
          rate,
          { ...audio, src: asset(audio.src) },
        ]),
      ) as typeof song.audio,
      lines: song.lines.map((line) => ({
        ...line,
        ...(line.narration
          ? {
              narration: Object.fromEntries(
                Object.entries(line.narration).map(([speed, voice]) => [
                  speed,
                  { ...voice, src: asset(voice.src) },
                ]),
              ) as Record<ReadSpeed, (typeof line.narration)[ReadSpeed]>,
            }
          : {}),
      })),
    })),
    chunks: Object.fromEntries(
      Object.entries(input.chunks || {}).map(([src, manifest]) => [
        asset(src),
        {
          ...manifest,
          chunks: manifest.chunks.map((chunk) => ({
            ...chunk,
            src: asset(chunk.src),
            ...(chunk.parts ? { parts: chunk.parts.map(asset) } : {}),
          })),
        },
      ]),
    ),
  };
}
