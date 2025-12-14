import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requireUser } from '../../lib/supabase';
import { SavedPlace } from '../places/model';
import {
  flushAnalytics,
  setLocalConsent,
  setLocalDiagnostics,
  track,
} from '../analytics/client';
import { disableDigest, refreshDigest, retentionPreferences } from './native';
export function useRetention(
  uid: string,
  places: SavedPlace[],
  ready: boolean,
) {
  const [analytics, setAnalytics] = useState(false),
    [diagnostics, setDiagnostics] = useState(false),
    [digest, setDigest] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const opened = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(
    async (open = false) => {
      const ticket = generation.current;
      try {
        const prefs = await retentionPreferences(uid);
        if (ticket !== generation.current) return;
        await setLocalConsent(uid, prefs.analytics);
        await setLocalDiagnostics(uid, prefs.diagnostics);
        if (ticket !== generation.current) return;
        setAnalytics(prefs.analytics);
        setDiagnostics(prefs.diagnostics);
        setDigest(prefs.digest);
        setLoaded(true);
        setError(null);
        if (open) await track(uid, 'app_opened');
        void flushAnalytics(uid).catch(() => undefined);
        if (ready && prefs.digest) await refreshDigest(uid, places);
      } catch {
        if (ticket === generation.current)
          setError('Preferences could not refresh. Retry when connected.');
      }
    },
    [uid, places, ready],
  );
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (alive) {
        const first = !opened.current;
        opened.current = true;
        void refresh(first);
      }
    }, 0);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(true);
    });
    const rotation = Notifications.addPushTokenListener(() => {
      if (AppState.currentState === 'active') void refresh();
    });
    const flushTimer = setInterval(() => {
      if (AppState.currentState === 'active')
        void flushAnalytics(uid).catch(() => undefined);
    }, 30000);
    return () => {
      alive = false;
      clearTimeout(timer);
      listener.remove();
      rotation.remove();
      clearInterval(flushTimer);
    };
  }, [refresh, uid]);
  async function change(work: () => Promise<void>) {
    generation.current++;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Preferences could not update.',
      );
    } finally {
      setBusy(false);
    }
  }
  return {
    analytics,
    diagnostics,
    toggleDiagnostics() {
      return change(async () => {
        const next = !diagnostics;
        if (!next) await setLocalDiagnostics(uid, false);
        const client = await requireUser(uid);
        const { error } = await client.rpc('set_diagnostics_consent', {
          p_enabled: next,
        });
        if (error)
          throw new Error(
            'Diagnostics consent could not sync. Retry this preference.',
          );
        await setLocalDiagnostics(uid, next);
        setDiagnostics(next);
      });
    },
    digest,
    loaded,
    retry: () => refresh(),
    busy,
    error,
    toggleAnalytics() {
      return change(async () => {
        const next = !analytics;
        if (!next) {
          await setLocalConsent(uid, false);
        }
        const client = await requireUser(uid);
        const { error } = await client.rpc('set_analytics_consent', {
          p_enabled: next,
        });
        if (error)
          throw new Error('Consent could not sync. Retry this preference.');
        await setLocalConsent(uid, next);
        setAnalytics(next);
        if (next) {
          await track(uid, 'app_opened');
          void flushAnalytics(uid).catch(() => undefined);
        }
      });
    },
    toggleDigest() {
      return change(async () => {
        if (digest) {
          await disableDigest(uid);
          setDigest(false);
        } else {
          await refreshDigest(uid, places, true);
          setDigest(true);
        }
      });
    },
  };
}
