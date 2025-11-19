import {
  createTrackHandler,
  posthogCapture,
  TrackDependencies,
} from './handler.ts';
import { assert, equal } from '../../../eval/support.ts';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  timestamp = '2026-10-13T12:00:00.000Z';
const event = { id, event: 'app_opened' as const, timestamp, properties: {} };
const request = (input: unknown = { events: [event] }, token = 'valid') =>
  new Request('http://local', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
function setup() {
  let calls = 0;
  const deps: TrackDependencies = {
    authenticate: (t) => Promise.resolve(t === 'valid' ? id : null),
    consume: () => Promise.resolve('allowed'),
    now: () => Date.parse(timestamp),
    capture: () => {
      calls++;
      return Promise.resolve();
    },
  };
  return { deps, calls: () => calls };
}
Deno.test(
  'analytics authenticates and checks consent before sending; opt out discards queued events',
  async () => {
    const { deps, calls } = setup();
    const handler = createTrackHandler(deps);
    equal((await handler(request(undefined, 'invalid'))).status, 401);
    deps.consume = () => Promise.resolve('disabled');
    const disabled = await handler(request());
    equal(await disabled.json(), { accepted: [], discarded: [id] });
    equal(calls(), 0);
    deps.consume = () => Promise.resolve('limited');
    equal((await handler(request())).status, 429);
    equal(calls(), 0);
    deps.consume = () => Promise.resolve('allowed');
    equal((await handler(request())).status, 200);
    equal(calls(), 1);
  },
);
Deno.test(
  'analytics rejects arbitrary properties, identities, events, batch size and clock skew',
  async () => {
    const { deps, calls } = setup(),
      handler = createTrackHandler(deps);
    for (const input of [
      { events: [{ ...event, properties: { email: 'private' } }] },
      { events: [{ ...event, owner: 'foreign' }] },
      { events: [{ ...event, event: 'unknown' }] },
      { events: Array(21).fill(event) },
      { events: [{ ...event, timestamp: '2099-01-01T00:00:00Z' }] },
      { events: [{ ...event, timestamp: '2026-01-01T00:00:00Z' }] },
    ])
      equal((await handler(request(input))).status, 400);
    equal(calls(), 0);
  },
);
Deno.test(
  'PostHog proxy uses server identity, fixed host and retry UUID; provider errors are sanitized',
  async () => {
    let sent: Record<string, unknown> = {};
    const transport = ((url, options) => {
      equal(url, 'https://us.i.posthog.com/batch/');
      sent = JSON.parse(String(options?.body));
      return Promise.resolve(new Response('{}'));
    }) as typeof fetch;
    await posthogCapture(
      'https://us.i.posthog.com',
      'server-secret',
      transport,
    )(id, [event]);
    equal(sent.token, 'server-secret');
    const batch = sent.batch as Record<string, unknown>[];
    equal(batch[0]!.uuid, id);
    equal((batch[0]!.properties as Record<string, unknown>).distinct_id, id);
    let rejected = false;
    try {
      posthogCapture('https://evil.invalid', 'key');
    } catch {
      rejected = true;
    }
    assert(rejected);
    const { deps } = setup();
    deps.capture = () => Promise.reject(new Error('provider secret'));
    const result = await createTrackHandler(deps)(request());
    equal(result.status, 503);
    equal(await result.json(), { error: 'analytics_unavailable' });
  },
);
Deno.test('PostHog quota-limited response is not acknowledged', async () => {
  let rejected = false;
  try {
    await posthogCapture('https://eu.i.posthog.com', 'secret', (() =>
      Promise.resolve(
        new Response(JSON.stringify({ quota_limited: ['events'] })),
      )) as typeof fetch)(id, [event]);
  } catch {
    rejected = true;
  }
  assert(rejected);
});
