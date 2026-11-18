import { Component, type FormEvent, type ReactNode, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useLocalCatalog, useSongAssets } from './catalog';
import { SoranePlayerHost } from './player/SoranePlayerHost';
import { createMockJob, getMockJob, toSongSummary } from './mock-api';
import { useMockSession } from './session-store';

class PlayerErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <section className="entry" role="alert">
        <p>播放器页面出错：{this.state.error}</p>
        <Link to="/">返回曲库</Link>
      </section>
    ) : (
      this.props.children
    );
  }
}

function CatalogPage() {
  const query = useLocalCatalog();
  const [search, setSearch] = useState('');
  const songs = query.data?.songs.filter((song) =>
    `${song.title} ${song.artist}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">歌曲库 · 演示数据</p>
          <h1>曲库</h1>
        </div>
        <Link className="command-link" to="/uploads/new">
          提交歌曲
        </Link>
      </div>
      <div className="catalog-toolbar">
        <label htmlFor="catalog-search">搜索曲名或歌手</label>
        <input
          id="catalog-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="输入曲名或歌手"
        />
      </div>
      {query.isPending && <p role="status">正在读取本地歌曲包…</p>}
      {query.error && (
        <div className="inline-error" role="alert">
          <span>{query.error.message}</span>
          <button type="button" onClick={() => void query.refetch()}>
            重试
          </button>
        </div>
      )}
      {query.data && query.data.songs.length === 0 && <p role="status">暂无歌曲。</p>}
      {query.data && query.data.songs.length > 0 && songs?.length === 0 && (
        <p role="status">没有匹配的歌曲。</p>
      )}
      {query.data && songs && songs.length > 0 && (
        <div className="song-table-wrap">
          <table className="song-table">
            <thead>
              <tr>
                <th scope="col">歌曲</th>
                <th scope="col">时长</th>
                <th scope="col">歌词</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id}>
                  <td>
                    <Link className="song-name" to={`/songs/${encodeURIComponent(song.id)}`}>
                      {song.title}
                    </Link>
                    <span className="song-artist">{song.artist}</span>
                  </td>
                  <td>{formatDuration(song.duration)}</td>
                  <td>{song.lines.length} 句</td>
                  <td className="row-actions">
                    <Link to={`/songs/${encodeURIComponent(song.id)}`}>详情</Link>
                    <Link to={`/songs/${encodeURIComponent(song.id)}/practice`}>练习</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <MockNote />
    </section>
  );
}

function MySongsPage() {
  const signedIn = useMockSession((state) => state.signedIn);
  return (
    <section className="page-section narrow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">个人曲库</p>
          <h1>我的歌曲</h1>
        </div>
      </div>
      {!signedIn ? (
        <div className="state-panel" role="status">
          <h2>需要登录</h2>
          <p>当前会话没有个人曲库权限。</p>
          <p>使用顶部的演示会话切换查看空状态。</p>
        </div>
      ) : (
        <div className="state-panel" role="status">
          <h2>还没有私人歌曲</h2>
          <p>私人歌曲及任务会显示在这里。</p>
          <Link className="command-link" to="/uploads/new">
            创建模拟任务
          </Link>
        </div>
      )}
      <MockNote />
    </section>
  );
}

function SongDetailsPage() {
  const { songId } = useParams();
  const query = useLocalCatalog();
  if (query.isPending)
    return (
      <p className="entry" role="status">
        正在读取歌曲…
      </p>
    );
  if (query.error)
    return (
      <section className="entry" role="alert">
        <p>{query.error.message}</p>
        <button onClick={() => void query.refetch()}>重试加载</button>
      </section>
    );
  const song = query.data?.songs.find((entry) => entry.id === songId);
  if (!song) return <MissingSong />;
  const summary = toSongSummary(query.data!, song);
  return (
    <section className="page-section narrow-page">
      <Link className="back-link" to="/">
        返回曲库
      </Link>
      <div className="page-heading detail-heading">
        <div>
          <p className="eyebrow">已发布 · schema {summary.schemaVersion}</p>
          <h1>{summary.title}</h1>
          <p className="detail-artist">{summary.artist}</p>
        </div>
        <Link className="command-link" to={`/songs/${encodeURIComponent(song.id)}/practice`}>
          开始练习
        </Link>
      </div>
      <dl className="metadata-list">
        <div>
          <dt>歌曲包版本</dt>
          <dd>{summary.packageVersion}</dd>
        </div>
        <div>
          <dt>歌曲时长</dt>
          <dd>{formatDuration(song.duration)}</dd>
        </div>
        <div>
          <dt>歌词句数</dt>
          <dd>{song.lines.length}</dd>
        </div>
        <div>
          <dt>练习资源</dt>
          <dd>三档原曲</dd>
        </div>
      </dl>
      <div className="lyric-preview">
        <h2>歌词预览</h2>
        {song.lines.slice(0, 5).map((line, index) => (
          <p key={line.id || index}>
            <span>{line.tokens.map((token) => token.romaji).join(' ')}</span>
            {line.translation && <small>{line.translation}</small>}
          </p>
        ))}
      </div>
      <MockNote />
    </section>
  );
}

function PracticePage() {
  const { songId } = useParams();
  const query = useLocalCatalog();
  const assets = useSongAssets(query.data, songId);
  if (query.isPending)
    return (
      <p className="entry" role="status">
        正在读取本地歌曲包…
      </p>
    );
  if (query.error)
    return (
      <section className="entry" role="alert">
        <p>{query.error.message}</p>
        <button onClick={() => void query.refetch()}>重试加载</button>
      </section>
    );
  const song = query.data?.songs.find((entry) => entry.id === songId);
  if (!song || !query.data) return <MissingSong />;
  return (
    <>
      {assets.isPending || assets.isFetching ? (
        <p className="entry" role="status">
          正在检查歌曲资源…
        </p>
      ) : assets.error ? (
        <section className="entry" role="alert">
          <p>{assets.error.message}</p>
          <button onClick={() => void assets.refetch()}>重试歌曲加载</button>
          <Link to="/">返回歌曲目录</Link>
        </section>
      ) : (
        <>
          <header className="practice-heading">
            <Link to={`/songs/${encodeURIComponent(song.id)}`}>详情</Link>
            <h1>{song.title}</h1>
            <span>{song.artist}</span>
          </header>
          <PlayerErrorBoundary key={song.id}>
            <SoranePlayerHost catalog={query.data} songId={song.id} />
          </PlayerErrorBoundary>
        </>
      )}
    </>
  );
}

function UploadPage() {
  const signedIn = useMockSession((state) => state.signedIn);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn) return;
    if (!fileName) {
      setError('请选择音频文件。');
      return;
    }
    try {
      const job = createMockJob(title, artist, fileName);
      navigate(`/processing/jobs/${encodeURIComponent(job.jobId)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法创建模拟任务。');
    }
  }
  return (
    <section className="page-section narrow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">歌曲制作</p>
          <h1>提交歌曲</h1>
        </div>
      </div>
      {!signedIn ? (
        <div className="state-panel" role="alert">
          <h2>需要登录</h2>
          <p>切换演示会话后可查看表单状态。</p>
        </div>
      ) : (
        <form className="upload-form" onSubmit={submit}>
          <label>
            歌曲名称
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            歌手
            <input value={artist} onChange={(event) => setArtist(event.target.value)} required />
          </label>
          <label>
            音频文件
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => setFileName(event.target.files?.[0]?.name || '')}
            />
          </label>
          {fileName && <p className="selected-file">{fileName}</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="command-button" type="submit">
            创建模拟任务
          </button>
        </form>
      )}
      <MockNote />
    </section>
  );
}

