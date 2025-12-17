import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { useAuth } from '../features/auth/useAuth';
import { AuthScreen } from '../features/auth/AuthScreen';
import { AccountScreen } from '../features/auth/AccountScreen';
import { useCapture } from '../features/capture/useCapture';
import { CaptureScreen } from '../features/capture/CaptureScreen';
import { Capture } from '../features/capture/types';
import { ConfirmScreen } from '../features/places/ConfirmScreen';
import { recentPlaces, SavedPlace } from '../features/places/remote';
import { Button, Notice, styles } from '../lib/ui';
import { useSavedActions } from '../features/places/useSavedActions';
import { ReminderScreen } from '../features/reminders/ReminderScreen';
import { useReminderLifecycle } from '../features/reminders/useReminderLifecycle';
import { requireUser } from '../lib/supabase';
import { getState } from '../features/reminders/store';
import { stopReminders } from '../features/reminders/native';
import { useRetention } from '../features/retention/useRetention';
function SignedIn({
  uid,
  capture,
  signOut,
  authError,
}: {
  uid: string;
  capture: ReturnType<typeof useCapture>;
  signOut: () => Promise<void>;
  authError: string | null;
}) {
  const [active, setActive] = useState<Capture | null>(null),
    [account, setAccount] = useState(false),
    [reminders, setReminders] = useState(false),
    [radius, setRadius] = useState(300),
    [places, setPlaces] = useState<SavedPlace[]>([]),
    [placesReady, setPlacesReady] = useState(false),
    [error, setError] = useState<string | null>(null);
  const loadPlaces = useCallback(async () => {
    try {
      setPlaces(await recentPlaces(uid));
      setPlacesReady(true);
      setError(null);
    } catch {
      setError(
        'Saved places could not refresh. Your captures remain on this phone.',
      );
    }
  }, [uid]);
  const retention = useRetention(uid, places, placesReady);
  const actions = useSavedActions(uid, loadPlaces);
  useReminderLifecycle(uid, places, radius, placesReady, loadPlaces);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadPlaces();
    });
    return () => listener.remove();
  }, [loadPlaces]);
  useEffect(() => {
    let disposed = false;
    void requireUser(uid)
      .then((client) =>
        client.from('users').select('reminder_radius_m').eq('id', uid).single(),
      )
      .then((result) => {
        if (!disposed && result.data) setRadius(result.data.reminder_radius_m);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [uid]);
  useEffect(() => {
    let disposed = false;
    void recentPlaces(uid)
      .then((rows) => {
        if (!disposed) {
          setPlaces(rows);
          setPlacesReady(true);
        }
      })
      .catch(async () => {
        try {
          const cached = await getState();
          if (!disposed && cached?.owner === uid) {
            setPlaces(cached.places);
            setRadius(cached.radius);
            setPlacesReady(true);
          }
        } catch {
          /* Captures stay available without a reminder cache. */
        }
        if (!disposed)
          setError(
            'Saved places could not refresh. Your captures remain on this phone.',
          );
      });
    return () => {
      disposed = true;
    };
  }, [uid]);
  async function open(item: Capture) {
    try {
      const owned = await capture.bind(item);
      if (owned) setActive(owned);
    } catch {
      setError('Could not open this save. Please retry.');
    }
  }
  async function saved() {
    if (!active) return;
    await capture.acknowledged(active);
    setActive(null);
    await loadPlaces();
  }
  if (account)
    return (
      <AccountScreen
        uid={uid}
        retention={retention}
        onBack={() => setAccount(false)}
        onSignOut={signOut}
      />
    );
  if (reminders)
    return (
      <ReminderScreen
        uid={uid}
        places={places}
        radius={radius}
        onRadius={setRadius}
        onBack={() => setReminders(false)}
      />
    );
  if (active)
    return (
      <ConfirmScreen
        key={active.id}
        item={active}
        uid={uid}
        onBack={() => setActive(null)}
        onSaved={saved}
      />
    );
  return (
    <CaptureScreen
      items={capture.items}
      places={places}
      uid={uid}
      near={actions.near}
      onNearMe={() => void actions.nearMe()}
      onNavigate={(place) => void actions.navigate(place)}
      onVisit={(place) => void actions.visit(place)}
      onDelete={actions.remove}
      onRefreshPlace={(place) => void actions.refresh(place)}
      onReminders={() => setReminders(true)}
      busy={capture.busy || capture.importing || actions.busy}
      error={capture.error ?? actions.error ?? error ?? authError}
      onGallery={() => void capture.gallery()}
      onManual={() => {
        void capture.manual().then((item) => {
          if (item) void open(item);
        });
      }}
      onOpen={(item) => void open(item)}
      onRetry={(item) => void capture.retry(item)}
      onRefresh={() => {
        void capture.refresh();
        void loadPlaces();
      }}
      onSettings={() => setAccount(true)}
      onRetryShare={capture.retryShare}
    />
  );
}
export function Root() {
  const auth = useAuth(),
    uid = auth.session?.user.id ?? null,
    capture = useCapture(uid);
  useEffect(() => {
    if (auth.ready && !uid)
      void stopReminders(undefined, 'signout').catch(() => undefined);
  }, [auth.ready, uid]);
  if (!auth.ready)
    return (
      <View style={styles.content}>
        <ActivityIndicator accessibilityLabel="Restoring sign-in" />
      </View>
    );
  if (!uid)
    return (
      <>
        <AuthScreen auth={auth} pendingCount={capture.items.length} />
        {capture.error && (
          <>
            <Notice>{capture.error}</Notice>
            <Button
              label="Retry share"
              secondary
              onPress={capture.retryShare}
            />
          </>
        )}
      </>
    );
  // Account-specific screens and results are discarded on sign-out/account change.
  return (
    <SignedIn
      key={uid}
      uid={uid}
      capture={capture}
      signOut={auth.signOut}
      authError={auth.error}
    />
  );
}
