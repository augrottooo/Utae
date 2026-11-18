import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { mountPlayerHost, type Catalog, type PlayerSession } from '@utae/player-bridge';
import markup from '@utae/player-bridge/template';
import { useUiStore } from '../ui-store';
import styles from './SoranePlayerHost.module.css';

const subscribeNothing = () => () => {};
const emptySnapshot = () => null;

export function SoranePlayerHost({ catalog, songId }: { catalog: Catalog; songId: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const activeSession = useRef<PlayerSession | null>(null);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const showSnapshot = useUiStore((state) => state.showSnapshot);
  const toggleSnapshot = useUiStore((state) => state.toggleSnapshot);
  const snapshot = useSyncExternalStore(
    session?.subscribe || subscribeNothing,
    session?.getSnapshot || emptySnapshot,
    emptySnapshot,
  );

  useLayoutEffect(() => {
    if (!container.current) return;
    setError(null);
    try {
      const mounted = mountPlayerHost({ container: container.current, markup, catalog, songId });
      activeSession.current = mounted;
      setSession(mounted);
      return () => {
        activeSession.current = null;
        mounted.dispose();
      };
    } catch (cause) {
      activeSession.current = null;
      setSession(null);
      setError(cause instanceof Error ? cause.message : '播放器初始化失败。');
    }
  }, [catalog, songId, generation]);

  const song = catalog.songs.find((entry) => entry.id === snapshot?.songId);
  const line = song?.lines[snapshot?.currentLineIndex ?? -1];
  const perform = (action: () => void | Promise<void>) => {
    setError(null);
    try {
      // Play resolve only accepts the request; actual playing comes from the snapshot.
      Promise.resolve(action()).catch((cause: unknown) => {
        if (activeSession.current === session && !session?.getSnapshot().disposed)
          setError(cause instanceof Error ? cause.message : '播放请求失败。');
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '播放命令失败。');
    }
  };
  return (
    <section className={styles.host} aria-label="Sorane 播放器宿主">
      <div className={styles.bar}>
        <button
          type="button"
          disabled={!session || !snapshot || snapshot.loading}
          onClick={() =>
            session &&
            perform(() => (snapshot?.playing ? session.bridge.pause() : session.bridge.play()))
          }
        >
          {snapshot?.playing ? '暂停' : snapshot?.loading ? '加载中…' : '播放'}
        </button>
        <output aria-label="Bridge 播放状态">
          {snapshot
            ? `${snapshot.playing ? '播放中' : '已暂停'} · ${snapshot.positionSeconds.toFixed(1)} 秒 · ${snapshot.rate}×`
            : '正在挂载…'}
        </output>
        <button type="button" onClick={() => setGeneration((value) => value + 1)}>
          重新挂载
        </button>
        <button type="button" aria-expanded={showSnapshot} onClick={toggleSnapshot}>
          状态详情
        </button>
      </div>
      {line && (
        <p className={styles.context} aria-label="当前句罗马音">
          {line.tokens.map((token) => token.romaji).join(' ')}
        </p>
      )}
      {(error || snapshot?.error) && (
        <p role="alert" className={styles.error}>
          {error || snapshot?.error?.message}
        </p>
      )}
      {showSnapshot && (
        <pre className={styles.snapshot} aria-label="Bridge Snapshot">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
      {/* React never renders children inside this node: Sorane owns its DOM and media. */}
      <div ref={container} className={styles.player} data-testid="sorane-dom" />
    </section>
  );
}
