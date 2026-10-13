import { useState, useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { requireUser } from '../../lib/supabase';
import { SavedPlace } from '../places/model';
import { enableReminders, stopReminders, GEOFENCE_TASK } from './native';
import { debugRows, getState, rows } from './store';
import { flushReminders } from './remote';
export function useReminderSettings(
  uid: string,
  places: SavedPlace[],
  radius: number,
  onRadius: (value: number) => void,
) {
  const [value, setValue] = useState(String(radius)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [snapshot, setSnapshot] = useState('Loading native status…');
  const refresh = useCallback(async () => {
    try {
      const cached = await getState(),
        state = cached?.owner === uid ? cached : null,
        events = state ? await debugRows() : [],
        pending = await rows(uid),
        tasks = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK),
        location = await Location.getBackgroundPermissionsAsync(),
        notifications = await Notifications.getPermissionsAsync();
      const options = tasks
        ? await TaskManager.getTaskOptionsAsync<{
            regions?: { identifier?: string; radius?: number }[];
          }>(GEOFENCE_TASK)
        : null;
      const regions = options?.regions ?? [];
      setSnapshot(
        `Reminders ${state?.enabled ? 'enabled' : 'off'} · native task ${tasks ? 'registered' : 'off'}\nAlways location: ${location.status} · notifications: ${notifications.status}\n${pending.filter((r) => r.dirty).length} reminder records awaiting sync\nNative registered (${state ? regions.length : 0}):\n${state ? regions.map((r) => `${r.identifier} · ${r.radius}m`).join('\n') || 'None' : 'None'}\nExpected selection: ${state?.regions.length ?? 0}\nLast events:\n${events.map((e) => `${e.at} ${e.message}`).join('\n') || 'None'}`,
      );
    } catch {
      setError('Debug status could not load. Please retry.');
    }
  }, [uid]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reminders unavailable');
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  return {
    value,
    setValue,
    busy,
    error,
    snapshot,
    refresh: () => run(refresh),
    disable: () => run(() => stopReminders(uid)),
    settings: () => run(() => Linking.openSettings()),
    sync: () =>
      run(async () => {
        const failures = await flushReminders(uid);
        if (failures) throw new Error(`${failures} records still await sync.`);
      }),
    enable: () =>
      run(async () => {
        const next = Number(value);
        if (!Number.isInteger(next) || next < 100 || next > 2000)
          throw new Error('Choose a whole number from 100 to 2000.');
        const client = await requireUser(uid);
        const { error } = await client
          .from('users')
          .update({ reminder_radius_m: next })
          .eq('id', uid);
        if (error) throw new Error('Radius could not save. Retry when online.');
        try {
          await enableReminders(uid, places, next);
        } catch (e) {
          await stopReminders(uid);
          throw e;
        }
        onRadius(next);
      }),
  };
}
