import type { Catalog, PlayerSnapshot } from '@utae/player-bridge';

export function catalogFixture(): Catalog {
  return {
    schemaVersion: 1,
    songs: ['a', 'b'].map((id) => ({
      schemaVersion: 1,
      id,
      title: id === 'a' ? '朝の光' : '夜の空',
      artist: 'Test',
      duration: 24,
      audio: {
        '1': { src: 'assets/one.wav' },
        '0.75': { src: 'assets/slow.wav' },
        '0.5': { src: 'assets/slower.wav' },
      },
      lines: [1, 7, 13, 19].map((start, index) => ({
        id: String(index),
        jp: '朝の光',
        section: '練習',
        start,
        end: start + 3.8,
        tokens: [{ jp: '朝', kana: 'あさ', romaji: 'asa', start, end: start + 1 }],
      })),
    })),
    chunks: {},
  };
}
export function snapshotFixture(songId = 'a'): PlayerSnapshot {
  return {
    songId,
    positionSeconds: 0,
    sourcePositionSeconds: 0,
    durationSeconds: 24,
    currentLineIndex: 0,
    playing: false,
    playIntent: false,
    loading: false,
    source: 'song',
    scope: { kind: 'full' },
    pendingScope: null,
    rate: 1,
    loop: { kind: 'full' },
    error: null,
    clockSource: 'test-clock',
    disposed: false,
  };
}
