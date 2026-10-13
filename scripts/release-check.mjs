import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateReleaseGates } from './release-gates.mjs';
const root = process.cwd(),
  manifest = JSON.parse(await readFile('docs/release-readiness.json', 'utf8'));
const app = JSON.parse(await readFile('apps/mobile/app.json', 'utf8'));
validateReleaseGates(manifest, app.expo.version);
let blocked = 0;
for (const gate of manifest.gates) {
  const path = resolve(root, gate.evidence);
  if (
    !path.startsWith(resolve(root, 'docs') + '/') &&
    !path.startsWith(resolve(root, 'docs') + '\\')
  )
    throw new Error('Evidence must stay in docs');
  await access(path);
  console.log(`${gate.status}: ${gate.id} (${gate.evidence})`);
  if (
    gate.status !== 'verified' &&
    !(
      gate.id === 'local-functional-checks' &&
      gate.status === 'locally_verified'
    )
  )
    blocked++;
}
if (blocked) {
  console.log(
    `RELEASE HOLD: ${blocked} required gates lack verified release evidence.`,
  );
  process.exitCode = 1;
} else
  console.log(
    'Recorded release evidence is complete. This does not publish or authorize deployment.',
  );
