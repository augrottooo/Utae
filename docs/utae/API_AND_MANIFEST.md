# API 与 SongManifest 契约

本文定义 Utae 的目标 API 和适配边界。当前新仓库没有 Java API；下面的 JSON 是目标契约示意，不是已验证的运行接口。当前实际适配基线是 Sorane Player HEAD `80f04d69070b0816d2c8335e1b782df2f2dd7e13`。本轮已将它与上游基线 `15bb3bb7dd05430af18120bfbc1ef2558322308b` 的 `docs/data-format.md`、`lyric_player/schema.py`、`format-version.json` 做只读比较，三个文件无差异；逐字段映射仍必须以实际运行的 HEAD 和固定 fixture 为准。若以后 HEAD 与上游基线出现差异，以实际使用的 HEAD 为准，不得只引用旧基线。

## 响应、认证和请求约定

- 业务 API 统一返回 `{ "code": "OK", "message": "", "data": ... }`；错误 code 稳定、不能泄露本地路径或密钥。
- 登录使用 HttpOnly Cookie 会话；前端请求默认 `credentials: 'include'`，写请求需要 CSRF token/header 方案，过期返回 `401` 并清理客户端会话状态。
- `POST` 创建/重试/发布接口接受 `Idempotency-Key`；服务端把它与当前用户和操作类型一起校验。
- API 和数据库的业务时间统一使用整数毫秒；Sorane player song 的 `duration/start/end` 使用浮点秒。只有 song-package/PlayerBridge adapter 转入 Player 时做 `seconds = milliseconds / 1000`；从 Player snapshot 回写 API 时做 `milliseconds = round(seconds * 1000)`，往返误差最多 0.5 ms。React 组件不直接混用这两种单位。
- Utae API 的 `packageVersion` 是业务版本；Sorane `schemaVersion` 是歌曲包格式版本。两者不能互换。

## 认证

- `POST /api/auth/login`：账号/密码或未来的认证方式，设置 HttpOnly Cookie。
- `POST /api/auth/logout`：撤销服务端会话并清理 Cookie。
- `GET /api/me`：返回当前用户和角色；未登录返回 `401`。
- `GET /api/auth/csrf`：按采用的 CSRF 方案返回一次性/会话 token（若 Cookie 策略需要）。

## 曲库、版本和制作

- `GET /api/songs?scope=library|mine&keyword=&page=&size=`：只返回当前用户有权访问的歌曲。
- `GET /api/songs/{songId}`：歌曲 `visibility`、`lifecycleStatus`、当前发布版本摘要、权限和最近任务。
- `GET /api/songs/{songId}/versions`：版本列表、`schemaVersion`、`packageVersion`、发布/撤回状态和来源哈希。
- `GET /api/songs/{songId}/versions/{versionId}`：版本元数据和复核摘要。
- `GET /api/songs/{songId}/manifest?versionId=`：根据权限返回 Utae wrapper 和可给 PlayerBridge 的 `playerSong`。
- `POST /api/songs`：上传音频、可选 LRC、标题和歌手；只创建 `song` 和不可变 `input_revision`，不创建 `processing_job`。需要上传操作自己的 `Idempotency-Key`。
- `POST /api/songs/{songId}/input-revisions`：上传新的音频/LRC/元数据修订；内容不可变并生成新的 input fingerprint，不自动创建 Job；需要后续单独调用 processing-jobs 接口。
- `POST /api/songs/{songId}/processing-jobs`：在 Song/InputRevision 创建成功后单独调用；body 必须引用已存在的 `inputRevisionId`、pipeline/profile，创建一个 Job 和初始 Outbox event。该接口自己的 `Idempotency-Key` 只负责 Job 创建幂等；相同请求重放返回原 Job。相同 InputRevision 的用户主动原样重制必须使用新 key，创建新 Job 和独立 Studio task directory；上传接口和 Job 接口不能各自隐式创建另一份 Job。
- `GET /api/processing/jobs/{jobId}`：Job、Stage、Studio task 目录标识摘要、候选和 review 状态。
- `POST /api/processing/jobs/{jobId}/retry`：同输入、同 job 增加 attempt；不创建新 package version。
- `POST /api/processing/jobs/{jobId}/reviews`：提交 Studio alignment 的授权人工决定和 report evidence。
- `POST /api/processing/jobs/{jobId}/resume`：仅在 alignment review 批准后排入恢复同一 Studio task 的执行。
- `POST /api/processing/jobs/{jobId}/cancel`：设置取消标记和 fencing 版本，Worker 回报不能复活任务。
- `POST /api/candidates/{candidateId}/reviews`：维护者追加 playback/package review，append-only 并带 `reviewRevision`。
- `POST /api/candidates/{candidateId}/publish`：独立 Utae publish approval，通过后创建不可变 `packageVersion` 并更新 current pointer。
- `DELETE /api/songs/{songId}`：私人歌曲进入删除流程；共享歌曲使用撤回 API，不做用户级硬删除。
- `POST /api/songs/{songId}/withdraw`：维护者撤回共享歌曲，保留版本和审计。

### 上传与任务创建顺序

```text
POST /api/songs
  -> 创建 Song + InputRevision（不创建 Job）
POST /api/songs/{songId}/processing-jobs
  -> 引用已存在的 inputRevisionId，创建一个 ProcessingJob + 初始 Outbox event
```

