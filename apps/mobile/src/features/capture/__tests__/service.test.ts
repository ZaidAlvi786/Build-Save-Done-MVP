import { Capture, CaptureRemote, CaptureStore } from '../types';
import { createCaptureService } from '../service';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const initial: Capture = {
  version: 1,
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: null,
  sourceKey: 'key',
  fileUri: 'file://private/image',
  originalUri: 'file://shared/image',
  mime: 'image/png',
  sourceText: null,
  sourceApp: 'share',
  createdAt: '2026-10-12T00:00:00Z',
  uploaded: false,
  extraction: null,
  error: null,
};
const extraction = {
  place: {
    name: 'Juniper Cafe',
    area: 'Lahore',
    address: null,
    category: 'cafe' as const,
    confidence: 0.9,
  },
  reason: 'identified' as const,
};
function setup() {
  let rows = [{ ...initial }];
  const store: CaptureStore = {
    list: async () => rows.map((r) => ({ ...r })),
    put: async (item) => {
      rows = rows.map((r) => (r.id === item.id ? { ...item } : r));
    },
    remove: async (item) => {
      rows = rows.filter((r) => r.id !== item.id);
    },
    ingest: async () => initial,
  };
  const remote: CaptureRemote = {
    ensure: jest.fn().mockResolvedValue('pending'),
    upload: jest.fn().mockResolvedValue(undefined),
    extract: jest.fn().mockResolvedValue(extraction),
  };
  return { store, remote, service: createCaptureService(store, remote) };
}
test('offline save retains image and owner then retries with the same UUID', async () => {
  const { store, remote, service } = setup();
  (remote.ensure as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await service.process(initial, A);
  const failed = (await store.list())[0]!;
  expect(failed.error).toContain('safe');
  expect(failed.fileUri).toBe(initial.fileUri);
  expect(failed.ownerId).toBe(A);
  await service.process(failed, A);
  const ready = (await store.list())[0]!;
  expect(ready.extraction).toEqual(extraction);
  expect(ready.uploaded).toBe(true);
  expect(remote.ensure).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ id: initial.id }),
    A,
  );
});
test('provider failure does not repeat successful upload and cannot discard capture', async () => {
  const { store, remote, service } = setup();
  (remote.extract as jest.Mock).mockRejectedValueOnce(new Error('provider'));
  await service.process(initial, A);
  expect((await store.list())[0]!.uploaded).toBe(true);
  await service.process(initial, A);
  expect(remote.upload).toHaveBeenCalledTimes(1);
  expect((await store.list())[0]!.extraction).toEqual(extraction);
});
test('stale pre-auth snapshot cannot rebind an item after another user claimed it', async () => {
  const { store, service, remote } = setup();
  await service.bind(initial, A);
  await expect(service.process(initial, B)).rejects.toThrow('another account');
  await expect(service.bind(initial, B)).rejects.toThrow('Wrong account');
  expect(remote.ensure).not.toHaveBeenCalled();
  expect((await store.list())[0]!.ownerId).toBe(A);
});
test('link-only share is persisted remotely and remains available for manual place entry', async () => {
  const { store, remote, service } = setup();
  await store.put({
    ...initial,
    fileUri: null,
    sourceText: 'https://example.com/place',
  });
  await service.process(initial, A);
  expect(remote.extract).not.toHaveBeenCalled();
  expect((await store.list())[0]!.sourceText).toBe('https://example.com/place');
});
test('lost confirmation acknowledgement reconciles remote success before local cleanup', async () => {
  const { store, remote, service } = setup();
  (remote.ensure as jest.Mock).mockResolvedValue('confirmed');
  await service.process(initial, A);
  expect(await store.list()).toEqual([]);
  expect(remote.upload).not.toHaveBeenCalled();
});
test('measurement failure cannot break extraction; extraction failures distinguish transport from upload', async () => {
  const { store, remote } = setup();
  const observer = jest.fn().mockRejectedValue(new Error('measurement'));
  const service = createCaptureService(store, remote, observer);
  await service.process(initial, A);
  expect((await store.list())[0]?.extraction).toEqual(extraction);
  expect(observer).toHaveBeenCalledWith(
    A,
    'extraction_succeeded',
    { item_id: initial.id },
    initial.id,
  );
  const second = setup(),
    events = jest.fn();
  const retried = createCaptureService(second.store, second.remote, events);
  (second.remote.upload as jest.Mock).mockRejectedValueOnce(
    new Error('upload'),
  );
  await retried.process(initial, A);
  expect(events).not.toHaveBeenCalled();
  (second.remote.extract as jest.Mock).mockRejectedValueOnce(
    new Error('vision'),
  );
  await retried.process(initial, A);
  expect(events).toHaveBeenCalledWith(A, 'extraction_failed', {
    item_id: initial.id,
    reason: 'unavailable',
  });
});
