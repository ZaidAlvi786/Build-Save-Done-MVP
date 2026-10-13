import { openDatabaseAsync } from 'expo-sqlite';
import { z } from 'zod';
import { SavedPlace, savedPlaceSchema } from '../places/model';
import {
  Reminder,
  ReminderAction,
  applyAction,
  reminderSchema,
} from './actions';
const stateSchema = z.object({
  owner: z.string().uuid(),
  enabled: z.boolean(),
  radius: z.number().int().min(100).max(2000),
  places: z.array(savedPlaceSchema),
  regions: z.array(
    z.object({
      identifier: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number(),
      notifyOnEnter: z.boolean(),
      notifyOnExit: z.boolean(),
    }),
  ),
});
export type ReminderState = z.infer<typeof stateSchema>;
let connection: ReturnType<typeof openDatabaseAsync> | null = null;
async function db() {
  if (!connection) connection = openDatabaseAsync('reminders.db');
  const value = await connection;
  await value.execAsync(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,owner TEXT NOT NULL,place_id TEXT NOT NULL,sent_at TEXT NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS debug(id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,message TEXT NOT NULL);',
  );
  return value;
}
let lock = Promise.resolve();
export function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const task = lock.then(work);
  lock = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
export async function getState(): Promise<ReminderState | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ payload: string }>('SELECT payload FROM state WHERE id=1');
  return row ? stateSchema.parse(JSON.parse(row.payload)) : null;
}
export async function putState(state: ReminderState) {
  await (
    await db()
  ).runAsync(
    'INSERT INTO state(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
    JSON.stringify(stateSchema.parse(state)),
  );
}
export async function initialize(
  owner: string,
  places: SavedPlace[],
  radius: number,
) {
  return exclusive(async () => {
    const old = await getState();
    if (old?.owner !== owner) await clearDebug();
    const awaitedVisits = new Set(
      (await rows(owner))
        .filter((r) => r.action === 'been_there')
        .map((r) => r.placeId),
    );
    const state: ReminderState = {
      owner,
      enabled: old?.owner === owner && old.enabled,
      radius,
      places: places.map((p) =>
        awaitedVisits.has(p.id) ? { ...p, status: 'visited' as const } : p,
      ),
      regions: old?.owner === owner ? old.regions : [],
    };
    await putState(state);
    return state;
  });
}
export async function rows(owner: string) {
  return (
    await (
      await db()
    ).getAllAsync<{ payload: string }>(
      'SELECT payload FROM events WHERE owner=? ORDER BY sent_at DESC',
      owner,
    )
  ).map((row) => reminderSchema.parse(JSON.parse(row.payload)));
}
export async function putReminder(row: Reminder) {
  await (
    await db()
  ).runAsync(
    'INSERT INTO events(id,owner,place_id,sent_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sent_at=excluded.sent_at,payload=excluded.payload',
    row.id,
    row.owner,
    row.placeId,
    row.sentAt,
    JSON.stringify(reminderSchema.parse(row)),
  );
}
export async function action(id: string, uid: string, value: ReminderAction) {
  return exclusive(async () => {
    const row = (await rows(uid)).find((r) => r.id === id);
    if (!row || !row.delivered || row.canceled)
      throw new Error('Reminder unavailable');
    const next = applyAction(row, value, new Date());
    await putReminder(next);
    if (next.action === 'been_there') {
      const state = await getState();
      if (state?.owner === uid)
        await putState({
          ...state,
          places: state.places.map((p) =>
            p.id === row.placeId ? { ...p, status: 'visited' } : p,
          ),
        });
    }
    return { row: next, changed: next !== row };
  });
}
export async function acknowledge(id: string, value: Reminder['action']) {
  return exclusive(async () => {
    const record = await (
      await db()
    ).getFirstAsync<{ payload: string }>(
      'SELECT payload FROM events WHERE id=?',
      id,
    );
    if (!record) return;
    const row = reminderSchema.parse(JSON.parse(record.payload));
    if (row.action === value) await putReminder({ ...row, dirty: false });
  });
}
export async function debug(message: string) {
  const value = await db();
  await value.runAsync(
    'INSERT INTO debug(at,message) VALUES(?,?)',
    new Date().toISOString(),
    message.slice(0, 300),
  );
  await value.execAsync(
    'DELETE FROM debug WHERE id NOT IN (SELECT id FROM debug ORDER BY id DESC LIMIT 50)',
  );
}
export async function debugRows() {
  return (await db()).getAllAsync<{ at: string; message: string }>(
    'SELECT at,message FROM debug ORDER BY id DESC LIMIT 50',
  );
}
export async function clearDebug() {
  await (await db()).execAsync('DELETE FROM debug');
}
export async function purge(owner: string) {
  await exclusive(async () => {
    const value = await db();
    const state = await getState();
    if (state?.owner === owner)
      await value.execAsync('DELETE FROM state; DELETE FROM debug;');
    await value.runAsync('DELETE FROM events WHERE owner=?', owner);
  });
}
export async function purgeExpired() {
  return exclusive(async () => {
    const state = await getState();
    if (!state) return;
    const now = Date.now();
    const expired = state.places.some(
      (p) =>
        p.lat !== null &&
        p.coordinates_expire_at &&
        Date.parse(p.coordinates_expire_at) <= now,
    );
    await putState({
      ...state,
      places: state.places.map((p) =>
        p.coordinates_expire_at && Date.parse(p.coordinates_expire_at) <= now
          ? { ...p, lat: null, lng: null }
          : p,
      ),
      regions: state.regions.filter((r) =>
        state.places.some(
          (p) =>
            p.id === r.identifier &&
            p.coordinates_expire_at &&
            Date.parse(p.coordinates_expire_at) > now,
        ),
      ),
    });
    return expired;
  });
}
