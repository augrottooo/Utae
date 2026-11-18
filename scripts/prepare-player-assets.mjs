import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { songAssets, validateCatalog } from '../packages/player-bridge/src/validate.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.argv[2] || path.join(root, 'build'));
const output = path.resolve(process.argv[3] || path.join(root, 'apps/web/public/sorane'));
if (
  source === output ||
  source.startsWith(output + path.sep) ||
  output.startsWith(source + path.sep)
) {
  throw new Error('歌曲构建目录和准备目录必须分离。');
}
const raw = await readFile(path.join(source, 'library.json'), 'utf8').catch(() => {
  throw new Error('缺少或无法读取 build/library.json，请先运行 Python build。');
});
const catalog = JSON.parse(raw);
validateCatalog(catalog);
const names = [...new Set(catalog.songs.flatMap((song) => songAssets(catalog, song)))];
const assetsRoot = await realpath(path.join(source, 'assets')).catch(() => null);
// Validate all referenced files before publishing a catalog; do not leave a partial catalog.
for (const name of names) {
  if (!/^assets\/[a-f0-9]{20}\.[a-z0-9]+$/.test(name))
    throw new Error('需要 Python build 的内容哈希资产路径。');
  const file = await realpath(path.join(source, name));
  if (
    !assetsRoot ||
    path.dirname(file) !== assetsRoot ||
    !(await stat(file)).isFile() ||
    !(await stat(file)).size
  ) {
    throw new Error('歌曲资源缺失、为空或位于资产目录外。');
  }
  const digest = createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
    .slice(0, 20);
  if (path.basename(name).split('.')[0] !== digest)
    throw new Error('歌曲资源内容与哈希文件名不一致，请重新运行 Python build。');
}
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const name of names) {
  // Content-hash assets are immutable; replace a damaged/truncated prepared copy as well.
  const input = await readFile(path.join(source, name));
  const existing = await readFile(path.join(output, name)).catch(() => null);
  if (!existing?.equals(input)) await copyFile(path.join(source, name), path.join(output, name));
}
await writeFile(path.join(output, 'library.json'), raw, 'utf8');
console.log(
  `Prepared ${catalog.songs.length} local song package(s), ${names.length} referenced asset(s).`,
);
