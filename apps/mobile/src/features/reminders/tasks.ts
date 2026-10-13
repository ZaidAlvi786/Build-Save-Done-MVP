import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  GEOFENCE_TASK,
  MOVEMENT_TASK,
  RESPONSE_TASK,
  geofenceEvent,
  reconcile,
  handleResponse,
} from './native';
import { debug } from './store';
const recordError = async () => {
  try {
    await debug('Native task failed; open Reminders to retry');
  } catch {
    /* No logging of sensitive data. */
  }
};
TaskManager.defineTask<{
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}>(GEOFENCE_TASK, async ({ data, error }) => {
  try {
    if (error) throw error;
    if (data?.region.identifier)
      await geofenceEvent(
        data.region.identifier,
        data.eventType === Location.GeofencingEventType.Enter,
      );
  } catch {
    await recordError();
  }
});
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  MOVEMENT_TASK,
  async ({ data, error }) => {
    try {
      if (error) throw error;
      const last = data?.locations.at(-1);
      if (last) await reconcile(last.coords);
    } catch {
      await recordError();
    }
  },
);
TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  RESPONSE_TASK,
  async ({ data, error }) => {
    try {
      if (error) throw error;
      if (data && 'actionIdentifier' in data) await handleResponse(data);
    } catch {
      await recordError();
    }
  },
);
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
