import {
  createRefreshHandler,
  googleCoordinates,
  RefreshDependencies,
} from './handler.ts';
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Mismatch');
}
const id = '11111111-1111-4111-8111-111111111111';
const request = (auth = true) =>
  new Request('https://local/refresh-place', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer token' } : {}),
    },
    body: JSON.stringify({ place_id: id }),
  });
Deno.test(
  'coordinate refresh authenticates, checks ownership and quota before provider and saving',
  async () => {
    let calls = 0;
    const deps: RefreshDependencies = {
      authenticate: () => Promise.resolve('user'),
      place: () => Promise.resolve(null),
      consume: () => Promise.resolve(true),
      coordinates: () => {
        calls++;
        return Promise.resolve({ lat: 1, lng: 2 });
      },
      save: () => Promise.resolve(true),
    };
    equal((await createRefreshHandler(deps)(request(false))).status, 401);
    equal((await createRefreshHandler(deps)(request())).status, 404);
    deps.place = () => Promise.resolve({ itemId: id, providerId: 'provider' });
    deps.consume = () => Promise.resolve(false);
    equal((await createRefreshHandler(deps)(request())).status, 429);
    equal(calls, 0);
    deps.consume = () => Promise.resolve(true);
    equal((await createRefreshHandler(deps)(request())).status, 200);
    equal(calls, 1);
    deps.save = () => Promise.resolve(false);
    equal((await createRefreshHandler(deps)(request())).status, 409);
  },
);
Deno.test(
  'Place Details requests only destination coordinates and validates bounds',
  async () => {
    let actual: URL | undefined;
    let headers: Headers | undefined;
    const provider = googleCoordinates('secret', (input, init) => {
      actual = new URL(String(input));
      headers = new Headers(init?.headers);
      return Promise.resolve(
        new Response(
          JSON.stringify({ location: { latitude: 31.5, longitude: 74.3 } }),
        ),
      );
    });
    equal(await provider('id/encoded'), { lat: 31.5, lng: 74.3 });
    equal(actual?.hostname, 'places.googleapis.com');
    equal(actual?.pathname, '/v1/places/id%2Fencoded');
    equal(headers?.get('X-Goog-FieldMask'), 'location');
    const failed = googleCoordinates('secret', () =>
      Promise.resolve(new Response('private provider detail', { status: 500 })),
    );
    try {
      await failed('id');
      throw new Error('Expected failure');
    } catch (error) {
      equal((error as Error).message, 'provider_failed');
    }
  },
);
