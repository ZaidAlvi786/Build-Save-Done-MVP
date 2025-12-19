import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateReleaseGates } from './release-gates.mjs';
const original = JSON.parse(
  await readFile('docs/release-readiness.json', 'utf8'),
);
test('current evidence inventory is valid', () => {
  assert.doesNotThrow(() => validateReleaseGates(original, '0.1.0'));
});
for (const [name, mutate] of [
  [
    'replaced blocker',
    (m) => {
      m.gates[1].id = 'optional-check';
    },
  ],
  [
    'missing blocker',
    (m) => {
      m.gates.pop();
    },
  ],
  [
    'duplicate gate',
    (m) => {
      m.gates[1].id = m.gates[0].id;
    },
  ],
  [
    'device gate marked local',
    (m) => {
      m.gates[3].status = 'locally_verified';
    },
  ],
  [
    'stale app version',
    (m) => {
      m.version = '0.0.1';
    },
  ],
  [
    'missing evidence path',
    (m) => {
      delete m.gates[1].evidence;
    },
  ],
]) {
  test(`rejects ${name}`, () => {
    const manifest = structuredClone(original);
    mutate(manifest);
    assert.throws(() => validateReleaseGates(manifest, '0.1.0'));
  });
}
