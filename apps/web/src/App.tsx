import { Component, type ReactNode } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useLocalCatalog, useSongAssets } from './catalog';
import { SoranePlayerHost } from './player/SoranePlayerHost';

class PlayerErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <section className="entry" role="alert">
        <p>播放器页面出错：{this.state.error}</p>
        <Link to="/">返回本地入口</Link>
      </section>
    ) : (
      this.props.children
    );
  }
}

function LocalEntry() {
  const query = useLocalCatalog();
  return (
    <section className="entry">
      <h1>从一首歌开始精听</h1>
      <p>本地歌曲目录</p>
      <p>选择已准备的歌曲开始练习。音频、歌词与读音来自同一个歌曲包。</p>
      {query.isPending && <p role="status">正在读取本地歌曲包…</p>}
      {query.error && (
        <div role="alert">
          <p>{query.error.message}</p>
          <button onClick={() => void query.refetch()}>重试加载</button>
        </div>
      )}
      {query.data?.songs.length === 0 && <p role="status">本地曲库暂无歌曲。</p>}
      {query.data && (
        <ul>
          {query.data.songs.map((song) => (
            <li key={song.id}>
              <Link to={`/songs/${encodeURIComponent(song.id)}/practice`}>
                {song.title} · {song.artist}
              </Link>
            </li>
          ))}
        </ul>
      )}
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
  if (!song || !query.data)
    return (
      <p className="entry" role="alert">
        当前本地曲库没有这首歌曲。
      </p>
    );
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

export default function App() {
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Utae 导航">
        <Link to="/">Utae 唱吧</Link>
        <span>精听与逐句练习</span>
      </nav>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<LocalEntry />} />
          <Route path="/songs/:songId/practice" element={<PracticePage />} />
          <Route
            path="*"
            element={
              <section className="entry">
                <h1>页面不存在</h1>
                <Link to="/">返回本地入口</Link>
              </section>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
