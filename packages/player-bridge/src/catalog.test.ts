import { expect, it } from 'vitest';
import { rebaseCatalog } from './catalog';
import { catalogFixture } from '../../../tests/frontend/fixture';

it('rebases full audio, narration, chunk keys and stereo parts without changing timing or input', () => {
  const catalog = catalogFixture();
  const voice = { src: 'assets/read.wav', duration: 1, tokens: [{ start: 0, end: 1 }] };
  catalog.songs[0].lines[0].narration = { normal: voice, slow: voice, verySlow: voice };
  catalog.chunks = {
    'assets/one.wav': {
      sampleRate: 44100,
      frames: 44100,
      chunks: [
        {
          src: 'assets/back.wav',
          parts: ['assets/back.wav', 'assets/vocal.wav'],
          first: 0,
          last: 44100,
        },
      ],
    },
  };
  const before = JSON.stringify(catalog);
  const result = rebaseCatalog(catalog, 'http://localhost:5173/sorane/library.json');
  expect(result.songs[0].audio['1'].src).toBe('http://localhost:5173/sorane/assets/one.wav');
  expect(result.songs[0].lines[0].narration?.normal.src).toBe(
    'http://localhost:5173/sorane/assets/read.wav',
  );
  const chunk = result.chunks!['http://localhost:5173/sorane/assets/one.wav'].chunks[0];
  expect(chunk.parts?.[1]).toBe('http://localhost:5173/sorane/assets/vocal.wav');
  expect(result.songs[0].lines[0].start).toBe(1);
  expect(JSON.stringify(catalog)).toBe(before);
});

it('rejects unsupported catalogs and assets outside the prepared static directory', () => {
  const catalog = catalogFixture();
  catalog.songs[0].audio['1'].src = '../private.wav';
  expect(() => rebaseCatalog(catalog, 'http://localhost:5173/sorane/library.json')).toThrow(
    '目录内',
  );
  catalog.songs[0].audio['1'].src = 'https://other.example/audio.wav';
  expect(() => rebaseCatalog(catalog, 'http://localhost:5173/sorane/library.json')).toThrow(
    '目录内',
  );
  expect(() =>
    rebaseCatalog({ schemaVersion: 1, songs: [] }, 'http://localhost/library.json'),
  ).toThrow('非空');
});
