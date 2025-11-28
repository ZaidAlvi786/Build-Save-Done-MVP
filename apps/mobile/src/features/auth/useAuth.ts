import { reportIssue } from '../../lib/diagnostics';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { disableDigest } from '../retention/native';
import { purgeAnalytics } from '../analytics/client';
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(!supabase),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [sentTo, setSentTo] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) {
      return;
    }
    let mounted = true;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (mounted) {
          setSession(data.session);
          setReady(true);
          if (error)
            setError('Sign-in could not be restored. Please try again.');
        }
      })
      .catch(() => {
        if (mounted) {
          setReady(true);
          setError('Sign-in is unavailable. Your saves stay on this phone.');
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });
    const change = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      change.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, []);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch {
      void reportIssue(session?.user.id ?? null, 'auth');
      setError('Sign-in is unavailable. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return {
    session,
    ready,
    busy,
    error,
    sentTo,
    configured: !!supabase,
    send(email: string) {
      return run(async () => {
        const address = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
          throw new Error('Invalid email');
        if (!supabase) throw new Error('Unavailable');
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setSentTo(address);
      });
    },
    verify(code: string) {
      return run(async () => {
        if (!supabase || !sentTo || !/^\d{6,8}$/.test(code.trim()))
          throw new Error('Invalid code');
        const { data, error } = await supabase.auth.verifyOtp({
          email: sentTo,
          token: code.trim(),
          type: 'email',
        });
        if (error || !data.session) throw new Error('Invalid code');
        setSession(data.session);
        setSentTo(null);
      });
    },
    signOut() {
      return run(async () => {
        if (!supabase) return;
        if (session) {
          await disableDigest(session.user.id);
          await purgeAnalytics(session.user.id);
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
      });
    },
  };
}
