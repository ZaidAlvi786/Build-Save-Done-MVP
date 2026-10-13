import { z } from 'zod';
import { readLimited } from './io.ts';
export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
  limit = 4096,
): Promise<T> {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json')
    throw new Error('invalid_body');
  return schema.parse(
    JSON.parse(
      new TextDecoder().decode(await readLimited(request.body, limit)),
    ),
  );
}
export async function user(
  request: Request,
  authenticate: (token: string) => Promise<string | null>,
) {
  const token = /^Bearer (\S+)$/i.exec(
    request.headers.get('Authorization') ?? '',
  )?.[1];
  return token ? await authenticate(token) : null;
}
export function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error('configuration_missing');
  return value;
}
export const unavailable = () =>
  json(503, { error: 'temporarily_unavailable' });
