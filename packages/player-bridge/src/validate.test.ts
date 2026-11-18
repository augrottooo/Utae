import { expect, it } from 'vitest';
import { validateCatalog, assetPath } from './validate';
import { rebaseCatalog } from './catalog';
import { catalogFixture } from '../../../tests/frontend/fixture';

it.each([
  ['schema', (c: any) => (c.schemaVersion = 2)],
  ['duplicate song', (c: any) => (c.songs[1].id = 'a')],
  ['missing rate', (c: any) => delete c.songs[0].audio['0.5']],
  ['invalid duration', (c: any) => (c.songs[0].duration = Infinity)],
  ['overlap', (c: any) => (c.songs[0].lines[1].start = 2)],
  ['missing romaji', (c: any) => delete c.songs[0].lines[0].tokens[0].romaji],
  ['token outside line', (c: any) => (c.songs[0].lines[0].tokens[0].end = 20)],
  ['invalid clip', (c: any) => (c.songs[0].lines[0].clipStart = 2)],
  ['invalid narration', (c: any) => (c.songs[0].lines[0].narration = {})],
])('rejects %s before creating any player', (_, change) => {
  const catalog = catalogFixture();
  change(catalog);
  expect(() => validateCatalog(catalog)).toThrow('歌曲包');
});

it.each([
  '../private.wav',
  '%2e%2e/private.wav',
  'assets/%252e%252e/x',
  'https://other/a',
  '/outside/a',
  'assets\\x',
  'assets/a?x',
  'assets/a#x',
])('rejects unsafe asset %s', (path) => {
  expect(() => assetPath(path)).toThrow('目录内');
});

function chunked() {
  const catalog = catalogFixture();
  catalog.chunks = {
    'assets/one.wav': {
      sampleRate: 44100,
      frames: 24 * 44100,
      chunks: [
        {
          src: 'assets/back.wav',
          parts: ['assets/back.wav', 'assets/voice.wav'],
          first: 0,
          last: 24 * 44100,
        },
      ],
    },
  };
  return catalog;
}
it.each([
  ['gap', (c: any) => (c.chunks['assets/one.wav'].chunks[0].first = 1)],
  [
    'duration',
    (c: any) => {
      c.chunks['assets/one.wav'].frames = 44100;
      c.chunks['assets/one.wav'].chunks[0].last = 44100;
    },
  ],
  ['sample rate', (c: any) => (c.chunks['assets/one.wav'].sampleRate = 48000)],
  ['decoded frames', (c: any) => (c.chunks['assets/one.wav'].chunks[0].decodedFrames = 2)],
  ['stereo parts', (c: any) => (c.chunks['assets/one.wav'].chunks[0].parts = ['assets/voice.wav'])],
])('rejects invalid chunk %s', (_, change) => {
  const catalog = chunked();
  change(catalog);
  expect(() => validateCatalog(catalog)).toThrow('歌曲包');
});

it('preserves lyrics, romaji, timing, optional fields and unknown upstream extensions', () => {
  const catalog = chunked();
  Object.assign(catalog.songs[0].lines[0].tokens[0], {
    ruby: [{ text: '朝', reading: 'あさ' }],
    readingParts: ['a', 'sa'],
  });
  Object.assign(catalog.songs[0], { futureMetadata: 'retained' });
  const before = JSON.stringify(catalog);
  const mapped = rebaseCatalog(catalog, 'http://localhost/sorane/library.json');
  expect(mapped.songs[0].lines).toEqual(catalog.songs[0].lines);
  expect(mapped.songs[0]).toHaveProperty('futureMetadata', 'retained');
  expect(JSON.stringify(catalog)).toBe(before);
});
it('represents a valid empty catalog without constructing a player', () => {
  expect(
    rebaseCatalog({ schemaVersion: 1, songs: [] }, 'http://localhost/sorane/library.json').songs,
  ).toEqual([]);
});
