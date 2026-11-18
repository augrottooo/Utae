import { rebaseCatalog } from './catalog.ts';
import { songAssets } from './validate.ts';
import type { Catalog } from './types.ts';

export async function loadCatalog(
  url: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<Catalog> {
  const response = await request(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`本地曲库加载失败（HTTP ${response.status}）。`);
  let input: unknown;
  try {
    input = await response.json();
  } catch {
    signal?.throwIfAborted();
    throw new Error('本地曲库不是有效 JSON，请检查歌曲包构建结果。');
  }
  signal?.throwIfAborted();
  return rebaseCatalog(input, response.url || url);
}

/** Check only the selected song. React never decodes audio; cancel any range-response body immediately. */
export async function checkSongAssets(
  catalog: Catalog,
  songId: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<void> {
  signal?.throwIfAborted();
  const song = catalog.songs.find((entry) => entry.id === songId);
  if (!song) throw new Error('歌曲不在本地曲库中。');
  const assets = songAssets(catalog, song);
  // Bounded batches avoid issuing one request per chunk simultaneously.
  for (let i = 0; i < assets.length; i += 4) {
    const batch = await Promise.allSettled(
      assets.slice(i, i + 4).map(async (url) => {
        let response = await request(url, { method: 'HEAD', signal, cache: 'no-cache' });
        if (response.status === 405 || response.status === 501) {
          response = await request(url, {
            headers: { Range: 'bytes=0-0' },
            signal,
            cache: 'no-cache',
          });
          await response.body?.cancel();
        }
        signal?.throwIfAborted();
        const type = response.headers.get('content-type') || '';
        if (
          !response.ok ||
          type.includes('text/html') ||
          response.headers.get('content-length') === '0'
        ) {
          throw new Error(
            `歌曲资源不可用（HTTP ${response.status}）：${new URL(url).pathname.split('/').pop()}。请重新构建歌曲包后重试。`,
          );
        }
        if (response.url && response.url !== url)
          throw new Error('歌曲资源发生重定向，请检查本地歌曲包。');
      }),
    );
    signal?.throwIfAborted();
    const failed = batch.find((entry) => entry.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }
}
