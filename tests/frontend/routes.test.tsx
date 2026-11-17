import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../../apps/web/src/App';
import { catalogFixture } from './fixture';

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
});

it('route leaving unmounts the player; returning mounts exactly one new host', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['local-sorane-catalog'], catalogFixture());
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/songs/a/practice']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(mount.setup).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('link', { name: 'Utae 唱吧' }));
  expect(mount.dispose).toHaveBeenCalledTimes(1);
  fireEvent.click(await screen.findByRole('link', { name: '朝の光 · Test' }));
  expect(mount.setup).toHaveBeenCalledTimes(2);
});

it('an unknown song is an explicit error and never creates a host', () => {
  const client = new QueryClient();
  client.setQueryData(['local-sorane-catalog'], catalogFixture());
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
