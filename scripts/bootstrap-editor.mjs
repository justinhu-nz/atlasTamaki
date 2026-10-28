// Reserve the Worker URL before credentials exist. The normal deployment still
// requires GITHUB_TOKEN; the Worker itself denies every request without it.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'atlas-editor-bootstrap-'));
try {
  const config = JSON.parse(await readFile(join(root, 'wrangler.jsonc'), 'utf8'));
  delete config.secrets;
  delete config.$schema;
  config.main = resolve(root, config.main);
  config.assets.directory = resolve(root, config.assets.directory);
  const path = join(directory, 'wrangler.json');
  await writeFile(path, JSON.stringify(config));
  const result = spawnSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--config', path], {
    cwd: root, stdio: 'inherit'
  });
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, {recursive: true, force: true}); }
