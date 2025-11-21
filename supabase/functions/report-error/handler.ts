import { body, json, user } from '../_shared/http.ts';
import { Diagnostic, diagnosticSchema } from '../../../shared/diagnostics.ts';
export interface DiagnosticDependencies {
  authenticate: (token: string) => Promise<string | null>;
  consume: (uid: string) => Promise<'allowed' | 'disabled' | 'limited'>;
  send: (event: Diagnostic) => Promise<void>;
}
export function createDiagnosticHandler(deps: DiagnosticDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST')
      return json(405, { error: 'method_not_allowed' });
    try {
      const uid = await user(request, deps.authenticate);
      if (!uid) return json(401, { error: 'unauthorized' });
      let event: Diagnostic;
      try {
        event = await body(request, diagnosticSchema);
      } catch {
        return json(400, { error: 'invalid_request' });
      }
      const consent = await deps.consume(uid);
      if (consent === 'disabled') return json(200, { accepted: false });
      if (consent === 'limited') return json(429, { error: 'rate_limited' });
      await deps.send(event);
      return json(200, { accepted: true });
    } catch {
      return json(503, { error: 'monitoring_unavailable' });
    }
  };
}
export function sentryReporter(
  dsn: string,
  environment: string,
  transport: typeof fetch = fetch,
) {
  const parsed = new URL(dsn);
  if (
    parsed.protocol !== 'https:' ||
    !/^o\d+\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(parsed.hostname) ||
    parsed.port ||
    parsed.password ||
    !/^\/[0-9]+$/.test(parsed.pathname) ||
    !/^[a-f0-9]{32}$/.test(parsed.username) ||
    !['development', 'staging', 'production'].includes(environment)
  )
    throw new Error('invalid_configuration');
  const url = `${parsed.origin}/api${parsed.pathname}/envelope/`;
  return async (event: Diagnostic) => {
    const id = event.id.replaceAll('-', '');
    const payload = JSON.stringify({
      event_id: id,
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      release: `saved-done@${event.release}`,
      environment,
      fingerprint: ['saved-done', event.code],
      exception: {
        values: [
          { type: 'SavedDoneFailure', value: `${event.code} operation failed` },
        ],
      },
      tags: { feature: event.code },
    });
    const envelope = [
      JSON.stringify({ event_id: id, dsn, sent_at: new Date().toISOString() }),
      JSON.stringify({
        type: 'event',
        length: new TextEncoder().encode(payload).length,
      }),
      payload,
      '',
    ].join('\n');
    const response = await transport(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    if (!response.ok || response.headers.get('X-Sentry-Rate-Limits'))
      throw new Error('reporting_failed');
  };
}
