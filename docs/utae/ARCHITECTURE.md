# Utae 整体架构

本文把已检查的 Sorane Player 事实和 Utae 目标设计分开描述。带有“源码确认”的内容来自 `C:\Users\hj\Projects\utae` 的 `80f04d69070b0816d2c8335e1b782df2f2dd7e13`；带有“设计建议”的内容尚未实现。

## 总体边界

```text
React Web
  ├─ App Shell / 路由 / 业务页面
  ├─ TanStack Query（服务端数据）
  ├─ Zustand（非播放 UI 状态）
  └─ PlayerBridge（唯一播放状态边界）
       └─ Sorane audio transport/chunks/decoder/cache/mixer/timeline

Spring Boot 模块化单体
  ├─ Auth / Song Catalog / Package / Learning / Agent / Review
  ├─ MySQL + Flyway（事实来源）
  ├─ Redis（缓存、限流）
  ├─ MinIO（资产）
  └─ Outbox -> RabbitMQ -> Python Worker -> Sorane Studio CLI/Adapter
```

## 源码确认：Sorane Player

| 模块                                             | 实际职责                             | 复用策略                                |
| ------------------------------------------------ | ------------------------------------ | --------------------------------------- |
| `web/src/audio/transport.js`                     | HTMLAudio、PCM loop、播放时钟和 seek | 保留，包装为 Bridge                     |
| `web/src/audio/chunks.js`                        | 44.1kHz 分块调度、预取、循环、恢复   | 保留，补测试后复用                      |
| `web/src/audio/decoder.js`                       | 整段解码后备路径                     | 保留                                    |
| `web/src/audio/cache.js`                         | Cache Storage、并发下载和失效        | 保留，未来增加授权 URL 适配             |
| `web/src/audio/mixer.js`                         | 四声道拆分、人声/伴奏增益、朗读切换  | 保留，按资产能力显示 UI                 |
| `web/src/timeline.js`                            | 原曲时间到速度变体的映射             | 保留                                    |
| `web/src/player.js`                              | 练习模式、句子选择、固定 DOM 事件    | 先隔离，再由 Bridge 包装                |
| `web/src/lyrics.js`、`layout.js`、`directory.js` | 当前页面文字和目录 UI                | React 页面逐步替换                      |
| `web/src/library.js`                             | 静态目录搜索和 localStorage 收藏     | 替换为后端 API；仅保留排序/搜索逻辑参考 |
| `lyric_player/schema.py`、`build.py`             | schema 校验和静态构建                | 作为歌曲包契约参考；服务端另建适配层    |
| `server/http.py`、`compose.yaml`                 | 静态预览服务                         | 仅保留开发参考，不作为业务后端          |

Player 依赖 `web/index.html` 的固定 DOM ID，不能直接当成 UI 无关 npm 包。阶段 1A 已在原位实现 controller、快照、订阅和 dispose，Bridge 接收 catalog、root、songId；完整目标 loadPackage 尚未实现。React 集成采用单实例宿主，具体边界见 [PLAYER_BRIDGE.md](PLAYER_BRIDGE.md) 和 [1A 报告](PLAYER_BRIDGE_1A_REPORT.md)。

## 阶段 1 的目录演进

阶段 1 保持 Sorane 上游目录原位，不进行大规模移动或复制：

| 阶段 1 位置                                     | 所有者                    | 处理方式                                                                 |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `web/src/audio/`                                | Sorane 播放核心           | 原位保留，Bridge 通过现有 import 使用                                    |
| `web/src/player.js`                             | Sorane 控制器             | 原位增量改造，增加最小 controller/snapshot/event/dispose 出口            |
| `web/src/timeline.js`、`lyrics.js`、`layout.js` | Sorane 时间和旧 UI        | 时间映射先保留；旧 UI 逐步由 React 替代                                  |
| `lyric_player/`                                 | 歌曲包 schema、校验、构建 | 原位保留，作为真实 schema 适配和构建工具                                 |
| `tests/`                                        | 上游 JS/Python 测试       | 原位保留并先扩展 Bridge 相关测试                                         |
| `apps/web/`                                     | Utae React 应用           | 仅在 1A 通过后创建最小宿主，不复制 `audio/`                              |
| `packages/player-bridge/`                       | Utae 适配层               | 1B 采用同仓 npm workspace；配置和依赖在 1B 开始前核对根包/锁文件后再加入 |

依赖关系是 `apps/web -> packages/player-bridge -> 当前 web/src/player.js -> 当前 web/src/audio/*`。在 1A/1B 通过前，不把 `web/src/audio` 复制到 `packages/player-bridge`，不把 `lyric_player` 重新实现为 npm 包，也不把目录结构图当成已经存在的目录。

## 目录迁移判定

完成集成验证后，再根据测试和构建结果选择：继续保留上游目录并通过适配层引用；将少量 UI 无关模块移动到 package；或暂时不移动。每次移动必须保留上游历史、更新 import、运行原有测试和真实浏览器回归。阶段 1 的目标是验证边界，不是整理目录。

## 后端模块（设计建议）

采用模块化单体而非微服务：

- `auth`：会话、角色、user scope。
- `catalog`：Song、权限、搜索和发布版本。
- `package`：Manifest、资产授权和版本校验。
- `processing`：Job、Stage、Outbox、重试和复核。
- `learning`：进度、收藏、事件和复习任务。
- `agent`：Runtime、Tool Registry、Harness、Trace。

模块共享一个 Spring Boot 进程和 MySQL 事务边界，跨模块写入通过明确的 Service 接口，不直接访问其他模块的表。

数据访问建议采用 MyBatis Mapper 和显式 SQL；复杂列表及资产授权查询可读性优先，SQL 条件必须包含会话 user scope。Flyway 负责结构版本，禁止依赖 ORM 自动建表。

## 状态与可靠性

- Song 发布状态与 ProcessingJob 阶段状态分离；核心音频可用而可选资产失败时使用 `PARTIAL_SUCCESS`。
- Outbox 在业务事务中写入；发布后崩溃允许重复消息，Worker 必须用业务幂等键去重。
- Redis 不保存唯一事实；缓存失效以 MySQL 写入成功为准。
- MinIO object key 不进入浏览器公开接口；Manifest 中的资产地址必须是授权代理或短期 URL。

## 事实分类

- **源码确认**：当前 Player 模块、固定 DOM、歌曲包 schema 1、静态 Python CLI、上游测试文件和提交版本。
- **测试验证**：1A 使用显式 Node 24.22.1、Miniconda Python 3.13.13，JS 17/17、Python 7/7 通过，用户确认本地合成音包浏览器与生命周期验收。默认 Node/launcher 和全局 PATH 未修改，可移植项目工具链尚未固定。
- **设计建议**：React 宿主、Spring Boot、MySQL/Redis/RabbitMQ/MinIO、完整目标 Bridge 契约、Worker、Agent 以及后续目标目录。1A 原型已有实现不等同于完整目标契约。
- **待验证**：React 宿主改造的最小差异、Studio Worker 对阶段/证据门禁的实际编排、模型环境可复现性、真实基础设施链路、认证实现、浏览器端回归和目录迁移是否值得执行。
