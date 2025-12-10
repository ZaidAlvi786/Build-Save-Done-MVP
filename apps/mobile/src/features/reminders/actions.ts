import { z } from 'zod';
export const reminderSchema = z.object({
  id: z.string().uuid(),
  owner: z.string().uuid(),
  placeId: z.string().uuid(),
  sentAt: z.string().datetime(),
  action: z.enum(['ignored', 'navigate', 'snooze', 'been_there']),
  actionAt: z.string().datetime().nullable(),
  dirty: z.boolean(),
  delivered: z.boolean(),
  source: z.enum(['geofence', 'snooze']).optional(),
  parentId: z.string().uuid().optional(),
  canceled: z.boolean().optional(),
});
export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderAction = Exclude<Reminder['action'], 'ignored'>;
export function snoozePlan(parent: Reminder, id: string): Reminder {
  if (parent.action !== 'snooze' || !parent.actionAt)
    throw new Error('Snooze requires an action');
  return reminderSchema.parse({
    id,
    owner: parent.owner,
    placeId: parent.placeId,
    sentAt: new Date(Date.parse(parent.actionAt) + 24 * 3600000).toISOString(),
    action: 'ignored',
    actionAt: null,
    dirty: true,
    delivered: false,
    source: 'snooze',
    parentId: parent.id,
  });
}
export function applyAction(
  row: Reminder,
  action: ReminderAction,
  now: Date,
): Reminder {
  if (row.action !== 'ignored') return row;
  if (now.getTime() < Date.parse(row.sentAt))
    throw new Error('Invalid action time');
  return { ...row, action, actionAt: now.toISOString(), dirty: true };
}
export interface ReminderSyncPort {
  write(row: Reminder): Promise<void>;
  acknowledge(id: string, action: Reminder['action']): Promise<void>;
}
export async function syncReminderRows(
  rows: Reminder[],
  uid: string,
  port: ReminderSyncPort,
  now = Date.now(),
) {
  let failures = 0;
  for (const row of rows.filter(
    (r) =>
      r.owner === uid &&
      r.dirty &&
      r.delivered &&
      !r.canceled &&
      Date.parse(r.sentAt) <= now,
  )) {
    try {
      await port.write(row);
      await port.acknowledge(row.id, row.action);
    } catch {
      failures++;
    }
  }
  return failures;
}
