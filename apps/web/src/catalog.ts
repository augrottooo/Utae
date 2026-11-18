import { useQuery } from '@tanstack/react-query';
import { checkSongAssets, loadCatalog, type Catalog } from '@utae/player-bridge';

export function loadLocalCatalog(signal?: AbortSignal): Promise<Catalog> {
  const url = new URL('/sorane/library.json', window.location.origin);
  return loadCatalog(url.href, signal);
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

export function useSongAssets(catalog: Catalog | undefined, songId: string | undefined) {
  return useQuery({
    queryKey: ['local-song-assets', catalog, songId],
    enabled: !!catalog?.songs.some((song) => song.id === songId),
    queryFn: async ({ signal }) => {
      await checkSongAssets(catalog!, songId!, signal);
      return true;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
