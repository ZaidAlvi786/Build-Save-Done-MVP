import {
  createDiagnosticHandler,
  sentryReporter,
  DiagnosticDependencies,
} from './handler.ts';
import { equal, assert } from '../../../eval/support.ts';
const event = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: 'render' as const,
  release: '0.1.0' as const,
};
const request = (body: unknown = event, token = 'valid') =>
  new Request('http://local', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
Deno.test(
  'error reporting requires authentication and independent consent; arbitrary error text never reaches provider',
  async () => {
    let sends = 0;
    const deps: DiagnosticDependencies = {
      authenticate: (t) => Promise.resolve(t === 'valid' ? 'owner' : null),
      consume: () => Promise.resolve('disabled'),
      send: () => {
        sends++;
        return Promise.resolve();
      },
    };
    const handler = createDiagnosticHandler(deps);
    equal((await handler(request(event, 'invalid'))).status, 401);
    equal(await (await handler(request())).json(), { accepted: false });
    equal(sends, 0);
    deps.consume = () => Promise.resolve('allowed');
    for (const value of [
      { ...event, message: 'private screenshot' },
      { ...event, stack: 'private' },
      { ...event, code: 'arbitrary' },
      { ...event, user_id: 'foreign' },
    ])
      equal((await handler(request(value))).status, 400);
    equal(sends, 0);
    equal((await handler(request())).status, 200);
    equal(sends, 1);
    deps.send = () => Promise.reject(new Error('dsn secret'));
    const result = await handler(request());
    equal(await result.json(), { error: 'monitoring_unavailable' });
  },
);
Deno.test(
  'Sentry envelope contains only fixed diagnostics and validates destination',
  async () => {
    let envelope = '';
    const dsn = 'https://' + 'a'.repeat(32) + '@o123.ingest.us.sentry.io/456';
    const send = sentryReporter(dsn, 'staging', ((url, options) => {
      equal(url, 'https://o123.ingest.us.sentry.io/api/456/envelope/');
      envelope = String(options?.body);
      return Promise.resolve(new Response('{}'));
    }) as typeof fetch);
    await send(event);
    const lines = envelope.split('\n');
    equal(JSON.parse(lines[1]!).type, 'event');
    const payload = JSON.parse(lines[2]!);
    equal(payload.exception.values[0].value, 'render operation failed');
    assert(
      !('user' in payload) &&
        !('breadcrumbs' in payload) &&
        !('stacktrace' in payload.exception.values[0]),
    );
    equal(
      JSON.parse(lines[1]!).length,
      new TextEncoder().encode(lines[2]!).length,
    );
    for (const bad of [
      'https://a@evil.invalid/1',
      'http://a@o123.ingest.sentry.io/1',
    ]) {
      let denied = false;
      try {
        sentryReporter(bad, 'staging');
      } catch {
        denied = true;
      }
      assert(denied);
    }
  },
);
