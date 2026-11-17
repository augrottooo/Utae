import { useQuery } from '@tanstack/react-query';
import { rebaseCatalog, type Catalog } from '@utae/player-bridge';

export async function loadLocalCatalog(signal?: AbortSignal): Promise<Catalog> {
  const url = new URL('/sorane/library.json', window.location.origin);
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok)
    throw new Error(`本地歌曲包加载失败（HTTP ${response.status}）。请先构建并准备静态资源。`);
  return rebaseCatalog((await response.json()) as Catalog, response.url || url.href);
}

export function useLocalCatalog() {
  return useQuery({
    queryKey: ['local-sorane-catalog'],
    queryFn: ({ signal }) => loadLocalCatalog(signal),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
