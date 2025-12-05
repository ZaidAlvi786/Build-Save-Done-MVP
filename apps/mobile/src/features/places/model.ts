import { z } from 'zod';
export const savedPlaceSchema = z.object({
  id: z.string().uuid(),
  saved_item_id: z.string().uuid(),
  name: z.string(),
  address: z.string(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  category: z.enum(['restaurant', 'cafe', 'shop', 'attraction', 'other']),
  coordinates_expire_at: z.string().nullable(),
  status: z.enum(['confirmed', 'visited']),
});
export type SavedPlace = z.infer<typeof savedPlaceSchema>;
export type Position = { latitude: number; longitude: number };
export function usableCoordinates(place: SavedPlace, now = Date.now()) {
  return (
    place.lat !== null &&
    place.lng !== null &&
    place.coordinates_expire_at !== null &&
    Date.parse(place.coordinates_expire_at) > now
  );
}
export function distanceMeters(a: Position, b: Position) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad,
    dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLng / 2) ** 2;
  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function visiblePlaces(
  places: SavedPlace[],
  category: string,
  near: Position | null,
  now = Date.now(),
) {
  const selected = places.filter(
    (p) => category === 'all' || p.category === category,
  );
  const distances = new Map(
    selected.map((p) => [
      p.id,
      near && usableCoordinates(p, now)
        ? distanceMeters(near, { latitude: p.lat!, longitude: p.lng! })
        : Infinity,
    ]),
  );
  return selected.sort((a, b) => {
    if (near) {
      const da = distances.get(a.id)!,
        db = distances.get(b.id)!;
      if (da !== db) return da - db;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
