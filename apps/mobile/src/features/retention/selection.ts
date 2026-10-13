import {
  distanceMeters,
  Position,
  SavedPlace,
  usableCoordinates,
} from '../places/model';
export function digestPlaceIds(
  places: SavedPlace[],
  point: Position,
  now = Date.now(),
) {
  return [
    ...new Set(
      places
        .filter(
          (p) =>
            p.status === 'confirmed' &&
            usableCoordinates(p, now) &&
            distanceMeters(point, { latitude: p.lat!, longitude: p.lng! }) <=
              5000,
        )
        .map((p) => p.id),
    ),
  ]
    .sort()
    .slice(0, 100);
}
