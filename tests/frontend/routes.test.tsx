import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../../apps/web/src/App';
import { catalogFixture } from './fixture';
import { rebaseCatalog } from '../../packages/player-bridge/src/catalog';
const localCatalog = () => rebaseCatalog(catalogFixture(), 'http://localhost/sorane/library.json');

const mount = vi.hoisted(() => ({ setup: vi.fn(), dispose: vi.fn() }));
vi.mock('../../apps/web/src/player/SoranePlayerHost', async () => {
  const { useEffect } = await import('react');
  return {
    SoranePlayerHost: () => {
      useEffect(() => {
        mount.setup();
        return mount.dispose;
      }, []);
      return <div>mounted-player</div>;
    },
  };
});
beforeEach(() => {
  mount.setup.mockClear();
  mount.dispose.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null)),
  );
});

it('route leaving unmounts the player; returning mounts exactly one new host', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['local-sorane-catalog'], localCatalog());
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/songs/a/practice']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText('mounted-player');
  expect(mount.setup).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('link', { name: 'Utae 唱吧' }));
  expect(mount.dispose).toHaveBeenCalledTimes(1);
  fireEvent.click(await screen.findByRole('link', { name: '朝の光 · Test' }));
  await screen.findByText('mounted-player');
  expect(mount.setup).toHaveBeenCalledTimes(2);
});

it('an unknown song is an explicit error and never creates a host', () => {
  const client = new QueryClient();
  client.setQueryData(['local-sorane-catalog'], localCatalog());
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/songs/missing/practice']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('alert').textContent).toContain('没有这首歌曲');
  expect(mount.setup).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllGlobals());

function practice() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['local-sorane-catalog'], localCatalog());
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/songs/a/practice']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it('a missing asset blocks the host, displays an actionable error and allows retry', async () => {
  const request = vi.fn(async () => new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', request);
  practice();
  expect((await screen.findByRole('alert')).textContent).toContain('HTTP 404');
  expect(mount.setup).not.toHaveBeenCalled();
  request.mockImplementation(async () => new Response(null));
  fireEvent.click(screen.getByRole('button', { name: '重试歌曲加载' }));
  await screen.findByText('mounted-player');
  expect(mount.setup).toHaveBeenCalledTimes(1);
});
it('leaving during resource checking aborts requests and never mounts a stale host', async () => {
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, options: RequestInit) => {
      signals.push(options.signal as AbortSignal);
      return new Promise<Response>(() => {});
    }),
  );
  practice();
  await screen.findByText('正在检查歌曲资源…');
  fireEvent.click(screen.getByRole('link', { name: 'Utae 唱吧' }));
  await screen.findByRole('heading', { name: '从一首歌开始精听' });
  expect(signals.length).toBeGreaterThan(0);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(mount.setup).not.toHaveBeenCalled();
});
it('shows an empty catalog without mounting a host', () => {
  const client = new QueryClient();
  client.setQueryData(['local-sorane-catalog'], { schemaVersion: 1, songs: [] });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('status').textContent).toContain('暂无歌曲');
  expect(mount.setup).not.toHaveBeenCalled();
});

it('returning to a cached song waits for fresh checks and reports a newly missing asset', async () => {
  const request = vi.fn(async () => new Response(null));
  vi.stubGlobal('fetch', request);
  practice();
  await screen.findByText('mounted-player');
  fireEvent.click(screen.getByRole('link', { name: 'Utae 唱吧' }));
  await screen.findByRole('link', { name: '朝の光 · Test' });
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => (finish = resolve));
  request.mockImplementation(() => pending);
  fireEvent.click(screen.getByRole('link', { name: '朝の光 · Test' }));
  await screen.findByText('正在检查歌曲资源…');
  expect(screen.queryByText('mounted-player')).toBeNull();
  expect(mount.setup).toHaveBeenCalledTimes(1);
  finish(new Response(null, { status: 404 }));
  expect((await screen.findByRole('alert')).textContent).toContain('HTTP 404');
  expect(mount.setup).toHaveBeenCalledTimes(1);
});
