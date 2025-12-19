import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Use the package entry point so Windows shims and Linux binaries behave alike.
const entry = fileURLToPath(
  new URL('../node_modules/deno/bin.cjs', import.meta.url),
);
const result = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DENO_NO_PACKAGE_JSON: '1' },
});
if (result.error) {
  console.error('Deno could not start. Run npm ci.');
  process.exit(1);
}
process.exit(result.status ?? 1);
