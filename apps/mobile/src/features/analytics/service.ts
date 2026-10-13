import { FunnelEvent } from '../../../../../shared/events';
export interface EventQueue {
  list(uid: string): Promise<FunnelEvent[]>;
  remove(ids: string[]): Promise<void>;
}
export async function flushEventQueue(
  uid: string,
  queue: EventQueue,
  send: (
    events: FunnelEvent[],
  ) => Promise<{ accepted: string[]; discarded: string[] }>,
  now = Date.now(),
) {
  const rows = await queue.list(uid),
    expired = rows.filter((e) => Date.parse(e.timestamp) < now - 30 * 86400000);
  if (expired.length) await queue.remove(expired.map((e) => e.id));
  const batch = rows
    .filter((e) => Date.parse(e.timestamp) >= now - 30 * 86400000)
    .slice(0, 20);
  if (!batch.length) return;
  const result = await send(batch),
    sent = new Set(batch.map((e) => e.id));
  if ([...result.accepted, ...result.discarded].some((id) => !sent.has(id)))
    throw new Error('Invalid acknowledgement');
  await queue.remove([...result.accepted, ...result.discarded]);
}
