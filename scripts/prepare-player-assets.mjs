import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'build');
const output = path.join(root, 'apps/web/public/sorane');
async function copyMissing(sourceDir, outputDir) {
  await mkdir(outputDir, { recursive: true });
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      await copyMissing(sourcePath, outputPath);
      continue;
    }
    try {
      await stat(outputPath);
    } catch {
      await copyFile(sourcePath, outputPath);
    }
  }
}
// Copy generated data only, never upstream JS/HTML or source songs.
const raw = await readFile(path.join(source, 'library.json'), 'utf8').catch(() => {
  throw new Error('缺少 build/library.json。请先通过现有 Python 工具构建本地歌曲包。');
});
const catalog = JSON.parse(raw);
if (catalog.schemaVersion !== 1 || !catalog.songs?.length)
  throw new Error('需要非空 schema 1 曲库。');
await mkdir(output, { recursive: true });
await copyMissing(path.join(source, 'assets'), path.join(output, 'assets'));
await writeFile(path.join(output, 'library.json'), raw, 'utf8');
console.log(`Prepared ${catalog.songs.length} local song package(s) for the React host.`);
