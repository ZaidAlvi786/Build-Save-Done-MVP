import { z } from 'zod';
import { body, json, user } from '../_shared/http.ts';
import { eventSchema, FunnelEvent } from '../../../shared/events.ts';
import { readLimited } from '../_shared/io.ts';
const inputSchema = z
  .object({ events: z.array(eventSchema).min(1).max(20) })
  .strict();
export interface TrackDependencies {
  authenticate: (token: string) => Promise<string | null>;
  consume: (
    uid: string,
    count: number,
  ) => Promise<'allowed' | 'disabled' | 'limited'>;
  capture: (uid: string, events: FunnelEvent[]) => Promise<void>;
  now: () => number;
}
export function createTrackHandler(deps: TrackDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST')
      return json(405, { error: 'method_not_allowed' });
    try {
      const uid = await user(request, deps.authenticate);
      if (!uid) return json(401, { error: 'unauthorized' });
      let input: z.infer<typeof inputSchema>;
      try {
        input = await body(request, inputSchema, 16384);
        const now = deps.now();
        if (
          input.events.some(
            (e) =>
              Date.parse(e.timestamp) > now + 300000 ||
              Date.parse(e.timestamp) < now - 30 * 86400000,
          )
        )
          throw new Error('invalid_time');
      } catch {
        return json(400, { error: 'invalid_request' });
      }
      const consent = await deps.consume(uid, input.events.length);
      if (consent === 'disabled')
        return json(200, {
          accepted: [],
          discarded: input.events.map((e) => e.id),
        });
      if (consent === 'limited') return json(429, { error: 'rate_limited' });
      await deps.capture(uid, input.events);
      return json(200, {
        accepted: input.events.map((e) => e.id),
        discarded: [],
      });
    } catch {
      return json(503, { error: 'analytics_unavailable' });
    }
  };
}
export function posthogCapture(
  host: string,
  key: string,
  transport: typeof fetch = fetch,
) {
  if (!['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host))
    throw new Error('invalid_host');
  return async (uid: string, events: FunnelEvent[]) => {
    const response = await transport(`${host}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: key,
        batch: events.map((e) => ({
          uuid: e.id,
          event: e.event,
          timestamp: e.timestamp,
          properties: {
            ...e.properties,
            distinct_id: uid,
            $process_person_profile: false,
          },
        })),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('provider_failed');
    }
    const bytes = await readLimited(response.body, 16384);
    if (bytes.length) {
      const result = z
        .object({
          quota_limited: z.array(z.string()).optional(),
          errors: z.unknown().optional(),
        })
        .passthrough()
        .parse(JSON.parse(new TextDecoder().decode(bytes)));
      if (result.quota_limited?.length || result.errors)
        throw new Error('provider_limited');
    }
  };
}
