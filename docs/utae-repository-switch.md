# Utae 仓库切换记录

日期：2026-11-13（Asia/Shanghai）。

## 当前结果

旧仓库已完整归档；用户要求继续后，标准 Git Clone 重试成功，新项目已建立，克隆产生的 origin 已移除。没有提交、推送、安装依赖、迁移业务代码或开发功能。

## 旧仓库

- 原路径：`C:\Users\hj\Projects\utae`
- 归档路径：`C:\Users\hj\Projects\utae-legacy`
- 分支：`main`
- HEAD：`d2c573274d97cfbd762be00feac4b1cf6173ec42`
- 最近提交：
  - `d2c5732 feat: add learning records and audio practice controls`
  - `83b6915 feat: add local romaji processing`
  - `fba91db chore: initialize Utae project`
- 原 origin：`git@github.com:augrottooo/Utae.git`
- 当前 origin（fetch/push）：`git@github.com:augrottooo/Utae-legacy.git`
- GitHub 改名由用户完成；随后通过现有 SSH 身份执行只读 `ls-remote`，确认改名后的仓库可访问，HEAD 与 main 都指向上述提交。未执行 GitHub 推送。

### 完整性核验

目录整体原地重命名，没有复制、清理、提交或重置。重命名前后逐一比对：

- 12,555 个文件的 SHA-256、文件长度和修改时间一致。
- 1,396 个子目录清单一致。
- HEAD、分支及工作区状态一致。
- 上述核验包含 `.git`、未跟踪文件、被忽略的依赖、构建产物和本地音频。
- 完成核验后，仅按 GitHub 改名更新旧仓库 `.git/config` 中 origin 的地址；该项是预期配置变化。

完整性基线：`C:\Users\hj\AppData\Local\Temp\utae-repository-switch-cddc2233d5f9473d9bb07189c90686f9\baseline.json`。该文件不包含环境文件内容，但记录相对路径、哈希、长度、时间和 Git 状态；临时目录不是长期备份。

### 保留的未提交修改

已修改（6 个）：

```text
README.md
frontend/package.json
frontend/src/App.vue
frontend/src/components/AudioPlayer.vue
frontend/src/components/LyricList.vue
frontend/src/composables/useAudioPractice.ts
```

未跟踪（4 个）：

```text
frontend/src/composables/usePronunciation.ts
frontend/src/services/pronunciation.ts
frontend/tests/practice.test.mjs
frontend/tests/register-source.mjs
```

### 第四阶段成果与本地文件

- 学习进度、收藏、学习事件、关联清理的 Repository、Service、API 及集成测试源码均存在。
- 现有 Surefire 报告共 18 项测试，失败 0、错误 0；其中 `LearningDataIntegrationTest` 为 5/5 通过。这里只检查已有报告，本轮没有重跑测试，也没有声称完成新的浏览器验收。
- 前端保留进度节流及即时保存逻辑；原有验收限制仍有效，包括开发用户作用域、H2 内存数据源及未验证的 MySQL 运行兼容性。
- `.env.example`、应用 Profile、启动脚本和 README 均保留；检查时未发现项目自有 `.env` 文件。没有输出配置密钥。
- `backend/data/`、`backend/target/`、`frontend/node_modules/`、`frontend/dist/`、`testuse/` 原样保留。
- `C:\Users\hj\Desktop\utae_codex_spec` 中的原规格文件保持原位，没有复制到新旧项目。本切换记录另存一份到新项目 `docs/utae-repository-switch.md`。
- 归档前未发现监听 5173/18080 的开发服务，没有停止进程。H2 内存数据不能通过重命名恢复；本地音频文件则已纳入文件完整性核验。

## 首次克隆失败记录

- 目标产品名称：Utae（唱吧）。
- 目标路径：`C:\Users\hj\Projects\utae`
- 上游地址：`https://github.com/SuperJuice666/sorane-player.git`
- 使用的命令：`git clone https://github.com/SuperJuice666/sorane-player.git C:\Users\hj\Projects\utae`
- 结果：退出码 128，`fatal: unable to access ...: Empty reply from server`。
- 错误后检查：目标路径不存在，没有可用的新 `.git` 或克隆 Commit Hash。
- 新分支、版本、LICENSE/NOTICE、文档结构、remote：因克隆失败尚无法核验；没有创建新 GitHub 仓库或 Fork，也没有配置新 remote。
- 按用户要求，网络问题后停止；没有切换下载协议、下载 ZIP、重新初始化 `.git` 或自动重试。

## 当前目录结构

