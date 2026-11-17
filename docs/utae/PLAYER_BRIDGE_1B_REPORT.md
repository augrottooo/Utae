# PlayerBridge 1B 实施与验收报告

日期：2026-11-17。结论：**本轮 1B 实现与验收完成，待用户确认提交**。本轮没有提交、推送、合并或变基。

## 基线与范围

主工作区 HEAD 为 `d6a18885ae7e907b2f6ce09529e40815232f097a`；`origin/main` 为 `39ef91f7e48f0e9f569cd5c84b8f5c866b24f0fb`。后者仅增加已推送的 1A 格式修复。主工作区中的对应 1A 文件已经包含相同格式结果，相对 `origin/main` 不再出现独立的 1A 格式差异。主分支仍落后一个提交，本轮按授权保持引用不变；以后准备提交时需单独处理基线关系，不能重复提交格式补丁。

原有 1B 未提交文件完整保留。工作内容限定为 React/Vite 单实例宿主、实际 1A Bridge 类型边界、本地 catalog 资产映射、宿主生命周期、路由和现有回归。本轮源码复查未发现阻断 1B 验收的缺陷，收尾只更新状态及使用文档。没有新增依赖、调整锁文件、修改 workflow、上游音频核心或系统配置，也没有开始业务后端与其他阶段。

## 实现与职责

- `apps/web`：React 19 + TypeScript + Vite，提供本地曲库入口与 `/songs/:songId/practice`。TanStack Query 负责 catalog 查询及请求取消，Zustand 仅保存状态详情面板开关。
- `SoranePlayerHost`：在 layout effect 中建立 session，清理时 dispose；切歌、路由卸载、显式重挂和 StrictMode setup-cleanup-setup 均使用该边界。初始化失败显示错误，并允许重新挂载。
- `packages/player-bridge`：直接调用原位 `createPlayerBridge`；导入既有 HTML 模板、去除脚本并创建新 DOM。WeakMap 限制每个 document 一个活跃宿主，正常销毁和失败路径均释放锁。
- session 通过 `subscribe` 缓存上游通知快照，供 `useSyncExternalStore` 读取稳定对象；销毁后忽略旧通知，取消订阅、清空监听器、dispose Bridge，再丢弃 DOM。新的 host 使用全新 audio 元素。
- React 的播放按钮只发 Bridge 命令；`play()` resolve 不会被当作已经播放。当前时间、播放状态、循环、速度及当前歌词行均来自 Sorane 快照。React 未创建时钟、音频上下文或底层调度。
- 上游歌词和练习控件继续由 Sorane DOM 实现；React 显示标题、当前句罗马音和快照状态。本阶段保留固定 ID 和全局样式，不支持多实例，也没有复制上游 audio 模块。
- 本地资产来自 Python build 的内容哈希输出。准备脚本仅补拷缺失的哈希资产并更新 catalog；映射覆盖整曲音频、读音、chunk 索引键和 stereo parts，保持时间值不变。

实际 Bridge 仍采用 catalog 工厂及 `loadSong`；跨 catalog 的目标 `loadPackage` API 继续作为设计草案，未伪记为本轮交付。

## 自动化验证

显式使用已有 Node 24.22.1 和项目依赖；Python 使用已有 Miniconda 运行时。未安装或升级工具。

| 检查                                      | 结果  | 验证范围                                                      |
| ----------------------------------------- | ----- | ------------------------------------------------------------- |
| `npm run format:check`                    | 通过  | 既有全仓 Prettier 检查范围                                    |
| `npm run format:host`                     | 通过  | React、Bridge、宿主测试、脚本及 TS 配置                       |
| `npm run lint`                            | 通过  | 现有 ESLint 配置的 `web/src` JS 范围；TS 通过下述严格类型检查 |
| `npm run typecheck`                       | 通过  | `tsc --noEmit`，严格模式                                      |
| `npm run test:frontend`                   | 9/9   | 5 个宿主生命周期、2 个路由、2 个 catalog 映射测试             |
| `npm test`                                | 17/17 | 原位播放器、时钟/循环/速度、资源释放及事件清理                |
| `python -B -m unittest discover -s tests` | 7/7   | schema、构建、demo 与静态服务回归                             |
| `npm run build`                           | 通过  | 资产准备及 Vite 生产构建至 `apps/web/dist`                    |
| Python demo/build                         | 通过  | 临时目录生成、校验和构建合成音歌曲包                          |
| `git diff --check`                        | 通过  | 当前未提交差异                                                |

宿主测试确认：StrictMode 第一次 setup 的实例与订阅各清理一次；第二次 setup 使用不同 audio；卸载后没有 audio；切歌和重挂销毁旧实例；旧通知不影响新快照；初始化失败可重试；第二个活跃宿主被拒绝；快照在通知前保持对象身份稳定。路由测试确认离开时卸载、返回时建立新宿主，未知歌曲不会创建播放器。

本轮测试前后核对源码、依赖声明、锁文件及 workflow 的 SHA-256，均未改变。最终文档更新后单独重跑格式和 diff 检查，不重复已经通过的业务测试。

## 用户实际浏览器验收

用户在本轮明确确认：已在浏览器实际测试当前网页，**页面、路由、刷新及相关功能均正常**。据此记录为用户实际浏览器验收通过，沿用该结果，不安排重复手动验收。此前本地 5173 端口 EACCES 的记录保留为历史环境问题，已不作为本轮阻塞项。

用户反馈没有逐项列出浏览器版本、设备型号或资源指纹，本报告不补造这些信息。StrictMode 与监听器清理的细粒度结论来自源码及自动化测试；本轮未新增浏览器堆快照或 AudioContext 数量测量。

## 当前结论与保留边界

当前 1B 没有已知的验收阻断问题。真实歌曲包、人声/朗读资产、移动设备和复杂网络故障的更广泛矩阵保留为后续回归范围，不要求重复本轮已确认的网页验收。持久 Cache Storage 与部分后台工作沿用上游生命周期，本轮没有承诺全部后台请求取消。

1A 的 checks #3 和 demo #3 成功由用户确认；它们验证已推送的 1A 提交。尚未提交的 1B 使用本报告的本地检查结果，现有 workflow 尚未包含 React 专项类型、前端测试和生产构建任务，不能把 1A CI 成功记为 1B 远端 CI 成功。现有 Pages 继续部署 Python 演示站点，React 路由生产部署需要静态服务器提供 index fallback。
