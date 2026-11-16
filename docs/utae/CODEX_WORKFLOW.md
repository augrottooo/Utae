# Codex 工作流

## 首次进入任务

1. 阅读 `AGENTS.md`、`README.md` 和 `docs/utae/` 中当前阶段引用的规范；历史仓库切换记录不作为当前需求来源。
2. 检查当前新仓库、上游 commit、Git 状态、依赖声明和测试入口；严禁查找、读取、检查、迁移或修改旧版 Utae 仓库及其 Git 状态。
3. 阶段 1 前验证 Node >=24、Python >=3.12。默认命令不满足时，先核查可显式调用的项目级运行时；若仍缺少版本，再提出项目级工具链方案及安装影响，等待用户确认；不得修改全局工具或 Windows/WSL 配置。
4. 输出源码确认、测试验证、设计建议和待验证假设。
5. 给出文件级计划、验收命令和不改动范围，等待确认后编码。

## 阶段开发

- 先复述本阶段目标和不包含项。
- 小步修改，保持 Sorane 音频核心和歌曲包格式兼容。
- 每次修改后运行与改动相关的单元测试、格式检查和最小集成测试。
- 失败时定位、修复并重新运行失败测试；不要用“理论上可用”替代结果。
- 汇报修改文件、命令、结果、剩余风险和下一阶段依赖。

## 必查风险

- PlayerBridge 是否出现 React 与 Sorane 双重播放状态。
- 歌曲包 schemaVersion、业务 packageVersion 和歌词稳定 ID 是否混淆。
- 上传、Outbox、MQ 重复消息、Worker 重试和候选包发布是否幂等。
- HTTP idempotency key、input revision fingerprint、execution attempt 和 package candidate 是否被区分。
- Studio alignment review/accept、playback review、isolated install 和 Utae publish approval 是否独立。
- 查询和写入是否从会话 user scope 授权，资产 URL 是否受保护。
- Agent 工具是否白名单、校验参数、检查权限、限制预算并脱敏 Trace。

## 禁止事项

- 不查找、读取、检查、迁移或修改旧版 Utae 仓库；不把 `docs/REPOSITORY_SWITCH_2026-11-13.md` 中的历史事实当作当前实现来源。
- 不把尚未运行的测试、未接入的基础设施或未验证的 Studio 调用写成完成。
- 不在没有方案评审的情况下重写 Sorane Player 核心、删除许可证或引入微服务。
- 未经用户明确要求不改 Git remote、提交、推送、系统环境、Docker/WSL 或端口。

## 最终验收

按 [ACCEPTANCE.md](ACCEPTANCE.md) 从干净环境验证真实歌曲包、上传制作、学习记录、权限和 Agent Trace。浏览器和真实音频验证是播放器完成的必要条件。