function JobPage() {
  const { jobId = '' } = useParams();
  const signedIn = useMockSession((state) => state.signedIn);
  if (!signedIn)
    return (
      <section className="page-section narrow-page" role="alert">
        <h1>需要登录</h1>
        <p>切换演示会话后可查看模拟任务。</p>
      </section>
    );
  const job = getMockJob(jobId);
  return job ? (
    <section className="page-section narrow-page">
      <Link className="back-link" to="/mine">
        返回我的歌曲
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">制作任务 · Mock</p>
          <h1>{job.songTitle}</h1>
        </div>
      </div>
      <dl className="metadata-list">
        <div>
          <dt>歌手</dt>
          <dd>{job.artist}</dd>
        </div>
        <div>
          <dt>所选文件</dt>
          <dd>{job.fileName}</dd>
        </div>
        <div>
          <dt>任务编号</dt>
          <dd>{job.jobId}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>
            <span className="state-value">排队中 · 0%</span>
          </dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{new Date(job.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mock-warning" role="status">
        {job.message}
      </p>
      <p className="mock-note">仅保存本标签页的演示任务信息，没有上传音频或创建真实制作任务。</p>
    </section>
  ) : (
    <section className="page-section narrow-page" role="alert">
      <h1>没有这个模拟任务</h1>
      <Link to="/mine">返回我的歌曲</Link>
    </section>
  );
}

function MissingSong() {
  return (
    <section className="entry" role="alert">
      <p>当前曲库没有这首歌曲。</p>
      <Link to="/">返回曲库</Link>
    </section>
  );
}

function MockNote() {
  return (
    <p className="mock-note">
      目录来自本地歌曲包；登录、我的歌曲和制作任务为演示状态，没有连接后端。播放器收藏仍保存在本机。
    </p>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export default function App() {
  const signedIn = useMockSession((state) => state.signedIn);
  const toggleSession = useMockSession((state) => state.toggleMockSession);
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
        <button className="session-toggle" type="button" onClick={toggleSession}>
          {signedIn ? '退出演示会话' : '模拟登录'}
        </button>
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/library" element={<CatalogPage />} />
          <Route path="/mine" element={<MySongsPage />} />
          <Route path="/songs/:songId" element={<SongDetailsPage />} />
          <Route path="/songs/:songId/practice" element={<PracticePage />} />
          <Route path="/uploads/new" element={<UploadPage />} />
          <Route path="/processing/jobs/:jobId" element={<JobPage />} />
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
