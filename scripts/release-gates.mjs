export const requiredGateIds = Object.freeze([
  'local-functional-checks',
  'real-vision-accuracy',
  'android-share-latency',
  'two-phone-geofences-snooze',
  'live-providers-cron-and-metric',
  'native-crash-monitoring',
  'signed-native-build-performance',
  'deployed-isolation-deletion-retention',
  'dependency-security',
  'owner-store-privacy-assets',
]);

export function validateReleaseGates(manifest, version) {
  if (manifest.version !== version || !Array.isArray(manifest.gates))
    throw new Error('Invalid release evidence manifest');
  const seen = new Set();
  for (const gate of manifest.gates) {
    if (
      !gate ||
      !requiredGateIds.includes(gate.id) ||
      seen.has(gate.id) ||
      !['locally_verified', 'verified', 'blocked'].includes(gate.status) ||
      (gate.status === 'locally_verified' &&
        gate.id !== 'local-functional-checks') ||
      typeof gate.evidence !== 'string' ||
      !gate.evidence.trim()
    )
      throw new Error('Invalid release gate');
    seen.add(gate.id);
  }
  if (requiredGateIds.some((id) => !seen.has(id)))
    throw new Error('Required release gate missing');
}
