import { reportIssue } from '../../lib/diagnostics';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SavedPlace } from '../places/model';
import {
  configureNotifications,
  handleResponse,
  resumeReminders,
  stopReminders,
} from './native';
import { debug } from './store';
export function useReminderLifecycle(
  uid: string,
  places: SavedPlace[],
  radius: number,
  ready: boolean,
  onAction: () => Promise<void>,
) {
  useEffect(() => {
    let disposed = false;
    const failure = () => {
      void reportIssue(uid, 'reminder');
      return debug(
        'Reminder setup/action failed; open Reminders to retry',
      ).catch(() => undefined);
    };
    const refresh = () => {
      if (!disposed && ready)
        void resumeReminders(uid, places, radius).catch(failure);
    };
    void configureNotifications()
      .then(async () => {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && !disposed) {
          await handleResponse(response);
          await onAction();
        }
      })
      .catch(failure);
    const timer = setTimeout(refresh, 0),
      app = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      }),
      response = Notifications.addNotificationResponseReceivedListener(
        (result) => {
          if (!disposed)
            void handleResponse(result).then(onAction).catch(failure);
        },
      );
    return () => {
      disposed = true;
      clearTimeout(timer);
      app.remove();
      response.remove();
    };
  }, [uid, places, radius, ready, onAction]);
  useEffect(
    () => () => {
      void stopReminders(uid, 'signout').catch(() => undefined);
    },
    [uid],
  );
}
