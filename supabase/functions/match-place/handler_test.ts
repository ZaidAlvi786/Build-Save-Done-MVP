import { createMatchHandler } from './handler.ts';
import { googleGeocoder } from './geocoder.ts';
import { equal, assert } from '../../../eval/support.ts';
const id = '11111111-1111-4111-8111-111111111111';
const request = (
  token = 'valid',
  input: unknown = { saved_item_id: id, query: 'Juniper Cafe, Lahore' },
) =>
  new Request('http://local', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
Deno.test(
  'matching authenticates, checks ownership and consumes quota before provider',
  async () => {
    let calls = 0;
    let owns = true,
      quota = true;
    const handler = createMatchHandler({
      authenticate: (t) => Promise.resolve(t === 'valid' ? 'user' : null),
      owns: () => Promise.resolve(owns),
      consume: () => Promise.resolve(quota),
      geocoder: {
        search: () => {
          calls++;
          return Promise.resolve([]);
        },
      },
    });
    equal((await handler(request('invalid'))).status, 401);
    owns = false;
    equal((await handler(request())).status, 404);
    owns = true;
    quota = false;
    equal((await handler(request())).status, 429);
    equal(calls, 0);
    quota = true;
    const response = await handler(request());
    equal(response.status, 200);
    equal(await response.json(), { candidates: [] });
    equal(
      (
        await handler(
          request('valid', { saved_item_id: id, query: 'ok', lat: 31 }),
        )
      ).status,
      400,
    );
  },
);
Deno.test(
  'geocoder normalizes candidates and sends no current device location',
  async () => {
    let payload: Record<string, unknown> = {};
    const transport = ((_url: unknown, init: RequestInit) => {
      payload = JSON.parse(String(init.body));
      return Promise.resolve(
        Response.json({
          places: [
            {
              id: 'p',
              displayName: { text: 'Cafe' },
              formattedAddress: 'Lahore',
              location: { latitude: 31.5, longitude: 74.3 },
            },
          ],
        }),
      );
    }) as typeof fetch;
    equal(await googleGeocoder('secret', transport).search('Cafe, Lahore'), [
      { id: 'p', name: 'Cafe', address: 'Lahore', lat: 31.5, lng: 74.3 },
    ]);
    assert(!('locationBias' in payload));
    assert(!('secret' in payload));
  },
);
Deno.test('matching provider errors are sanitized', async () => {
  const handler = createMatchHandler({
    authenticate: () => Promise.resolve('u'),
    owns: () => Promise.resolve(true),
    consume: () => Promise.resolve(true),
    geocoder: { search: () => Promise.reject(new Error('secret key details')) },
  });
  const response = await handler(request());
  equal(response.status, 503);
  assert(!(await response.text()).includes('secret'));
});
