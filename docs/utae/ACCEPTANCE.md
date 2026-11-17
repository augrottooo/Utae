# 验收标准

## 事实状态标记

- **源码确认**：通过指定 commit 的文件阅读确认。
- **测试验证**：命令在声明的环境中实际运行并记录结果。
- **设计建议**：本轮确定的目标方案，尚未实现。
- **待验证**：需要真实服务、浏览器、设备或 Studio/模型才能确认。

## 阶段 1 播放器

- [x] 阶段 1A 的静态页面 Bridge 原型可驱动已存在的 Sorane Player 能力；命令/快照/事件出口由 `player.js` 实现并测试。2026-11-16 用户确认验收完成；JS 17/17、Python 7/7，通过范围仅限本地合成音测试包，详见 [1A 报告](PLAYER_BRIDGE_1A_REPORT.md)。
- [x] 1A 生命周期：AudioContext 关闭及替换 audio 后重新初始化有用户浏览器反馈；AudioNode 清理、Transport 监听器移除、清理顺序与重复 dispose 有源码及自动化测试依据。未做浏览器堆快照测量。
- [x] 阶段 1B React 页面通过单实例 host 加载 schema 1 歌曲包；React 不拥有第二套播放时间/循环状态。源码核查、9 项前端测试及用户实际浏览器验收通过，见 [1B 报告](PLAYER_BRIDGE_1B_REPORT.md)。
- [ ] 首次播放、暂停/继续、seek、切歌和卸载无残留事件；disposal 范围与模块缓存/AudioContext 所有权一致。
- [ ] 全曲、逐句、逐段、单句循环、范围循环和 1/0.75/0.5 速度行为正确。
- [ ] 歌词高亮读取同一个音频 transport；断流和解码失败状态可恢复。
- [ ] 人声/伴奏/朗读控件只在资产存在时出现。

阶段 1B **本轮验收通过，待确认提交**（2026-11-17）。React 宿主、Bridge 快照订阅、路由卸载、StrictMode 重挂、旧快照隔离、初始化失败重试和资产映射已由自动化验证。用户明确确认当前网页的页面、路由、刷新及相关功能均正常，记录为用户实际浏览器验收通过；此前 5173 绑定失败已不构成本轮验收阻塞，不要求重复手测。上面其余未勾选项保留为更广泛的真实歌曲包、人声朗读、移动设备及故障场景矩阵，不代表当前 1B 宿主仍待验收；本轮没有新增浏览器堆快照或设备矩阵测量。

## 阶段 3 业务后端

- [ ] Flyway 在真实 MySQL 执行，字段/索引/外键与文档一致。
- [ ] 私人/共享/维护者权限和资产 Range 访问通过集成测试。
- [ ] 上传、SHA-256 去重、版本不可变和错误结构通过 API 测试。

## 阶段 4 Pipeline

- [ ] 相同 `(user,operation,Idempotency-Key,requestHash)` 返回同 Job；key 重用但 request hash 不同返回冲突。
- [ ] 同任务 retry/resume 复用 input revision、Studio task 和 Job；输入、配置或 Studio commit 改变时创建新 revision/Job。
- [ ] Studio alignment review -> 人工批准 -> Studio `accept` -> resume -> candidate -> playback review -> Utae publish approval 各自可追踪。
- [ ] `Studio install` 仅进入隔离 staging；任何工具/Worker 都不能绕过 Utae publish gate。
- [ ] 上传 -> MinIO -> MySQL -> Outbox -> RabbitMQ -> Worker -> 状态更新；重复消息、worker 重启、lease 过期和有限重试不产生重复 candidate/version。
- [ ] 可选步骤失败写 job outcome `PARTIAL_SUCCESS`，不会改变旧发布版本可用性。

## 阶段 5 学习

- [ ] 播放进度约 5 秒节流；暂停、跳转、切歌和离开页面立即保存。
- [ ] 并发保存按版本或时间条件更新，旧进度不能覆盖新进度；位置不超过时长。
- [ ] 收藏新增/取消幂等并严格校验 line 归属；学习事件不记录每次 tick。
- [ ] 私人删除取消/围栏活动任务，清除学习进度、收藏、复习任务和可识别学习事件，MinIO 清理可重试。
- [ ] 共享撤回隐藏新访问但保留其他用户历史引用和审核记录。

## 阶段 6 Agent

- [ ] 真实学习数据由白名单只读工具查询。
- [ ] 未知工具、越权参数、Schema 错误、超时和预算耗尽被阻断并记录。
- [ ] 写工具经过 user scope 和业务 Service，重复调用幂等。
- [ ] Run/Step/Tool Call Trace 能查看状态、耗时、错误摘要和脱敏参数。

## 全量回归

- [ ] 从空环境按 README 启动。
- [ ] 真实 MP3/LRC/歌曲包端到端播放和练习。
- [ ] 不把编译通过、静态页面打开或 Mock API 通过当成完整验收。
