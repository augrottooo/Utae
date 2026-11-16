# 架构决策记录

## ADR-001：React 作为业务前端

- 背景：需要多页面曲库、上传、任务、学习和 Agent UI，同时保留成熟播放器。
- 方案：Vue、React 或继续扩展静态 DOM。
- 选择：React + TypeScript + Vite + React Router；TanStack Query 管服务端数据，Zustand 管 UI 状态。
- 理由：Vue 也能满足需求，但两者都必须面对当前 Player 的固定 DOM；React 的路由、异步数据和 headless 组件生态更适合预期的曲库/任务/Agent 多页面，团队也已明确 React 作为目标。播放状态通过 Bridge 隔离，避免让 React 重写音频调度。
- 影响：Player 当前固定 DOM，必须先做单实例宿主和适配器；不能宣称已有 npm Core。

## ADR-002：Sorane Player 是唯一播放核心

- 背景：上游已有 transport、分块、缓存、混音、时间轴和练习行为。
- 选择：保留音频核心和测试，React 只替换业务 UI。
- 理由：降低音频时序和真实设备回归风险。
- 影响：需要逐步隔离固定 DOM；不得再实现第二个 HTMLAudio/歌词时钟。

## ADR-003：PlayerBridge 是集成边界

- 背景：`web/src/player.js` 访问固定 DOM ID，不能直接作为 React hook 或无 UI Core。
- 选择：单实例 `SoranePlayerHost` + `PlayerBridge`，显式命令、快照和事件。
- 理由：集中生命周期和并发取消，后续可逐步替换 UI。
- 影响：Bridge 命令、snapshot、subscribe、dispose 均需修改 `web/src/player.js` 后才能提供；阶段 1 分 1A 静态原型和 1B React 宿主集成。

## ADR-010：先验证边界，再演进目录

- 背景：Sorane Player 的模块位于 `web/src/audio/`、`web/src/player.js`、`lyric_player/` 和 `tests/`，依赖固定 DOM。
- 选择：阶段 1 原位保留这些模块；React 通过 `apps/web -> packages/player-bridge -> 当前 web/src` 引用，不复制/移动上游代码。
- 理由：先证明 controller/event/lifecycle 合同，再决定是否抽包或迁移，避免大规模改动播放器。
- 影响：真实浏览器集成测试通过后才能评估目录整理；历史保留并以独立 commit 记录来源。

## ADR-011：开发工具链必须项目级且经确认

- 背景：Player 声明 Node >=24、Python >=3.12；默认命令为 Node 22.23.4，`python`/`py` launcher 不可用，但机器上存在可显式调用的 Node 24.22.1 和 Miniconda Python 3.13.13。
- 选择：阶段 1 先只读核查已安装的项目级运行时；缺失时提出项目级固定版本方案和影响，等待用户确认后再安装。
- 理由：不改变全局 Windows/WSL 配置、不影响其他项目。
- 影响：1A 已使用显式 Node 24.22.1、Python 3.13.13 完成版本与测试验证。可移植项目脚本固定仍留后续，不把 1A 本机验收等同为干净环境可复现；没有安装或升级工具，也没有修改全局 PATH。

## ADR-012：阶段 1B 使用同仓 npm workspaces

- 背景：Sorane 当前根目录已有 `package.json` 和 `package-lock.json`，React 宿主与 Bridge 需要逐步接入；阶段 1 不能复制音频核心或提前安装依赖。
- 选择：阶段 1B 前选择同仓 npm workspaces，目标边界为 `apps/web` 和 `packages/player-bridge`；workspace 配置只在根包/锁文件兼容性核对后加入。
- 理由：保持上游源码和测试原位，允许 React/Bridge 通过明确包边界引用现有模块，并让一次安装保持锁文件一致。独立 package 或多仓拆分留到 1B 集成通过后重新评估。
- 影响：1A 不创建 workspace 依赖、不执行安装；1B 开始前必须记录根 `package.json`/`package-lock.json` 的兼容检查结果。

## ADR-004：Studio 通过 CLI/Adapter 和 Worker 调用

- 背景：Studio 是独立制作工具链，可能依赖模型、文件锁、阶段产物和人工复核。
- 选择：先本地 Adapter 端到端验证，再将同一 Adapter 放入 RabbitMQ Worker。
- 理由：保持 Studio 的恢复和审计语义，避免把未知内部 API 绑进 Java。
- 影响：Worker 不自动发布；Studio commit 和命令必须在阶段 4 重新核查。

## ADR-005：模块化单体

- 背景：业务边界清楚但早期规模有限。
- 选择：Java Spring Boot 一个进程，内部按 auth/catalog/processing/learning/agent 分模块。
- 理由：保留事务和调试简单性，不提前承担微服务治理成本。

## ADR-006：不可变歌曲包版本

- 背景：学习记录和收藏需要可追溯，制作重试不能破坏已发布资产。
- 选择：`schemaVersion` 表示格式，`packageVersion` 表示业务版本；新制作生成新版本。
- 理由：可回滚、可审计、可明确歌词行继承关系。

## ADR-007：基础设施按真实场景使用

- MySQL 保存业务事实，Redis 只缓存/限流，RabbitMQ 只调度制作任务，MinIO 保存资产。
- Outbox 解决数据库与消息发布双写；Worker 消费必须幂等。
- 影响：基础设施接入前先用 Mock/本地 Adapter 验证业务契约，不能为了展示技术栈提前强行接入。

## ADR-008：Agent 只能通过 Tool Registry

- 背景：复习建议必须基于真实数据并可审计。
- 选择：Java 管理 Run/Step/Tool Call，工具白名单、Schema、权限、预算、超时和 Trace。
- 理由：阻止 LLM 直接拼 SQL 或越权访问对象存储。
- 影响：首版只做一个复习建议场景，失败和无数据都返回明确状态。

## ADR-009：MyBatis 与 CSS Modules

- 后端选择 MyBatis 显式 Mapper/SQL，配合 Flyway；用户 scope 和资产权限条件留在可审查的 SQL 中，避免通用 CRUD 绕过授权边界。
- 前端选择 CSS Modules + CSS variables，不使用重型后台 UI 套件；Radix UI primitives 和 Lucide React 仅在需要时加入。
- 影响：样式和查询由项目维护，但依赖更少、视觉控制明确，且安全条件更容易审查。
