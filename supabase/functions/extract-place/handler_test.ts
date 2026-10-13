import { createHandler } from './handler.ts';
import { extractionSchema } from '../_shared/contracts.ts';
import { MAX_IMAGE_BYTES, validateImage } from '../_shared/io.ts';
import { assert, equal, MemoryRepository } from '../../../eval/support.ts';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ID = '11111111-1111-4111-8111-111111111111';
const png = await Deno.readFile('eval/cases/01-cafe.png');
const result = {
  place: {
    name: 'Juniper Cafe',
    area: 'Gulberg, Lahore',
    address: null,
    category: 'cafe',
    confidence: 0.9,
  },
  reason: 'identified',
};
function setup(
  extract: () => Promise<unknown> = () => Promise.resolve(result),
) {
  const repo = new MemoryRepository();
  repo.add(A, ID, new Blob([png], { type: 'image/png' }));
  const handler = createHandler({
    repository: repo,
    authenticate: (t) => Promise.resolve(t === 'A' ? A : t === 'B' ? B : null),
    extract,
  });
  const request = (token = 'A', body: unknown = { saved_item_id: ID }) =>
    handler(
      new Request('http://local/extract-place', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );
  return { repo, handler, request };
}
Deno.test(
  'schema rejects extra fields, unknown category, mismatched reason and invalid confidence',
  () => {
    assert(extractionSchema.safeParse(result).success);
    for (const bad of [
      { ...result, command: 'ignore' },
      { ...result, place: { ...result.place, confidence: 2 } },
      { ...result, place: { ...result.place, category: 'event' } },
      { place: null, reason: 'identified' },
      { ...result, place: { ...result.place, name: '  ' } },
    ])
      assert(!extractionSchema.safeParse(bad).success);
  },
);
Deno.test('image signature, declared MIME and cap enforced', () => {
  equal(validateImage(png, 'image/png'), 'image/png');
  for (const [bytes, mime] of [
    [png, 'image/jpeg'],
    [new Uint8Array(MAX_IMAGE_BYTES + 1), 'image/png'],
    [new TextEncoder().encode('<svg>'), 'image/png'],
  ] as const) {
    let thrown = false;
    try {
      validateImage(bytes, mime);
    } catch {
      thrown = true;
    }
    assert(thrown);
  }
});
Deno.test('auth, body, method and cross-user ownership denied', async () => {
  const { request, handler } = setup();
  equal((await request('bad')).status, 401);
  equal((await request('B')).status, 404);
  equal(
    (await request('A', { saved_item_id: ID, url: 'https://example.com' }))
      .status,
    400,
  );
  equal(
    (await handler(new Request('http://local', { method: 'GET' }))).status,
    405,
  );
  equal((await request('A', { saved_item_id: 'bad' })).status, 400);
  equal((await request('A', { saved_item_id: 'x'.repeat(3000) })).status, 400);
});
Deno.test(
  'duplicate success returns cached result without another provider call',
  async () => {
    let calls = 0;
    const { request, repo } = setup(() => {
      calls++;
      return Promise.resolve(result);
    });
    equal((await request()).status, 200);
    const second = await request();
    equal((await second.json()).cached, true);
    equal(calls, 1);
    equal(repo.finished, 1);
  },
);
Deno.test('concurrent request is busy; provider called once', async () => {
  let resolve!: (value: unknown) => void;
  const pending = new Promise((r) => (resolve = r));
  let entered!: () => void;
  const started = new Promise<void>((r) => (entered = r));
  const { request } = setup(() => {
    entered();
    return pending;
  });
  const first = request();
  await started;
  equal((await request()).status, 409);
  resolve(result);
  equal((await first).status, 200);
});
Deno.test(
  'provider failure stays pending, sanitized and retryable',
  async () => {
    let calls = 0;
    const { request, repo } = setup(() => {
      if (calls++ === 0) throw new Error('secret provider detail');
      return Promise.resolve(result);
    });
    const fail = await request();
    equal(fail.status, 503);
    assert(!(await fail.text()).includes('secret'));
    assert(!repo.rows.get(ID)?.cache);
    assert(!repo.rows.get(ID)?.lease);
    equal((await request()).status, 200);
  },
);
Deno.test('malformed provider output is not persisted', async () => {
  const { request, repo } = setup(() => Promise.resolve({ place: 'invented' }));
  equal((await request()).status, 503);
  equal(repo.finished, 0);
});
Deno.test(
  'per-user quota limits uncached requests but permits cached reads',
  async () => {
    const { request, repo } = setup();
    repo.limit = 1;
    equal((await request()).status, 200);
    equal((await request()).status, 200);
    const id = crypto.randomUUID();
    repo.add(A, id, new Blob([png], { type: 'image/png' }));
    equal((await request('A', { saved_item_id: id })).status, 429);
    repo.add(B, id, new Blob([png], { type: 'image/png' }));
    equal((await request('B', { saved_item_id: id })).status, 200);
  },
);
Deno.test(
  'wrong storage prefix, links and oversized images stay pending',
  async () => {
    for (const kind of ['prefix', 'link', 'size', 'mime']) {
      const { request, repo } = setup();
      const row = repo.rows.get(ID)!;
      if (kind === 'prefix') row.path = `${B}/${ID}/image.png`;
      if (kind === 'link') row.path = 'https://example.com/a.png';
      if (kind === 'size')
        row.image = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], {
          type: 'image/png',
        });
      if (kind === 'mime') row.image = new Blob([png], { type: 'image/jpeg' });
      equal((await request()).status, 422);
      equal(repo.finished, 0);
      assert(!row.lease);
    }
  },
);
Deno.test('lost fenced write is not reported as successful', async () => {
  const { request, repo } = setup();
  repo.finish = () => Promise.resolve(false);
  equal((await request()).status, 409);
});
Deno.test('cleanup failure never creates an unhandled rejection', async () => {
  const { request, repo } = setup();
  repo.release = () => Promise.reject(new Error('db down'));
  equal((await request()).status, 200);
});
