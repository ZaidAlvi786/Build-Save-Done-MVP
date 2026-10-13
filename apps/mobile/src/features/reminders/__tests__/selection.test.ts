import { SavedPlace, distanceMeters, visiblePlaces } from '../../places/model';
import { nearestGeofences } from '../selection';
const now = Date.parse('2026-10-12T10:00:00Z');
const place = (
  id: string,
  lat: number,
  extra: Partial<SavedPlace> = {},
): SavedPlace => ({
  id,
  saved_item_id: id,
  name: id,
  address: 'Area',
  lat,
  lng: 0,
  category: 'cafe',
  status: 'confirmed',
  coordinates_expire_at: '2026-11-01T00:00:00Z',
  ...extra,
});
test('selects nearest twenty, deduplicates and excludes visited, null and expired coordinates', () => {
  const rows = Array.from({ length: 30 }, (_, i) => place(String(i), i / 100));
  rows.push(
    rows[0]!,
    place('visited', 0, { status: 'visited' }),
    place('missing', 0, { lat: null, lng: null }),
    place('expired', 0, { coordinates_expire_at: '2026-10-01T00:00:00Z' }),
  );
  const result = nearestGeofences(
    rows,
    { latitude: 0, longitude: 0 },
    300,
    100,
    now,
  );
  expect(result).toHaveLength(20);
  expect(result[0]?.identifier).toBe('0');
  expect(result.at(-1)?.identifier).toBe('19');
  expect(result.every((r) => r.radius === 300)).toBe(true);
});
test('deterministic ties, empty lists and radius validation', () => {
  const rows = [place('b', 1), place('a', 1)];
  expect(
    nearestGeofences(rows, { latitude: 0, longitude: 0 }, 100, 2, now).map(
      (r) => r.identifier,
    ),
  ).toEqual(['a', 'b']);
  expect(nearestGeofences([], { latitude: 0, longitude: 0 })).toEqual([]);
  expect(() =>
    nearestGeofences(rows, { latitude: NaN, longitude: 0 }),
  ).toThrow();
  expect(() =>
    nearestGeofences(rows, { latitude: 0, longitude: 0 }, 99),
  ).toThrow();
});
test('distance handles the antimeridian and near sort puts unknown positions last', () => {
  expect(
    distanceMeters(
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 },
    ),
  ).toBeCloseTo(22239, 0);
  expect(
    visiblePlaces(
      [
        place('unknown', 0, { lat: null, lng: null }),
        place('near', 0),
        place('far', 2, { category: 'shop' }),
      ],
      'cafe',
      { latitude: 0, longitude: 0 },
      now,
    ).map((p) => p.id),
  ).toEqual(['near', 'unknown']);
});
