# PlayerBridge 1A 原型记录

日期：2026-11-16。当前结论：控制器原型和 Mixer/Transport 生命周期清理已实现，自动化测试通过；用户已确认 1A 全部浏览器与生命周期验收通过，阶段 1A 完成；阶段 1B 未开始，等待下一步指令。

## 范围与基线

- 项目：`C:\Users\hj\Projects\utae`，`main`，起点 `80f04d69070b0816d2c8335e1b782df2f2dd7e13`。
- 保留 `web/src/audio/`、`timeline.js`、`lyric_player/`、原有 `tests/`、许可证及 Git 历史原位。
- 未创建 React 应用、workspaces、后端或基础设施；未安装依赖、下载模型、提交或推送。未访问旧版仓库。
- Node：显式调用已有 `C:\Users\hj\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`，24.22.1。
- Python：显式调用已有 `C:\ProgramData\miniconda3\python.exe`，3.13.13。默认 Node/Python launcher 和全局 PATH 未改；这些本机路径尚不是可移植的项目工具链方案。

## 修改文件与依赖方向

| 文件 | 变化 |
| --- | --- |
| `web/src/player.js` | 返回 controller；复用现有闭包、transport 和时间映射；加入快照、订阅、取消、命令校验及控制器销毁 |
| `web/src/lyrics.js` | 接收 root 和事件 AbortSignal；取消显示选项的监听器 |
| `web/src/directory.js` | 接收 root 和事件 AbortSignal；取消动态目录按钮监听器 |
| `web/src/layout.js` | 显式传入下一句容器；观察器返回清理函数，阻止迟到字体回调 |
| `web/src/player-bridge.js` | 从已有 schema 1 catalog 创建 cache、decoder、chunk engine 和 controller，持有布局观察器 |
| `web/src/audio/mixer.js` | mixer 幂等 dispose，断开常驻图、停止预热 source、安全关闭独占 context |
| `web/src/audio/transport.js` | transport 幂等 dispose，移除原生媒体监听器并停止/清理活动循环会话 |
| `web/bridge-probe.html`、`web/src/bridge-probe.js` | 静态验证入口；从已有 `index.html` 读取 DOM，不复制整页播放器实现 |
| `tests/player-controller.test.js` | 6 组命令、快照、生命周期、失败和过期结果测试 |
| `tests/player-view-lifecycle.test.js` | 2 组目录监听器及布局观察器释放测试 |
| `tests/audio-lifecycle.test.js` | Mixer/Transport 释放、context close、media listener 和 source-node 关联测试 |
| `tests/player-bridge-lifecycle.test.js` | 验证 Bridge dispose 后替换整个 audio DOM 节点 |

原页面 `index.html` 和 `main.js` 保留。默认 `createPlayer` 仍按 document 查找元素；原页面可以忽略新增返回值。新 Bridge 调用同一 `createPlayer`，不会拥有另一套播放时钟。静态验证页用 `root=global` 和 `root=container` 对照，尚未确定 React 的最终 DOM 方案。

## 原型实际接口

```js
const bridge = createPlayerBridge({ catalog, root, songId });
const stop = bridge.subscribe((snapshot) => { /* 更新宿主视图 */ });
bridge.loadSong('id-in-catalog');
bridge.setPracticeScope({ kind: 'section', startIndex: 1, endIndex: 2 });
await bridge.play();
bridge.pause();
bridge.seek(8);
bridge.selectLine(1, false);
bridge.setRate(0.75);
bridge.setLoop('section');
stop();
bridge.dispose();
```

- 输入是当前构建产生的 `library.json`（`schemaVersion/songs/chunks`），不是 Utae API wrapper。工厂只核对基本 catalog 形状；完整 schema 校验仍由原有 build/validate 完成。
- `songId` 为初始歌曲；`loadSong` 只能选择传入 catalog 中的歌曲。动态替换歌曲包的目标 `loadPackage` 尚未实现，不能称为完整目标 Bridge API。
- `play()` 的 Promise 表示播放请求已提交。加载和浏览器授权仍可能尚未完成；真实状态和失败通过快照订阅观察，不以 Promise resolve 断言已经发声。
- `seek` 和 `positionSeconds` 采用原曲秒数；使用现有 playback session + transport 快照映射，限制在当前练习范围内。`durationSeconds` 为原曲时长。
- `sourcePositionSeconds` 为当前音频源时间。朗读源没有原曲的连续时钟：`positionSeconds` 固定为当前句起点，`source='reading'`；歌曲 seek/rate 命令在朗读模式下拒绝。朗读语速仍使用上游原有 UI。
- `scope` 为 full / line / section；句索引从 0 开始。设置 scope 暂停播放，不自动播放；在 section 内 selectLine 越界会拒绝。无歌曲、无效索引、倒序范围、非法速度等均校验。
- `setLoop` 接受 none 或当前 scope 类型。full 是对目标草案的补充，用来保留上游整曲重复行为。loop 默认启用；none 在当前范围结束后停止。
- `playing` 读取 transport；`playIntent` 是用户意图；`loading`、`pendingScope`、`error` 单独返回。快照订阅合并同一微任务中的通知；暂停也会通知，取消订阅后不再通知。
- `dispose` 幂等：撤销控制器/目录/显示选项监听、清理布局观察、取消 rAF、递增加载与播放代数、停止并 dispose transport、释放朗读 URL，再 disconnect mixer 图并关闭该 mixer 独占的 AudioContext。销毁后命令拒绝；允许读取最后的 disposed 快照。

