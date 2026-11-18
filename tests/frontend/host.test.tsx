import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeOptions, PlayerBridge, PlayerSnapshot } from '@utae/player-bridge';
import { mountPlayerHost } from '@utae/player-bridge';
import { SoranePlayerHost } from '../../apps/web/src/player/SoranePlayerHost';
import { useUiStore } from '../../apps/web/src/ui-store';
import { catalogFixture, snapshotFixture } from './fixture';

const original = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../../web/src/player-bridge.js', () => ({ createPlayerBridge: original.create }));

function fakePlayer(options: BridgeOptions) {
  let snapshot = snapshotFixture(options.songId);
  const listeners = new Set<(value: PlayerSnapshot) => void>();
  const audio = options.root.querySelector('audio');
  const unsubscribe = vi.fn();
  const bridge: PlayerBridge = {
    getSnapshot: () => ({ ...snapshot }),
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
        unsubscribe();
      };
    },
    loadSong: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    seek: vi.fn(),
    selectLine: vi.fn(),
    setRate: vi.fn(),
    setPracticeScope: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(() => {
      snapshot = { ...snapshot, disposed: true, playing: false };
      audio?.replaceWith(audio.cloneNode());
    }),
  };
  return {
    bridge,
    audio,
    unsubscribe,
    emit(next: Partial<PlayerSnapshot>) {
      snapshot = { ...snapshot, ...next };
      for (const listener of listeners) listener({ ...snapshot });
    },
  };
}
let players: ReturnType<typeof fakePlayer>[] = [];
beforeEach(() => {
  players = [];
  useUiStore.setState({ showSnapshot: false });
  original.create.mockImplementation((options: BridgeOptions) => {
    const player = fakePlayer(options);
    players.push(player);
    return player.bridge;
  });
});
afterEach(() => {
  original.create.mockReset();
});

describe('React host lifecycle', () => {
  it('StrictMode setup-cleanup-setup creates fresh audio and disposes subscriptions', () => {
    const view = render(
      <StrictMode>
        <SoranePlayerHost catalog={catalogFixture()} songId="a" />
      </StrictMode>,
    );
    expect(players).toHaveLength(2);
    expect(players[0].bridge.dispose).toHaveBeenCalledTimes(1);
    expect(players[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(players[0].audio).not.toBe(players[1].audio);
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    view.unmount();
    expect(players[1].bridge.dispose).toHaveBeenCalledTimes(1);
    expect(players[1].unsubscribe).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('audio')).toHaveLength(0);
  });

  it('renders only emitted playback state and sends commands through Bridge', async () => {
    render(<SoranePlayerHost catalog={catalogFixture()} songId="a" />);
    fireEvent.click(screen.getByRole('button', { name: /^播放$/ }));
    expect(players[0].bridge.play).toHaveBeenCalledTimes(1);
    // play() resolving must not invent a playing state.
    await act(async () => {});
    expect(screen.getByLabelText('Bridge 播放状态').textContent).toContain('已暂停');
    act(() => players[0].emit({ playing: true, playIntent: true, positionSeconds: 7.5 }));
    expect(screen.getByLabelText('Bridge 播放状态').textContent).toContain('播放中 · 7.5 秒');
    fireEvent.click(screen.getByRole('button', { name: /^暂停$/ }));
    expect(players[0].bridge.pause).toHaveBeenCalledTimes(1);
  });

  it('song changes and explicit remount destroy old instances and ignore late snapshots', () => {
    const catalog = catalogFixture();
    const view = render(<SoranePlayerHost catalog={catalog} songId="a" />);
    const previous = players[0];
    view.rerender(<SoranePlayerHost catalog={catalog} songId="b" />);
    expect(previous.bridge.dispose).toHaveBeenCalledTimes(1);
    act(() => previous.emit({ playing: true, positionSeconds: 99 }));
    expect(screen.getByLabelText('Bridge 播放状态').textContent).toContain('0.0 秒');
    fireEvent.click(screen.getByRole('button', { name: '重新挂载' }));
    expect(players[1].bridge.dispose).toHaveBeenCalledTimes(1);
    expect(players[2].audio).not.toBe(players[1].audio);
  });

  it('shows initialization failure and permits a fresh retry', () => {
    original.create.mockImplementationOnce(() => {
      throw new Error('mount failed');
    });
    render(<SoranePlayerHost catalog={catalogFixture()} songId="a" />);
    expect(screen.getByRole('alert').textContent).toContain('mount failed');
    fireEvent.click(screen.getByRole('button', { name: '重新挂载' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(players).toHaveLength(1);
  });

  it('rejects a second live host and caches snapshot identity until a notification', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const config = {
      container: first,
      markup: '<audio id="audio"></audio>',
      catalog: catalogFixture(),
      songId: 'a',
    };
    const session = mountPlayerHost(config);
    expect(session.getSnapshot()).toBe(session.getSnapshot());
    expect(() => mountPlayerHost({ ...config, container: second })).toThrow('只允许一个');
    session.dispose();
    session.dispose();
    expect(players[0].bridge.dispose).toHaveBeenCalledTimes(1);
    const next = mountPlayerHost({ ...config, container: second });
    next.dispose();
  });
});

it('a rejected old play request after switching songs cannot display an error in the new host', async () => {
  const catalog = catalogFixture();
  const view = render(<SoranePlayerHost catalog={catalog} songId="a" />);
  let reject!: (cause: Error) => void;
  vi.mocked(players[0].bridge.play).mockImplementationOnce(
    () => new Promise((_, fail) => (reject = fail)),
  );
  fireEvent.click(screen.getByRole('button', { name: /^播放$/ }));
  view.rerender(<SoranePlayerHost catalog={catalog} songId="b" />);
  await act(async () => reject(new Error('old song failed')));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(players[0].unsubscribe).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('audio')).toHaveLength(1);
});

it('retains the upstream lyric directory control while hiding only the routed song picker', () => {
  render(<SoranePlayerHost catalog={catalogFixture()} songId="a" />);
  expect(screen.getByRole('button', { name: /^歌词$/ })).toBeTruthy();
  expect(document.querySelector<HTMLElement>('.song-title')?.hidden).toBe(true);
  expect(document.querySelector<HTMLElement>('.topbar')?.hidden).toBe(false);
});
