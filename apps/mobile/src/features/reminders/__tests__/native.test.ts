import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../lib/supabase';
import {
  geofenceEvent,
  handleResponse,
  stopReminders,
  enableReminders,
  reconcile,
  removeLocalPlace,
  scheduleSnooze,
} from '../native';
import { flushReminders } from '../remote';
import * as store from '../store';
import { navigateTo } from '../../places/native';
import { SavedPlace } from '../../places/model';
import { Reminder, applyAction } from '../actions';
let mockState: store.ReminderState | null;
let mockRows: Reminder[] = [];
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pid = '11111111-1111-4111-8111-111111111111';
jest.mock('../store', () => ({
  exclusive: jest.fn((work: () => Promise<unknown>) => work()),
  purgeExpired: jest.fn(),
  getState: jest.fn(() => Promise.resolve(mockState)),
  putState: jest.fn((state: store.ReminderState) => {
    mockState = state;
    return Promise.resolve();
  }),
  rows: jest.fn(() => Promise.resolve(mockRows)),
  putReminder: jest.fn((row: Reminder) => {
    mockRows = mockRows.filter((r) => r.id !== row.id).concat(row);
    return Promise.resolve();
  }),
  debug: jest.fn(),
  purge: jest.fn(),
  clearDebug: jest.fn(),
  initialize: jest.fn(),
  action: jest.fn(),
}));
jest.mock('../remote', () => ({
  flushReminders: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../places/native', () => ({
  navigateTo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/supabase', () => ({
  requireUser: jest.fn().mockResolvedValue({}),
  supabase: { auth: { getSession: jest.fn() } },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '22222222-2222-4222-8222-222222222222',
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  hasStartedGeofencingAsync: jest.fn().mockResolvedValue(true),
  stopGeofencingAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(true),
  stopLocationUpdatesAsync: jest.fn(),
  startGeofencingAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: true }),
  requestBackgroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: true }),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  registerTaskAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled'),
  clearLastNotificationResponseAsync: jest.fn(),
}));
const place: SavedPlace = {
  id: pid,
  saved_item_id: pid,
  name: 'Cafe',
  address: 'Area',
  lat: 0,
  lng: 0,
  category: 'cafe',
  coordinates_expire_at: '2099-01-01T00:00:00Z',
  status: 'confirmed',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    owner: uid,
    enabled: true,
    radius: 300,
    places: [place],
    regions: [
      {
        identifier: pid,
        latitude: 0,
        longitude: 0,
        radius: 300,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ],
  };
  mockRows = [];
  (supabase!.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: uid } } },
  });
  (flushReminders as jest.Mock).mockResolvedValue(0);
});
test('entry queues one local notification and durable row; exit and duplicate entry do not notify', async () => {
  await geofenceEvent(pid, false);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  await geofenceEvent(pid, true);
  await geofenceEvent(pid, true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]?.delivered).toBe(true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        categoryIdentifier: 'saved-place',
        data: expect.objectContaining({ reminderId: mockRows[0]?.id }),
      }),
    }),
  );
});
test('inactive owner and visited or expired places cannot trigger', async () => {
  (supabase!.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'other' } } },
  });
  await geofenceEvent(pid, true);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  (supabase!.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: uid } } },
  });
  mockState!.places = [{ ...place, status: 'visited' }];
  await geofenceEvent(pid, true);
  mockState!.places = [
    { ...place, coordinates_expire_at: '2000-01-01T00:00:00Z' },
  ];
  await geofenceEvent(pid, true);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test('schedule failure retains a stable reminder ID for retry instead of logging a false sent event', async () => {
  (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
    new Error('native'),
  );
  await expect(geofenceEvent(pid, true)).rejects.toThrow();
  expect(mockRows[0]?.delivered).toBe(false);
  const id = mockRows[0]?.id;
  await geofenceEvent(pid, true);
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0]?.id).toBe(id);
  expect(mockRows[0]?.delivered).toBe(true);
});
test('navigate is persisted before Maps and survives offline sync failure', async () => {
  await geofenceEvent(pid, true);
  (store.action as jest.Mock).mockImplementation(
    async (id: string, owner: string, value: 'navigate') => {
      const row = applyAction(mockRows[0]!, value, new Date());
      mockRows = [row];
      return { row, changed: true };
    },
  );
  (flushReminders as jest.Mock).mockRejectedValue(new Error('offline'));
  const response = {
    actionIdentifier: 'navigate',
    notification: {
      request: {
        content: {
          data: { reminderId: mockRows[0]!.id, owner: uid, placeId: pid },
        },
      },
    },
  } as unknown as Notifications.NotificationResponse;
  await handleResponse(response);
  expect(mockRows[0]?.action).toBe('navigate');
  expect(mockRows[0]?.dirty).toBe(true);
  expect(navigateTo).toHaveBeenCalledWith(place);
  expect((store.action as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (navigateTo as jest.Mock).mock.invocationCallOrder[0]!,
  );
});
test('denied background access never starts native movement tracking', async () => {
  (
    Location.requestBackgroundPermissionsAsync as jest.Mock
  ).mockResolvedValueOnce({ granted: false });
  await expect(enableReminders(uid, [place], 300)).rejects.toThrow('Always');
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
});
test('pause fences events and stops geofences, movement and notifications', async () => {
  (
    Notifications.getAllScheduledNotificationsAsync as jest.Mock
  ).mockResolvedValueOnce([
    {
      identifier: 'notification',
      content: { data: { reminderId: 'row', placeId: pid } },
    },
  ]);
  await stopReminders(uid);
  expect(mockState?.enabled).toBe(false);
  expect(Location.stopGeofencingAsync).toHaveBeenCalled();
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'notification',
  );
  await geofenceEvent(pid, true);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test('reconciliation re-registers selected radius and invalid permissions stop tracking', async () => {
  await reconcile({ latitude: 0, longitude: 0 });
  expect(Location.startGeofencingAsync).toHaveBeenCalledWith(
    expect.any(String),
    [expect.objectContaining({ identifier: pid, radius: 300 })],
  );
  (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
    granted: false,
  });
  await reconcile({ latitude: 0, longitude: 0 });
  expect(mockState?.enabled).toBe(false);
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
});

test('sign-out clears coordinates and debug but retains the account-bound outbox; deletion purges it', async () => {
  await stopReminders(uid, 'signout');
  expect(mockState?.places).toEqual([]);
  expect(store.clearDebug).toHaveBeenCalled();
  expect(store.purge).not.toHaveBeenCalled();
  await stopReminders(uid, 'delete');
  expect(store.purge).toHaveBeenCalledWith(uid);
});
test('old account cleanup cannot stop a newly active account', async () => {
  mockState!.owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await stopReminders(uid, 'signout');
  expect(Location.stopGeofencingAsync).not.toHaveBeenCalled();
  expect(mockState?.enabled).toBe(true);
});
test('notification permission revoked after registration never produces a false sent row', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
    granted: false,
  });
  await geofenceEvent(pid, true);
  expect(mockRows).toEqual([]);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('deleting the final place unregisters its native region even without a recent position', async () => {
  await removeLocalPlace(uid, pid);
  expect(mockState?.regions).toEqual([]);
  expect(mockState?.places).toEqual([]);
  expect(Location.stopGeofencingAsync).toHaveBeenCalled();
});

