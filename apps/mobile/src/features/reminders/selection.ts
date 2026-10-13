import {
  SavedPlace,
  Position,
  usableCoordinates,
  distanceMeters,
} from '../places/model';
export function nearestGeofences(
  places: SavedPlace[],
  position: Position,
  radius = 300,
  limit = 20,
  now = Date.now(),
) {
  if (
    !Number.isFinite(position.latitude) ||
    Math.abs(position.latitude) > 90 ||
    !Number.isFinite(position.longitude) ||
    Math.abs(position.longitude) > 180
  )
    throw new Error('Invalid location');
  if (!Number.isInteger(radius) || radius < 100 || radius > 2000)
    throw new Error('Invalid radius');
  const unique = new Map(
    places
      .filter((p) => p.status === 'confirmed' && usableCoordinates(p, now))
      .map((p) => [p.id, p]),
  );
  return [...unique.values()]
    .sort(
      (a, b) =>
        distanceMeters(position, { latitude: a.lat!, longitude: a.lng! }) -
          distanceMeters(position, { latitude: b.lat!, longitude: b.lng! }) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, Math.min(20, Math.floor(limit))))
    .map((p) => ({
      identifier: p.id,
      latitude: p.lat!,
      longitude: p.lng!,
      radius,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
}
