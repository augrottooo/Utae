import type { Catalog, Song } from './types.ts';

const rates = ['1', '0.75', '0.5'] as const;
const speeds = ['normal', 'slow', 'verySlow'] as const;
type ObjectValue = Record<string, unknown>;
function invalid(path: string, reason: string): never {
  throw new TypeError(`歌曲包 ${path}：${reason}`);
}
function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, '需要对象');
  return value as ObjectValue;
}
function list(value: unknown, path: string, nonempty = true): unknown[] {
  if (!Array.isArray(value) || (nonempty && !value.length))
    invalid(path, '需要数组且必需内容不能为空');
  return value;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.length) invalid(path, '需要非空字符串');
  return value;
}
function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    invalid(path, '需要有限数字（秒或采样帧）');
  return value;
}
function frames(value: unknown, path: string, positive = false): number {
  const n = number(value, path);
  if (!Number.isSafeInteger(n) || n < (positive ? 1 : 0)) invalid(path, '采样帧必须为非负整数');
  return n;
}
function interval(item: ObjectValue, path: string, duration: number): [number, number] {
  const start = number(item.start, `${path}.start`);
  const end = number(item.end, `${path}.end`);
  if (!(0 <= start && start < end && end <= duration + 0.001)) invalid(path, '时间区间越界或倒置');
  return [start, end];
}

/** Validate relative paths before URL resolution, including encoded traversal/separators. */
export function assetPath(value: unknown, path = 'src'): string {
  const src = text(value, path);
  let decoded: string;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    return invalid(path, '资源路径编码无效');
  }
  if (
    /^[\/]/.test(decoded) ||
    /[\\:?#%\u0000-\u0020]/.test(decoded) ||
    decoded.split('/').some((part) => part === '..')
  )
    invalid(path, '本地资源必须位于歌曲资产目录内');
  return src;
}

