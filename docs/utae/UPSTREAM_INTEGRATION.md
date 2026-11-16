# Sorane Player / Studio 上游核查

## 核查范围和版本

本文件保留 `80f04d6` 提交的源码核查基线，不能等同于含未提交 1A 修改的工作区状态。2026-11-16 阶段 **1A 已完成，1B 未开始**；后续实现及验收证据见 [1A 报告](PLAYER_BRIDGE_1A_REPORT.md)。

- Player 本地路径：`C:\Users\hj\Projects\utae`。
- Player HEAD：`80f04d69070b0816d2c8335e1b782df2f2dd7e13`，其上游基线为 `15bb3bb7dd05430af18120bfbc1ef2558322308b`。
- Player 当前分支：`main`，remote：`git@github.com:augrottooo/Utae.git`。
- Player 声明：Node >=24、Python >=3.12、包版本 0.1.0、歌曲包 schema 1 / format revision 1.0.0。
- Schema 文件对比：当前 Player HEAD `80f04d69070b0816d2c8335e1b782df2f2dd7e13` 与上游基线 `15bb3bb7dd05430af18120bfbc1ef2558322308b` 的 `docs/data-format.md`、`lyric_player/schema.py`、`format-version.json` 一致；只确认了这些 schema 契约文件，不代表两提交的全部代码/fixture 相同。Utae 当前映射以实际使用的 Player HEAD 为准，后续版本变化时重新对比。
- Studio 当前核查基线：`b63633f5381a582e851a953409583c4679b098c5`（`main`，2026-10-20，提交“增加Nanami三档读音合成和词时间记录”）。该 commit 来自 GitHub API 和源码读取，不代表本地已安装或运行。

## Player 源码确认

当前新仓库的顶层结构是 `web/`、`lyric_player/`、`server/`、`examples/`、`tests/` 和 `docs/`，并由 `package.json`、`pyproject.toml`、`compose.yaml` 和 `Dockerfile` 提供开发/预览入口。这里没有 React、Vue、Java 或业务数据库目录。

### 加载和构建

`web/src/main.js` 请求 `library.json`，创建 `createAudioCache`、`createDecoder`、`createChunkedAudio`、`createPlayer`、歌曲选择器、歌词布局和手势绑定。`lyric_player/__main__.py` 仅注册 `demo`、`build`、`validate` 三个命令；`lyric_player/build.py` 校验 `data/songs/*/song.json`，复制并按内容哈希生成 `build/` 和 `library.json`。`server/http.py` 只提供静态预览和 `/health`。

### 播放和歌词

- `web/src/player.js` 通过固定 DOM ID 建立一个播放器控制器，集中维护歌曲、句子、全曲/逐句/逐段范围、读音/原曲、循环和速度。
- `web/src/audio/transport.js` 把 HTMLAudio 和 Web Audio PCM loop 统一为 transport，使用音频上下文时钟。
- `web/src/audio/chunks.js` 按 44.1kHz 采样帧调度分块，支持预取、循环、缓存淘汰、断流恢复和取消过期请求。
- `web/src/audio/decoder.js` 提供整段解码后备；`cache.js` 使用 Cache Storage 保存压缩资产；`mixer.js` 拆分四声道并控制伴奏、人声和朗读。
- `web/src/timeline.js` 把原曲时间映射到 1、0.75、0.5 三档预制音频；`lyrics.js`、`layout.js` 负责文字和词级高亮。

### 当前测试边界

基线源码包含 `tests/chunks.test.js`、`tests/timeline.test.js`、`tests/test_format.py`、`test_build.py`、`test_demo_site.py` 和 `test_server.py`。最初只读核查时未运行测试。后续 1A 显式调用已有 Node 24.22.1、Python 3.13.13，实际项目 JS 17/17、Python 7/7 通过（含新增测试）；本地合成音包的浏览器与生命周期验收获用户确认。真实歌曲包、人声朗读和移动设备尚未验证；全局环境与可移植工具链状态没有因此改变。

