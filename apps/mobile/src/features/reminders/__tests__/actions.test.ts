import {
  applyAction,
  Reminder,
  syncReminderRows,
  snoozePlan,
} from '../actions';
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row: Reminder = {
  id: '11111111-1111-4111-8111-111111111111',
  owner: uid,
  placeId: '22222222-2222-4222-8222-222222222222',
  sentAt: '2026-10-12T10:00:00Z',
  action: 'ignored',
  actionAt: null,
  dirty: true,
  delivered: true,
};
test.each(['navigate', 'snooze', 'been_there'] as const)(
  'records %s with action timestamp and preserves first action on duplicate delivery',
  (action) => {
    const next = applyAction(row, action, new Date('2026-10-12T10:00:10Z'));
    expect(next.action).toBe(action);
    expect(next.actionAt).toBe('2026-10-12T10:00:10.000Z');
    expect(next.dirty).toBe(true);
    expect(
      applyAction(next, 'been_there', new Date('2026-10-12T10:01:00Z')),
    ).toBe(next);
  },
);
test('offline failure retains dirty row, other account and undelivered events never upload, retry acknowledges after success', async () => {
  const write = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined),
    acknowledge = jest.fn().mockResolvedValue(undefined);
  const rows = [
    row,
    { ...row, id: 'other', owner: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { ...row, id: 'not-sent', delivered: false },
  ];
  expect(await syncReminderRows(rows, uid, { write, acknowledge })).toBe(1);
  expect(acknowledge).not.toHaveBeenCalled();
  expect(row.dirty).toBe(true);
  expect(await syncReminderRows(rows, uid, { write, acknowledge })).toBe(0);
  expect(write).toHaveBeenCalledTimes(2);
  expect(acknowledge).toHaveBeenCalledWith(row.id, 'ignored');
});
test('future and canceled snoozes never count as sent, due snooze can log its own action', async () => {
  const parent = applyAction(row, 'snooze', new Date('2026-10-12T10:00:10Z'));
  const child = {
    ...snoozePlan(parent, '33333333-3333-4333-8333-333333333333'),
    delivered: true,
  };
  const write = jest.fn(),
    acknowledge = jest.fn();
  await syncReminderRows(
    [child],
    uid,
    { write, acknowledge },
    Date.parse('2026-10-13T10:00:00Z'),
  );
  expect(write).not.toHaveBeenCalled();
  await syncReminderRows(
    [{ ...child, canceled: true }],
    uid,
    { write, acknowledge },
    Date.parse('2026-10-13T10:01:00Z'),
  );
  expect(write).not.toHaveBeenCalled();
  const action = applyAction(
    child,
    'navigate',
    new Date('2026-10-13T10:01:00Z'),
  );
  await syncReminderRows(
    [action],
    uid,
    { write, acknowledge },
    Date.parse('2026-10-13T10:01:00Z'),
  );
  expect(write).toHaveBeenCalledWith(action);
  expect(() => snoozePlan(row, child.id)).toThrow();
});
test('sync also retries an acknowledgement failure and refuses action times before send', async () => {
  const write = jest.fn().mockResolvedValue(undefined),
    acknowledge = jest.fn().mockRejectedValue(new Error('disk'));
  expect(await syncReminderRows([row], uid, { write, acknowledge })).toBe(1);
  expect(() =>
    applyAction(row, 'navigate', new Date('2026-10-11T00:00:00Z')),
  ).toThrow();
});
