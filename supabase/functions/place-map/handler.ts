import { z } from 'zod';
import { body, json, user } from '../_shared/http.ts';
import { readLimited, validateImage } from '../_shared/io.ts';
const schema = z
  .object({
    saved_item_id: z.string().uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();
export interface MapDependencies {
  authenticate: (token: string) => Promise<string | null>;
  owns: (uid: string, id: string) => Promise<boolean>;
  consume: (uid: string, id: string) => Promise<boolean>;
  image: (lat: number, lng: number) => Promise<Uint8Array>;
}
export function createMapHandler(deps: MapDependencies) {
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
      if (!(await deps.owns(uid, input.saved_item_id)))
        return json(404, { error: 'item_not_found' });
      if (!(await deps.consume(uid, input.saved_item_id)))
        return json(429, { error: 'rate_limited' });
      const image = await deps.image(input.lat, input.lng);
      validateImage(image, 'image/png');
      let binary = '';
      for (let i = 0; i < image.length; i += 8192)
        binary += String.fromCharCode(...image.subarray(i, i + 8192));
      return json(200, { image_base64: btoa(binary) });
    } catch {
      return json(503, { error: 'map_unavailable' });
    }
  };
}
export function staticMap(key: string, transport: typeof fetch = fetch) {
  return async (lat: number, lng: number) => {
    const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
    for (const [name, value] of Object.entries({
      center: `${lat},${lng}`,
      zoom: '16',
      size: '600x320',
      scale: '1',
      format: 'png',
      markers: `color:green|${lat},${lng}`,
      key,
    }))
      url.searchParams.set(name, value);
    const response = await transport(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('map_unavailable');
    }
    return await readLimited(response.body, 1024 * 1024);
  };
}
