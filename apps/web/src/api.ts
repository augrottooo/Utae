import { apiCatalog, type Catalog } from '@utae/player-bridge';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface Account {
  id: string;
  username: string;
  role: string;
}
export interface SongSummary {
  songId: string;
  title: string;
  artist: string;
  durationMs: number;
  versionId: string;
  packageVersion: string;
  schemaVersion: 1;
  visibility: 'SHARED' | 'PRIVATE';
  lifecycleStatus: string;
}
export interface SongPage {
  items: SongSummary[];
  page: number;
  size: number;
  total: number;
}
export interface Manifest {
  songId: string;
  versionId: string;
  packageVersion: string;
  schemaVersion: 1;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', '后端响应不可用，请检查 API 服务。');
  }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('utae:unauthenticated'));
    throw new ApiError(
      response.status,
      body.code || 'REQUEST_FAILED',
      body.message || '请求失败。',
    );
  }
  if (body.apiVersion !== 'utae-api-v1' || body.code !== 'OK')
    throw new ApiError(502, 'INVALID_RESPONSE', 'API 契约不兼容。');
  return body.data as T;
}
export async function write<T>(path: string, data?: unknown): Promise<T> {
  const csrf = await request<{ token: string; headerName: string }>('/auth/csrf');
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
export async function loadApiSong(
  songId: string,
  versionId: string | undefined,
  signal?: AbortSignal,
): Promise<{ catalog: Catalog; manifest: Manifest }> {
  const data = await request<Manifest>(
    `/songs/${encodeURIComponent(songId)}/manifest${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''}`,
    { signal },
  );
  return { catalog: apiCatalog(data, window.location.origin), manifest: data };
}
