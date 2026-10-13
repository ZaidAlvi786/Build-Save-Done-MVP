import { useState } from 'react';
import { placePort } from './remote';
import { SavedPlace, usableCoordinates } from './model';
export function useSavedMap(uid: string, place: SavedPlace) {
  const [image, setImage] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return {
    image,
    busy,
    error,
    async load() {
      setBusy(true);
      setError(null);
      try {
        if (!usableCoordinates(place)) throw new Error('Expired coordinates');
        setImage(
          await placePort.map(
            place.saved_item_id,
            {
              id: place.id,
              name: place.name,
              address: place.address,
              lat: place.lat!,
              lng: place.lng!,
            },
            uid,
          ),
        );
      } catch {
        setError('Map unavailable. Refresh the location or retry when online.');
      } finally {
        setBusy(false);
      }
    },
  };
}
