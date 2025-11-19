import { createClient } from '@supabase/supabase-js';
import { backend } from '../extract-place/repository.ts';
import { required, unavailable } from '../_shared/http.ts';
import { createTrackHandler, posthogCapture } from './handler.ts';
let handler: (request: Request) => Promise<Response>;
try {
  const url = required('SUPABASE_URL'),
    key = required('SUPABASE_SERVICE_ROLE_KEY'),
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  handler = createTrackHandler({
    authenticate: backend(url, key).authenticate,
    now: Date.now,
    capture: posthogCapture(
      required('POSTHOG_HOST'),
      required('POSTHOG_PROJECT_TOKEN'),
    ),
    async consume(uid, count) {
      const { data, error } = await client.rpc('consume_analytics_quota', {
        p_user_id: uid,
        p_events: count,
      });
      if (error || !['allowed', 'disabled', 'limited'].includes(data))
        throw new Error('database_failed');
      return data;
    },
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
