import { afterEach, expect, it, vi } from 'vitest';
import { catalogFixture } from './fixture';
import {
  createMockJob,
  envelope,
  getMockJob,
  MOCK_API_VERSION,
  toSongSummary,
} from '../../apps/web/src/mock-api';

afterEach(() => sessionStorage.clear());

it('wraps responses with a versioned mock API envelope', () => {
  expect(envelope({ ok: true })).toEqual({
    apiVersion: MOCK_API_VERSION,
    code: 'OK',
    message: '',
    data: { ok: true },
  });
});

it('keeps task ids unique even for submissions in the same millisecond', () => {
  const first = createMockJob(' Song ', ' Artist ', 'one.wav');
  const second = createMockJob('Song', 'Artist', 'two.wav');
  expect(first.jobId).not.toBe(second.jobId);
  expect(first.songTitle).toBe('Song');
  expect(first.artist).toBe('Artist');
  expect(getMockJob(first.jobId)).toEqual(first);
  expect(() => createMockJob('  ', 'Artist', 'one.wav')).toThrow();
});

it('restores only valid demo metadata after a module reload', async () => {
  const job = createMockJob('Song', 'Artist', 'audio.wav');
  vi.resetModules();
  const reloaded = await import('../../apps/web/src/mock-api');
  expect(reloaded.getMockJob(job.jobId)).toEqual(job);
  sessionStorage.setItem('utae:mock-job:v1:broken', '{');
  expect(reloaded.getMockJob('broken')).toBeUndefined();
  sessionStorage.setItem(
    'utae:mock-job:v1:invalid',
    JSON.stringify({ ...job, jobId: 'invalid', status: 'SUCCEEDED' }),
  );
  expect(reloaded.getMockJob('invalid')).toBeUndefined();
});

it('maps the Sorane player song without changing seconds or losing chunk manifests', () => {
  const catalog = catalogFixture();
  catalog.chunks = {
    'assets/one.wav': {
      sampleRate: 44100,
      frames: 24 * 44100,
      chunks: [{ src: 'assets/part.wav', first: 0, last: 24 * 44100 }],
    },
  };
  const song = catalog.songs[0];
  const summary = toSongSummary(catalog, song);
  expect(summary.schemaVersion).toBe(1);
  expect(summary.packageVersion).not.toBe(String(summary.schemaVersion));
  expect(summary.durationMs).toBe(song.duration * 1000);
  expect(summary.playerSong).toBe(song);
  expect(summary.playerSong.lines).toEqual(song.lines);
  expect(summary.playerChunks).toBe(catalog.chunks);
});
