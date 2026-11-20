import { Component, type ReactNode, useState } from 'react';
import { Link, NavLink, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loadApiSong, request, type SongPage, type SongSummary } from './api';
import { useSession } from './session';
import { useSongAssets } from './catalog';
import { SoranePlayerHost } from './player/SoranePlayerHost';

class PlayerErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <p role="alert">播放器页面出错：{this.state.error}</p>
    ) : (
      this.props.children
    );
  }
}
function Failure({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="state-panel" role="alert">
      <p>{error.message}</p>
      <button onClick={retry}>重试</button>
    </div>
  );
}
function SongTable({ songs }: { songs: SongSummary[] }) {
  return (
    <div className="song-table-wrap">
      <table className="song-table">
        <thead>
          <tr>
            <th>歌曲</th>
            <th>时长</th>
            <th>版本</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr key={song.songId}>
              <td>
                <Link className="song-name" to={`/songs/${encodeURIComponent(song.songId)}`}>
                  {song.title}
                </Link>
                <span className="song-artist">{song.artist}</span>
              </td>
              <td>{formatDuration(song.durationMs / 1000)}</td>
              <td>{song.packageVersion}</td>
              <td className="row-actions">
                <Link to={`/songs/${encodeURIComponent(song.songId)}`}>详情</Link>
                <Link
                  to={`/songs/${encodeURIComponent(song.songId)}/practice?versionId=${encodeURIComponent(song.versionId)}`}
                >
                  练习
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CatalogPage({ scope = 'library' }: { scope?: 'library' | 'mine' }) {
  const session = useSession();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['songs', session.data?.id || null, scope, search, page],
    queryFn: ({ signal }) =>
      request<SongPage>(
        `/songs?scope=${scope}&keyword=${encodeURIComponent(search)}&page=${page}&size=20`,
        { signal },
      ),
    enabled: scope === 'library' || !!session.data,
    retry: false,
    staleTime: 0,
  });
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{scope === 'mine' ? '个人曲库' : '已发布歌曲'}</p>
          <h1>{scope === 'mine' ? '我的歌曲' : '曲库'}</h1>
        </div>
      </div>
      {scope === 'mine' && !session.data ? (
        <p role="status">{session.isPending ? '正在确认会话…' : '需要登录后查看私人歌曲。'}</p>
      ) : (
        <>
          <div className="catalog-toolbar">
            <label htmlFor="catalog-search">搜索曲名或歌手</label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          {query.isPending && <p role="status">正在读取歌曲…</p>}
          {query.error && <Failure error={query.error} retry={() => void query.refetch()} />}
          {query.data &&
            (query.data.items.length ? (
              <SongTable songs={query.data.items} />
            ) : (
              <p role="status">{search ? '没有匹配的歌曲。' : '暂无歌曲。'}</p>
            ))}
          {query.data && (
            <div className="row-actions">
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                上一页
              </button>
              <span>第 {page + 1} 页</span>
              <button
                disabled={(page + 1) * 20 >= query.data.total}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function SongPageView({ practice = false }: { practice?: boolean }) {
  const { songId = '' } = useParams();
  const [params] = useSearchParams();
  const versionId = params.get('versionId') || undefined;
  const session = useSession();
  const query = useQuery({
    queryKey: ['manifest', session.data?.id || null, songId, versionId],
    queryFn: ({ signal }) => loadApiSong(songId, versionId, signal),
    enabled: !session.isPending,
    staleTime: 0,
    retry: false,
  });
  const assets = useSongAssets(practice ? query.data?.catalog : undefined, songId);
  if (session.isPending || query.isPending) return <p role="status">正在读取歌曲…</p>;
  if (query.error) return <Failure error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return null;
  const { catalog, manifest } = query.data;
  const song = catalog.songs[0];
  return (
    <section className="page-section narrow-page">
      <Link className="back-link" to="/">
        返回曲库
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">已发布 · schema {manifest.schemaVersion}</p>
          <h1>{song.title}</h1>
          <p>{song.artist}</p>
        </div>
        {!practice && (
          <Link
            className="command-link"
            to={`/songs/${encodeURIComponent(songId)}/practice?versionId=${encodeURIComponent(manifest.versionId)}`}
          >
            开始练习
          </Link>
        )}
        {practice && <Link to={`/songs/${encodeURIComponent(songId)}`}>详情</Link>}
      </div>
      {practice ? (
        assets.isPending || assets.isFetching ? (
          <p role="status">正在检查歌曲资源…</p>
        ) : assets.error ? (
          <Failure error={assets.error} retry={() => void assets.refetch()} />
        ) : (
          <PlayerErrorBoundary key={`${session.data?.id}:${songId}:${manifest.versionId}`}>
            <SoranePlayerHost catalog={catalog} songId={song.id} />
          </PlayerErrorBoundary>
        )
      ) : (
        <>
          <dl className="metadata-list">
            <div>
              <dt>歌曲包版本</dt>
              <dd>{manifest.packageVersion}</dd>
            </div>
            <div>
              <dt>歌曲时长</dt>
              <dd>{formatDuration(song.duration)}</dd>
            </div>
            <div>
              <dt>歌词句数</dt>
              <dd>{song.lines.length}</dd>
            </div>
          </dl>
          <div className="lyric-preview">
            <h2>歌词预览</h2>
            {song.lines.slice(0, 5).map((line, i) => (
              <p key={line.id || i}>
                <span>{line.tokens.map((t) => t.romaji).join(' ')}</span>
                {line.translation && <small>{line.translation}</small>}
              </p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function SessionControl() {
  const session = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录操作失败。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      {session.data ? (
        <>
          <span>{session.data.username}</span>
          <button disabled={busy} onClick={() => void perform(session.logout)}>
            退出登录
          </button>
        </>
      ) : (
        <form
          className="upload-form"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() => session.login(username, password));
          }}
        >
          <label>
            账号
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={72}
            />
          </label>
          <button disabled={busy || session.isPending}>登录</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {session.error && <p role="alert">无法确认会话，请检查 API 服务。</p>}
    </div>
  );
}
function DeferredPage() {
  return (
    <section className="page-section">
      <h1>歌曲制作</h1>
      <p>上传与制作将在后续阶段接入。</p>
      <Link to="/mine">返回我的歌曲</Link>
    </section>
  );
}
function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export default function App() {
  return (
    <div className="app-shell">
      <header className="app-nav">
        <Link className="brand-link" to="/">
          Utae
        </Link>
        <nav aria-label="主导航">
          <NavLink end to="/">
            曲库
          </NavLink>
          <NavLink to="/mine">我的歌曲</NavLink>
          <NavLink to="/uploads/new">提交歌曲</NavLink>
        </nav>
        <SessionControl />
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/library" element={<CatalogPage />} />
          <Route path="/mine" element={<CatalogPage scope="mine" />} />
          <Route path="/songs/:songId" element={<SongPageView />} />
          <Route path="/songs/:songId/practice" element={<SongPageView practice />} />
          <Route path="/uploads/new" element={<DeferredPage />} />
          <Route path="/processing/jobs/:jobId" element={<DeferredPage />} />
          <Route
            path="*"
            element={
              <section className="entry">
                <h1>页面不存在</h1>
                <Link to="/">返回曲库</Link>
              </section>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
