# 第一轮开发后的调试、复查与验收计划

本文件只规划 **第一轮 MVP 实现完成后的一个验证时间盒**。一周用于调试、架构复查、端到端验收和修复高优先级问题；它不是全部 MVP 阶段的开发承诺，不用于压缩必要测试，也不引入额外功能。

开发阶段与依赖顺序唯一维护在 [ROADMAP.md](ROADMAP.md)。本文件不重复列功能开发任务；某个路线阶段尚未实现或其基础设施尚未启动时，该项标记为“未覆盖/阻塞”，不得伪记为通过。第一轮验证未通过的工作进入缺陷队列并延长验收时间。

## 验收前置条件

- 已按 ROADMAP 完成待验收范围，并冻结待测 commit、测试歌曲包及环境版本。
- Node.js >=24、Python >=3.12；MySQL、Redis、RabbitMQ、MinIO 的版本按实现锁定。
- React 与 Sorane Player Bridge 有可运行构建；Studio Worker 和 Learning Agent 仅在各自阶段已实现时纳入。
- 任何所需工具安装或环境调整都先提出项目级方案与影响，等待用户确认；不得升级全局 Node/Python 或修改 Windows/WSL 环境。

## 七天验证时间盒

### Day 1 — 基线与环境复核

- 核对 commit、锁文件、`.env.example` 和依赖版本；确认项目级 Node/Python 可执行文件。
- 从干净数据启动本轮已实现的服务，运行单元、格式、迁移和健康检查。
- 核对真实 MySQL migration、索引、外键和状态约束（若阶段 3 已完成）。

交付：可复现启动记录和阻塞项。

### Day 2 — PlayerBridge 浏览器回归

- 用真实 schema 1 歌曲包检查 React host mount/unmount、加载、暂停/继续、seek、切歌和 stale request。
- 检查歌词同步、全曲/逐句/逐段、循环、三档速度、读音、人声/伴奏以及资产缺失降级。
- 覆盖桌面浏览器与已纳入目标的移动浏览器。

交付：浏览器/设备、歌曲包 hash、步骤、结果和音频问题复现条件。

### Day 3 — API、身份、Manifest 与资产

- 检查登录/登出/过期会话、CSRF、普通用户/所有者/维护者的 user scope。
- 对比真实 Sorane fixture 与 Utae `playerSong` 映射；核对秒/毫秒转换。
- 检查音频 Range、越权资产访问、版本查询、候选包和错误响应。

交付：API 集成测试结果及权限矩阵失败用例。

### Day 4 — Studio 本地任务恢复

- 若 Stage 4A 已完成，验证一首真实歌曲从固定输入 revision 到 Studio alignment `NEEDS_REVIEW`、人工 approve、Studio accept、resume 和 candidate。
- 故意中断/重启 Worker，验证输入 fingerprint、task directory、阶段产物和 fencing 恢复。
- 核实对齐报告、playback review、Studio install 到 staging 与 Utae publish 不是同一门禁。

交付：状态轨迹、尝试次数、产物 hash、人工决策和失败原因。

### Day 5 — Outbox/MQ 与数据一致性

- 若 Stage 4B 已完成，覆盖 Outbox 重复发布、MQ redelivery、竞争 claim、ACK 顺序、DLQ 和有限重试。
- 检查候选对象写入成功/数据库失败、数据库提交后 worker 崩溃等恢复路径。
- 用相同 Idempotency-Key + 相同/不同 request hash 检查重复请求和冲突处理。

交付：消息重复和故障注入结果。

### Day 6 — 学习数据和 Agent Harness

- 若 Stage 5/6 已完成，检查进度乱序保护、收藏幂等、复习任务版本行绑定和删除/撤回行为。
- 检查 Learning Agent 只使用白名单工具、真实 user data、超时/预算和脱敏 Trace。
- 确认制作辅助 Agent 无法执行 Learning Agent 工具，也无法绕过人工 accept/publish。

交付：隐私/越权用例、Agent Run/Step/Tool Trace 和结果。

### Day 7 — 完整链路与回归决策

- 仅当所有相应阶段都实现时，按 [ACCEPTANCE.md](ACCEPTANCE.md) 跑完整业务链路。
- 重跑所有修复过的测试和关键音频路径，整理已知问题、证据与复现步骤。
- 结论分为通过、失败、未覆盖、环境阻塞；任何必需项未覆盖都不能汇报“完整验收通过”。

交付：验收报告、缺陷队列、是否进入下一轮的决策材料；不在验收周追加 MVP 功能。

## 与路线图的关系

`ROADMAP.md` 说明先做什么、依赖什么、每个开发阶段要实现哪些能力；本文件说明第一轮实现之后如何用一周发现和修复问题。它们不是两份开发排期，也不互相覆盖。
