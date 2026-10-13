import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { visiblePlaces } from '../apps/mobile/src/features/places/model.ts';
const result = {
  kind: 'desktop-pure-sort-only',
  node: process.version,
  samples: [],
};
for (const count of [100, 1000, 5000]) {
  const places = Array.from({ length: count }, (_, i) => ({
    id: String(i),
    saved_item_id: String(i),
    name: `Place ${String(i).padStart(5, '0')}`,
    address: 'Synthetic',
    category: 'cafe',
    status: 'confirmed',
    lat: 31 + (i % 100) * 0.001,
    lng: 74 + (i % 50) * 0.001,
    coordinates_expire_at: '2099-01-01T00:00:00Z',
  }));
  for (let i = 0; i < 5; i++)
    visiblePlaces(places, 'all', { latitude: 31, longitude: 74 });
  const times = [];
  for (let i = 0; i < 25; i++) {
    const start = performance.now();
    const sorted = visiblePlaces(places, 'all', {
      latitude: 31,
      longitude: 74,
    });
    if (sorted.length !== count) throw new Error('lost data');
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  result.samples.push({
    places: count,
    median_ms: Number(times[12].toFixed(3)),
    p95_ms: Number(times[23].toFixed(3)),
  });
}
await mkdir('dist', { recursive: true });
await writeFile(
  'dist/phase-5-performance.json',
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
console.log(
  'This does not measure Android cold start, rendering, memory, or share-to-confirm latency.',
);
