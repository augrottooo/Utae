# Utae（唱吧）

Utae 是面向日语歌曲精听与发音练习的工具，以 [Sorane Player](https://github.com/SuperJuice666/sorane-player) 为播放器基础进行二次开发。

当前仓库保留上游播放器、构建工具、文档、Git 历史及版权声明。上游基线为 `15bb3bb7dd05430af18120bfbc1ef2558322308b`；仓库切换与版本信息见 [切换记录](docs/utae-repository-switch.md)。

本地目录为 `C:\Users\hj\Projects\utae`。当前提供歌曲包播放及已验收的 Bridge 1A 原型，React 宿主、用户上传、Java 后端、学习记录与 Agent 属于后续规划。旧版仓库不作为当前开发来源，禁止访问。

以下保留上游使用说明；其中 Sorane 演示链接指向上游站点，运行示例按上游目录名称书写。本地使用时进入当前 Utae 目录。歌曲制作由独立的 Sorane Studio 负责。

## 上游 Sorane Player 使用说明

[更新日志](CHANGELOG.md)

日语歌词练习播放器。支持全曲、逐句、逐段循环，原曲与读音、三档速度、人声音量、假名、译文、本地收藏。

播放器读取歌曲包，提供同步歌词、循环练习和读音辅助。制作歌曲包使用关联项目 [Sorane Studio](https://github.com/SuperJuice666/sorane-studio)。两者独立运行，以 [schemaVersion 1](docs/data-format.md) 交换数据。

[在线演示](https://superjuice666.github.io/sorane-player/?song=strings) · STRiNGS — THE ORCHESTRA TOKYO

<p>
  <img src="docs/images/strings-full.gif" width="240" alt="全曲播放，歌词逐词高亮" />
  <img src="docs/images/strings-reading.gif" width="240" alt="逐句慢速读音，显示汉字假名和中文译文" />
  <img src="docs/images/strings-loop.gif" width="240" alt="依次选择起始句和结束句，循环练习所选范围" />
</p>

全曲同步 · 逐句读音 · 选段循环。录制视口为 iPhone 17 Pro 对应的 402 × 874。

## 本地运行

需要 Python 3.12 或更新版本。下载完整源码，进入项目根目录：

```sh
git clone https://github.com/SuperJuice666/sorane-player.git
cd sorane-player
python -m lyric_player demo
python -m lyric_player build
python -m server
```

打开 <http://127.0.0.1:8080>。演示包含本项目编写的音调和示例文字。
运行与构建使用 Python 标准库，Node.js 提供开发检查。

## 添加歌曲包

将 Sorane Studio 交付的完整歌曲目录放入 `data/songs/<id>/`，保留相对路径：

```sh
python -m lyric_player validate data/songs/my-song/song.json
python -m lyric_player build
```

构建结果为 `build/`，可部署到静态服务器。`server/` 提供本地预览服务。见[部署](docs/deployment.md)。网站根目录设为 `build/`。

## 项目结构

| 目录            | 内容                       |
| --------------- | -------------------------- |
| `web/`          | 播放器和分块音频调度       |
| `server/`       | 静态网站预览服务           |
| `lyric_player/` | 曲库构建、校验器和音调示例 |
| `examples/`     | 歌曲包示例                 |
| `docs/`         | 格式、架构、部署和维护     |
| `tests/`        | 播放时序、格式和服务测试   |

个人歌曲和构建结果分别保存在 `data/` 和 `build/`。

## 开发

```sh
python -m pip install -r requirements-dev.txt
npm ci
npm test
npm run lint
npm run format:check
python -m unittest discover -s tests
python -m ruff check server lyric_player tests
python -m ruff format --check server lyric_player tests
```

音频修改还需按[维护说明](docs/maintenance.md)做设备检查。歌曲包兼容与版本协作见[两个项目如何协作](docs/relationship.md)。

代码采用 MIT。内置字体使用 OFL，见 `web/fonts/OFL.txt`。歌曲内容需自行取得相应使用权限。

## Utae PlayerBridge 1A 原型

静态验证入口：构建后打开 `http://127.0.0.1:8080/bridge-probe.html?root=container`；切换 `root=global` 作对照。[接口、验证结果与未完成项](docs/utae/PLAYER_BRIDGE_1A_REPORT.md)。Bridge host 在销毁后替换整个 `<audio>` 元素；同一元素不能通过关闭 AudioContext 重置其 MediaElementAudioSourceNode 关联。阶段 1A 已于 2026-11-16 验收完成（JS 17/17、Python 7/7；用户浏览器确认旧 AudioContext 关闭及新节点重挂播放、暂停正常）。验证仅使用本地合成音测试包，真实歌曲包兼容性尚未验证。阶段 1B 未开始，等待下一步指令。

## Utae 正式文档索引

`docs/utae/` 为产品与开发规范入口；上游文档及历史切换记录保留。历史切换记录不作为当前开发依据。

- [产品需求](docs/utae/PRD.md)
- [整体架构](docs/utae/ARCHITECTURE.md)
- [上游 Player 集成核查](docs/utae/UPSTREAM_INTEGRATION.md)
- [PlayerBridge 方案](docs/utae/PLAYER_BRIDGE.md)
- [1A 原型实施记录与生命周期验收](docs/utae/PLAYER_BRIDGE_1A_REPORT.md)
- [歌曲包与 API](docs/utae/API_AND_MANIFEST.md)
- [数据模型](docs/utae/DATABASE.md)
- [制作 Pipeline](docs/utae/PROCESSING_PIPELINE.md)
- [认证与授权](docs/utae/AUTHORIZATION.md)
- [Learning Agent 与 Harness](docs/utae/AGENT_HARNESS.md)
- [React 交互规范](docs/utae/FRONTEND_DESIGN.md)
- [开发路线图](docs/utae/ROADMAP.md)、[第一轮一周验收计划](docs/utae/ONE_WEEK_PLAN.md)、[验收标准](docs/utae/ACCEPTANCE.md)
- [架构决策记录](docs/utae/DECISIONS.md)
- [Codex 工作流](docs/utae/CODEX_WORKFLOW.md)

阶段 1A 已完成并归档；阶段 1B 未开始，等待下一步指令。后续规划功能仍不属于当前已实现能力。
