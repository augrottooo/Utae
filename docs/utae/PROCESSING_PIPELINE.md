# 歌曲制作 Pipeline

## 参与角色

- **Python Worker**：执行可重复、确定性的文件/模型/校验步骤；不做网络资料判断、不听音决策、不调用 Learning Agent，也不批准发布。
- **制作辅助 Agent（可选）**：Sorane Studio `agent` 子命令可启动配置的宿主 Agent。它可以检索和整理证据、准备歌词草稿、指出疑点；它不是 Utae Learning Agent，也没有自动 `accept` 或发布权限。
- **上传者/歌曲所有者**：补充私人歌曲所需的歌词来源、版本信息和修订输入，可审核仅自己可见的私人候选。
- **Utae 维护者**：负责共享曲目的歌词/来源/版权和包质量复核，执行 Utae publish decision。
- **Learning Agent**：只处理用户学习数据、复习建议和复习任务；不访问 Studio 任务目录、不搜索歌曲来源、不审听或批准歌曲包。

资料查找、版本识别、歌词完整性、段落判断、专名读音、对齐疑点、朗读质量和目标设备听感都不能假设由 Worker 自动完成。第一版让 Worker 自动执行确定性步骤，遇到任何不能按规则确认的情况进入 `NEEDS_REVIEW`，由歌曲所有者或维护者处理并恢复同一个 Studio task。

## 审批门与 staging install

```text
输入修订
  -> Worker 调用 Studio CLI: start / doctor / run
  -> NEEDS_REVIEW: Studio alignment review (人工决定)
  -> Studio CLI accept --report alignment-review.json
  -> Studio CLI run 继续生成音频、读音、分块和预览
  -> Utae 私有 candidate 上传 MinIO
  -> playback review (实际播放器/设备验收)
  -> Studio CLI install 到隔离 staging library（可选的 Studio 本地验收门）
  -> Utae maintainer review + publish approval
  -> 创建 song_package_version，更新 current version pointer
```

审批含义不能混用：

1. **Studio alignment review / `accept`**：确认 alignment evidence 报告。`accept` 只写入 Studio job 的对齐批准文件，不表示成品包已验收或可发布。
2. **Playback review**：按 Studio 的 playback template，在 Sorane Player 中实际检查全曲、逐句/逐段、seek、三档速度、移动端首次播放和有朗读时的 narration。报告属于候选包和目标设备的证据。
3. **Studio `install`**：它不是发布审批，而是可选的本地技术验收步骤，把包复制到隔离 staging library。Utae 不把生产 MinIO/公共曲库挂载给 Studio。
4. **Utae publish approval**：独立的业务审批。共享歌必须由维护者确认来源/许可、歌词和包质量后发布；Studio `accept` 和 `install` 都不能代替它。私人歌由所有者决定是否在其私人曲库启用。

候选包先进入按用户授权的 MinIO 私有区域，才能进行 Utae 的浏览器/设备播放复核；这不代表已经进入基础曲库。播放报告和业务 review 均绑定候选包 SHA-256，包内容改变后旧报告失效。

## 状态模型

### Song visibility 与 lifecycle

`visibility` 和 `lifecycle_status` 是独立字段：`visibility` 为 `PRIVATE/SHARED`，表示访问范围；`lifecycle_status` 为 `ACTIVE/WITHDRAWN/DELETING/DELETED`，表示生命周期。私人歌和共享歌都可以处于 `ACTIVE`；共享歌曲撤回时保持 `visibility=SHARED` 并转为 `WITHDRAWN`，私人删除进入 `DELETING` 并在关联清理完成后转为终态 `DELETED`。共享歌曲若因权利要求需删除，也使用 `DELETING -> DELETED`。

私人歌曲通过候选包复核后，只有维护者完成来源/许可、歌词和播放证据审核并批准发布，才在同一发布事务中设置 `visibility=SHARED`、保持 `lifecycle_status=ACTIVE` 并更新当前发布版本。审核拒绝或待复核时仍为 `PRIVATE/ACTIVE`，不进入基础曲库。撤回后的共享歌曲经维护者重新审核并重新发布时，可从 `SHARED/WITHDRAWN` 恢复为 `SHARED/ACTIVE`；撤回期间保留历史用户引用。

### ProcessingJob workflow

`QUEUED`、`RUNNING`、`NEEDS_REVIEW`、`CANDIDATE_READY`、`COMPLETED`、`FAILED_RETRYABLE`、`FAILED_FINAL`、`CANCEL_REQUESTED`、`CANCELLED`。

Job 另有结果字段 `SUCCESS/PARTIAL_SUCCESS/FAILED`。`PARTIAL_SUCCESS` 表示原曲和必需资源可用、某些可选资源（例如 narration）缺失；它不是 review 状态，也不表示已发布。若等待复核，workflow status 仍为 `NEEDS_REVIEW`，结果字段可说明部分成功。

### Stage / review

- Stage：`PENDING/RUNNING/SUCCEEDED/SKIPPED/FAILED`；`processing_stage` 保存当前状态和 checkpoint，`processing_stage_attempt` 为每次执行单独记录 attempt、输入 fingerprint、fencing/lease、产物 hash 和错误摘要。
- Review：`PENDING/CHANGES_REQUESTED/APPROVED/REJECTED`，按 `STUDIO_ALIGNMENT`、`PLAYBACK`、`UTAE_PACKAGE`、`UTAE_PUBLISH` 类型追加记录。
- 歌曲当前发布版本只在 Utae publish approval 成功后更新；新 job 失败不改变旧版本可用性。

## 输入修订和幂等

