import { openDatabaseAsync } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { requireUser } from '../../lib/supabase';
import {
  EventName,
  EventProperties,
  eventSchema,
} from '../../../../../shared/events';
import { flushEventQueue } from './service';
let connection: ReturnType<typeof openDatabaseAsync> | null = null;
async function db() {
  if (!connection) connection = openDatabaseAsync('analytics.db');
  const value = await connection;
  await value.execAsync(
    'CREATE TABLE IF NOT EXISTS consent(owner TEXT PRIMARY KEY,enabled INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,owner TEXT NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS deleted_accounts(owner TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS diagnostics_consent(owner TEXT PRIMARY KEY,enabled INTEGER NOT NULL);',
  );
  return value;
}
let lock = Promise.resolve();
function exclusive<T>(work: () => Promise<T>) {
  const task = lock.then(work);
  lock = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
export async function enabled(uid: string) {
  return (
    (
      await (
        await db()
      ).getFirstAsync<{ enabled: number }>(
        'SELECT enabled FROM consent WHERE owner=?',
        uid,
      )
    )?.enabled === 1
  );
}
export async function diagnosticsEnabled(uid: string) {
  return (
    (
      await (
        await db()
      ).getFirstAsync<{ enabled: number }>(
        'SELECT enabled FROM diagnostics_consent WHERE owner=?',
        uid,
      )
    )?.enabled === 1
  );
}
export async function setLocalDiagnostics(uid: string, value: boolean) {
  await exclusive(async () => {
    const valueDb = await db();
    if (
      value &&
      (await valueDb.getFirstAsync(
        'SELECT owner FROM deleted_accounts WHERE owner=?',
        uid,
      ))
    )
      return;
    await valueDb.runAsync(
      'INSERT INTO diagnostics_consent(owner,enabled) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET enabled=excluded.enabled',
      uid,
      value ? 1 : 0,
    );
  });
}
export async function setLocalConsent(uid: string, value: boolean) {
  await exclusive(async () => {
    const valueDb = await db();
    if (
      value &&
      (await valueDb.getFirstAsync(
        'SELECT owner FROM deleted_accounts WHERE owner=?',
        uid,
      ))
    )
      return;
    await valueDb.runAsync(
      'INSERT INTO consent(owner,enabled) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET enabled=excluded.enabled',
      uid,
      value ? 1 : 0,
    );
    if (!value) await valueDb.runAsync('DELETE FROM events WHERE owner=?', uid);
  });
}
export async function track(
  uid: string | null,
  event: EventName,
  properties: EventProperties = {},
  semanticKey?: string,
) {
  if (!uid) return;
  try {
    await exclusive(async () => {
      if (!(await enabled(uid))) return;
      const hash = semanticKey
        ? await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${uid}:${event}:${semanticKey}`,
          )
        : null;
      const id = hash
        ? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
        : Crypto.randomUUID();
      const record = eventSchema.parse({
        id,
        event,
        timestamp: new Date().toISOString(),
        properties,
      });
      const value = await db();
      await value.runAsync(
        'INSERT OR IGNORE INTO events(id,owner,payload) VALUES(?,?,?)',
        id,
        uid,
        JSON.stringify(record),
      );
      await value.runAsync(
        'DELETE FROM events WHERE owner=? AND id NOT IN (SELECT id FROM events WHERE owner=? ORDER BY rowid DESC LIMIT 1000)',
        uid,
        uid,
      );
    });
  } catch {
    /* Analytics never blocks the saved-place flow. */
  }
}
const uploads = new Map<string, Promise<void>>();
export function flushAnalytics(uid: string) {
  const pending = uploads.get(uid);
  if (pending) return pending;
  const task = upload(uid).finally(() => uploads.delete(uid));
  uploads.set(uid, task);
  return task;
}
async function upload(uid: string) {
  if (!(await enabled(uid))) return;
  const client = await requireUser(uid);
  await flushEventQueue(
    uid,
    {
      async list(owner) {
        return exclusive(async () =>
          (
            await (
              await db()
            ).getAllAsync<{ payload: string }>(
              'SELECT payload FROM events WHERE owner=? ORDER BY rowid LIMIT 1000',
              owner,
            )
          ).map((row) => eventSchema.parse(JSON.parse(row.payload))),
        );
      },
      async remove(ids) {
        await exclusive(async () => {
          for (const id of ids)
            await (
              await db()
            ).runAsync('DELETE FROM events WHERE id=? AND owner=?', id, uid);
        });
      },
    },
    async (events) => {
      if (!(await enabled(uid)))
        return { accepted: [], discarded: events.map((e) => e.id) };
      await requireUser(uid);
      const { data, error } = await client.functions.invoke('track-events', {
        body: { events },
      });
      if (error) throw new Error('Analytics queued');
      return z
        .object({
          accepted: z.array(z.string().uuid()),
          discarded: z.array(z.string().uuid()),
        })
        .parse(data);
    },
  );
}
export async function purgeAnalytics(uid: string, permanent = false) {
  if (permanent)
    await exclusive(async () => {
      await (
        await db()
      ).runAsync(
        'INSERT OR IGNORE INTO deleted_accounts(owner) VALUES(?)',
        uid,
      );
    });
  await setLocalConsent(uid, false);
  await setLocalDiagnostics(uid, false);
}
