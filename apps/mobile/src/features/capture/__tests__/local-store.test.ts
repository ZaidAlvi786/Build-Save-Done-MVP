import { captureStore, purgeAccountCaptures } from '../local-store';
const mockFiles = new Map<string, string>();
const mockRows = new Map<
  string,
  { id: string; key: string; payload: string }
>();
let mockCopyFailure = false,
  mockMoveFailure = false,
  mockId = 0;
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://docs/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async (path: string, value: string) => {
    mockFiles.set(path, value);
  }),
  readAsStringAsync: jest.fn(async (path: string) => {
    if (!mockFiles.has(path)) throw new Error('missing');
    return mockFiles.get(path);
  }),
  getInfoAsync: jest.fn(async (path: string) => ({
    exists: mockFiles.has(path),
  })),
  readDirectoryAsync: jest.fn(async (path: string) => [
    ...new Set(
      [...mockFiles.keys()]
        .filter((key) => key.startsWith(path))
        .map((key) => key.slice(path.length).split('/')[0]),
    ),
  ]),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    if (mockCopyFailure) {
      mockCopyFailure = false;
      throw new Error('copy interrupted');
    }
    const value = mockFiles.get(from);
    if (value === undefined) throw new Error('missing source');
    mockFiles.set(to, value);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    mockFiles.delete(to);
    if (mockMoveFailure) {
      mockMoveFailure = false;
      throw new Error('interrupted rename');
    }
    const value = mockFiles.get(from);
    if (value === undefined) throw new Error('missing');
    mockFiles.set(to, value);
    mockFiles.delete(from);
  }),
  deleteAsync: jest.fn(async (path: string) => {
    for (const key of mockFiles.keys())
      if (key.startsWith(path)) mockFiles.delete(key);
  }),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: jest.fn(
    async (_algorithm: string, input: string) => input,
  ),
  randomUUID: () =>
    `11111111-1111-4111-8111-${String(++mockId).padStart(12, '0')}`,
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(
      async (sql: string, id: string, key?: string, payload?: string) => {
        if (sql.startsWith('DELETE')) mockRows.delete(id);
        else mockRows.set(id, { id, key: key!, payload: payload! });
      },
    ),
    getFirstAsync: jest.fn(
      async (_sql: string, key: string) =>
        [...mockRows.values()].find((row) => row.key === key) ?? null,
    ),
    getAllAsync: jest.fn(async () => [...mockRows.values()]),
  })),
}));
const input = {
  uri: 'file://shared/screenshot.png',
  mime: 'image/png',
  text: null,
  sourceApp: 'share' as const,
};
beforeEach(() => {
  mockFiles.clear();
  mockRows.clear();
  mockCopyFailure = false;
  mockMoveFailure = false;
  mockFiles.set(input.uri, 'image bytes');
});
test('duplicate native delivery is durably copied once before acknowledgement', async () => {
  const first = await captureStore.ingest(input),
    second = await captureStore.ingest(input);
  expect(first.id).toBe(second.id);
  expect(mockFiles.get(first.fileUri!)).toBe('image bytes');
  expect(await captureStore.list()).toHaveLength(1);
});
test('interrupted copy retains its journal and supports retry', async () => {
  mockCopyFailure = true;
  await expect(captureStore.ingest(input)).rejects.toThrow('safely keep');
  const pending = (await captureStore.list())[0]!;
  expect(pending.originalUri).toBe(input.uri);
  expect(pending.error).toBeTruthy();
  const recovered = await captureStore.ingest(input);
  expect(recovered.id).toBe(pending.id);
  expect(recovered.error).toBeNull();
  expect(mockFiles.get(recovered.fileUri!)).toBe('image bytes');
});
test('crash between replacing journal and SQLite update recovers newest owner/state', async () => {
  const item = await captureStore.ingest(input);
  mockMoveFailure = true;
  await expect(
    captureStore.put({
      ...item,
      ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      uploaded: true,
    }),
  ).rejects.toThrow('rename');
  const recovered = (await captureStore.list())[0]!;
  expect(recovered.uploaded).toBe(true);
  expect(recovered.ownerId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});
test('confirmed local cleanup deletes the journal and screenshot', async () => {
  const item = await captureStore.ingest(input);
  await captureStore.remove(item);
  expect(await captureStore.list()).toEqual([]);
  expect(mockFiles.has(item.fileUri!)).toBe(false);
  expect(mockFiles.has(input.uri)).toBe(true);
});

test('delete-account tombstone removes owned images and rejects late write resurrection', async () => {
  const item = await captureStore.ingest(input),
    owned = { ...item, ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  await captureStore.put(owned);
  await purgeAccountCaptures(owned.ownerId);
  expect(await captureStore.list()).toEqual([]);
  expect(mockFiles.has(item.fileUri!)).toBe(false);
  await expect(captureStore.put(owned)).rejects.toThrow('deletion');
  const fresh = await captureStore.ingest({ ...input, text: 'new share' });
  expect(fresh.ownerId).toBeNull();
  expect(await captureStore.list()).toHaveLength(1);
});
