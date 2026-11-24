# 阶段 3 实施记录

状态（2026-11-24）：阶段 3 实现已推送（`55719be`），checks #6 和 demo #6 已通过。**隔离 MySQL 8.0.36 迁移、HTTP + MinIO 和浏览器真实 API 播放验收已通过**。真实 HTTP 请求发现 MyBatis 对 record 查询结果的映射问题，已通过显式构造器参数映射修复。

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
- 在回环端口 `13306` 和独立数据目录启动临时 MySQL 8.0.36，运行 `backend/stage3-migrate.ps1`。Flyway 从空 schema 应用并验证 V1；八张业务表、Flyway 历史表、八条限制性外键、主要索引及启用的 CHECK 约束通过核对。12 项 Java 单测和 1 项真实 MySQL 集成测试通过，未跳过。验收后关闭临时实例。
- 验收分为两个独立入口：`backend/stage3-migrate.ps1` 只迁移隔离的空 MySQL schema 并核验数据库结构；`backend/stage3-acceptance.ps1` 只访问已导入测试数据的隔离 HTTP API，并核对测试 WAV 的 SHA-256、HEAD 和 Range 字节。两者都不清理或删除数据。
- 2026-11-23：独立实例 `127.0.0.1:13306/utae_stage3_test` 的 Flyway V1 实际执行成功；后续只读核验确认 8 张业务表、8 条外键、索引及 10 条 enforced CHECK 约束。验证命令退出码为 0。验收使用独立数据目录，没有连接业务 MySQL。
- 2026-11-24：普通 Windows PowerShell 使用 JDK 21.0.13 执行 `maven-clean-plugin:3.5.0:clean package`，19 个主源码、7 个测试源码重新编译，12 项单元测试通过，`BUILD SUCCESS`。新 JAR 中 `CatalogMapper` 包含显式 Asset/Song/Version record 构造映射。
- 2026-11-24：现有 `backend/stage3-acceptance.ps1` 对隔离 API、MySQL 和 MinIO fixture 实际通过，退出码 0。覆盖 CSRF、独立 Alice/Bob session、共享/私人访问、Manifest 版本绑定和隐私字段检查、音频 GET/SHA-256、HEAD、Range、错误版本和越权拒绝。该脚本不执行 Flyway。
- Ruff 不适用于本阶段 Java/TypeScript 代码；本阶段 TypeScript lint 使用现有 ESLint 配置及 `typescript-eslint`。

## 边界与未完成事项

- 早期 HTTP 失败日志保留在验收目录中，原因是旧 JAR 的 record 映射错位；随机前缀对象及测试行保留在专用测试资源中，没有执行清理或重建。
- 授权失败路径已由 HTTP + MinIO 自动化验收覆盖；浏览器中未重复登录 Bob 手测私有歌曲拒绝。此前 1B 浏览器验收不作为本阶段真实 API 播放证据。
- 2026-11-24 浏览器真实 API 播放验收已完成：Windows 10 的 ChatGPT in-app browser 通过 Vite `http://127.0.0.1:5174` 连接隔离 API `http://127.0.0.1:18080`，Alice 登录成功；共享歌曲和 Alice 私有歌曲均加载真实 schema-1 Manifest、歌词与 romaji token。共享歌曲播放器实际从播放切换到暂停，transport 时间从 0.0 秒推进到约 0.5 秒，暂停后停止推进，进度条 seek 可更新；Alice 私有歌曲也实际从播放切换到暂停并推进到约 0.1 秒。验收中发现临时 fixture 的 `ruby` 错误写成空字符串，已仅在隔离 `utae_stage3_test` 的两条版本快照中修正为合法 schema-1 数组，未修改应用代码、生产数据或对象存储。
- Bob 浏览器私有歌曲拒绝未重复手测；Bob 越权、匿名拒绝及 GET/HEAD/Range 已由 HTTP + MinIO 验收脚本退出码 0 覆盖。
- 版本 JSON 快照用于 schema 1 原样播放映射；normalized lyric 表已建，但离线包导入/生产导入流程与数据 backfill 不在本阶段启用。
- 上传、input revision、候选制作、队列、Studio Worker、Review/Publish 写 API 与 UI 明确留在 4A/4B；本轮没有伪造任务或上传成功状态。

## 真实验收准备

按 [后端验收说明](../../backend/README.md#isolated-mysql--minio-acceptance) 先执行 A，确认 Flyway 能从空库迁移；再向同一测试库和专用 bucket 导入 Alice/Bob、共享/私人歌曲、已发布版本及 WAV，运行 B。B 可用同一批测试数据反复执行。最后通过 Vite 连接同一个测试 API 做真实浏览器播放验收。
