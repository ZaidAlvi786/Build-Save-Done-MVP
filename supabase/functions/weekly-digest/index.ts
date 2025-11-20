import { createClient } from '@supabase/supabase-js';
import { required, unavailable } from '../_shared/http.ts';
import { createDigestHandler, cronAuthorization } from './handler.ts';
import { expoPush } from './provider.ts';
let handler: (request: Request) => Promise<Response>;
try {
  const secret = required('DIGEST_CRON_SECRET');
  if (secret.length < 32) throw new Error('weak_secret');
  const client = createClient(
      required('SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
    push = expoPush(required('EXPO_PUSH_ACCESS_TOKEN'));
  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('database_failed');
    return data;
  };
  handler = createDigestHandler({
    authorize: (token) => cronAuthorization(secret, token),
    claim: () => rpc('claim_weekly_digest'),
    pending: () => rpc('pending_digest_receipts'),
    allowed: (row) =>
      rpc('digest_still_allowed', {
        p_user_id: row.user_id,
        p_lease_id: row.lease_id,
      }),
    finish: async (uid, lease, state, ticket, invalid) => {
      await rpc('finish_digest', {
        p_user_id: uid,
        p_lease_id: lease,
        p_state: state,
        p_ticket_id: ticket,
        p_invalid_token: invalid,
      });
    },
    send: (rows) =>
      push.send(
        rows.map((r) => ({
          token: r.token,
          count: r.place_count,
          leaseId: r.lease_id,
          owner: r.user_id,
        })),
      ),
    receipts: push.receipts,
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
