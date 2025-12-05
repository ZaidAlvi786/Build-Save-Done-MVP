import { z } from 'zod';
import { requireUser } from '../../lib/supabase';
import { captureRemote } from '../capture/remote';
import { candidateSchema, PlacePort } from './service';
import { SavedPlace, savedPlaceSchema, usableCoordinates } from './model';
export type { SavedPlace } from './model';
export const placePort: PlacePort = {
  async ensure(item, uid) {
    const state = await captureRemote.ensure(item, uid);
    // Confirmation cannot discard a private original before its upload succeeds.
    if (state !== 'confirmed' && item.fileUri && !item.uploaded)
      await captureRemote.upload(item, uid);
    return state;
  },
  async search(id, query, uid) {
    const client = await requireUser(uid);
    const { data, error } = await client.functions.invoke('match-place', {
      body: { saved_item_id: id, query },
    });
    if (error) throw new Error('Matching unavailable');
    return z.object({ candidates: z.array(candidateSchema).max(5) }).parse(data)
      .candidates;
  },
  async map(id, candidate, uid) {
    const client = await requireUser(uid);
    const { data, error } = await client.functions.invoke('place-map', {
      body: { saved_item_id: id, lat: candidate.lat, lng: candidate.lng },
    });
    if (error) throw new Error('Map unavailable');
    const image = z
      .object({
        image_base64: z
          .string()
          .min(1)
          .max(1500000)
          .regex(/^[A-Za-z0-9+/=]+$/),
      })
      .parse(data).image_base64;
    return `data:image/png;base64,${image}`;
  },
  async confirm(input, uid) {
    const client = await requireUser(uid);
    const { error } = await client.rpc('confirm_place', {
      p_item_id: input.item.id,
      p_name: input.name.trim(),
      p_address: input.area.trim(),
      p_lat: input.candidate.lat,
      p_lng: input.candidate.lng,
      p_category: input.category,
      p_confidence: input.item.extraction?.place?.confidence ?? 0,
      p_provider_id: input.candidate.id,
    });
    if (error) throw new Error('Confirmation unavailable');
  },
};
export async function recentPlaces(uid: string): Promise<SavedPlace[]> {
  const client = await requireUser(uid);
  const places: SavedPlace[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from('places')
      .select(
        'id,saved_item_id,name,address,lat,lng,category,coordinates_expire_at,saved_items!inner(status)',
      )
      .in('saved_items.status', ['confirmed', 'visited'])
      .order('id')
      .range(offset, offset + 499);
    if (error || !data) throw new Error('Places unavailable');
    for (const row of data) {
      const parent = z
        .object({ status: z.enum(['confirmed', 'visited']) })
        .parse(row.saved_items);
      const place = savedPlaceSchema.parse({ ...row, status: parent.status });
      places.push(
        usableCoordinates(place) ? place : { ...place, lat: null, lng: null },
      );
    }
    if (data.length < 500) return places;
  }
}
