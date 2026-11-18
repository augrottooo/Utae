import type { Catalog, Song } from '@utae/player-bridge';

export const MOCK_API_VERSION = 'utae-api-v1';

export interface ApiEnvelope<T> {
  apiVersion: typeof MOCK_API_VERSION;
  code: 'OK';
  message: '';
  data: T;
}

export interface SongSummary {
  songId: string;
  packageVersion: string;
  schemaVersion: 1;
  visibility: 'SHARED' | 'PRIVATE';
  lifecycleStatus: 'ACTIVE';
  title: string;
  artist: string;
  durationMs: number;
  lineCount: number;
  playerSong: Song;
  playerChunks: Catalog['chunks'];
}

export interface MockJob {
  jobId: string;
  songTitle: string;
  artist: string;
  fileName: string;
  status: 'QUEUED';
  progress: 0;
  createdAt: string;
  message: string;
}

const mockJobs = new Map<string, MockJob>();
const jobStoragePrefix = 'utae:mock-job:v1:';

export function envelope<T>(data: T): ApiEnvelope<T> {
  return { apiVersion: MOCK_API_VERSION, code: 'OK', message: '', data };
}

export function toSongSummary(catalog: Catalog, song: Song): SongSummary {
  return {
    songId: song.id,
    packageVersion: 'mock-2026-01',
    schemaVersion: song.schemaVersion,
    visibility: 'SHARED',
    lifecycleStatus: 'ACTIVE',
    title: song.title,
    artist: song.artist,
    durationMs: Math.round(song.duration * 1000),
    lineCount: song.lines.length,
    playerSong: song,
    playerChunks: catalog.chunks,
  };
}

export function createMockJob(songTitle: string, artist: string, fileName: string): MockJob {
  if (!songTitle.trim() || !artist.trim() || !fileName.trim()) {
    throw new Error('请填写歌曲名称、歌手并选择音频文件。');
  }
  const job: MockJob = {
    jobId: `mock-${crypto.randomUUID()}`,
    songTitle: songTitle.trim(),
    artist: artist.trim(),
    fileName,
    status: 'QUEUED',
    progress: 0,
    createdAt: new Date().toISOString(),
    message: '演示任务未连接处理服务，不会执行歌曲制作。',
  };
  mockJobs.set(job.jobId, job);
  try {
    sessionStorage.setItem(jobStoragePrefix + job.jobId, JSON.stringify(job));
  } catch {
    // In-memory navigation still works when browser storage is unavailable.
  }
  return job;
}

export function getMockJob(jobId: string): MockJob | undefined {
  const cached = mockJobs.get(jobId);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(jobStoragePrefix + jobId);
    if (!raw) return undefined;
    const job = JSON.parse(raw) as MockJob;
    if (
      job.jobId !== jobId ||
      typeof job.songTitle !== 'string' ||
      typeof job.artist !== 'string' ||
      typeof job.fileName !== 'string' ||
      typeof job.message !== 'string' ||
      typeof job.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(job.createdAt)) ||
      job.status !== 'QUEUED' ||
      job.progress !== 0
    )
      return undefined;
    return job;
  } catch {
    return undefined;
  }
}
