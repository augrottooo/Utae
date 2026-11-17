/** Built Sorane schema 1 catalog subset used by the retained player; times are seconds. */
export type SongRate = 0.5 | 0.75 | 1;
export type ReadSpeed = 'normal' | 'slow' | 'verySlow';
export type PracticeScope =
  | { kind: 'full' }
  | { kind: 'line'; lineIndex: number }
  | { kind: 'section'; startIndex: number; endIndex: number };
export type LoopKind = 'none' | PracticeScope['kind'];
export interface Token {
  jp: string;
  kana: string;
  romaji: string;
  start: number;
  end: number;
  ruby?: { text: string; reading?: string }[];
  readingParts?: string[];
}
export interface Narration {
  src: string;
  duration: number;
  tokens: { start: number; end: number }[];
}
export interface LyricLine {
  id?: string;
  jp: string;
  section: string;
  start: number;
  end: number;
  clipStart?: number;
  clipEnd?: number;
  translation?: string;
  tokens: Token[];
  narration?: Record<ReadSpeed, Narration>;
}
export interface Song {
  schemaVersion: 1;
  id: string;
  title: string;
  artist: string;
  duration: number;
  audio: Record<`${SongRate}`, { src: string }>;
  lines: LyricLine[];
}
export interface Chunk {
  src: string;
  parts?: string[];
  first: number;
  last: number;
  decodedFrames?: number;
  trimStart?: number;
  postRoll?: number;
}
export interface ChunkManifest {
  sampleRate: 44100;
  frames: number;
  chunks: Chunk[];
}
export interface Catalog {
  schemaVersion: 1;
  songs: Song[];
  chunks?: Record<string, ChunkManifest>;
}
/** Actual 1A snapshot, not the future loadPackage contract. */
export interface PlayerSnapshot {
  songId: string | null;
  positionSeconds: number;
  sourcePositionSeconds: number;
  durationSeconds: number | null;
  currentLineIndex: number | null;
  playing: boolean;
  playIntent: boolean;
  loading: boolean;
  source: 'song' | 'reading' | null;
  scope: PracticeScope;
  pendingScope: PracticeScope['kind'] | null;
  rate: SongRate;
  loop: { kind: LoopKind };
  error: { code: string; message: string } | null;
  clockSource: string;
  disposed: boolean;
}
export interface PlayerBridge {
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void;
  loadSong(id: string): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  selectLine(index: number, autoplay?: boolean): void;
  setPracticeScope(scope: PracticeScope): void;
  setRate(rate: SongRate): void;
  setLoop(kind: LoopKind): void;
  dispose(): void;
}
export interface BridgeOptions {
  catalog: Catalog;
  root: HTMLElement;
  songId: string;
}
export type BridgeFactory = (options: BridgeOptions) => PlayerBridge;
