import { createClient } from '@supabase/supabase-js';
import { required, unavailable } from '../_shared/http.ts';
import { backend } from '../extract-place/repository.ts';
import { createDeleteHandler } from './handler.ts';
let handler: (request: Request) => Promise<Response>;
try {
  const url = required('SUPABASE_URL'),
    key = required('SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(url, key, { auth: { persistSession: false } });
  handler = createDeleteHandler({
    authenticate: backend(url, key).authenticate,
    async begin(uid) {
      const { error } = await client.rpc('begin_account_deletion', {
        p_user_id: uid,
      });
      if (error) throw new Error('database_failed');
    },
    async paths(uid) {
      const { data, error } = await client.rpc('account_capture_paths', {
        p_user_id: uid,
      });
      if (error) throw new Error('storage_failed');
      return data.map((row: { name: string }) => row.name);
    },
    async removeImages(paths) {
      const { error } = await client.storage.from('captures').remove(paths);
      if (error) throw new Error('storage_failed');
    },
    async removeUser(uid) {
      const { error } = await client.auth.admin.deleteUser(uid);
      if (error) throw new Error('auth_failed');
    },
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
