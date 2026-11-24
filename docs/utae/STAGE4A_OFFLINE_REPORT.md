# 阶段 4A 离线单曲预检

本轮使用固定的 Sorane Studio 提交 `b63633f5381a582e851a953409583c4679b098c5`、本机 Python 3.13 和 Utae 合成演示的 `chunk-1-0.wav`。源码和任务目录均隔离在 Utae 仓库之外。朗读配置为 `none`，不依赖朗读服务。

- 实际执行 Studio `start` 和 `status`：创建单曲任务，确认原音频、任务中的音频副本及 `job.json` 的 SHA-256 一致。
- 对同一任务目录再次执行 `start`：Studio 拒绝并要求使用 `run`，`job.json` 哈希保持不变。
- 实际执行 `doctor`：返回 1，报告 FFmpeg、SOFA 源码、checkpoint 和模型 Python 环境未就绪。

这次验证到任务初始化为止。尚未执行 `run`、同任务断点恢复、人工对齐审批、候选包验证、播放复核或隔离安装。待准备项目专用 Python 模型环境、FFmpeg 和 SOFA 后，沿用同一任务目录验证这些步骤；验证真实曲目的歌词与听感仍需授权音频和歌词素材。

## 依赖核查

Utae 仓库目前没有独立的 Studio Adapter 实现；预检直接调用固定源码的 `python -m song_import.import_job`。Studio 主解释器负责任务状态、FFmpeg 调用、报告与打包；`modelPython` 指向单独的模型解释器，运行对齐以及按需运行 Demucs。离线试制配置 `narration.provider=none`，不调用制作 Agent 或在线服务。

| 依赖            | 版本、来源和空间                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python 与模型库 | Studio [模型说明](https://github.com/SuperJuice666/sorane-studio/blob/b63633f5381a582e851a953409583c4679b098c5/docs/models.md) 推荐 Python 3.12，PyTorch/TorchAudio 均为 2.8.0，已有上游 CUDA 12.8 验证记录。建议本机先试 [CPU wheels](https://pytorch.org/get-started/previous-versions/)；Windows Python 3.12 的 torch CPU wheel 约 591 MiB，另需 TorchAudio 和该提交的 [requirements-models.txt](https://github.com/SuperJuice666/sorane-studio/blob/b63633f5381a582e851a953409583c4679b098c5/requirements-models.txt)。CPU 全链路仍需实测。 |
| FFmpeg          | 通过 [FFmpeg 下载页](https://ffmpeg.org/download.html#build-windows)选择 Windows 便携构建。例如 [Gyan 9.1 essentials ZIP](https://github.com/GyanD/codexffmpeg/releases/tag/9.1)，约 114 MiB，发布 API 提供 SHA-256。解压到验收目录，通过 Studio `ffmpeg` 配置指定完整路径。                                                                                                                                                                                                                                                                    |
| SOFA 源码       | 固定 [`584d6b9a57927843f85decebf4cbf03b9598125f`](https://github.com/qiuqiao/SOFA/commit/584d6b9a57927843f85decebf4cbf03b9598125f)，MIT 源码；路径填 `sofaSource`。                                                                                                                                                                                                                                                                                                                                                                             |
| SOFA 权重       | 使用作者的 [`akm_ja_v001`](https://github.com/ariikamusic/SOFA_Models/releases/tag/akm_ja_v001)，发布 ZIP 约 360 MiB，未附 SHA-256。作者仓库和发布说明未找到明确的权重许可；源码 MIT 不覆盖权重。先确认可用许可或取得作者许可，再下载并解压所需 checkpoint，记录 SHA-256，配置 `sofaCheckpoint`。固定 Studio 通过 pickle 读取该 checkpoint，只使用可信来源。                                                                                                                                                                                    |
| 人声分离        | 有同起点、同长度且授权的独立人声轨时，用 `vocals` 提供，可省去 Demucs。否则较后再批准安装 `demucs==4.0.1` 及其 `htdemucs` 模型；当前空间预算不含它。                                                                                                                                                                                                                                                                                                                                                                                            |

本机 Conda 已有 Python 3.7、3.9、3.10、3.11 和 3.13 环境，没有可直接复用的 3.12 加精确模型版本组合。保留现有环境，在验收目录新建一个专用 3.12 前缀。CPU 路线建议预留 8–12 GiB 给依赖缓存、解压、模型和单曲中间文件，属于预算而非实测体积。检查时 C 盘约剩 34.5 GiB、D 盘约剩 23 GiB；RTX 3050 Laptop 的显存是 4 GiB，无需先改 GPU 或驱动环境。

## 真实单曲试制计划

1. 选一首 60–90 秒、自有或明确授权的真实日语演唱。保存原始 WAV、对应录音版本的歌词和来源记录；若有匹配人声轨另存为输入。先取得素材与权重的使用许可。
2. 建新的隔离任务目录，用 `start` 固定音频和配置指纹。在 `sources.json` 记录版本、歌词快照和哈希，在 `draft.json` 准备歌词分段、假名和读音；先通过 `doctor`，再在同一任务上执行 `run`。
3. 到对齐门禁时保存证据，人工试听和校对后才调用 `accept --report`，然后用 `run` 恢复原任务。保留未获批准时不产生候选的证据。
4. 将输出歌曲包和预览留在隔离目录。用 Utae schema 1 校验器检查三档音频、分块、路径、时间和哈希，再人工检验同步、变速与 seek。需要验证安装时，只安装到专用 staging library；不发布或写入业务库。
