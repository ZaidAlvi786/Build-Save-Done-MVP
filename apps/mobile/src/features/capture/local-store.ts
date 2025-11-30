import * as FS from 'expo-file-system/legacy';
import { openDatabaseAsync } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Capture, Incoming, CaptureStore, captureSchema } from './types';
const root = () => {
  if (!FS.documentDirectory) throw new Error('Storage unavailable');
  return `${FS.documentDirectory}captures/`;
};
let database: ReturnType<typeof openDatabaseAsync> | null = null;
async function db() {
  if (!database) database = openDatabaseAsync('saved-done.db');
  const value = await database;
  await value.execAsync(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY, source_key TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);',
  );
  return value;
}
async function index(item: Capture) {
  await (
    await db()
  ).runAsync(
    'INSERT INTO captures(id,source_key,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
    item.id,
    item.sourceKey,
    JSON.stringify(item),
  );
}
const deletionMarker = (uid: string) =>
  `${FS.documentDirectory}account-deletions/${uid}.json`;
async function blocked(uid: string | null) {
  return uid ? (await FS.getInfoAsync(deletionMarker(uid))).exists : false;
}
async function write(item: Capture) {
  if (await blocked(item.ownerId))
    throw new Error('Account deletion requested');
  const directory = `${root()}${item.id}/`;
  await FS.makeDirectoryAsync(directory, { intermediates: true });
  const temp = `${directory}manifest.next`;
  await FS.writeAsStringAsync(temp, JSON.stringify(item));
  await FS.moveAsync({ from: temp, to: `${directory}manifest.json` });
  await index(item);
}
let lock = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const task = lock.then(work);
  lock = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
async function recover() {
  await FS.makeDirectoryAsync(root(), { intermediates: true });
  for (const folder of await FS.readDirectoryAsync(root())) {
    const directory = `${root()}${folder}/`;
    let item: Capture | null = null;
    for (const filename of ['manifest.next', 'manifest.json']) {
      const path = `${directory}${filename}`;
      if (!(await FS.getInfoAsync(path)).exists) continue;
      try {
        item = captureSchema.parse(
          JSON.parse(await FS.readAsStringAsync(path)),
        );
        break;
      } catch {
        continue;
      }
    }
    if (!item) throw new Error('Capture journal needs recovery');
    if (await blocked(item.ownerId)) {
      await FS.deleteAsync(directory, { idempotent: true });
      await (await db()).runAsync('DELETE FROM captures WHERE id=?', item.id);
      continue;
    }
    await index(item);
    if ((await FS.getInfoAsync(`${directory}manifest.next`)).exists) {
      await FS.writeAsStringAsync(
        `${directory}manifest.next`,
        JSON.stringify(item),
      );
      await FS.moveAsync({
        from: `${directory}manifest.next`,
        to: `${directory}manifest.json`,
      });
    }
  }
}
export const captureStore: CaptureStore = {
  list() {
    return serialize(async () => {
      await recover();
      const rows = await (
        await db()
      ).getAllAsync<{ payload: string }>(
        'SELECT payload FROM captures ORDER BY rowid',
      );
      const parsed = rows.map((r) =>
        captureSchema.parse(JSON.parse(r.payload)),
      );
      const kept: Capture[] = [];
      for (const item of parsed) {
        if (await blocked(item.ownerId)) {
          await FS.deleteAsync(`${root()}${item.id}/`, { idempotent: true });
          await (
            await db()
          ).runAsync('DELETE FROM captures WHERE id=?', item.id);
        } else kept.push(item);
      }
      return kept;
    });
  },
  put(item) {
    return serialize(() => write(item));
  },
  remove(item) {
    return serialize(async () => {
      await FS.deleteAsync(`${root()}${item.id}/`, { idempotent: true });
      await (await db()).runAsync('DELETE FROM captures WHERE id=?', item.id);
    });
  },
  ingest(input: Incoming) {
    return serialize(async () => {
      await recover();
      const sourceKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify(input),
      );
      const previous = await (
        await db()
      ).getFirstAsync<{ payload: string }>(
        'SELECT payload FROM captures WHERE source_key=?',
        sourceKey,
      );
      let item: Capture;
      if (previous) item = captureSchema.parse(JSON.parse(previous.payload));
      else {
        const id = Crypto.randomUUID();
        item = {
          version: 1,
          id,
          ownerId: null,
          sourceKey,
          originalUri: input.uri,
          fileUri: input.uri ? `${root()}${id}/image` : null,
          mime: input.mime,
          sourceText: input.text,
          sourceApp: input.sourceApp,
          createdAt: new Date().toISOString(),
          uploaded: false,
          extraction: null,
          error: null,
        };
        await write(item); // Recovery journal precedes copying or clearing the native intent.
      }
      if (item.fileUri && !(await FS.getInfoAsync(item.fileUri)).exists) {
        if (!item.originalUri) throw new Error('Shared image unavailable');
        const temporary = `${item.fileUri}.copying`;
        try {
          await FS.copyAsync({ from: item.originalUri, to: temporary });
          await FS.moveAsync({ from: temporary, to: item.fileUri });
          item = { ...item, error: null };
          await write(item);
        } catch {
          await write({
            ...item,
            error: 'Could not copy this image yet. Please retry the share.',
          });
          throw new Error('Could not safely keep this image. Please retry.');
        }
      }
      return item;
    });
  },
};
export async function purgeAccountCaptures(userId: string) {
  await FS.makeDirectoryAsync(`${FS.documentDirectory}account-deletions/`, {
    intermediates: true,
  });
  await FS.writeAsStringAsync(deletionMarker(userId), 'requested');
  // A durable tombstone prevents late in-flight writes from recreating deleted files.
  await captureStore.list();
}