## 验证结果与边界

| 检查 | 本轮结果 |
| --- | --- |
| 修改前上游 JS | 3/3 通过 |
| 实际项目最终 JS | 17/17 通过（3 上游 + 14 新增） |
| Python | 7/7 通过，未修改 Python 项目代码 |
| demo/build | 生成并构建 1 首上游合成音 schema 1 包成功 |
| 语法 / `git diff --check` | 5 个变更 JS 文件 `node --check` 通过；实际项目 `git diff --check` 通过 |
| ESLint / Prettier | 已尝试，执行失败：未安装的开发依赖导致命令不可用；本轮未安装依赖，不能报为 lint/format 通过 |
| 浏览器生命周期复验 | 用户手动验收通过：旧 AudioContext=closed，替换 audio 节点后新实例播放；后续手动暂停正常 |
| 真实歌曲、人声朗读、移动设备 | 未覆盖；合成音不能替代真人试听 |

控制器测试用替身隔离 transport、DOM、mixer 与 decoder；验证控制器逻辑，不构成真实媒体集成通过。Mixer/Transport 生命周期测试使用 Web Audio/EventTarget 替身核验调用和节点释放；真实 `AudioContext.state === 'closed'` 另由本轮用户手动浏览器验收确认。上游音频调度测试保留。

测试包 `data/songs/demo/song.json` SHA-256：`7db885e7138d6bb582c0c6580e8a957d0a74d5adf1449f75e5937979d61aace3`。

构建 catalog SHA-256：`2dbe5ffc1be823fffe626dfdee5420456e6c29d638ad8207db51c7cdad7cf13f`。音频和构建在现有忽略目录中，不加入 Git。

## 保留限制与后续验证边界

1. **媒体元素关联（源码与标准行为）**：关闭 AudioContext 不解除 `HTMLMediaElement` 与 `MediaElementAudioSourceNode` 的关联。若复用同一个 audio 元素再创建 mixer，`createMediaElementSource` 会失败。Bridge host 现于 dispose 后 clone/replace 整个 `<audio>` 节点；实际 React host 必须采用这一边界。独立 `createPlayer` 调用者须自行提供从未绑定过的新 audio 元素。
2. **Async close（本轮通过）**：mixer.dispose 安全处理 close rejection；player 保持同步 dispose 接口。自动化覆盖关闭失败处理，用户浏览器验收确认旧 context 最终为 closed。
3. **剩余资源边界（源码确认）**：cache、decoder、chunk engine 每个 Bridge 创建实例；本轮没有改变它们的下载、解码或持久 Cache Storage 生命周期。controller generation 阻止过期结果挂载，不能中止所有后台工作。
4. **DOM 和宿主边界**：用户已确认 1A 其他浏览器测试通过。原型保留 global/container 对照；固定 ID、dialog、全局 CSS、document 字体和 window 滚动依赖仍在，不承诺多实例或样式隔离。已确认重建时替换 audio 元素；React 宿主的具体布局和集成在尚未开始的 1B 单独验证。
5. **工具链和回归**：开发依赖未安装，正式 lint/format 不可用；真实歌曲、人声朗读和移动设备仍需另行验收。

1A 原型与生命周期修复已完成并经用户验收，不改写音频调度算法。1B 未开始；本次归档不启动后续开发。

## 已执行的手动浏览器验收范围

服务：`http://127.0.0.1:8080`。分别打开 `/bridge-probe.html?root=global` 和 `/bridge-probe.html?root=container`。

