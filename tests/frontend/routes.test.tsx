import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../../apps/web/src/Stage2MockApp';
import { catalogFixture } from './fixture';
import { rebaseCatalog } from '../../packages/player-bridge/src/catalog';
import { useMockSession } from '../../apps/web/src/session-store';
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
  sessionStorage.clear();
  useMockSession.setState({ signedIn: false });
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
  fireEvent.click(screen.getByRole('link', { name: /^Utae$/ }));
  expect(mount.dispose).toHaveBeenCalledTimes(1);
  fireEvent.click((await screen.findAllByRole('link', { name: '练习' }))[0]);
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
  fireEvent.click(screen.getByRole('link', { name: /^Utae$/ }));
  await screen.findByRole('heading', { name: '曲库' });
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
  fireEvent.click(screen.getByRole('link', { name: /^Utae$/ }));
  await screen.findAllByRole('link', { name: '练习' });
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => (finish = resolve));
  request.mockImplementation(() => pending);
  fireEvent.click(screen.getAllByRole('link', { name: '练习' })[0]);
  await screen.findByText('正在检查歌曲资源…');
  expect(screen.queryByText('mounted-player')).toBeNull();
  expect(mount.setup).toHaveBeenCalledTimes(1);
  finish(new Response(null, { status: 404 }));
  expect((await screen.findByRole('alert')).textContent).toContain('HTTP 404');
  expect(mount.setup).toHaveBeenCalledTimes(1);
});

function page(path = '/', catalog = localCatalog()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['local-sorane-catalog'], catalog);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('filters the library and distinguishes no search results from an empty library', () => {
  page('/library');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '夜の空' } });
  expect(screen.queryByRole('link', { name: '朝の光' })).toBeNull();
  expect(screen.getByRole('link', { name: '夜の空' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unmatched' } });
  expect(screen.getByRole('status').textContent).toContain('没有匹配');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
  expect(screen.getAllByRole('link', { name: '练习' })).toHaveLength(2);
});

it('opens song details without mounting audio, then enters practice through the host', async () => {
  page('/songs/a');
  expect(screen.getByRole('heading', { name: '朝の光' })).toBeTruthy();
  expect(screen.getByText('mock-2026-01')).toBeTruthy();
  expect(mount.setup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: '开始练习' }));
  await screen.findByText('mounted-player');
  expect(mount.setup).toHaveBeenCalledTimes(1);
});

it('shows permission and empty states when toggling the demo session', () => {
  page('/mine');
  expect(screen.getByRole('heading', { name: '需要登录' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '模拟登录' }));
  expect(screen.getByRole('heading', { name: '还没有私人歌曲' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '退出演示会话' }));
  expect(screen.getByRole('heading', { name: '需要登录' })).toBeTruthy();
});

it('creates a clearly marked demo job without uploading or processing audio', async () => {
  page('/uploads/new');
  expect(screen.queryByLabelText('音频文件')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '模拟登录' }));
  fireEvent.change(screen.getByLabelText('歌曲名称'), { target: { value: 'Test song' } });
  fireEvent.change(screen.getByLabelText('歌手'), { target: { value: 'Test artist' } });
  fireEvent.click(screen.getByRole('button', { name: '创建模拟任务' }));
  expect(screen.getByRole('alert').textContent).toContain('请选择音频文件');
  fireEvent.change(screen.getByLabelText('音频文件'), {
    target: { files: [new File(['sample'], 'sample.wav', { type: 'audio/wav' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建模拟任务' }));
  expect(await screen.findByRole('heading', { name: 'Test song' })).toBeTruthy();
  expect(screen.getByText('Test artist')).toBeTruthy();
  expect(screen.getByText('sample.wav')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('不会执行歌曲制作');
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '退出演示会话' }));
  expect(screen.getByRole('heading', { name: '需要登录' })).toBeTruthy();
});

it('directly opening an unknown demo job shows an explicit error', () => {
  useMockSession.setState({ signedIn: true });
  page('/processing/jobs/missing');
  expect(screen.getByRole('alert').textContent).toContain('没有这个模拟任务');
});

it.each(['/', '/songs/a'])('catalog request failure at %s is retryable', async (path) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect((await screen.findByRole('alert')).textContent).toContain('503');
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify(catalogFixture())));
  fireEvent.click(screen.getByRole('button', { name: /重试/ }));
  expect(
    await screen.findByRole(path === '/' ? 'link' : 'heading', { name: '朝の光' }),
  ).toBeTruthy();
});
