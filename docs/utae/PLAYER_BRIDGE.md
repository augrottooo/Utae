# PlayerBridge 集成方案

阶段状态（2026-11-17）：**1A、1B 完成并推送**，当前开发基线为 `5fc32044`，checks #4、demo #4 及 1B 用户浏览器验收通过（用户确认）。本轮 1C 本地歌曲包加载与校验的实现、测试及真实歌曲包桌面验证及剩余限制见 [1C 报告](PLAYER_BRIDGE_1C_REPORT.md)。[1A 报告](PLAYER_BRIDGE_1A_REPORT.md) 和 [1B 报告](PLAYER_BRIDGE_1B_REPORT.md) 保留原阶段证据；下面完整 Bridge API 仍是目标契约。

## 事实边界

当前 Sorane Player 已有能力和目标 Bridge 接口必须分开记录。

### 冻结基线已有（80f04d6，1A 修改前）

在 Player commit `80f04d69070b0816d2c8335e1b782df2f2dd7e13` 中：

- `web/src/audio/transport.js` 提供 HTMLAudio/Web Audio PCM loop 的统一 transport，包含播放、暂停、seek、时间快照和媒体事件转发所需的内部能力。
- `web/src/audio/chunks.js` 提供分块查找、预取、循环、断流恢复和取消过期请求。
- `web/src/audio/decoder.js`、`cache.js`、`mixer.js`、`timeline.js` 分别提供解码后备、Cache Storage、四声道混音和速度时间映射。
- `web/src/player.js` 的 `createPlayer({ songs, cache, decoder })` 在固定页面 DOM 上建立一个控制器。内部已经维护歌曲、当前句、练习范围、循环、速度、播放意图和 playback session。
- 当前页面已经支持全曲、逐句、逐段、循环、三档速度、读音/原曲切换、歌词高亮和点击歌词跳转。

### 冻结基线未提供（80f04d6，1A 修改前）

基线 `createPlayer` 没有对外返回一个已定义的 `play/pause/seek/selectLine/setRate/snapshot/subscribe/dispose` 契约；它主要通过 `document.getElementById(...)`、固定事件监听器和闭包状态驱动页面。基线 `web/index.html` 也没有 React mount point 或多实例容器。

1A 已修改 `player.js` 并实现 controller、快照、订阅及 dispose；原位 `web/src/player-bridge.js` 接收 catalog、root、songId，支持 catalog 内 loadSong。Mixer/Transport 增加实例销毁接口，Host 替换 audio 元素后重建。下面完整 Bridge API 仍是目标草案，特别是跨 catalog 的 loadPackage 尚未实现，不能混同为全部已经交付。

## 固定 DOM、实例和 React 宿主

目标关系如下：

```text
React route
  └─ SoranePlayerHost (React owns mount/unmount)
       └─ player DOM integration host (strategy selected by 1A)
            └─ PlayerBridge (owns controller and event adapter)
                 └─ createPlayer(...) in web/src/player.js
                      ├─ audio/transport.js
                      ├─ audio/chunks.js
                      ├─ audio/decoder.js
                      ├─ audio/cache.js
                      ├─ audio/mixer.js
                      └─ timeline.js
```

React owns the host lifecycle and renders the Utae business UI. The Bridge owns one Sorane controller instance and translates React commands/events. Sorane remains the only owner of audio time, playback mode, loop boundaries and current lyric calculation.

1A 保留 global ID 与 container-scoped lookup 的原型对照，用户已确认浏览器测试通过。重建边界已明确为替换 audio 元素；固定 ID、全局 CSS、dialog 和单实例约束仍在。1B 已实现单实例宿主：直接读取现有 `web/index.html` 模板并去除脚本，将播放器 DOM 导入 React 容器；每次重挂创建新节点。宿主布局经用户浏览器验收，固定 ID 和全局样式仍保留，不支持多实例。

## Target Bridge contract (design, not current API)

```ts
type PracticeScope =
  | { kind: 'full' }
  | { kind: 'line'; lineIndex: number }
  | { kind: 'section'; startIndex: number; endIndex: number };

type PlayerSnapshot = {
  songId: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  currentLineIndex: number | null;
  playing: boolean;
  loading: boolean;
  source: 'song' | 'reading' | null;
  scope: PracticeScope;
  rate: number;
  loop: { kind: 'none' | 'line' | 'section' };
  error: { code: string; message: string } | null;
};

interface PlayerBridge {
  loadPackage(input: { song: SoraneSongEntry; chunks: SoraneChunkIndex }): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  selectLine(lineIndex: number, autoplay?: boolean): void;
  setPracticeScope(scope: PracticeScope): void;
  setLoop(loop: 'none' | 'line' | 'section'): void;
  setRate(rate: 0.5 | 0.75 | 1): void;
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void;
  dispose(): void;
}
```

The names and payloads above remain a target draft. `SoraneSongEntry` must be the real schema 1 song entry after mapping, and `SoraneChunkIndex` must preserve the top-level chunk map consumed by `createChunkedAudio`; neither is the business API wrapper. 1A 已实现 subscribe，并为上游整曲循环保留 full loop；实际方法签名及 play Promise 语义见验收报告。

## 1A 原计划与实现边界

以下保留阶段原计划。1A 已交付最小 controller、快照、订阅和生命周期；第 6 项实现的是 catalog 工厂及 loadSong，并非目标 loadPackage。最终结果见验收报告。

