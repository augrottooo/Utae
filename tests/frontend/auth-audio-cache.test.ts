import { afterEach, expect, it, vi } from 'vitest';
import { createAuthorizedAudioCache } from '../../packages/player-bridge/src';

afterEach(() => vi.unstubAllGlobals());

it('fetches version-authorized media with cookies and never persists it', async () => {
  const request = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  vi.stubGlobal('fetch', request);
  const cache = createAuthorizedAudioCache();
  const response = await cache.get('/api/assets/asset?versionId=v1');
  expect(response.ok).toBe(true);
  expect(request).toHaveBeenCalledWith('/api/assets/asset?versionId=v1', {
    credentials: 'include',
    cache: 'no-store',
  });
  await expect(cache.persist()).resolves.toBe(false);
  await expect(cache.getDiagnostics()).resolves.toMatchObject({
    storedFiles: 0,
    bytes: 0,
    persistent: false,
  });
});

it('rejects expired authorization instead of returning a cached private audio response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 401 })),
  );
  await expect(createAuthorizedAudioCache().get('/api/assets/asset?versionId=v1')).rejects.toThrow(
    'HTTP 401',
  );
});
