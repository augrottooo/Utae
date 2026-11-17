import { Component, type ReactNode } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useLocalCatalog } from './catalog';
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
      <p>本地歌曲包入口 · 1B 宿主验证</p>
      <p>当前仅加载本机已有的 Sorane 构建结果。合成音示例用于验证播放与歌词同步。</p>
      {query.isPending && <p role="status">正在读取本地歌曲包…</p>}
      {query.error && (
        <div role="alert">
          <p>{query.error.message}</p>
          <button onClick={() => void query.refetch()}>重试加载</button>
        </div>
      )}
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
      <header className="practice-heading">
        <h1>{song.title}</h1>
        <span>{song.artist}</span>
      </header>
      <PlayerErrorBoundary key={song.id}>
        <SoranePlayerHost catalog={query.data} songId={song.id} />
      </PlayerErrorBoundary>
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
