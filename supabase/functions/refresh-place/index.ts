import { createClient } from '@supabase/supabase-js';
import { required, unavailable } from '../_shared/http.ts';
import { matchingBackend } from '../_shared/matching-backend.ts';
import { createRefreshHandler, googleCoordinates } from './handler.ts';
let handler: (request: Request) => Promise<Response>;
try {
  if (required('GEOCODING_PROVIDER') !== 'google')
    throw new Error('unsupported_provider');
  const url = required('SUPABASE_URL'),
    key = required('SUPABASE_SERVICE_ROLE_KEY'),
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  handler = createRefreshHandler({
    ...matchingBackend(url, key),
    coordinates: googleCoordinates(required('GEOCODING_API_KEY')),
    async place(uid, id) {
      const { data, error } = await client
        .from('places')
        .select(
          'saved_item_id,provider_place_id,saved_items!inner(user_id,status)',
        )
        .eq('id', id)
        .eq('saved_items.user_id', uid)
        .in('saved_items.status', ['confirmed', 'visited'])
        .maybeSingle();
      if (error) throw new Error('database_failed');
      return data?.provider_place_id
        ? { itemId: data.saved_item_id, providerId: data.provider_place_id }
        : null;
    },
    async save(uid, id, point) {
      const { data, error } = await client.rpc('refresh_place_coordinates', {
        p_user_id: uid,
        p_place_id: id,
        p_lat: point.lat,
        p_lng: point.lng,
      });
      if (error) throw new Error('database_failed');
      return data === true;
    },
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
