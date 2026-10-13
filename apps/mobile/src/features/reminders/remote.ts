import { requireUser } from '../../lib/supabase';
import { Reminder, syncReminderRows } from './actions';
import { rows, acknowledge } from './store';
import { track } from '../analytics/client';
export async function flushReminders(uid: string) {
  const client = await requireUser(uid);
  return syncReminderRows(await rows(uid), uid, {
    async write(row: Reminder) {
      const { error } = await client.rpc('record_reminder', {
        p_id: row.id,
        p_place_id: row.placeId,
        p_sent_at: row.sentAt,
        p_action: row.action,
        p_action_at: row.actionAt,
      });
      if (error) throw new Error('Action remains on this phone');
      await track(
        uid,
        'reminder_sent',
        { reminder_id: row.id, source: row.source ?? 'geofence' },
        row.id,
      );
      if (row.action !== 'ignored')
        await track(
          uid,
          'reminder_action',
          {
            reminder_id: row.id,
            action: row.action,
            source: row.source ?? 'geofence',
          },
          row.id,
        );
    },
    acknowledge,
  });
}