客户端必须先完成第一个请求，再以返回的 `songId` 和 `inputRevisionId` 调用第二个请求。上传请求重试只重放 Song/InputRevision 创建；Job 请求重试只重放 Job 创建。两类幂等键、请求哈希和错误处理彼此独立，不能通过重复调用 `/api/songs` 重新触发制作。

## 资产访问

- `GET /api/assets/{assetId}`：校验会话和 song/version 权限后代理对象，支持 `Range`、`206`、`Content-Range`、`Accept-Ranges`、`Content-Type`、`ETag` 和 `If-Range`。
- 或 `POST /api/assets/{assetId}/url`：在确认短期签名 URL 方案后使用，响应不写日志，不能直接暴露内部 object key。
- `GET /api/songs/{songId}/versions/{versionId}/assets`：返回资产类型和可访问 asset id，不返回 MinIO key。

## 歌词、学习和收藏

- `GET /api/songs/{songId}/versions/{versionId}/lyrics`：返回具体版本行、token、原文/罗马音/翻译和毫秒时间。
- `PUT /api/songs/{songId}/progress`：body 含 `versionId`、`positionMs`、可空 `versionLineId`、`writeSequence`；服务端 clamp 到音频时长并拒绝旧 sequence。
- `POST /api/learning/events`：记录逐句练习、完成一段、收藏等有意义事件，不记录每次进度 tick。
- `GET /api/learning/recent`：当前用户最近学习事件和进度。
- `GET /api/favorites`：只返回当前用户收藏。
- `PUT /api/songs/{songId}/versions/{versionId}/lines/{versionLineId}/favorite`：幂等收藏并严格校验 line/version/song 归属。
- `DELETE /api/songs/{songId}/versions/{versionId}/lines/{versionLineId}/favorite`：幂等取消。
- `GET /api/review-tasks`、`POST /api/review-tasks/{taskId}/complete`：当前用户的复习任务。

## Agent

- `POST /api/agent/runs`：创建一个 Learning Agent Run；服务端从会话取得 user scope。
- `GET /api/agent/runs/{runId}`：Run、Step、Tool Call 的状态、耗时和脱敏摘要。
- `GET /api/agent/runs`：当前用户 Run 列表。

Learning Agent 只能调用学习域白名单工具；歌曲制作中的 Studio host Agent/人工审核不是这些 API 的同一角色，详见 [PROCESSING_PIPELINE.md](PROCESSING_PIPELINE.md)。

## Utae wrapper 与真实 Sorane song entry

Utae 对外可以返回业务 wrapper，但必须把播放器输入单独命名为 `playerSong`，并通过适配测试确认它符合 Sorane schema 1：

```json
{
  "code": "OK",
  "message": "",
  "data": {
    "songId": "song-123",
    "packageVersion": "2026-0001",
    "schemaVersion": 1,
    "visibility": "PRIVATE",
    "lifecycleStatus": "ACTIVE",
    "playerSong": {
      "schemaVersion": 1,
      "id": "strings",
      "title": "Example",
      "artist": "Artist",
      "duration": 220.0,
      "audio": {
        "1": { "src": "/api/assets/a1" },
        "0.75": { "src": "/api/assets/a2" },
        "0.5": { "src": "/api/assets/a3" }
      },
      "lines": [
        {
          "id": "source-line-id",
          "jp": "君のことが好きだ",
          "section": "verse-1",
          "start": 1.0,
          "end": 4.0,
          "translation": "我喜欢你",
          "tokens": [
            { "jp": "君", "kana": "きみ", "romaji": "kimi", "start": 1.0, "end": 1.7 }
          ]
        }
      ]
    },
    "playerChunks": {
      "/api/assets/chunk-src": {
        "sampleRate": 44100,
        "frames": 123456,
        "chunks": []
      }
    }
  }
}
```

上面的 `playerSong` 只是字段映射示意：真实 Sorane 行要求、`audio` 变体、可选 `chunks`、`narration`、`clipStart/clipEnd`、token 区间和资产路径必须以源码/fixture 核对。特别是：

| Utae 业务字段 | Sorane Player 字段 | 转换要求 |
| --- | --- | --- |
| `song_package_version.schema_version` | `playerSong.schemaVersion` | 原样传递并做兼容检查；不是 Utae package version |
| `song_package_version.package_version` | 不存在 | 只留在 wrapper，不能写进假设的 Player schema |
| `song.title/artist` | `playerSong.title/artist` | 字符串原样映射 |
| `song.duration_ms` | `playerSong.duration` | `duration = duration_ms / 1000`，由适配层一次转换 |
| `version_lyric_line.start_ms/end_ms` | `line.start/end` | 毫秒转秒：`seconds = milliseconds / 1000`；适配层统一处理浮点精度、边界舍入和往返误差并写测试 |
| `version_lyric_line.source_line_id` | `line.id` | 只作为当前包的 source ID；Utae 逻辑/版本行 ID 不直接替换它 |
| `lyric_token.text/kana/romaji` | `token.jp/kana/romaji` | 逐 token 映射；token 时间从毫秒除以 1000 转为秒，Player 时间回写时乘以 1000 并按最近整数毫秒舍入 |
| `candidate_asset` / `package_version_asset` | `playerSong.audio.*.src`, `playerChunks`, `line.narration.*.src` | 生成授权 asset URL；chunk manifest 的顶层索引结构保留；不把 MinIO object key 传给浏览器 |

适配器必须拒绝缺少必需 `id/title/artist/duration/audio/lines`、越界时间、token 顺序错误、不可访问资产或未知 schema 版本；不能未经源码核对就声称“完全兼容 Sorane”。