1. 等待 loading=false，确认未自动播放；点击播放，观察 positionSeconds 增长、playing 和歌词高亮；暂停后应停止增长。
2. 全曲跳到 8 秒，应显示第 2 句附近。切 0.75/0.5/1 倍速时比较原曲秒数及 sourcePositionSeconds，不得把两种时间混同。
3. 第 2 句、2–3 句段落、全曲逐项选择后手动播放；分别验证循环/单次，段落外的时间跳转应限制在当前范围。
4. 打开原有歌词目录，点击句子与段落端点；显示选项和键盘控制仍应工作。对照全局/容器模式的布局及事件。
5. 取消订阅后通知计数停止；销毁后音频停止、点击原控件不再启动。点“同宿主重挂（测试替换 audio）”后，播放器应再次启动且无 `InvalidStateError`；新 context 与旧 context 独立。
6. 原页面 `/` 验证首次播放、seek、歌词和三档速度。demo 没有 narration，读音入口应禁用；有合法 narration 的真实包须另行补验。

## 同步与复验记录

本次 Mixer/Transport 生命周期候选保存在文档工作区 `stage1a/files`。`stage1a/sync-lifecycle.py` 在任何写入前核对所有目标文件的 SHA-256 或新增文件不存在，发现并发修改即停止；不操作 Git、依赖或系统环境。用户已完成同步；实际项目复跑 JS 17/17、Python 7/7、语法和 `git diff --check` 均通过。ESLint/Prettier 因未安装而未运行。

```powershell
& 'C:\Users\hj\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.js
& 'C:\ProgramData\miniconda3\python.exe' -B -m unittest discover -s tests
git diff --check
```

实际项目 JS 共 17 项（3 上游 + 14 新增），Python 7 项全部通过；结果来自本轮归档前的实际项目复跑。本次仅更新文档，不重复运行代码测试。

浏览器步骤：刷新验证页，点击播放后等待音频 context 初始化，点“同宿主重挂（测试替换 audio）”。按钮会 dispose 当前实例、由 Bridge 替换 `<audio>` 节点、在相同宿主 DOM 创建新实例并再次请求播放。确认快照恢复、无 `InvalidStateError`、新实例可暂停/seek；然后销毁。DevTools 可额外查看旧 context 最终为 `closed`。直接复用旧 `HTMLAudioElement` 创建新 mixer 应按设计拒绝/不支持。


## 最终验收归档（2026-11-16）

阶段状态：**1A 完成；1B 未开始**。用户已明确确认生命周期验收及 1A 其他浏览器测试通过。

| 验收项 | 结果与证据 |
| --- | --- |
| JavaScript 回归 | 实际项目 17/17 通过，覆盖原有调度、时间映射及新增生命周期、controller、snapshot、订阅和取消 |
| Python 回归 | 实际项目 7/7 通过，覆盖格式、构建和静态服务 |
| AudioContext 关闭 | 浏览器手动通过：验证页输出 `旧 AudioContext=closed` |
| AudioNode 清理 | 源码与自动化通过：常驻图断开、未结束预热 source 停止/断开，活动 PCM source 停止/断开；原有 chunk 清理路径及测试保留。未做浏览器堆快照或逐节点内存测量 |
| Transport 监听器移除 | 源码与自动化通过：移除自身注册的原生媒体监听器；dispose 后派发媒体事件不再转发，重复 dispose 安全 |
| Player 清理顺序 | 自动化通过：先停止播放、清理 transport，再清理 mixer；公开 snapshot 和订阅回归通过 |
| 新 audio 元素重新初始化 | 浏览器手动通过：Bridge 替换整个 audio 元素，新实例进入 `audio-context-chunks` 播放，无 InvalidStateError |
| 同一旧 audio 元素复用 | 明确不支持；关闭 context 不解除媒体源关联。自动化验证该限制，Host 以替换元素处理 |
| 重挂后的暂停 | 用户确认快照 `playing=false`、`playIntent=false` 来自后来手动暂停；不属于重挂失败 |

浏览器证据由用户手动提供，自动化 UI 工具因审批服务模型 404 未能执行。用户反馈包含 `旧 AudioContext=closed；已替换 audio 节点，新实例播放中（audio-context-chunks）`；浏览器版本和具体设备型号未记录，不推定为跨浏览器/移动设备覆盖。

**测试资产仅为本地合成音 schema 1 demo 包**（24 秒，4 行歌词）。本次没有使用真实歌曲包，真实歌曲包兼容性、真实人声朗读、语音边界和移动设备尚未验证；1A 完成不代表这些项目或整体 MVP 已通过。

ESLint/Prettier 仍因依赖未安装而未完成，不能视为格式检查通过；本次文档归档另外执行 Markdown 本地链接检查、文档一致性核对和 `git diff --check`。没有安装依赖、修改系统环境、提交或推送 Git。