1. In 1A, prototype the smallest viable DOM boundary: keep global IDs as a control case, test container-scoped lookup and test a DOM adapter only where the current code requires it. Select the strategy from measured layout, event and lifecycle results; do not decide the final compatibility DOM shape in advance.
2. Return a controller object exposing the minimum command methods used by the Bridge. Existing DOM listeners may call the same methods so the legacy page keeps working during migration.
3. Add an explicit snapshot builder that reads the existing playback session and transport state. Do not create a second timer or infer position in React.
4. Add one event emitter for state changes (`play`, `pause`, `timeupdate`, line changes, loading, waiting, playing, ended and error), with unsubscribe support.
5. Add disposal/cancellation for event listeners, pending loads/seeks and controller-owned transport resources. 已实现 Transport 监听器解绑与会话销毁、Mixer 节点清理和独占 AudioContext 关闭；后台缓存/下载的生命周期仍独立，不宣称全部后台任务可取消。
6. Add a manifest/song-loading entry point that can replace the current static `main.js` setup without changing the `audio/*` modules in the first spike.

`web/src/main.js` will eventually become the adapter bootstrap or be bypassed by React. `web/src/audio/*`, `timeline.js` and their tests remain imported from their existing locations until integration tests prove a move is safe.

## Stage 1 split

### 1A — Bridge feasibility spike

状态：**完成**。本轮使用本地合成音 schema 1 包；真实歌曲包兼容性尚未验证。

- Keep the current static page and current directories.
- Modify only the smallest surface of `web/src/player.js` (plus a test harness if needed) to expose a controller, snapshot and unsubscribe event stream.
- Prove command/DOM behavior with a valid schema 1 song package: load, play/pause, seek, line selection, scope, loop, rate and error cancellation. 本轮证据来自本地合成音包，不代表真实歌曲包兼容性通过。
- Record which global IDs, internal closures, layout assumptions and media events prevent container scoping or disposal, and compare them with the control case.
- Do not create the React app or move/copy the audio modules in this step.

Exit criteria: the proposed Bridge contract can drive the existing player behavior, or the blocked methods and required redesign are documented with failing tests.

### 1B — React host integration

状态：**本轮验收通过，待确认提交**（2026-11-17）。`packages/player-bridge` 提供实际 1A 接口的 TypeScript 边界、catalog 资产映射和单实例 `mountPlayerHost`；`apps/web` 提供 React 宿主和路由。React 通过缓存的通知快照订阅状态，卸载时先取消订阅、清空监听器，再 dispose Bridge 并丢弃旧 DOM。StrictMode、切歌、重挂和过期快照隔离已有自动化覆盖；用户实际浏览器验收通过。

- Create the smallest React host around the proven controller.
- Mount exactly one DOM host using the strategy selected by 1A, with one Bridge instance per practice route.
- Before adding React dependencies, select the repository packaging boundary. The current choice is an npm workspace in the same repository (`apps/web` and `packages/player-bridge`) so the existing Sorane root package/lock remains the source of the first integration. Verify the root `package.json`/lock compatibility before adding workspace entries; do not install dependencies during 1A or before that decision is recorded.
- Render React lyrics and controls from Bridge snapshots; React Query and Zustand remain outside the playback clock.
- Verify route unmount, remount, song switch, stale async cancellation and browser playback regression.

Exit criteria: real browser playback and synchronization work through React while the Sorane modules retain their original paths and tests.

Only after 1A and 1B pass may the team decide whether any proven modules should move into the selected workspace packages. A directory move is not part of the first prototype.

## Ownership and errors

1B 的 `SoranePlayerHost` 已持有 Bridge session，并在卸载、切歌和显式重挂时 dispose；单实例锁在正常清理及初始化失败时均释放。1A 的 Bridge 持有 controller、订阅和布局观察；controller 先停 transport、清理会话及监听器，再释放 mixer 图并关闭 mixer 独占的 AudioContext。context 仅在同一实例内部由 mixer、transport 和 chunk session 共用，未采用跨播放器全局 context。关闭 context 不解除原 audio 的媒体源关联，Host 采用替换整个 audio 元素的策略。

cache、decoder 和 chunk engine 由每次工厂调用创建，持久 Cache Storage 可共享；1A 没有新增缓存驱逐或全部后台下载取消接口。浏览器自动播放拒绝、网络等待、解码失败和歌曲制作失败仍是不同状态。1A 的浏览器证据及其范围以报告为准。

## 1C 已实现的加载边界

`loadCatalog` 获取 Python build 的公开 `library.json`，先 `validateCatalog` 再 `rebaseCatalog`；校验必需字段、原曲秒数、歌词/token、读音相对时间、分块帧覆盖和包内路径。URL 映射保留顶层 chunks 键、双声部 parts、完整音频 fallback 和扩展字段，不改变上游 schema。

练习页通过 Query 的 AbortSignal 对所选歌曲的整曲/分块/双声部/读音 URL 做有界预检（每批最多 4 个）。HEAD 不支持时退回 `Range: bytes=0-0` 并取消响应体；预检不解码音频，服务器忽略 Range 时无法保证只传一个字节。缺失、空响应、HTML 回退或重定向阻止挂载，可重试；离页取消，返回缓存歌曲也需预检成功。此检查只证明请求时资源可访问，不能证明解码或听感正确，也不能保证之后网络不变。

真实包验收发现 Host 隐藏整个 `.topbar` 使歌词目录不可达，现改为只隐藏 React 已接管的 `.song-title`，保留上游歌词目录按钮和原控制器事件路径。Host 仍经现有 `mountPlayerHost` 创建/销毁 Bridge；旧 play Promise 的拒绝只允许更新原活动会话。没有增加跨 catalog 的 `loadPackage` API，没有修改 Sorane 音频核心、第二套时钟或播放状态。