/** Runtime guard for Python build's public library.json, not the future business wrapper. */
export function validateCatalog(value: unknown): asserts value is Catalog {
  const catalog = object(value, 'catalog');
  if (catalog.schemaVersion !== 1) invalid('schemaVersion', '仅支持 Sorane schema 1');
  const songs = list(catalog.songs, 'songs', false);
  const ids = new Set<string>();
  const references = new Map<string, number[]>();
  for (const [index, entry] of songs.entries()) {
    const path = `songs[${index}]`;
    const song = object(entry, path);
    if (song.schemaVersion !== 1) invalid(`${path}.schemaVersion`, '仅支持版本 1');
    const id = text(song.id, `${path}.id`);
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || ids.has(id))
      invalid(`${path}.id`, '需要唯一小写 slug');
    ids.add(id);
    for (const key of ['title', 'artist'])
      if (!text(song[key], `${path}.${key}`).trim()) invalid(path, '标题和歌手不能为空');
    const duration = number(song.duration, `${path}.duration`);
    if (duration <= 0) invalid(path, '时长必须为正数');
    const audio = object(song.audio, `${path}.audio`);
    // Preserve any additional variants the upstream builder publishes, but validate every URL.
    for (const [rate, variant] of Object.entries(audio))
      assetPath(object(variant, path).src, `${path}.audio.${rate}.src`);
    for (const rate of rates) {
      const src = assetPath(object(audio[rate], `${path}.audio.${rate}`).src);
      references.set(src, [...(references.get(src) || []), duration / Number(rate)]);
    }
    let previous = -1;
    for (const [i, value] of list(song.lines, `${path}.lines`).entries()) {
      const lp = `${path}.lines[${i}]`;
      const line = object(value, lp);
      const [start, end] = interval(line, lp, duration);
      if (start < previous) invalid(lp, '歌词句重叠或顺序错误');
      previous = end;
      text(line.jp, `${lp}.jp`);
      text(line.section, `${lp}.section`);
      if (line.translation !== undefined && typeof line.translation !== 'string')
        invalid(lp, '译文必须为字符串');
      const clipStart = line.clipStart === undefined ? start : number(line.clipStart, lp);
      const clipEnd = line.clipEnd === undefined ? end : number(line.clipEnd, lp);
      if (!(0 <= clipStart && clipStart <= start && end <= clipEnd && clipEnd <= duration + 0.001))
        invalid(lp, '练习裁切边界无效');
      const tokens = list(line.tokens, `${lp}.tokens`);
      let prior = start;
      for (const [j, value] of tokens.entries()) {
        const tp = `${lp}.tokens[${j}]`;
        const token = object(value, tp);
        const [a, b] = interval(token, tp, duration);
        if (a < prior - 0.001 || a < start - 0.001 || b > end + 0.001)
          invalid(tp, '词时间必须按顺序位于句内');
        prior = b;
        for (const key of ['jp', 'kana', 'romaji']) text(token[key], `${tp}.${key}`);
        if (token.ruby !== undefined)
          for (const part of list(token.ruby, `${tp}.ruby`, false)) {
            const ruby = object(part, tp);
            text(ruby.text, tp);
            if (ruby.reading !== undefined) text(ruby.reading, tp);
          }
        if (token.readingParts !== undefined)
          for (const part of list(token.readingParts, tp, false)) text(part, tp);
      }
      if (line.narration !== undefined) {
        const narration = object(line.narration, `${lp}.narration`);
        for (const speed of speeds) {
          const voice = object(narration[speed], `${lp}.narration.${speed}`);
          assetPath(voice.src);
          const length = number(voice.duration, `${lp}.narration.duration`);
          if (length <= 0) invalid(lp, '朗读时长必须为正数');
          const marks = list(voice.tokens, `${lp}.narration.tokens`);
          if (marks.length !== tokens.length) invalid(lp, '朗读词数与歌词不一致');
          let prior = 0;
          for (const mark of marks) {
            const [a, b] = interval(object(mark, lp), lp, length);
            if (a < prior) invalid(lp, '朗读词时间重叠');
            prior = b;
          }
        }
      }
    }
  }
  const manifests = catalog.chunks === undefined ? {} : object(catalog.chunks, 'chunks');
  for (const [src, value] of Object.entries(manifests)) {
    assetPath(src, 'chunks key');
    const manifest = object(value, 'chunk manifest');
    if (manifest.sampleRate !== 44100) invalid('chunks.sampleRate', '必须为 44100');
    const total = frames(manifest.frames, 'chunks.frames', true);
    let cursor = 0;
    for (const value of list(manifest.chunks, 'chunks.chunks')) {
      const chunk = object(value, 'chunk');
      const first = frames(chunk.first, 'chunk.first');
      const last = frames(chunk.last, 'chunk.last', true);
      if (first !== cursor || last <= first) invalid('chunk', '分块覆盖存在间隙或重叠');
      assetPath(chunk.src);
      if (chunk.parts !== undefined) {
        const parts = list(chunk.parts, 'chunk.parts');
        if (parts.length !== 2 || parts[0] !== chunk.src)
          invalid('chunk.parts', '需要伴奏/人声两个声部且 src 等于第一项');
        parts.forEach((part) => assetPath(part));
      }
      const trim = chunk.trimStart === undefined ? 0 : frames(chunk.trimStart, 'chunk.trimStart');
      const decoded =
        chunk.decodedFrames === undefined
          ? last - first
          : frames(chunk.decodedFrames, 'chunk.decodedFrames', true);
      if (decoded < last - first + trim) invalid('chunk', '解码采样帧不足');
      for (const key of ['postRoll', 'crossfadeFrames'])
        if (chunk[key] !== undefined) frames(chunk[key], `chunk.${key}`);
      cursor = last;
    }
    if (cursor !== total) invalid('chunks', '分块未覆盖全部采样帧');
    for (const duration of references.get(src) || [])
      if (Math.abs(total / 44100 - duration) > 0.15)
        invalid('chunks', '分块时长与原曲时间轴不一致');
  }
}

/** All referenced assets, including the full-audio fallback and optional narration/chunks. */
export function songAssets(catalog: Catalog, song: Song): string[] {
  const assets = new Set<string>();
  for (const audio of Object.values(song.audio)) {
    assets.add(audio.src);
    for (const chunk of catalog.chunks?.[audio.src]?.chunks || []) {
      assets.add(chunk.src);
      chunk.parts?.forEach((part) => assets.add(part));
    }
  }
  for (const line of song.lines)
    for (const voice of Object.values(line.narration || {})) assets.add(voice.src);
  return [...assets];
}
