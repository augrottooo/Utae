# AGENTS.md — Utae 开发规则

## 开始工作前

- 先阅读 `README.md` 和 `docs/utae/` 中与当前任务相关的规格；上游 `docs/` 文档只用于 Sorane 格式/维护参考。
- `docs/utae/` 是 Utae 产品方案的唯一规范目录。`docs/REPOSITORY_SWITCH_2026-11-13.md` 是历史归档，不属于当前产品/开发规范，也不能作为旧版代码迁移来源。
- 核对代码基线和 Git 状态；保护上游历史、许可证、歌曲包格式和已有测试。
- 先提出文件级计划和验收命令，再开始阶段性修改。
- 明确标注源码确认、测试验证、设计建议和待验证假设。

## 上游源码维护

- 修改 Player 前阅读 `docs/maintenance.md` 与 `docs/data-format.md`。
- 歌词时间必须使用 Sorane transport 的时间；歌曲差异优先写入歌曲包数据。
- 格式契约由 `docs/data-format.md`、`lyric_player/schema.py` 和 `format-version.json` 共同维护；涉及格式修改时同步评估 Sorane Studio 的离线 contract snapshot，并运行跨项目校验。
- 录音、模型权重、生成站点、日志和凭据放在 `.gitignore` 指定目录；提交前检查 `git ls-files` 和差异。
- 播放器/音频改动需要在真实浏览器和目标设备检查；记录设备、浏览器、操作和限制。
- 文档和 UI 使用明确、肯定、具体的表达；操作要求写在相应设置流程中，指标需注明验证范围。

## 产品边界

- Utae 服务歌曲精听、逐句练习、发音辅助和轻量复习，不扩展为综合日语学习平台。
- 罗马音是主要辅助信息，歌曲包已有中文翻译是可选辅助信息。
- 不做发音评分、语法课程、完整词典、社区、排行榜、自动强制对齐、多 Agent 或向量数据库。
- Sorane Player 负责播放核心；Sorane Studio 负责制作工具链。Utae 管理业务、权限、任务和发布。

## 技术边界

- 目标前端为 React + TypeScript + Vite + React Router + Zustand + TanStack Query。
- 阶段 1B 采用同仓 npm workspaces（`apps/web`、`packages/player-bridge`）；先核对现有根 `package.json`/`package-lock.json`，不在 1A 前安装依赖。
- Sorane 音频 transport、分块调度、缓存、解码、混音、时间轴和歌曲包校验优先保留；通过 `PlayerBridge` 接入 React。
- React 不得维护第二套播放时钟或循环状态。当前播放状态必须来自 Sorane 播放核心。
- 后端采用 Java 21 + Spring Boot 3 模块化单体；MySQL 是事实来源，Redis 只能缓存/限流，RabbitMQ 只处理异步制作任务，MinIO 保存资产。
- 数据访问使用显式 MyBatis Mapper/SQL，user scope 应出现在查询条件中；避免不带权限条件的通用 CRUD。
- Worker 必须按 Sorane Studio 的真实 CLI/Adapter 调用方式执行；不得把 Studio 当成可以随意 import 的普通库，也不得自动绕过人工复核发布。

## 数据与安全

- 所有用户数据查询和写入都从服务端登录身份取得 user scope，不能信任客户端 `userId`。
- 歌曲包版本不可变；重新制作生成新业务版本，保留 `schemaVersion` 与 Utae `packageVersion` 的区别。
- 数据库结构通过 Flyway 迁移；MySQL 迁移、H2 测试结构和 API DTO 必须一起评审。
- Outbox 与 RabbitMQ 消费必须幂等、有限重试、可观测；可选处理失败只能产生 `PARTIAL_SUCCESS`，不能让原曲不可用。
- 对象存储 key 不直接暴露；音频访问必须经过授权并支持 Range 或受控短期 URL。
- LLM 只能通过白名单 Tool Registry 访问业务能力；工具参数、权限、预算、超时和结果都要记录 Trace。

## 代码与测试

- 小步修改，避免为了架构感增加无用抽象；不重写已验证的 Sorane 音频核心。
- API 使用统一错误结构，日志不记录密钥、完整签名 URL 或敏感用户数据。
- 每个阶段运行格式检查、单元测试和最小集成测试；修复失败后必须重跑失败测试。
- 播放器改动必须覆盖真实 `currentTime`、切歌、seek、循环、变速、缓存失败和资源释放。
- 制作链路必须覆盖上传、资产校验、Worker 幂等、重试、候选包、人工复核和发布边界。

## Git 与范围控制

- 禁止查找、读取、检查、迁移或修改旧版 Utae 仓库（包括 `C:\Users\hj\Projects\utae-legacy`）；不复制旧版 frontend/backend 作为新实现。
- `docs/REPOSITORY_SWITCH_2026-11-13.md` 仅作为历史切换记录保留，不纳入当前方案审核，也不重新核对其中旧仓库内容。
- 不擅自删除上游许可证、版权声明、第三方说明或提交历史。
- 未经明确要求不改 remote、提交、推送、Docker/WSL/系统配置或安装依赖。
- 遇到上游接口不足或架构冲突，先记录影响范围和替代方案，等待确认后再大规模重构。
