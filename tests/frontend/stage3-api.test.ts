import { expect, it, vi } from 'vitest';
import { apiCatalog } from '../../packages/player-bridge/src/api-catalog';
import { loadApiSong, request } from '../../apps/web/src/api';
import { catalogFixture } from './fixture';

function manifest() {
  const song = catalogFixture().songs[0];
  song.audio = {
    '1': { src: '/api/assets/11111111-1111-4111-8111-111111111111?versionId=v1' },
    '0.75': { src: '/api/assets/22222222-2222-4222-8222-222222222222?versionId=v1' },
    '0.5': { src: '/api/assets/33333333-3333-4333-8333-333333333333?versionId=v1' },
  };
  return {
    songId: song.id,
    versionId: 'v1',
    schemaVersion: 1,
    packageVersion: '2026-1',
    playerSong: song,
    playerChunks: {},
  };
}

it('maps authorized manifest references to Sorane catalog URLs and preserves time/song data', () => {
  const catalog = apiCatalog(manifest(), 'https://utae.test');
  expect(catalog.songs).toHaveLength(1);
  expect(catalog.songs[0].duration).toBe(24);
  expect(catalog.songs[0].audio['1'].src).toBe(
    'https://utae.test/api/assets/11111111-1111-4111-8111-111111111111?versionId=v1',
  );
});

it('rejects foreign, wrong-version and non-asset URLs', () => {
  const source = manifest() as any;
  source.playerSong.audio['1'].src =
    'https://evil.test/api/assets/11111111-1111-4111-8111-111111111111?versionId=v1';
  expect(() => apiCatalog(source, 'https://utae.test')).toThrow(/未授权/);
  source.playerSong.audio['1'].src =
    '/api/assets/11111111-1111-4111-8111-111111111111?versionId=v2';
  expect(() => apiCatalog(source, 'https://utae.test')).toThrow(/未授权/);
  source.playerSong.audio['1'].src = '/private/object-key?versionId=v1';
  expect(() => apiCatalog(source, 'https://utae.test')).toThrow(/未授权/);
});

it('requests include Cookie credentials, no-store semantics and validates the API envelope', async () => {
  const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => {
    void args;
    return new Response(
      JSON.stringify({ apiVersion: 'utae-api-v1', code: 'OK', message: '', data: { value: 7 } }),
      { status: 200 },
    );
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(request('/me')).resolves.toEqual({ value: 7 });
  expect(fetcher).toHaveBeenCalledWith(
    '/api/me',
    expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'denied' }), { status: 403 }),
    ),
  );
  await expect(request('/private')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  vi.unstubAllGlobals();
});

it('loads a version-pinned manifest through the business API', async () => {
  const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => {
    void args;
    return new Response(
      JSON.stringify({ apiVersion: 'utae-api-v1', code: 'OK', message: '', data: manifest() }),
      { status: 200 },
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const loaded = await loadApiSong('a/b', 'v1');
  expect(fetcher.mock.calls[0][0]).toBe('/api/songs/a%2Fb/manifest?versionId=v1');
  expect(loaded.catalog.songs[0].id).toBe('a');
  vi.unstubAllGlobals();
});
