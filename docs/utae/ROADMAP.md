# Utae 开发路线图

本路线图定义实施顺序、依赖和阶段验收，不承诺全部 MVP 在一周内完成。第一轮实现之后的一周调试、复查和验收时间盒见 [ONE_WEEK_PLAN.md](ONE_WEEK_PLAN.md)，它不重复本文件的开发计划。

当前状态（2026-11-17）：阶段 **1A、1B 已完成并推送**，基线为 `5fc320442ef78d1fdb771e36e7a12f0b60d07b99`；checks #4、demo #4 成功，1B 用户浏览器验收通过（用户确认）。本轮 **1C 本地歌曲包链路已实现并通过自动化检查**；上游公开 STRiNGS 包的桌面功能验收通过，完整逐词听审和移动设备矩阵仍待验证。1C 不接入后端或阶段 2 业务页面。证据见 [1C 报告](PLAYER_BRIDGE_1C_REPORT.md)。

## 阶段 0：方案审核和源码基线

核对 Sorane Player/Studio 版本、格式、Player 固定 DOM 和 Studio 人工门禁；审核产品、数据、授权、API、Pipeline 和测试边界。

完成条件：审核通过；PlayerBridge 和歌词版本数据模型歧义解决；项目级 Node/Python 工具链有明确方案。方案已获用户审核；1A 使用已有 Node 24.22.1、Python 3.13.13 显式路径完成测试，没有调整全局环境。可移植工具链固定仍留后续评估。

## 阶段 1A：PlayerBridge 可行性原型

状态：**完成**（2026-11-16，用户验收确认）。以下为阶段范围，最终证据及保留限制以 [1A 验收报告](PLAYER_BRIDGE_1A_REPORT.md) 为准。

依赖：Node >=24、Python >=3.12 可执行；工具链若需安装，先获用户确认。

- 保持 `web/src/audio/`、`web/src/player.js`、`lyric_player/` 和 `tests/` 原位。
- 最小修改 `player.js`，暴露 controller、快照、事件订阅/取消和 disposal 能力；用原型比较现有 global ID、container-scoped lookup、必要的 DOM adapter、布局依赖和资源释放，再决定兼容 DOM 方案。
- 以静态页面和有效 schema 1 歌曲包测试命令，不创建 React 页面；本轮使用本地合成音包，真实歌曲包兼容性尚未验证。

验收：确认最小 API 的可行性、单实例 DOM 约束、异步取消与资源所有权；不能实现的部分记录重设计，不进入 React host。

## 阶段 1B：React 宿主接入

状态：**完成并推送**（2026-11-17，`87b21814` 文档、`5fc32044` 应用）。最小宿主、自动化生命周期回归、生产构建及用户实际浏览器验收均通过；不重复要求该轮手测。

依赖：阶段 1A 通过。

- 在 1A 选定方案后建 React/Vite 应用和单实例 `SoranePlayerHost`，由宿主 mount/unmount 对应的 DOM host；不预先假设必须使用 compatibility shell。
- 1B 开始前采用同仓 npm workspaces（`apps/web`、`packages/player-bridge`）；先核对现有根 `package.json`/`package-lock.json`，不在 1A 或方案确认前安装依赖。
- 通过 PlayerBridge 操作当前 Sorane controller；React 读取快照，不维护播放时钟或循环状态。
- 验证 route remount、错误、切歌、浏览器自动播放和真实歌词同步。
- 不搬移或复制上游 audio 模块；集成通过后再单独决定目录迁移。

验收：真实浏览器下播放、seek、全曲/逐句/逐段、循环、速度、读音及卸载回收行为通过。

## 阶段 1C：本地歌曲包加载与兼容性收尾

本阶段根据用户明确的 1C 指令补充，限定为阶段 1 播放器的数据链路。依赖：1B 完成、现有 Node >=24/Python >=3.12 和项目依赖、Sorane schema 1 构建工具；不引入业务后端或中间件。

交付物：运行时 catalog 校验、歌曲资源预检、曲库到练习路由的数据衔接、取消与重试、哈希资产准备、回归测试和 [1C 报告](PLAYER_BRIDGE_1C_REPORT.md)。

- 保持 `song.json` 源包与 Python build 的公开 `library.json` 区别，保留三档原曲、歌词/token 原曲秒数、可选读音及顶层 chunks 索引。
- 挂载前校验 JSON/schema/时间区间/分块覆盖/路径及所选资源，缺失资源不初始化播放器，可重试；离页取消查询，切歌隔离旧会话。
- React 只管理加载和页面状态；播放状态、音频时钟、循环和调度继续由 Sorane 经 Bridge 提供。
- 自动化覆盖非法包、资源缺失/损坏、错误恢复、路由取消、StrictMode 和旧请求隔离；运行原有回归及生产构建。