```text
C:\Users\hj\Projects\
├─ utae\
│  ├─ .git\
│  ├─ .github\
│  ├─ docs\
│  ├─ examples\
│  ├─ lyric_player\
│  ├─ server\
│  ├─ tests\
│  ├─ web\
│  ├─ AGENTS.md
│  ├─ LICENSE
│  ├─ README.md
│  └─ 上游构建与开发配置文件
└─ utae-legacy\
   ├─ .git\
   ├─ backend\
   ├─ frontend\
   ├─ infra\
   ├─ scripts\
   ├─ testuse\
   ├─ worker\
   ├─ .env.example
   ├─ .gitignore
   └─ README.md
```

## 用户确认继续后的完成记录

- 新项目：`C:\Users\hj\Projects\utae`。
- 来源：`https://github.com/SuperJuice666/sorane-player.git`，通过标准 Git Clone 创建，没有使用 Fork 或重新初始化 `.git`。
- 上游 HEAD：`15bb3bb7dd05430af18120bfbc1ef2558322308b`。
- 分支：`main`。
- HEAD 提交：`按名称排列歌曲并完善夜间按钮状态`，提交时间 `2026-10-20T23:45:06+08:00`。
- Git 版本描述：`demo-media-v1-3-g15bb3bb`；HEAD 本身没有标签。保留标签 `demo-media-v1`。
- Git 历史：非浅克隆，HEAD 可达 4 个提交；`git fsck --full` 通过。
- 上游包版本：`package.json` 与 `pyproject.toml` 均为 `0.1.0`；歌曲包 `schemaVersion` 为 1，格式修订为 `1.0.0`。三者含义不同。
- 当前 Git remote：无。克隆后已执行 `git remote remove origin`，main 不再关联远程跟踪分支，没有配置 upstream 或新 GitHub 地址。
- 新项目产品名称：Utae（唱吧），定位为日语歌曲精听与发音练习工具。
- 本轮名称改动：README 标题及开头来源说明、网页 HTML 标题、未选歌时的默认 `document.title`；播放器逻辑和结构不变。
- `README.md` 原有操作说明与 `docs/` 原文保留，仅增加 Utae 的身份和现阶段能力边界；新增本切换记录。
- `LICENSE` 的 MIT 许可及 `Copyright (c) 2026 SuperJuice666` 原样保留。
- `web/fonts/OFL.txt`、字体来源说明及 `docs/third-party.md` 原样保留；上游没有独立 NOTICE 文件，没有删改任何许可文件。
- 尚未安装依赖、构建、运行服务或测试。本轮核验为 Git 对象完整性、工作区差异、文件结构、名称替换范围及许可证未改动；不声称播放器运行验收通过。

## 保留的上游技术标识与后续事项

- `package.json`、`package-lock.json`、`pyproject.toml` 的 `sorane-player` 包名及上游作者、来源链接保留，后续统一评估再修改。
- 原示例、部署文档、CHANGELOG 和测试中的 Sorane 名称保留，作为上游资料，不进行全局替换。
- `.github/workflows/` 原样保留；没有运行或发布工作流，未来连接自己的 GitHub 仓库前需评估 Pages 发布和上游演示歌曲配置。
- 克隆版本要求 Python >=3.12、Node >=24；旧项目 Node 22 启动脚本没有复制进来，也未安装或升级工具链。
- Sorane Studio 继续独立维护，本轮没有克隆、安装或复制 Studio。
- 新项目目前仍是原生 JavaScript/Python 标准库的 Sorane Player 基础，尚未实现 Vue 重建、Java API 或中间件集成。
- 旧仓库原有 6 个修改文件和 4 个未跟踪文件复查仍在；后续业务迁移单独评估。
- 新 GitHub 仓库与 remote 等待用户后续指示，本轮不创建、不推送、不提交。

## 用户授权连接新 GitHub 仓库（2026-11-13）

用户提供 `git@github.com:augrottooo/Utae.git` 并明确要求推送。此前“无 remote、等待后续指示”为目录切换完成时的历史状态。

- 推送前通过 SSH 执行 `ls-remote`，远程没有分支或标签引用。
- 新仓库 origin 设置为 `git@github.com:augrottooo/Utae.git`，目标分支为 `main`。
- 提交范围仅为 Utae 名称说明、两处展示标题及本切换记录；保留上游完整历史与许可。
- 使用普通推送并建立 main 跟踪关系，不使用 force，不推送旧 Utae 代码。
- 本地只检查 Git 完整性与差异，未安装依赖或重跑播放器测试。上游已有 CI 和 Pages 工作流随源码保留，推送可能触发；其执行结果另行核对。
