import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { requireUser } from '../../lib/supabase';
import { SavedPlace } from '../places/model';
import { digestPlaceIds } from './selection';
import { configureNotifications } from '../reminders/native';
let installationPromise: Promise<string> | null = null;
export function installationId() {
  if (!installationPromise)
    installationPromise = (async () => {
      const key = 'saved-done-installation';
      const old = await SecureStore.getItemAsync(key);
      if (old) return old;
      const id = Crypto.randomUUID();
      await SecureStore.setItemAsync(key, id);
      return id;
    })();
  return installationPromise;
}
export async function retentionPreferences(uid: string) {
  const client = await requireUser(uid);
  const { data, error } = await client
    .from('users')
    .select(
      'analytics_opt_in,diagnostics_opt_in,digest_enabled,push_installation_id',
    )
    .eq('id', uid)
    .single();
  if (error || !data) throw new Error('Preferences unavailable');
  return {
    analytics: data.analytics_opt_in === true,
    diagnostics: data.diagnostics_opt_in === true,
    digest:
      data.digest_enabled === true &&
      data.push_installation_id === (await installationId()),
  };
}
export async function disableDigest(uid: string) {
  const client = await requireUser(uid);
  const { error } = await client.rpc('set_digest_preferences', {
    p_enabled: false,
    p_installation_id: await installationId(),
    p_token: null,
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  if (error) throw new Error('Could not stop digest delivery');
}
export async function refreshDigest(
  uid: string,
  places: SavedPlace[],
  explicit = false,
) {
  if (AppState.currentState !== 'active') {
    if (explicit) throw new Error('Open the app to enable the digest.');
    return;
  }
  const id = await installationId();
  if (!explicit && !(await retentionPreferences(uid)).digest) return;
  const notifications = explicit
    ? await Notifications.requestPermissionsAsync()
    : await Notifications.getPermissionsAsync();
  const location = explicit
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (!notifications.granted || !location.granted) {
    if (explicit)
      throw new Error(
        'Allow notifications and foreground location to enable the digest.',
      );
    await disableDigest(uid);
    return;
  }
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId)
    throw new Error(
      'Weekly push needs the configured EAS project and push credentials.',
    );
  await configureNotifications();
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const point = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  if (AppState.currentState !== 'active') return;
  const client = await requireUser(uid);
  // Only an explicit enable can take ownership from another installation.
  if (!explicit && !(await retentionPreferences(uid)).digest) return;
  const preferences = explicit
    ? await client.rpc('set_digest_preferences', {
        p_enabled: true,
        p_installation_id: id,
        p_token: token,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
    : await client.rpc('refresh_digest_token', {
        p_installation_id: id,
        p_token: token,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
  if (preferences.error) throw new Error('Digest preferences unavailable');
  if (!explicit && preferences.data !== true) return;
  const result = await client.rpc('publish_digest_nearby', {
    p_installation_id: id,
    p_ids: digestPlaceIds(places, point.coords),
  });
  if (result.error) throw new Error('Nearby selection could not refresh');
}
