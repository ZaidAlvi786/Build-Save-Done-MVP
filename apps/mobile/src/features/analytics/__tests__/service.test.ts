import { flushEventQueue } from '../service';
import {
  eventSchema,
  FunnelEvent,
  eventNames,
} from '../../../../../../shared/events';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const event: FunnelEvent = {
  id,
  event: 'app_opened',
  timestamp: '2026-10-13T12:00:00.000Z',
  properties: {},
};
const now = Date.parse(event.timestamp);
test('unknown acknowledgement cannot delete any queued event', async () => {
  const remove = jest.fn();
  await expect(
    flushEventQueue(
      id,
      { list: async () => [event], remove },
      async () => ({
        accepted: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        discarded: [],
      }),
      now,
    ),
  ).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
});
test('offline events survive, expired events prune, and acknowledged batch is bounded', async () => {
  const expired = {
    ...event,
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    timestamp: '2026-01-01T00:00:00Z',
  };
  const remove = jest.fn(),
    list = jest.fn(async () => [
      expired,
      ...Array.from({ length: 25 }, (_, i) => ({
        ...event,
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      })),
    ]);
  const send = jest.fn(async (_events: FunnelEvent[]) => {
    throw new Error('offline');
  });
  await expect(
    flushEventQueue(id, { list, remove }, send, now),
  ).rejects.toThrow();
  expect(list).toHaveBeenCalledWith(id);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith([expired.id]);
  expect(send.mock.calls[0]?.[0]).toHaveLength(20);
});
test('only the eight events and privacy allowlist can enter the queue', () => {
  expect(eventNames).toHaveLength(8);
  expect(eventSchema.safeParse({ ...event, event: 'pageview' }).success).toBe(
    false,
  );
  for (const key of ['email', 'latitude', 'name', 'token', 'distinct_id'])
    expect(
      eventSchema.safeParse({ ...event, properties: { [key]: 'secret' } })
        .success,
    ).toBe(false);
});
test('consent discard and accepted IDs are removed after acknowledgement', async () => {
  const remove = jest.fn();
  await flushEventQueue(
    id,
    { list: async () => [event], remove },
    async () => ({ accepted: [], discarded: [id] }),
    now,
  );
  expect(remove).toHaveBeenCalledWith([id]);
});