创建 Job 时固定不可变 `input_revision`，包含音频 SHA-256、LRC/歌词 SHA-256、标题/歌手和制作选项、Provider/模型配置指纹、pipeline 版本、Studio commit 和提示词/contract 指纹。敏感值只保存摘要，不保存密钥。

- HTTP `Idempotency-Key` 的作用域为 `(user_id, operation, key)`；数据库以 `(requested_by_user_id, job_type, request_idempotency_key)` 唯一保存，并记录 canonical `request_hash`。同 key + 同 hash 返回原 job；同 key + 不同 hash 返回 `409 IDEMPOTENCY_KEY_REUSED`。`job_type` 是 operation 的持久化区分值。
- 同一 Job 的 retry/resume 继续同一个 Studio task directory 和 job ID，只增加该 stage 的执行 attempt/generation，不新增 Song、InputRevision 或业务版本。
- 音频、歌词、metadata、provider/config、pipeline 或 Studio commit 任一输入变化都新建 `input_revision` 和 Job。不能从不同 fingerprint 的旧 checkpoint 恢复。
- 相同 InputRevision 下用户主动要求“原样重新制作”时，保留原 InputRevision，但创建新的 ProcessingJob、新 HTTP `Idempotency-Key` 和全新的独立 Studio task directory；新 Job 的 stage generation 从初始值开始，候选按新 Job 隔离。它不复用旧 Job 的 checkpoint，也不因创建 Job 自动产生新的已发布业务版本。
- 同一 Job 的 retry/resume 复用该 Job 和原 Studio task directory；retry 创建同 Job 的新执行 attempt，resume 仅在审核批准后推进同一任务。RabbitMQ redelivery 保留原 message/generation 并复用同一 stage attempt，不创建 Job、task directory 或 attempt。
- 候选包唯一键为 `(job_id, package_sha256)`；确定性 object key 至少含 tenant/song/input revision/job/package hash/asset role。不同内容不能覆盖旧候选。

## 执行与恢复顺序

1. `POST /api/songs` 校验 user scope 和文件，持久化原始资产、Song 和 InputRevision；上传请求只记录自己的幂等键与请求 hash。随后 `POST /api/songs/{songId}/processing-jobs` 校验该 InputRevision，持久化一个 ProcessingJob 和初始 Outbox event；两次请求不能互相隐式创建对方的记录。
2. Outbox publisher 以 `dedupe_key = job_id:stage:input_fingerprint:event_intent:generation` 发布 RabbitMQ 消息。每个 Job 的每个 stage 首次执行使用 `event_intent=RUN, generation=0`；同 Job 明确重试使用 `RETRY`，人工 review 通过后的恢复使用 `RESUME`，两者都递增该 stage 的 generation。相同 InputRevision 的原样重新制作使用另一个 Job，因此拥有独立的 generation 序列和 Studio task directory。发送后标记失败会导致同一 generation 的重复消息，属于允许情况。
3. Worker 在数据库中原子 claim Job/Stage，获得递增 fencing token 和 lease；只允许当前 token 提交结果。Worker 调固定 Studio commit 的 CLI：创建新任务时执行 `start` 一次，随后 `doctor/status` 用于诊断，`run` 用于推进/恢复。
4. Studio 在对齐证据不足时生成报告并停下。Worker 把状态回传为 `NEEDS_REVIEW` 并 ACK 已持久化的消息。审核者提交 review API 后，服务端递增 resume generation 并创建新的 Outbox `RESUME` event；Worker 在相同 task directory 上执行 `accept --report`（仅当授权人工决定为 APPROVED）并继续 `run`。相同 generation 的重投只能恢复同一 attempt 结果，不能创建新 candidate。
5. Studio 输出 package 和 preview 后，Worker 校验 schema、文件路径、哈希、时间线和 asset 列表，写入私有 candidate 与 `candidate_asset`，再更新状态为 `CANDIDATE_READY` 或等待 playback review。
6. 审核者用 Utae 受控 Manifest 在 Sorane Player 上做实际 playback review。通过后可把 report 交回 Studio；`install` 若需要，只复制到隔离 staging library。之后仍需独立的 Utae package/publish review。
7. 发布事务创建 `song_package_version`，保存不可变 manifest/资产引用，更新 song 当前发布版本指针并写 Outbox/audit event。对象写入成功但数据库失败时保留可识别孤儿记录，按哈希清理；不得让半成品可见。

## 消息消费、重试和 ACK

- 重复消息以 `(job_id, stage, input_fingerprint, generation)` 找回同一阶段 attempt；已成功的阶段校验产物 hash 后直接短路。新的 generation 只表示一次明确的执行意图，不表示输入发生变化，也不创建新的业务版本。`attempt_no` 只在实际创建新 attempt 时递增；broker redelivery 不递增。
- Worker claim 必须 compare-and-set，lease 到期后允许新 worker 接管；旧 lease token 的回报被 fencing 拒绝。
- 数据库状态和资产引用提交成功后才 ACK；永久输入错误转 `FAILED_FINAL`，暂时错误有限退避重试，达到上限进入 DLQ 并保留错误摘要。
- Outbox publisher 允许重复发布，以 `published_at` 和 dedupe key 可恢复；Outbox 本身的写入与业务记录同事务。`published_at` 只记录至少一次发布尝试成功，不替代 Worker 的消费幂等。
- 同一 candidate 的多次 review 使用 review revision/命令幂等键追加记录；不能靠 `(candidate_id,review_type)` 唯一约束阻止要求修改后的再次审核。

## 首阶段实现顺序

先做一个本地 Studio Adapter 的真实单曲闭环：固定 Studio commit、输入指纹、同任务恢复、alignment gate、候选包校验和人工报告。通过之后再把相同 Adapter 放进 RabbitMQ Worker；MQ 不改变 Studio 的阶段和审批语义。
