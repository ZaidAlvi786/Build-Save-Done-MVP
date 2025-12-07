import { useState } from 'react';
import * as Location from 'expo-location';
import { requireUser } from '../../lib/supabase';
import { SavedPlace, Position } from './model';
import { navigateTo, confirmPlaceDeletion } from './native';
import { removeLocalPlace } from '../reminders/native';
export function useSavedActions(uid: string, reload: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [near, setNear] = useState<Position | null>(null);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch {
      setError(
        'This action could not finish. Your place is kept; retry when online or check app permissions.',
      );
    } finally {
      setBusy(false);
    }
  }
  return {
    error,
    busy,
    near,
    nearMe: () =>
      run(async () => {
        if (!(await Location.requestForegroundPermissionsAsync()).granted)
          throw new Error('Location denied');
        setNear(
          (
            await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            })
          ).coords,
        );
      }),
    navigate: (place: SavedPlace) => run(() => navigateTo(place)),
    visit: (place: SavedPlace) =>
      run(async () => {
        const client = await requireUser(uid);
        const { error } = await client
          .from('saved_items')
          .update({ status: 'visited' })
          .eq('id', place.saved_item_id);
        if (error) throw error;
        await removeLocalPlace(uid, place.id);
        await reload();
      }),
    refresh: (place: SavedPlace) =>
      run(async () => {
        const client = await requireUser(uid);
        const { error } = await client.functions.invoke('refresh-place', {
          body: { place_id: place.id },
        });
        if (error) throw error;
        await reload();
      }),
    remove: (place: SavedPlace) =>
      confirmPlaceDeletion(
        place.name,
        () =>
          void run(async () => {
            const client = await requireUser(uid);
            const { data, error } = await client
              .from('saved_items')
              .select('image_url')
              .eq('id', place.saved_item_id)
              .single();
            if (error) throw error;
            if (data.image_url) {
              const removed = await client.storage
                .from('captures')
                .remove([data.image_url]);
              if (removed.error) throw removed.error;
            }
            const deleted = await client
              .from('saved_items')
              .delete()
              .eq('id', place.saved_item_id);
            if (deleted.error) throw deleted.error;
            await removeLocalPlace(uid, place.id);
            await reload();
          }),
      ),
  };
}
