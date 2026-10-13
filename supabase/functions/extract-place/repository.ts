import { createClient } from '@supabase/supabase-js';
import { Claim, Repository } from '../_shared/contracts.ts';
export function backend(url: string, serviceKey: string) {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repository: Repository = {
    async claim(userId, itemId, token) {
      const { data, error } = await client.rpc('claim_extraction', {
        p_user_id: userId,
        p_item_id: itemId,
        p_token: token,
      });
      if (error) throw new Error('database_failed');
      return data as Claim;
    },
    async image(path) {
      const { data, error } = await client.storage
        .from('captures')
        .download(path);
      if (error || !data) throw new Error('storage_failed');
      return data;
    },
    async finish(userId, itemId, token, result) {
      const { data, error } = await client.rpc('finish_extraction', {
        p_user_id: userId,
        p_item_id: itemId,
        p_token: token,
        p_result: result,
      });
      if (error) throw new Error('database_failed');
      return data === true;
    },
    async release(userId, itemId, token) {
      const { error } = await client.rpc('release_extraction', {
        p_user_id: userId,
        p_item_id: itemId,
        p_token: token,
      });
      if (error) throw new Error('database_failed');
    },
  };
  return {
    repository,
    async authenticate(token: string) {
      const { data, error } = await client.auth.getUser(token);
      if (error) {
        if (error.status && error.status >= 500)
          throw new Error('auth_unavailable');
        return null;
      }
      return data.user?.id ?? null;
    },
  };
}
