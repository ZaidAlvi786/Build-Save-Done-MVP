import { useState } from 'react';
import { requireUser } from '../../lib/supabase';
import { purgeAccountCaptures } from '../capture/local-store';
import { stopReminders } from '../reminders/native';
import { purgeAnalytics } from '../analytics/client';
import { disableDigest } from '../retention/native';
export function useDeleteAccount(uid: string | null) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return {
    busy,
    error,
    async remove(confirmation: string) {
      if (!uid || confirmation !== 'DELETE' || busy) return false;
      setBusy(true);
      setError(null);
      try {
        const client = await requireUser(uid);
        await disableDigest(uid);
        await purgeAnalytics(uid, true);
        await stopReminders(uid, 'delete');
        await purgeAccountCaptures(uid);
        const { data, error } = await client.functions.invoke(
          'delete-account',
          { body: { confirmation } },
        );
        if (error || data?.deleted !== true)
          throw new Error('Deletion incomplete');
        await client.auth.signOut({ scope: 'local' });
        return true;
      } catch {
        setError(
          'Deletion could not finish. Retry to remove the remaining data.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
}