test('snooze persists one future reminder before scheduling and repeated response does not duplicate', async () => {
  const parent: Reminder = {
    id: '33333333-3333-4333-8333-333333333333',
    owner: uid,
    placeId: pid,
    sentAt: new Date(Date.now() - 1000).toISOString(),
    action: 'snooze',
    actionAt: new Date().toISOString(),
    dirty: true,
    delivered: true,
  };
  mockRows = [parent];
  await scheduleSnooze(parent);
  await scheduleSnooze(parent);
  expect(mockRows).toHaveLength(2);
  const child = mockRows.find((r) => r.parentId === parent.id)!;
  expect(Date.parse(child.sentAt) - Date.parse(parent.actionAt!)).toBe(
    86400000,
  );
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: child.id,
      trigger: expect.objectContaining({ date: new Date(child.sentAt) }),
    }),
  );
  expect(
    (store.putReminder as jest.Mock).mock.invocationCallOrder[0],
  ).toBeLessThan(
    (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .invocationCallOrder[0]!,
  );
  await stopReminders(uid);
  expect(mockRows.find((r) => r.id === child.id)?.canceled).toBe(true);
});
test('failed snooze scheduling recovers the same child ID', async () => {
  const parent: Reminder = {
    id: '33333333-3333-4333-8333-333333333333',
    owner: uid,
    placeId: pid,
    sentAt: new Date(Date.now() - 1000).toISOString(),
    action: 'snooze',
    actionAt: new Date().toISOString(),
    dirty: true,
    delivered: true,
  };
  mockRows = [parent];
  (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
    new Error('native'),
  );
  await expect(scheduleSnooze(parent)).rejects.toThrow();
  const id = mockRows.find((r) => r.parentId === parent.id)?.id;
  await scheduleSnooze(parent);
  expect(mockRows.find((r) => r.parentId === parent.id)?.id).toBe(id);
  expect(mockRows).toHaveLength(2);
});
