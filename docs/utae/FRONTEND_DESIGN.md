# React 前端设计

## 技术选择

目标前端统一使用 React + TypeScript + Vite + React Router。TanStack Query 管理服务端数据和缓存，Zustand 管理显示开关、面板和非播放偏好。样式采用 CSS Modules + 全局 CSS variables，避免大型后台组件库限制练习页排版；只在对话框、菜单等复杂无障碍交互需要时采用 Radix UI primitives，图标使用 Lucide React。

React 负责页面和业务交互；Sorane Player 负责音频时钟、播放状态、循环边界、歌词同步和音频调度。两者不允许各自维护一份播放状态。

## 路由建议

```text
/library                         基础曲库
/mine                            我的歌曲
/songs/:songId                  歌曲详情与练习入口
/songs/:songId/practice         练习页面（PlayerBridge 宿主）
/uploads/new                     上传歌曲
/processing/jobs/:jobId          制作任务和失败恢复
/learning                        进度、收藏和复习任务
/agent/runs/:runId               Agent Trace
/maintainer/reviews              维护者复核（角色守卫）
```

路由只描述页面；歌曲包和播放状态由 Bridge/Query 提供，不能在路由组件内重新实现播放器。

## 组件边界

```text
AppShell
├─ LibraryView / MySongsView
├─ SongPracticePage
│  ├─ SoranePlayerHost
│  ├─ LyricContext
│  ├─ PracticeControls
│  └─ LearningActions
├─ UploadView / ProcessingJobView
├─ LearningView
└─ AgentDrawer / AgentTraceView
```

`SoranePlayerHost` 只负责挂载和销毁 Bridge；`LyricContext` 从 Bridge 的当前快照读取行号，不自行计算 currentTime。TanStack Query 缓存歌曲、Manifest、任务和学习数据；Zustand 不保存服务端事实。

API client 使用同源 `/api` base URL，Fetch/Axios 请求携带 Cookie credentials。登录由服务端设置 HttpOnly Cookie；前端从 `/api/me` 读取会话展示状态，不能把 token 或 userId 存 localStorage 作为授权。POST/PUT/DELETE 通过 `/api/auth/csrf` 获取的 token 按服务端约定放入 header；401 进入未登录状态，403 保持登录并展示权限错误。

## 练习页原则

- 罗马音默认显示，日文为原文，已有中文翻译为辅助内容。
- 当前句突出，上一句/下一句提供上下文；点击歌词通过 Bridge seek。
- 逐句、逐段、全曲和速度控制靠近练习区域；循环状态用文字和图标同时表达。
- 只有 Manifest 提供独立人声/伴奏或 narration 时才显示对应控件。
- 不使用大封面、长进度条、卡片套卡片或全屏聊天布局。
- 加载、待处理、部分成功、失败和重试入口必须明确，不能只依赖颜色。

## 生命周期与错误

组件挂载初始化一个 PlayerBridge，卸载时取消事件订阅并调用 controller disposal。1A 已实现 controller/Bridge dispose：先清理 transport 会话与监听器，再断开 mixer 图并安全关闭其独占 AudioContext。Bridge 替换整个 audio 元素，React 重挂必须提供新 DOM；不能复用旧 audio 来创建新的 MediaElementAudioSourceNode。cache/decoder 后台工作不保证全部取消，generation 防止过期结果挂载。切歌、seek 和速度切换都使用请求代号，过期异步结果不能覆盖当前会话。React 错误边界显示播放器错误并提供重新加载；不把浏览器自动播放拒绝误报为歌曲处理失败。

视觉规则和色彩 token 以本文件后续实现版本为准；阶段 1A 已完成；阶段 1B 尚未开始，React 页面在获准后实施。
