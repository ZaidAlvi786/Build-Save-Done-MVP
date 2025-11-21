import { createClient } from '@supabase/supabase-js';
import { backend } from '../extract-place/repository.ts';
import { required, unavailable } from '../_shared/http.ts';
import { createDiagnosticHandler, sentryReporter } from './handler.ts';
let handler: (request: Request) => Promise<Response>;
try {
  const url = required('SUPABASE_URL'),
    key = required('SUPABASE_SERVICE_ROLE_KEY'),
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  handler = createDiagnosticHandler({
    authenticate: backend(url, key).authenticate,
    send: sentryReporter(
      required('SENTRY_PROJECT_DSN'),
      required('SENTRY_ENVIRONMENT'),
    ),
    async consume(uid) {
      const { data, error } = await client.rpc('consume_diagnostics_quota', {
        p_user_id: uid,
      });
      if (error || !['allowed', 'disabled', 'limited'].includes(data))
        throw new Error('quota');
      return data;
    },
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
