import { createMapHandler, staticMap } from './handler.ts';
import { equal, assert } from '../../../eval/support.ts';
const png = await Deno.readFile('eval/cases/01-cafe.png');
const request = (
  input: unknown = {
    saved_item_id: '11111111-1111-4111-8111-111111111111',
    lat: 31.5,
    lng: 74.3,
  },
) =>
  new Request('http://local', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
Deno.test('map preview enforces ownership, bounds and quota', async () => {
  let owns = true,
    quota = true;
  const handler = createMapHandler({
    authenticate: () => Promise.resolve('u'),
    owns: () => Promise.resolve(owns),
    consume: () => Promise.resolve(quota),
    image: () => Promise.resolve(png),
  });
  owns = false;
  equal((await handler(request())).status, 404);
  owns = true;
  quota = false;
  equal((await handler(request())).status, 429);
  quota = true;
  equal(
    (
      await handler(
        request({
          saved_item_id: '11111111-1111-4111-8111-111111111111',
          lat: 100,
          lng: 0,
        }),
      )
    ).status,
    400,
  );
  const response = await handler(request());
  equal(response.status, 200);
  assert((await response.json()).image_base64.startsWith('iVBOR'));
});
Deno.test(
  'static map key is server-only and provider errors never contain it',
  async () => {
    let target = '';
    const transport = ((url: unknown) => {
      target = String(url);
      return Promise.resolve(
        new Response('private provider details', { status: 403 }),
      );
    }) as typeof fetch;
    let message = '';
    try {
      await staticMap('server-secret', transport)(31.5, 74.3);
    } catch (error) {
      message = String(error);
    }
    assert(target.startsWith('https://maps.googleapis.com/'));
    assert(target.includes('server-secret'));
    assert(!message.includes('server-secret'));
    assert(!message.includes('private'));
  },
);
