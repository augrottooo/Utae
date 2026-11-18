import { expect, it, vi } from 'vitest';
import { checkSongAssets, loadCatalog } from './load';
import { rebaseCatalog } from './catalog';
import { catalogFixture } from '../../../tests/frontend/fixture';

const url = 'http://localhost/sorane/library.json';
const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
it('loads upstream public catalog and uses its response directory to resolve assets', async () => {
  const request = vi.fn(async () => reply(catalogFixture()));
  const catalog = await loadCatalog(url, undefined, request);
  expect(catalog.songs[0].audio['1'].src).toBe('http://localhost/sorane/assets/one.wav');
});
it('distinguishes HTTP failure, malformed JSON and schema failure', async () => {
  await expect(loadCatalog(url, undefined, async () => reply({}, 404))).rejects.toThrow('HTTP 404');
  await expect(loadCatalog(url, undefined, async () => new Response('<html>'))).rejects.toThrow(
    'JSON',
  );
  await expect(
    loadCatalog(url, undefined, async () => reply({ schemaVersion: 4 })),
  ).rejects.toThrow('schemaVersion');
});
it('does not return a late catalog after cancellation', async () => {
  const abort = new AbortController();
  let resolve!: (response: Response) => void;
  const pending = loadCatalog(url, abort.signal, () => new Promise((r) => (resolve = r)));
  abort.abort();
  resolve(reply(catalogFixture()));
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
});
it('checks deduplicated full audio, chunks and narration for the selected song only', async () => {
  const input = catalogFixture();
  const voice = { src: 'assets/read.wav', duration: 1, tokens: [{ start: 0, end: 1 }] };
  input.songs[0].lines[0].narration = { normal: voice, slow: voice, verySlow: voice };
  input.songs[1].audio['1'].src = 'assets/other-song.wav';
  input.chunks = {
    'assets/one.wav': {
      sampleRate: 44100,
      frames: 24 * 44100,
      chunks: [
        {
          src: 'assets/back.wav',
          parts: ['assets/back.wav', 'assets/vocal.wav'],
          first: 0,
          last: 24 * 44100,
        },
      ],
    },
  };
  const request = vi.fn(async () => new Response(null, { status: 200 }));
  await checkSongAssets(rebaseCatalog(input, url), 'a', undefined, request);
  expect(request).toHaveBeenCalledTimes(6);
  expect(request.mock.calls.flat().join()).not.toContain('other-song');
});
it.each([404, 403, 500])(
  'rejects missing/inaccessible assets (%s) before mounting',
  async (status) => {
    await expect(
      checkSongAssets(
        rebaseCatalog(catalogFixture(), url),
        'a',
        undefined,
        async () => new Response(null, { status }),
      ),
    ).rejects.toThrow(`HTTP ${status}`);
  },
);
it('rejects a dev-server HTML fallback disguised as successful audio', async () => {
  await expect(
    checkSongAssets(
      rebaseCatalog(catalogFixture(), url),
      'a',
      undefined,
      async () => new Response(null, { headers: { 'content-type': 'text/html' } }),
    ),
  ).rejects.toThrow('资源不可用');
});
it('falls back to a range request when HEAD is unsupported and cancels its body', async () => {
  const cancel = vi.fn(async () => {});
  const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    init?.method === 'HEAD'
      ? new Response(null, { status: 405 })
      : ({
          ok: true,
          status: 206,
          headers: new Headers({ 'content-type': 'audio/wav' }),
          url: '',
          body: { cancel },
        } as unknown as Response),
  );
  await checkSongAssets(rebaseCatalog(catalogFixture(), url), 'a', undefined, request);
  expect(cancel).toHaveBeenCalledTimes(3);
});
it('cancellation stops later batches and suppresses stale success', async () => {
  const abort = new AbortController();
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>((r) => (resolve = r));
  const request = vi.fn(() => response);
  const pending = checkSongAssets(rebaseCatalog(catalogFixture(), url), 'a', abort.signal, request);
  abort.abort();
  resolve(new Response(null));
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
});
