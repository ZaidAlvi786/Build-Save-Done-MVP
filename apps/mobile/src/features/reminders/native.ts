import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import { requireUser, supabase } from '../../lib/supabase';
import { Position, SavedPlace, usableCoordinates } from '../places/model';
import { navigateTo } from '../places/native';
import { nearestGeofences } from './selection';
import { Reminder, ReminderAction, snoozePlan } from './actions';
import * as store from './store';
import { flushReminders } from './remote';
export const GEOFENCE_TASK = 'saved-done-geofences-v1',
  MOVEMENT_TASK = 'saved-done-movement-v1',
  RESPONSE_TASK = 'saved-done-responses-v1',
  CATEGORY = 'saved-place';
async function authenticated(owner: string) {
  const session = await supabase?.auth.getSession();
  return session?.data.session?.user.id === owner;
}
async function cancelPlaceNotifications(placeId?: string) {
  const state = await store.getState();
  if (state)
    for (const row of await store.rows(state.owner))
      if (
        row.source === 'snooze' &&
        !row.canceled &&
        Date.parse(row.sentAt) > Date.now() &&
        (!placeId || row.placeId === placeId)
      )
        await store.putReminder({
          ...row,
          canceled: true,
          dirty: false,
          delivered: false,
        });
  for (const request of await Notifications.getAllScheduledNotificationsAsync()) {
    if (
      (request.content.data?.reminderId ||
        (!placeId && request.content.data?.kind === 'digest')) &&
      (!placeId || request.content.data.placeId === placeId)
    )
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
  for (const item of await Notifications.getPresentedNotificationsAsync()) {
    if (
      (item.request.content.data?.reminderId ||
        (!placeId && item.request.content.data?.kind === 'digest')) &&
      (!placeId || item.request.content.data.placeId === placeId)
    )
      await Notifications.dismissNotificationAsync(item.request.identifier);
  }
}
export async function scheduleSnooze(parent: Reminder) {
  await store.exclusive(async () => {
    const state = await store.getState();
    if (
      !state?.enabled ||
      state.owner !== parent.owner ||
      !(await authenticated(parent.owner))
    )
      return;
    const place = state.places.find(
      (p) => p.id === parent.placeId && p.status === 'confirmed',
    );
    if (!place || !(await Notifications.getPermissionsAsync()).granted) return;
    const old = (await store.rows(parent.owner)).find(
      (r) => r.parentId === parent.id,
    );
    if (old?.canceled || old?.delivered) return;
    let row = old ?? snoozePlan(parent, Crypto.randomUUID());
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (!scheduled.some((r) => r.identifier === row.id)) {
      if (Date.parse(row.sentAt) <= Date.now())
        row = { ...row, sentAt: new Date(Date.now() + 1000).toISOString() };
      await store.putReminder(row);
      await Notifications.scheduleNotificationAsync({
        identifier: row.id,
        content: {
          title: `You saved ${place.name}`,
          body: 'Your snoozed save is ready. Navigate, snooze again, or mark it visited.',
          categoryIdentifier: CATEGORY,
          data: { reminderId: row.id, placeId: place.id, owner: parent.owner },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(row.sentAt),
          channelId: 'saved-places',
        },
      });
    }
    await store.putReminder({ ...row, delivered: true });
  });
}
export async function configureNotifications() {
  await Notifications.setNotificationChannelAsync('saved-places', {
    name: 'Nearby saved places',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    {
      identifier: 'navigate',
      buttonTitle: 'Navigate',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'snooze',
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'been_there',
      buttonTitle: 'Already been',
      options: { opensAppToForeground: true },
    },
  ]);
  await Notifications.registerTaskAsync(RESPONSE_TASK);
}
export async function stopReminders(
  owner?: string,
  mode: 'pause' | 'signout' | 'delete' = 'pause',
) {
  await store.exclusive(async () => {
    const state = await store.getState();
    if (!state || !owner || state.owner === owner) {
      if (state)
        await store.putState({
          ...state,
          enabled: false,
          places: mode === 'pause' ? state.places : [],
          regions: [],
        });
      if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      if (await Location.hasStartedLocationUpdatesAsync(MOVEMENT_TASK))
        await Location.stopLocationUpdatesAsync(MOVEMENT_TASK);
      await cancelPlaceNotifications();
      if (mode !== 'pause') await store.clearDebug();
    }
  });
  if (owner && mode === 'delete') await store.purge(owner);
}
export async function reconcile(position: Position) {
  await store.purgeExpired();
  await store.exclusive(async () => {
    const state = await store.getState();
    if (!state?.enabled || !(await authenticated(state.owner))) return;
    if (
      !(await Location.getBackgroundPermissionsAsync()).granted ||
      !(await Notifications.getPermissionsAsync()).granted
    ) {
      await store.putState({ ...state, enabled: false, regions: [] });
      await cancelPlaceNotifications();
      if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      if (await Location.hasStartedLocationUpdatesAsync(MOVEMENT_TASK))
        await Location.stopLocationUpdatesAsync(MOVEMENT_TASK);
      await store.debug('Permission lost; reminders paused');
      return;
    }
    const selected = nearestGeofences(state.places, position, state.radius);
    if (selected.length)
      await Location.startGeofencingAsync(GEOFENCE_TASK, selected);
    else if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    await store.putState({ ...state, regions: selected });
    await store.debug(
      `Registered ${selected.length} nearest geofences at ${state.radius}m`,
    );
  });
}
export async function resumeReminders(
  uid: string,
  places: SavedPlace[],
  radius: number,
) {
  await store.initialize(uid, places, radius);
  const state = await store.getState();
  if (state?.enabled) {
    for (const row of await store.rows(uid))
      if (row.action === 'snooze') await scheduleSnooze(row);
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) {
      const point = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await reconcile(point.coords);
    }
  }
  try {
    await flushReminders(uid);
  } catch {
    await store.debug('Reminder actions await sync');
  }
}
export async function enableReminders(
  uid: string,
  places: SavedPlace[],
  radius: number,
) {
  await requireUser(uid);
  await configureNotifications();
  if (!(await Notifications.requestPermissionsAsync()).granted)
    throw new Error(
      'Notifications are off. Saved places still work; enable notifications in Settings.',
    );
  if (!(await Location.requestForegroundPermissionsAsync()).granted)
    throw new Error(
      'Location is off. You can still browse and navigate manually.',
    );
  if (!(await Location.requestBackgroundPermissionsAsync()).granted)
    throw new Error(
      'Nearby reminders need Always location. Enable it in Settings, or keep using your saved list.',
    );
  await store.initialize(uid, places, radius);
  await store.exclusive(async () => {
    const state = await store.getState();
    if (state?.owner === uid) await store.putState({ ...state, enabled: true });
  });
  const point = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  await reconcile(point.coords);
  await Location.startLocationUpdatesAsync(MOVEMENT_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 1000,
    timeInterval: 300000,
    deferredUpdatesDistance: 1000,
    deferredUpdatesInterval: 300000,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Saved → Done nearby reminders',
      notificationBody:
        'Checking saved places on this phone. Turn off in Reminders.',
      killServiceOnDestroy: true,
    },
  });
  await store.debug(
    'Nearby reminders enabled; movement updates stay on device',
  );
}
export async function geofenceEvent(identifier: string, enter: boolean) {
  const expired = await store.purgeExpired();
  if (expired)
    await store.exclusive(async () => {
      const state = await store.getState();
      if (state?.enabled && state.regions.length)
        await Location.startGeofencingAsync(GEOFENCE_TASK, state.regions);
      else if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
    });
  await store.exclusive(async () => {
    const state = await store.getState();
    if (!state?.enabled || !(await authenticated(state.owner))) return;
    await store.debug(`Geofence ${enter ? 'enter' : 'exit'}: ${identifier}`);
    if (!enter) return;
    if (
      !(await Notifications.getPermissionsAsync()).granted ||
      !(await Location.getBackgroundPermissionsAsync()).granted
    ) {
      await store.debug(
        'Entry ignored: location or notifications permission missing',
      );
      return;
    }
    const place = state.places.find(
      (p) =>
        p.id === identifier && p.status === 'confirmed' && usableCoordinates(p),
    );
    if (!place || !state.regions.some((r) => r.identifier === identifier))
      return;
    const reminders = await store.rows(state.owner);
    const last = reminders.find(
      (r) => r.placeId === place.id && r.delivered && !r.canceled,
    );
    if (
      last &&
      Date.now() - Date.parse(last.actionAt ?? last.sentAt) <
        (last.action === 'snooze' ? 24 : 12) * 3600000
    ) {
      await store.debug(`Entry suppressed by cooldown: ${identifier}`);
      return;
    }
    const row = reminders.find(
      (r) =>
        r.placeId === place.id &&
        !r.delivered &&
        !r.canceled &&
        r.source !== 'snooze',
    ) ?? {
      id: Crypto.randomUUID(),
      owner: state.owner,
      placeId: place.id,
      sentAt: new Date().toISOString(),
      action: 'ignored' as const,
      actionAt: null,
      dirty: true,
      delivered: false,
    };
    await store.putReminder(row);
    await Notifications.scheduleNotificationAsync({
      identifier: row.id,
      content: {
        title: `You saved ${place.name}`,
        body: 'You are nearby. Go now, snooze, or mark it visited.',
        categoryIdentifier: CATEGORY,
        data: { reminderId: row.id, placeId: place.id, owner: state.owner },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: 'saved-places',
      },
    });
    await store.putReminder({ ...row, delivered: true });
    await store.debug(`Reminder scheduled: ${row.id}`);
  });
  const state = await store.getState();
  if (state?.enabled)
    try {
      await flushReminders(state.owner);
    } catch {
      await store.debug('Reminder queued offline');
    }
}
export async function handleResponse(
  response: Notifications.NotificationResponse,
) {
  const { reminderId, owner, placeId } =
    response.notification.request.content.data ?? {};
  const value = response.actionIdentifier;
  if (
    typeof reminderId !== 'string' ||
    typeof owner !== 'string' ||
    typeof placeId !== 'string'
  )
    return;
  if (!(await authenticated(owner))) return;
  const state = await store.getState();
  if (state?.owner !== owner) return;
  if (value === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    const place = state.places.find((p) => p.id === placeId);
    if (place)
      Alert.alert(
        `You saved ${place.name}`,
        'What would you like to do?',
        (['navigate', 'snooze', 'been_there'] as const).map((action) => ({
          text:
            action === 'navigate'
              ? 'Navigate'
              : action === 'snooze'
                ? 'Snooze'
                : 'Already been',
          onPress: () => {
            void handleResponse({
              ...response,
              actionIdentifier: action,
            }).catch(() =>
              store
                .debug('Reminder action failed; reopen the app')
                .catch(() => undefined),
            );
          },
        })),
      );
    await Notifications.clearLastNotificationResponseAsync();
    return;
  }
  if (!['navigate', 'snooze', 'been_there'].includes(value)) return;
  const result = await store.action(reminderId, owner, value as ReminderAction);
  const next = result.row;
  if (!result.changed) {
    if (next.action === 'snooze') await scheduleSnooze(next);
    await Notifications.clearLastNotificationResponseAsync();
    return;
  }
  await store.debug(`Action ${next.action} stored: ${reminderId}`);
  if (next.action === 'been_there' || next.action === 'snooze') {
    await cancelPlaceNotifications(placeId);
    if (next.action === 'been_there')
      await removeLocalPlace(owner, placeId, false);
    else await scheduleSnooze(next);
  }
  if (next.action === 'navigate') {
    const place = state.places.find((p) => p.id === placeId);
    if (place)
      try {
        await navigateTo(place);
      } catch {
        await store.debug('Navigation unavailable; action remains recorded');
      }
  }
  try {
    await flushReminders(owner);
  } catch {
    await store.debug('Action retained for foreground retry');
  }
  await Notifications.clearLastNotificationResponseAsync();
}
export async function removeLocalPlace(uid: string, id: string, remove = true) {
  await store.exclusive(async () => {
    const state = await store.getState();
    if (state?.owner === uid) {
      const regions = state.regions.filter((r) => r.identifier !== id);
      await store.putState({
        ...state,
        places: remove ? state.places.filter((p) => p.id !== id) : state.places,
        regions,
      });
      if (state.enabled) {
        if (regions.length)
          await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
        else if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
          await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }
    }
    await cancelPlaceNotifications(id);
  });
  try {
    const point = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
    if (point) await reconcile(point.coords);
  } catch {
    await store.debug('Selection refresh awaits a location fix');
  }
}
