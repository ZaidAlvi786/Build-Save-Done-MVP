import { useMemo } from 'react';
import { Capture } from './types';
import { SavedPlace } from '../places/model';
export type Entry =
  { kind: 'capture'; value: Capture } | { kind: 'place'; value: SavedPlace };
export function useEntries(items: Capture[], places: SavedPlace[]) {
  return useMemo<Entry[]>(
    () => [
      ...items.map((value) => ({ kind: 'capture' as const, value })),
      ...places.map((value) => ({ kind: 'place' as const, value })),
    ],
    [items, places],
  );
}
