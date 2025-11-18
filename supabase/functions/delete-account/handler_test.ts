import { createDeleteHandler } from './handler.ts';
import { equal, assert } from '../../../eval/support.ts';
const request = (confirmation = 'DELETE', token = 'valid') =>
  new Request('http://local', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmation }),
  });
Deno.test(
  'account deletion authenticates and requires explicit confirmation',
  async () => {
    let deleted = false;
    const handler = createDeleteHandler({
      authenticate: (t) => Promise.resolve(t === 'valid' ? 'user' : null),
      begin: () => Promise.resolve(),
      paths: () => Promise.resolve([]),
      removeImages: () => Promise.resolve(),
      removeUser: () => {
        deleted = true;
        return Promise.resolve();
      },
    });
    equal((await handler(request('DELETE', 'bad'))).status, 401);
    equal((await handler(request('NO'))).status, 400);
    assert(!deleted);
    equal((await handler(request())).status, 200);
    assert(deleted);
  },
);
Deno.test(
  'account survives image failure so deletion can be retried',
  async () => {
    const steps: string[] = [];
    const handler = createDeleteHandler({
      authenticate: () => Promise.resolve('user'),
      begin: () => {
        steps.push('pause');
        return Promise.resolve();
      },
      paths: () => Promise.resolve(['user/item/image']),
      removeImages: () => {
        steps.push('images');
        return Promise.reject(new Error('storage failure'));
      },
      removeUser: () => {
        steps.push('auth');
        return Promise.resolve();
      },
    });
    equal((await handler(request())).status, 503);
    equal(steps, ['pause', 'images']);
  },
);
