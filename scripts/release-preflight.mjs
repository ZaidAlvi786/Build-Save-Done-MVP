import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

let missing = 0;
function report(label, ready, detail) {
  console.log(
    `${ready ? 'FOUND' : 'MISSING'}: ${label}${detail ? ` — ${detail}` : ''}`,
  );
  if (!ready) missing++;
}
for (const [command, args, label] of [
  ['java', ['-version'], 'Java runtime'],
  ['adb', ['version'], 'Android device bridge'],
  ['docker', ['info'], 'Running Docker for the full local Supabase stack'],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  report(label, !result.error && result.status === 0);
}
for (const [path, label] of [
  ['apps/mobile/.env.local', 'Local mobile configuration'],
  ['supabase/functions/.env', 'Local server configuration'],
  ['apps/mobile/eas.json', 'EAS build profiles'],
]) {
  let exists = false;
  try {
    await access(path);
    exists = true;
  } catch {
    /* Presence only. */
  }
  report(label, exists, 'file presence only; values are not read or displayed');
}
console.log(
  'This checks local prerequisites only. It does not validate credentials, devices, signing, provider connectivity, or release evidence.',
);
if (missing) {
  console.log(`PREFLIGHT INCOMPLETE: ${missing} local prerequisites missing.`);
  process.exitCode = 1;
}
