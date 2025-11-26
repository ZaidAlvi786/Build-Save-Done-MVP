import {
  Claim,
  Extraction,
  Repository,
} from '../supabase/functions/_shared/contracts.ts';
// Test-only adapter. Never imported by the deployed Edge Function.
export class MemoryRepository implements Repository {
  readonly rows = new Map<
    string,
    {
      user: string;
      image: Blob;
      path: string;
      cache?: Extraction;
      lease?: string;
    }
  >();
  readonly counts = new Map<string, number>();
  limit = 20;
  finished = 0;
  add(user: string, id: string, image: Blob) {
    this.rows.set(id, { user, image, path: `${user}/${id}/image.png` });
  }
  claim(user: string, id: string, token: string): Promise<Claim> {
    const row = this.rows.get(id);
    if (!row || row.user !== user)
      return Promise.resolve({ state: 'not_found' });
    if (row.cache)
      return Promise.resolve({ state: 'cached', result: row.cache });
    if (row.lease) return Promise.resolve({ state: 'busy' });
    const count = this.counts.get(user) ?? 0;
    if (count >= this.limit) return Promise.resolve({ state: 'limited' });
    this.counts.set(user, count + 1);
    row.lease = token;
    return Promise.resolve({ state: 'claimed', image_path: row.path });
  }
  image(path: string): Promise<Blob> {
    const row = [...this.rows.values()].find((r) => r.path === path);
    if (!row) throw new Error('missing');
    return Promise.resolve(row.image);
  }
  finish(
    user: string,
    id: string,
    token: string,
    result: Extraction,
  ): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.user !== user || row.lease !== token)
      return Promise.resolve(false);
    row.cache = result;
    this.finished++;
    return Promise.resolve(true);
  }
  release(user: string, id: string, token: string): Promise<void> {
    const row = this.rows.get(id);
    if (row?.user === user && row.lease === token) delete row.lease;
    return Promise.resolve();
  }
}
export function assert(
  condition: unknown,
  message = 'Assertion failed',
): asserts condition {
  if (!condition) throw new Error(message);
}
export function equal(actual: unknown, expected: unknown) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