验收状态：自动化、合成音构建链路及上游公开 STRiNGS 包的桌面功能验证通过（42 句、403 个资产）。真实包在隔离目录核对并通过当前 React Host 播放；修复隐藏标题栏导致歌词目录不可达的问题，已实测段落循环回跳与缺失资产重试恢复。完整逐词听审、移动设备与堆快照不属于本次已验证结论；不重做用户已经通过的 1B 浏览器验收。

## 阶段 2：React 业务页面与契约

依赖：阶段 1B 通过、1C 歌曲包链路收尾；API 暂用有版本的 Mock contract。

- App Shell、登录状态、基础曲库、我的歌曲、歌曲详情/练习页、上传和任务状态页面。
- React Router + TanStack Query + Zustand（仅 UI 状态），播放状态只来自 Bridge。
- 完成 Utae wrapper 到 Sorane song entry 的 fixture 映射测试。

验收：路由刷新、loading/empty/error/权限状态清晰；真实 Player fixture 可加载；没有服务端时明确为 Mock。

## 阶段 3：Java 业务 API 与基础数据

依赖：阶段 2 DTO/API 契约稳定。

- Java 21 + Spring Boot 3 模块化单体、MyBatis、Flyway、MySQL。
- 登录/会话、song/song ownership、输入修订、候选和发布版本、歌词/资产 API。
- MinIO 资产访问和 Range 授权；Redis 只在有明确缓存/限流场景时接入。
- 首个迁移前评审字段、索引、外键和删除策略；运行真实 MySQL migration 测试。

验收：user scope 越权测试通过；Manifest 映射、版本查询、资产 Range 和私人/共享隔离集成测试通过。

## 阶段 4A：单曲 Studio Adapter 和人工门禁

依赖：Studio commit、Python 3.12/模型环境与本地任务目录策略核实；不引入 MQ。

- 本地 Adapter 调用固定 Studio CLI，保存 input fingerprint 和 Studio task directory。
- Worker/Adapter 推进确定性阶段；alignment evidence 不足时进入 `NEEDS_REVIEW`。
- 授权人处理歌词/对齐报告后，通过 Utae review command 记录决定，再调用 Studio `accept` 并恢复原任务。
- 生成候选包并做 schema/资产校验；playback review 和 Utae publish approval 独立。
- 发布产生不可变 `packageVersion`；不覆盖已有版本。

验收：单曲断点恢复、用户/维护者复核、失败路径和发布门禁端到端可重现。

## 阶段 4B：Outbox、RabbitMQ 和 Python Worker

依赖：阶段 3 与 4A 契约通过。

- 数据库事务写 Outbox；Publisher 可重发；Worker 消费幂等、租约/fencing、有限重试、ACK 和 DLQ。
- Python Worker 复用同一 Studio Adapter，不改变 CLI/人工门禁语义。
- Redis、MinIO、RabbitMQ 使用真实服务完成故障恢复验证。

验收：重复消息不重复生成候选/发布版本，worker 重启和过期 lease 不让旧回报覆盖新结果。

## 阶段 5：学习管理

依赖：认证、版本 API 和歌曲播放可用。

- 按歌曲+版本保存播放进度；约 5 秒节流，暂停/seek/切歌/离页立即保存。
- 收藏绑定具体版本歌词行；仅经确认的一对一映射建议跨版迁移。
- 有意义学习事件、最近练习和复习任务；明确私人删除和共享撤回策略。

验收：并发进度保护、收藏幂等、版本绑定和删除/撤回场景通过数据库/API 测试。

## 阶段 6：Learning Agent 与 Harness

依赖：真实学习数据和复习任务 API。

- Java Tool Registry 和一个复习建议场景。
- 参数 Schema、user scope、读写权限、预算、超时、重试、Run/Step/Tool Call Trace。
- 与 Studio 制作辅助 Agent 保持独立身份、工具和审计。

验收：Agent 只能读取真实学习数据和调用白名单工具；越权、预算、超时和无数据路径均有 Trace。

## 阶段 7：维护者操作体验与完整验收

依赖：阶段 4A/4B、学习/Agent 目标范围完成。

- 提升候选版本比较、批量维护、失败任务检索、审核证据查看和撤回操作体验。
- 阶段 4 已要求存在最小可用 review/publish 操作 API/UI；本阶段是效率和审计 UX 完善，不延后发布门禁的首版实现。
- 按 [ACCEPTANCE.md](ACCEPTANCE.md) 和 [ONE_WEEK_PLAN.md](ONE_WEEK_PLAN.md) 做完整回归。

验收：完整链路从干净环境可复现；真实浏览器/设备、真实基础设施和人工证据均有记录。

## 阶段依赖概览

```text
0 -> 1A -> 1B -> 1C -> 2 -> 3 -> 4A -> 4B
                               └------> 5 -> 6
                                        4A/4B + 5/6 -> 7
```
