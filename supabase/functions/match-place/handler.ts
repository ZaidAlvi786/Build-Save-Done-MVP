import { z } from 'zod';
import { body, json, user } from '../_shared/http.ts';
import { Geocoder } from './geocoder.ts';
const schema = z
  .object({
    saved_item_id: z.string().uuid(),
    query: z.string().trim().min(3).max(500),
  })
  .strict();
export interface MatchDependencies {
  authenticate: (token: string) => Promise<string | null>;
  owns: (userId: string, itemId: string) => Promise<boolean>;
  consume: (userId: string, itemId: string) => Promise<boolean>;
  geocoder: Geocoder;
}
export function createMatchHandler(deps: MatchDependencies) {
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
      return json(200, { candidates: await deps.geocoder.search(input.query) });
    } catch {
      return json(503, { error: 'matching_unavailable', status: 'pending' });
    }
  };
}
