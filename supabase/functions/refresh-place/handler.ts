import { z } from 'zod';
import { body, json, user } from '../_shared/http.ts';
import { readLimited } from '../_shared/io.ts';
const schema = z.object({ place_id: z.string().uuid() }).strict();
export interface RefreshDependencies {
  authenticate: (token: string) => Promise<string | null>;
  place: (
    uid: string,
    id: string,
  ) => Promise<{ itemId: string; providerId: string } | null>;
  consume: (uid: string, id: string) => Promise<boolean>;
  coordinates: (id: string) => Promise<{ lat: number; lng: number }>;
  save: (
    uid: string,
    id: string,
    point: { lat: number; lng: number },
  ) => Promise<boolean>;
}
export function createRefreshHandler(deps: RefreshDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST')
      return json(405, { error: 'method_not_allowed' });
    try {
      const uid = await user(request, deps.authenticate);
      if (!uid) return json(401, { error: 'unauthorized' });
      let input: z.infer<typeof schema>;
      try {
        input = await body(request, schema);
      } catch {
        return json(400, { error: 'invalid_request' });
      }
      const place = await deps.place(uid, input.place_id);
      if (!place) return json(404, { error: 'place_not_found' });
      if (!(await deps.consume(uid, place.itemId)))
        return json(429, { error: 'rate_limited' });
      const point = await deps.coordinates(place.providerId);
      if (!(await deps.save(uid, input.place_id, point)))
        return json(409, { error: 'place_changed' });
      return json(200, { refreshed: true });
    } catch {
      return json(503, { error: 'refresh_unavailable' });
    }
  };
}
export function googleCoordinates(
  key: string,
  transport: typeof fetch = fetch,
) {
  return async (id: string) => {
    if (!id || id.length > 300) throw new Error('invalid_id');
    const response = await transport(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
      {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('provider_failed');
    }
    const parsed = z
      .object({
        location: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      })
      .parse(
        JSON.parse(
          new TextDecoder().decode(await readLimited(response.body, 16384)),
        ),
      );
    return { lat: parsed.location.latitude, lng: parsed.location.longitude };
  };
}
