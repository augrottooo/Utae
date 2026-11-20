import { rebaseCatalog } from './catalog.ts';
import type { Catalog } from './types.ts';

/** Validate API URLs separately; keep the local-package relative-path validator strict. */
export function apiCatalog(input: unknown, origin: string): Catalog {
  if (!input || typeof input !== 'object') throw new TypeError('Manifest 格式错误。');
  const wrapper = input as Record<string, unknown>;
  if (
    wrapper.schemaVersion !== 1 ||
    typeof wrapper.versionId !== 'string' ||
    !wrapper.versionId ||
    typeof wrapper.songId !== 'string' ||
    !wrapper.songId
  )
    throw new TypeError('歌曲包版本不兼容。');
  const source = {
    schemaVersion: 1,
    songs: [wrapper.playerSong],
    chunks: wrapper.playerChunks || {},
  };
  const assets = new Map<string, string>();
  const relative = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(relative);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (key === 'src' || key === 'parts') {
          return [key, Array.isArray(item) ? item.map(asset) : asset(item)];
        }
        return [key, relative(item)];
      }),
    );
  };
  const asset = (value: unknown) => {
    if (typeof value !== 'string') throw new TypeError('资产地址错误。');
    const url = new URL(value, origin);
    if (
      url.origin !== new URL(origin).origin ||
      !/^\/api\/assets\/[a-zA-Z0-9-]+$/.test(url.pathname) ||
      url.searchParams.get('versionId') !== wrapper.versionId ||
      [...url.searchParams.keys()].some((k) => k !== 'versionId') ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new TypeError('Manifest 包含未授权的资产地址。');
    const path = `assets/${assets.size}.bin`;
    assets.set(path, url.href);
    return path;
  };
  const songs = relative(source.songs);
  const chunks = Object.fromEntries(
    Object.entries(source.chunks as Record<string, unknown>).map(([key, manifest]) => [
      asset(key),
      relative(manifest),
    ]),
  );
  const validated = rebaseCatalog(
    { schemaVersion: 1, songs, chunks },
    `${origin}/validated/library.json`,
  );
  const restore = (value: unknown): unknown => {
    if (typeof value === 'string' && value.startsWith(`${origin}/validated/assets/`)) {
      const path = value.slice(`${origin}/validated/`.length);
      return assets.get(path) || value;
    }
    if (Array.isArray(value)) return value.map(restore);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.startsWith(`${origin}/validated/assets/`) ? String(restore(key)) : key,
        restore(item),
      ]),
    );
  };
  const catalog = restore(validated) as Catalog;
  if (!catalog.songs[0]?.id || !catalog.songs[0].title)
    throw new TypeError('Manifest 缺少播放器歌曲身份。');
  return catalog;
}
