import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('asset preparation validates all references before publishing and repairs damaged copies', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'utae-assets-'));
  try {
    const source = path.join(temp, 'source'),
      output = path.join(temp, 'prepared');
    await mkdir(path.join(source, 'assets'), { recursive: true });
    const song = JSON.parse(
      await readFile(new URL('../examples/song.json', import.meta.url), 'utf8'),
    );
    // Deliberate byte fixture for file copying, not an audio decode/listening result.
    const bytes = Buffer.from('asset-copy-fixture');
    const name = 'assets/' + createHash('sha256').update(bytes).digest('hex').slice(0, 20) + '.wav';
    for (const audio of Object.values(song.audio)) audio.src = name;
    await writeFile(
      path.join(source, 'library.json'),
      JSON.stringify({ schemaVersion: 1, songs: [song] }),
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('../scripts/prepare-player-assets.mjs', import.meta.url)),
          source,
          output,
        ],
        { encoding: 'utf8' },
      );
    const missing = run();
    assert.notEqual(missing.status, 0);
    await assert.rejects(readFile(path.join(output, 'library.json')));
    await writeFile(path.join(source, name), bytes);
    assert.equal(run().status, 0);
    await writeFile(path.join(output, name), 'damaged');
    assert.equal(run().status, 0);
    assert.deepEqual(await readFile(path.join(output, name)), bytes);
    const published = await readFile(path.join(output, 'library.json'), 'utf8');
    await writeFile(path.join(source, name), 'corrupt source');
    assert.notEqual(run().status, 0);
    assert.equal(await readFile(path.join(output, 'library.json'), 'utf8'), published);
    await writeFile(path.join(source, name), bytes);
    const bad = JSON.parse(published);
    delete bad.songs[0].audio['0.5'];
    await writeFile(path.join(source, 'library.json'), JSON.stringify(bad));
    assert.notEqual(run().status, 0);
    assert.equal(await readFile(path.join(output, 'library.json'), 'utf8'), published);
  } finally {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('utae-assets-'));
    await rm(temp, { recursive: true, force: true });
  }
});
