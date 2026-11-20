import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../../apps/web/src/App';

const manifest = {
  songId: 'strings',
  versionId: 'version-1',
  packageVersion: '2026-1',
  schemaVersion: 1,
  visibility: 'SHARED',
  lifecycleStatus: 'ACTIVE',
  playerChunks: {},
  playerSong: {
    schemaVersion: 1,
    id: 'strings',
    title: 'STRiNGS',
    artist: 'THE ORCHESTRA TOKYO',
    duration: 120,
    audio: Object.fromEntries(
      ['1', '0.75', '0.5'].map((rate, i) => [
        rate,
        { src: `/api/assets/11111111-1111-4111-8111-11111111111${i}?versionId=version-1` },
      ]),
    ),
    lines: [
      {
        id: 'line-1',
        jp: '歌',
        section: 'verse',
        start: 1,
        end: 2,
        tokens: [{ jp: '歌', kana: 'うた', romaji: 'uta', start: 1, end: 2 }],
      },
    ],
  },
};
const envelope = (data: unknown) =>
  new Response(JSON.stringify({ apiVersion: 'utae-api-v1', code: 'OK', message: '', data }), {
    status: 200,
  });
const mount = (initialEntry: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return new Response('', { status: 401 });
      if (url.startsWith('/api/songs?'))
        return envelope({
          items: [
            {
              songId: 'strings',
              title: 'STRiNGS',
              artist: 'THE ORCHESTRA TOKYO',
              durationMs: 120000,
              versionId: 'version-1',
              packageVersion: '2026-1',
              schemaVersion: 1,
              visibility: 'SHARED',
              lifecycleStatus: 'ACTIVE',
            },
          ],
          page: 0,
          size: 20,
          total: 1,
        });
      if (url.startsWith('/api/songs/strings/manifest')) return envelope(manifest);
      return new Response(null, { status: 404 });
    }),
  );
});

it('renders catalog and song detail from backend query responses', async () => {
  mount('/');
  expect(await screen.findByRole('link', { name: 'STRiNGS' })).toBeTruthy();
  fireEvent.click(screen.getAllByRole('link', { name: '详情' })[0]);
  expect(await screen.findByRole('heading', { name: 'STRiNGS' })).toBeTruthy();
  expect(screen.getByText('2026-1')).toBeTruthy();
});

it('keeps mine scoped to a real session and performs no unauthenticated private query', async () => {
  mount('/mine');
  expect(await screen.findByText('需要登录后查看私人歌曲。')).toBeTruthy();
  expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
    expect.stringContaining('scope=mine'),
    expect.anything(),
  );
});
