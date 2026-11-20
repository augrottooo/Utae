# 阶段 3 实施记录

状态（2026-11-20）：**API 与前端接入候选已实现；代码级回归通过，真实 MySQL/Flyway 与真实资产端到端验收待专用环境执行**。本轮未提交或推送。

## 已实现

- `backend/`：Java 21、Spring Boot 3.5、MyBatis-Plus、Flyway、MySQL Connector 和 MinIO 对象存储适配；统一响应、错误码、Bean Validation、开发/测试配置。
- V1 迁移建立用户、歌曲、所有权、不可变 package version、存储资产、版本资产路径、版本歌词行和 token 表。外键使用 RESTRICT；迁移不开启自动 baseline/clean，也不提供默认账号。
- Cookie session 登录、退出、`/api/me`、session CSRF token；账号从 DB 查询，服务端 principal 提供 user scope。首次维护者仅通过显式 bootstrap 环境变量建立。
- 显式 SQL 的歌曲列表/详情/版本/Manifest/资产目录/歌词 API。每条访问查询要求共享可见性或当前用户 ownership；不可访问与不存在统一为 404。
- Sorane schema 1 秒制 `playerSong`、三档音频、歌词/token、chunks 以不可变 JSON 快照映射；资源 URL 改写为 asset ID，不输出对象存储 key。
- 资产 GET/HEAD 授权绑定 song、version、asset；单 Range、suffix/open-ended range、If-Range、206/416、ETag、Content-Range、Accept-Ranges 与私有 no-store 响应。
- React 生产 App 改用后端列表、会话和 Manifest 查询；Mock 页面保留为历史阶段 fixture，生产入口不再使用 Mock session/job。
- Bridge API catalog 验证同源资产路由和版本 ID；授权音频仅使用当前解码会话，不写 Cache Storage，Sorane 时钟、状态、调度保持上游职责。

## 自动化验证

- 2026-11-20：前端 API/页面测试 68 项通过；TypeScript 与 ESLint 通过。ESLint 覆盖上游 JavaScript、React/Bridge TypeScript 源码、前端 TypeScript 测试及 Vite/Vitest 配置。
- Java 21/Spring Boot 单元测试 12 项通过，包含身份/CSRF MockMvc、用户范围拒绝、Manifest 映射、Range 与资产控制器测试。
- 上游 JavaScript 测试 18 项、Python 回归 7 项通过。Python 使用显式 Miniconda 路径运行；默认 WindowsApps `python.exe` launcher 无法启动。
- React/Vite production build 通过，生成 119 modules。
- `mvn -Pmysql-it verify` 已执行；12 个单测通过，真实 MySQL migration 测试因未配置专用数据库而跳过 1 项。
- 新增 `backend/stage3-acceptance.ps1`：在专用 schema、MinIO bucket、API fixture 和测试账号均显式配置后，串行执行 Flyway opt-in、CSRF/session、目录/详情/版本、共享/私人隔离、Manifest object key 隐藏、MinIO-backed GET/HEAD 和 Range 验收；缺少或非专用配置时在连接前拒绝，脚本不创建或清理资源。
- Ruff 不适用于本阶段 Java/TypeScript 代码；本阶段 TypeScript lint 使用现有 ESLint 配置及 `typescript-eslint`。

## 未完成验收与边界

- 当前环境没有 `UTAE_TEST_DB_URL`、测试凭据或 MySQL 3306 listener；Flyway migration 与 mapper SQL **尚未在真实 MySQL 执行**。`mvn -Pmysql-it verify` 限制到专用 `utae_stage3_test`，要求先独立准备空测试 schema。
- 本机存在正在运行的 MySQL Windows 服务，但未连接或读取其业务数据；由于没有专用 schema 凭据，真实迁移仍保持未执行。MinIO 客户端/服务和 `UTAE_MINIO_*` 均未配置。
- 尚无真实用户/公开版本数据和对象存储资产，因此尚未完成浏览器到 MySQL/MinIO 的端到端播放。此前 1B 浏览器验收不代表该新 API 链路已人工验证。
- 版本 JSON 快照用于 schema 1 原样播放映射；normalized lyric 表已建，但离线包导入/生产导入流程与数据 backfill 不在本阶段启用。
- V1 迁移已统一声明 `DEFAULT CHARSET=utf8mb4`，但仍需在专用 MySQL 8.0.16+ 空 schema 实际运行后，才能确认 JSON/CHECK/复合外键兼容并把迁移标为通过。
- 上传、input revision、候选制作、队列、Studio Worker、Review/Publish 写 API 与 UI 明确留在 4A/4B；本轮没有伪造任务或上传成功状态。

## 真实验收准备

真实 MySQL/MinIO 验收必须使用隔离资源：空的 `utae_stage3_test` schema、专用数据库用户、专用 MinIO bucket 和小型 WAV fixture。先设置 `UTAE_TEST_DB_URL`、`UTAE_TEST_DB_USER`、`UTAE_TEST_DB_PASSWORD`，运行 `mvn -Pmysql-it verify`；测试会在迁移前确认 MySQL 版本并拒绝非预期表集合。随后按 `backend/README.md` 的 fixture 步骤插入两个用户、一首共享歌曲、一首由 `alice` 拥有的私有歌曲、一个 schema-1 已发布版本及其音频资产映射，启动 `dev` profile 验证 CSRF 登录、Manifest 隐藏 object key、共享/私有授权、GET/HEAD 和单 Range 响应。当前环境未配置这些资源，因此本轮没有声称真实 MySQL/MinIO 通过。
