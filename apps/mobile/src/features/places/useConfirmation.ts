import { reportIssue } from '../../lib/diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capture, Category } from '../capture/types';
import { Candidate, confirmationService } from './service';
import { placePort } from './remote';
import { track } from '../analytics/client';
const service = confirmationService(placePort);
export function useConfirmation(
  item: Capture,
  uid: string,
  onSaved: () => Promise<void>,
) {
  const detected = item.extraction?.place;
  const [name, setName] = useState(detected?.name ?? ''),
    [area, setArea] = useState(detected?.address ?? detected?.area ?? ''),
    [category, setCategory] = useState<Category>(detected?.category ?? 'other');
  const [editing, setEditing] = useState(!detected),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [selected, setSelected] = useState<Candidate | null>(null),
    [image, setImage] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [mapError, setMapError] = useState(false),
    [addressAcknowledged, setAddressAcknowledged] = useState(false);
  const generation = useRef(0),
    alive = useRef(true),
    initial = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const loadMap = useCallback(
    async (candidate: Candidate, ticket: number) => {
      try {
        const value = await placePort.map(item.id, candidate, uid);
        if (alive.current && generation.current === ticket) setImage(value);
      } catch {
        if (alive.current && generation.current === ticket) setMapError(true);
      }
    },
    [item.id, uid],
  );
  const search = useCallback(async () => {
    const ticket = ++generation.current;
    setBusy(true);
    setError(null);
    setSelected(null);
    setImage(null);
    setMapError(false);
    setAddressAcknowledged(false);
    setCandidates([]);
    try {
      const matches = await service.search(item, name, area, uid);
      if (!alive.current || ticket !== generation.current) return;
      setCandidates(matches);
      const first = matches[0];
      if (first) {
        setSelected(first);
        await loadMap(first, ticket);
      } else setError('No match found. Try the street address and city.');
    } catch {
      if (alive.current && ticket === generation.current)
        setError(
          'Matching is unavailable. Your save is kept; edit the name and area, then retry.',
        );
    } finally {
      if (alive.current && ticket === generation.current) setBusy(false);
    }
  }, [item, name, area, uid, loadMap]);
  useEffect(() => {
    if (initial.current) return;
    // Start native/network work after mount; cleanup cancels a dismissed screen.
    const timer = setTimeout(() => {
      initial.current = true;
      if (name.trim() && area.trim()) void search();
    }, 0);
    return () => clearTimeout(timer);
  }, [name, area, search]);
  function invalidate() {
    generation.current++;
    setCandidates([]);
    setSelected(null);
    setImage(null);
    setBusy(false);
    setMapError(false);
    setAddressAcknowledged(false);
  }
  return {
    name,
    area,
    category,
    editing,
    candidates,
    selected,
    image,
    busy,
    saving,
    error,
    mapError,
    addressAcknowledged,
    setName(value: string) {
      invalidate();
      setName(value);
    },
    setArea(value: string) {
      invalidate();
      setArea(value);
    },
    setCategory,
    setEditing,
    search,
    setAddressAcknowledged,
    async select(candidate: Candidate) {
      const ticket = ++generation.current;
      setSelected(candidate);
      setImage(null);
      setMapError(false);
      setAddressAcknowledged(false);
      setBusy(true);
      await loadMap(candidate, ticket);
      if (alive.current && generation.current === ticket) setBusy(false);
    },
    async retryMap() {
      if (!selected) return;
      setMapError(false);
      setBusy(true);
      await loadMap(selected, generation.current);
      if (alive.current) setBusy(false);
    },
    async confirm() {
      if (!selected || (!image && !addressAcknowledged) || saving) return;
      setSaving(true);
      setError(null);
      try {
        await service.confirm(
          { item, name, area, category, candidate: selected },
          uid,
        );
        const corrected =
          !detected ||
          name.trim() !== detected.name ||
          area.trim() !== (detected.address ?? detected.area ?? '') ||
          category !== detected.category ||
          selected !== candidates[0];
        await track(
          uid,
          'place_confirmed',
          { item_id: item.id, category, corrected },
          item.id,
        );
        if (corrected)
          await track(
            uid,
            'place_corrected',
            { item_id: item.id, category },
            item.id,
          );
        await onSaved();
      } catch {
        void reportIssue(uid, 'confirmation');
        if (alive.current)
          setError(
            'Could not finish saving. Your screenshot is safe; try again.',
          );
      } finally {
        if (alive.current) setSaving(false);
      }
    },
  };
}
