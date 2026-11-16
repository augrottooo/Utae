# Learning Agent 与 Harness

Learning Agent 由 Java 后端管理，目标是根据真实学习数据给出可解释的复习建议。LLM 不得直接访问 SQL、MinIO 或 RabbitMQ。

## 白名单工具

| 工具 | 权限 | 作用 |
| --- | --- | --- |
| `get_recent_learning` | READ | 读取当前用户最近学习事件和进度 |
| `get_song_detail` | READ | 读取用户有权访问的歌曲和歌词摘要 |
| `get_line_pronunciation` | READ | 读取原文、罗马音、翻译和朗读资产状态 |
| `create_review_task` | WRITE | 为当前用户创建复习任务 |

每个工具注册 name、描述、JSON Schema、权限、超时、输入校验、输出 Schema 和 Service executor。未知工具直接 `BLOCKED`。

## 执行流程

```text
创建 Run -> 构建受限上下文 -> 请求模型 -> 校验工具调用
  -> user scope/业务权限 -> 执行工具 -> 写 Tool Call Trace
  -> 继续模型或生成回答 -> 持久化最终状态
```

Run 状态：`RUNNING/SUCCEEDED/FAILED/LIMIT_REACHED/CANCELLED`。

Step 状态：`RUNNING/SUCCEEDED/FAILED/SKIPPED`。

Tool Call 状态：`RUNNING/SUCCEEDED/FAILED/TIMED_OUT/BLOCKED`。

## Harness 约束

- 每次 Run 限制模型轮数、工具调用数、上下文字符数和总时间；默认值只是配置起点，不是性能承诺。
- 工具失败只对明确的暂时性错误有限重试；写工具不得自动重复产生重复复习任务。
- 每次状态变更持久化，记录脱敏参数摘要、结果摘要、耗时和错误码。
- Trace 不记录 API Key、完整签名 URL、完整音频内容或无关个人数据。
- 模型不可用、权限失败、预算耗尽时返回明确状态，不编造学习历史。
- Agent 建议中的歌曲、句子和学习事实必须能由 Tool 结果追溯。

## 测试与评测

至少覆盖未知工具阻断、Schema 错误、越权 song/line、预算耗尽、工具超时、重复写工具、空学习历史和真实学习事件引用。后续增加固定输入/工具夹具，验证同一数据下 Run 状态和 Trace 可重复。

本文件是设计建议；当前仓库没有 Java Runtime、Tool Registry 或 Trace 实现。
