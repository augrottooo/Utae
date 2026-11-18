# Utae（唱吧）

Utae 是面向日语歌曲精听与发音练习的工具，以 [Sorane Player](https://github.com/SuperJuice666/sorane-player) 为播放器基础进行二次开发。

当前仓库保留上游播放器、构建工具、文档、Git 历史及版权声明。上游基线为 `15bb3bb7dd05430af18120bfbc1ef2558322308b`；仓库切换与版本信息见 [切换记录](docs/utae-repository-switch.md)。

本地目录为 `C:\Users\hj\Projects\utae`。当前提供歌曲包播放、已验收的 Bridge 1A 原型和 React 宿主 1B。1A、1B 已推送，checks #4、demo #4 及 1B 用户实际浏览器验收通过（用户确认）。本轮 1C 完善本地歌曲包的校验、资源准备与错误恢复；真实公开演示包的桌面加载、播放和恢复验证已通过，完整逐词听审与移动设备矩阵另行记录。用户上传、Java 后端、学习记录与 Agent 属于后续规划。旧版仓库不作为当前开发来源，禁止访问。

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

静态验证入口：构建后打开 `http://127.0.0.1:8080/bridge-probe.html?root=container`；切换 `root=global` 作对照。[接口、验证结果与未完成项](docs/utae/PLAYER_BRIDGE_1A_REPORT.md)。Bridge host 在销毁后替换整个 `<audio>` 元素；同一元素不能通过关闭 AudioContext 重置其 MediaElementAudioSourceNode 关联。阶段 1A 已于 2026-11-16 验收完成（JS 17/17、Python 7/7；用户浏览器确认旧 AudioContext 关闭及新节点重挂播放、暂停正常）。验证仅使用本地合成音测试包，真实歌曲包兼容性尚未验证。阶段 1B 的 React 宿主已完成实现与本轮验收，见 [1B 报告](docs/utae/PLAYER_BRIDGE_1B_REPORT.md)。

## Utae React 宿主 1B

需要 Node.js >=24 及已安装的项目依赖。在项目根目录运行：

```powershell
Set-Location 'C:\Users\hj\Projects\utae'
python -m lyric_player demo
python -m lyric_player build
npm run prepare:player
npm run dev --workspace @utae/web -- --host 127.0.0.1 --port 5174 --strictPort
```

已有本地歌曲构建时，可跳过生成 demo 和 Python build。资产准备先检查公开曲库 schema、全部引用资产及其内容哈希，再复制引用资产、修复损坏副本，最后发布曲库；不复制上游 JS/HTML。资源错误时先重新运行 Python build 和 prepare，再在页面重试。以上通过命令参数选择端口，不修改 Vite 或系统配置。访问 <http://127.0.0.1:5174/>，练习路由为 `/songs/:songId/practice`。部署 React 构建时，静态服务器需要将页面路由回退至 `index.html`。

`npm run build` 生成 React 站点 `apps/web/dist/`。检查命令为 `npm run format:check`、`npm run format:host`、`npm run lint`、`npm run typecheck`、`npm run test:frontend`、`npm test` 和 `python -m unittest discover -s tests`。现有 GitHub Pages 工作流仍部署 Python 生成的 Sorane 演示站点；1B 没有调整该部署工作流。

[1B 实施与验收报告](docs/utae/PLAYER_BRIDGE_1B_REPORT.md) 记录播放器职责边界、生命周期、自动化结果和用户浏览器验收。

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

阶段 1A、1B 已完成并推送；1C 本地包加载与真实歌曲包桌面验收见 [1C 报告](docs/utae/PLAYER_BRIDGE_1C_REPORT.md)。项目内仍只有合成音包；真实公开演示包已在隔离目录验证，歌曲资源不纳入 Git。完整听审和移动设备矩阵未覆盖。

## 阶段 2 页面候选

本地未提交候选已提供曲库（`/`、`/library`）、搜索、歌曲详情、练习、我的歌曲、提交歌曲和模拟任务页面。模拟登录只切换演示界面状态；任务仅保存本标签页元数据，刷新可恢复，不上传音频、不运行 Studio，也没有真实账户或业务 API。现有播放器收藏仍为本机存储。页面继续使用上述 React 启动与构建命令；详细边界和测试见 [阶段 2 报告](docs/utae/FRONTEND_STAGE2_REPORT.md)。当前 GitHub Pages 继续部署上游演示，不代表这些 React 页面已在线发布。