## 复用和替换结论

**保留核心与原位目录**：audio transport、chunks、decoder、cache、mixer、timeline、歌曲包 schema/校验和相关测试。1A 对 mixer/transport 增补实例生命周期接口，未重写调度算法。

**通过适配器使用**：`player.js` 的播放控制和固定 DOM 行为；第一阶段做单实例 `PlayerBridge`，逐步把命令和快照变成显式接口。

**由 React 替换**：`index.html` 的业务页面、歌曲选择器 UI、歌词目录 UI、localStorage 收藏、静态曲库加载和所有未来业务页面。

**不能直接假设**：Player 不是已发布的 UI 无关 npm 包；Studio 不是本轮已验证的可 import Python 库；Java、MySQL、Redis、RabbitMQ、MinIO 和正式认证当前都不存在。

## Studio 源码确认

Studio README 和 `SKILL.md` 将其定义为一个独立 Skill/工作站工具链：宿主 Agent 负责资料搜索、版本核对、听音和返修判断，`song_import/` 负责可恢复的文件处理。`song_import/import_job.py` 的真实 CLI 子命令是 `start`、`run`、`status`、`doctor`、`agent`、`accept`、`install`。

- `start` 固化输入音频 SHA-256、标题/歌手、提示词指纹、配置和独立任务目录；已有任务必须使用 `run` 恢复。
- `Job.stage` 用输入指纹、阶段目录文件树和 `state.json` 跳过完整的同输入阶段；用 `.import.lock` 防止并发执行，并把事件写入 `events.jsonl`。
- `prepare` 先用 FFmpeg 规范化到 44.1kHz，再使用提供的人声或 Demucs 分离，并拒绝人声时长不一致的自动补齐/位移。
- `align` 要求歌词来源快照和 `draft.json` 通过检查，调用 `song_import.align`、SOFA source 和 checkpoint；默认对齐轮数最多三轮。
- `advance` 生成 alignment review；没有 `alignment-approved.json` 时停止并要求人工复核。通过后才生成媒体、三档朗读/原曲、分块和预览，并要求填写 playback review。
- `accept` 记录人工对齐复核；`install` 再次检查包哈希、reviewer、所有 playback checks 和未解决问题，拒绝覆盖同名曲库目录。
- `doctor` 检查 FFmpeg、SOFA source/checkpoint、模型 Python、Demucs 和朗读服务；VOICEVOX/Edge/none 是配置选项，模型服务和外部依赖不是 Worker 自带能力。Studio README 声明 Python 3.12 和 FFmpeg；当前 `doctor` 要求 PyTorch 与 torchaudio 2.8.0，未提供预分离人声时还要求 Demucs；SOFA 源码和 checkpoint 需要按模型配置安装。

`SKILL.md` 明确宿主 Agent 负责资料搜索、版本辨别、歌词来源检查、结构判断、听音和返修依据；脚本负责指纹、阶段缓存、媒体处理、报告校验和安装。`doctor`/`status` 是检查命令，`run` 调用 `Job.advance()` 推进处理并在对齐复核门禁处停止，`accept` 记录对齐审查，之后 `run` 才能继续生成包/预览；`install` 还要求独立的播放验收报告。`advance` 是类方法，不是 CLI 子命令。

因此，Studio 的任务恢复、输入指纹、证据报告和人工门禁应由 Worker 复用；Worker 不应收到消息后无条件执行到 install，也不应绕过 `accept`。`install` 是写入指定本地曲库目录的文件操作，Utae Worker 应把通过验收的包上传到 MinIO 候选区，再由 Utae 维护者发布，不直接把生产库挂载给 Studio。

## Studio 待核查清单

阶段 4 开始前仍需把上述 Studio commit 和源码语义固化为 Worker 的契约测试，特别是输入指纹/文件锁/恢复点、外部模型版本、歌词与读音、疑点报告和人工复核。若某能力依赖外部模型或人工听审，Worker 任务状态必须显式表达，不能自动发布。
