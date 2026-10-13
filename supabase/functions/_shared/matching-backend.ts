import { createClient } from '@supabase/supabase-js';
import { backend } from '../extract-place/repository.ts';
export function matchingBackend(url: string, key: string) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    authenticate: backend(url, key).authenticate,
    async owns(uid: string, id: string) {
      const { data, error } = await client
        .from('saved_items')
        .select('id')
        .eq('id', id)
        .eq('user_id', uid)
        .maybeSingle();
      if (error) throw new Error('database_failed');
      return !!data;
    },
    async consume(uid: string, id: string) {
      const { data, error } = await client.rpc('consume_matching_quota', {
        p_user_id: uid,
        p_item_id: id,
      });
      if (error) throw new Error('database_failed');
      return data === true;
    },
  };
}
