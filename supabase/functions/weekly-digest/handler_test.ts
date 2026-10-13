import {
  createDigestHandler,
  cronAuthorization,
  DigestDependencies,
  DigestClaim,
} from './handler.ts';
import { expoPush } from './provider.ts';
import { assert, equal } from '../../../eval/support.ts';
const claim: DigestClaim = {
  user_id: 'owner',
  token: 'ExpoPushToken[test]',
  lease_id: 'lease',
  place_count: 2,
};
const request = (token = 'valid') =>
  new Request('http://local', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
function setup() {
  const finished: unknown[][] = [];
  let sends = 0;
  const deps: DigestDependencies = {
    authorize: (t) => Promise.resolve(t === 'valid'),
    claim: () => Promise.resolve([claim]),
    allowed: () => Promise.resolve(true),
    pending: () => Promise.resolve([]),
    finish: (...args) => {
      finished.push(args);
      return Promise.resolve();
    },
    send: () => {
      sends++;
      return Promise.resolve([
        { state: 'accepted', ticketId: 'ticket', invalidToken: false },
      ]);
    },
    receipts: () => Promise.resolve({}),
  };
  return { deps, finished, sends: () => sends };
}
Deno.test(
  'digest uses scheduler secret, checks current consent and never exposes recipient tokens',
  async () => {
    const { deps, finished, sends } = setup();
    const handler = createDigestHandler(deps);
    equal((await handler(request('invalid'))).status, 401);
    equal(sends(), 0);
    deps.allowed = () => Promise.resolve(false);
    equal((await handler(request())).status, 200);
    equal(sends(), 0);
    equal(finished[0], ['owner', 'lease', 'failed', null, false]);
    deps.allowed = () => Promise.resolve(true);
    const reply = await handler(request());
    equal(reply.status, 200);
    assert(!(await reply.text()).includes(claim.token));
    equal(sends(), 1);
  },
);
Deno.test(
  'ambiguous push failures mark leases unknown without trying a second send',
  async () => {
    const { deps, finished, sends } = setup();
    deps.send = () => {
      throw new Error('secret provider error');
    };
    const response = await createDigestHandler(deps)(request());
    equal(response.status, 503);
    equal(finished[0], ['owner', 'lease', 'unknown', null, false]);
    equal(sends(), 0);
  },
);
Deno.test(
  'receipt outages do not prevent new digests and persistence failure does not overwrite accepted tickets',
  async () => {
    const { deps, finished } = setup();
    deps.pending = () =>
      Promise.resolve([
        { user_id: 'old', lease_id: 'old', ticket_id: 'old', expired: false },
      ]);
    deps.receipts = () => Promise.reject(new Error('offline'));
    const response = await createDigestHandler(deps)(request());
    equal(await response.json(), {
      claimed: 1,
      accepted: 1,
      receipt_errors: 1,
    });
    equal(finished.length, 1);
    deps.finish = () => Promise.reject(new Error('db'));
    const result = await createDigestHandler(deps)(request());
    equal((await result.json()).receipt_errors, 2);
  },
);
Deno.test('cron secret rejects weak or wrong keys', async () => {
  equal(await cronAuthorization('weak', 'weak'), false);
  equal(await cronAuthorization('a'.repeat(32), 'a'.repeat(32)), true);
  equal(await cronAuthorization('a'.repeat(32), 'b'.repeat(32)), false);
});
Deno.test(
  'Expo adapter validates tickets and disables only DeviceNotRegistered tokens',
  async () => {
    let sent: Record<string, unknown>[] = [];
    const provider = expoPush('server-secret', ((url, options) => {
      equal(url, 'https://exp.host/--/api/v2/push/send');
      equal(
        (options?.headers as Record<string, string>).Authorization,
        'Bearer server-secret',
      );
      sent = JSON.parse(String(options?.body));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              { status: 'error', details: { error: 'DeviceNotRegistered' } },
            ],
          }),
        ),
      );
    }) as typeof fetch);
    equal(
      await provider.send([
        { token: claim.token, count: 2, leaseId: 'lease', owner: 'owner' },
      ]),
      [{ state: 'failed', ticketId: null, invalidToken: true }],
    );
    assert(
      String(sent[0]!.body).includes('2 saved places near you this weekend'),
    );
    equal((sent[0]!.data as Record<string, unknown>).kind, 'digest');
  },
);
