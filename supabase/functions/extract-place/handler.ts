import {
  Dependencies,
  extractionSchema,
  requestSchema,
} from '../_shared/contracts.ts';
import { MAX_IMAGE_BYTES, readLimited, validateImage } from '../_shared/io.ts';
const respond = (status: number, body: unknown, retry?: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(retry ? { 'Retry-After': String(retry) } : {}),
    },
  });
export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    // Native clients and CLI only in MVP; no broad browser CORS access.
    if (request.method !== 'POST')
      return respond(405, { error: 'method_not_allowed' });
    let userId: string | null;
    try {
      const match = /^Bearer (\S+)$/i.exec(
        request.headers.get('Authorization') ?? '',
      );
      if (!match?.[1]) return respond(401, { error: 'unauthorized' });
      userId = await deps.authenticate(match[1]);
      if (!userId) return respond(401, { error: 'unauthorized' });
    } catch {
      return respond(503, { error: 'temporarily_unavailable' });
    }
    if (
      request.headers.get('Content-Type')?.split(';')[0] !== 'application/json'
    )
      return respond(415, { error: 'json_required' });
    let itemId: string;
    try {
      const bytes = await readLimited(request.body, 2048);
      itemId = requestSchema.parse(
        JSON.parse(new TextDecoder().decode(bytes)),
      ).saved_item_id;
    } catch {
      return respond(400, { error: 'invalid_request' });
    }
    const token = crypto.randomUUID();
    let claimed = false;
    try {
      const claim = await deps.repository.claim(userId, itemId, token);
      if (claim.state === 'not_found')
        return respond(404, { error: 'item_not_found' });
      if (claim.state === 'not_pending')
        return respond(409, { error: 'item_not_pending' });
      if (claim.state === 'busy')
        return respond(409, { error: 'extraction_in_progress' }, 5);
      if (claim.state === 'limited')
        return respond(429, { error: 'rate_limited' }, 3600);
      if (claim.state === 'cached')
        return respond(200, {
          saved_item_id: itemId,
          result: extractionSchema.parse(claim.result),
          cached: true,
        });
      if (claim.state !== 'claimed') throw new Error('invalid_claim');
      claimed = true;
      // Never fetch arbitrary URLs; only a private object in this user's item folder.
      if (
        !claim.image_path ||
        !claim.image_path.startsWith(`${userId}/${itemId}/`) ||
        claim.image_path.includes('..')
      ) {
        return respond(422, { error: 'image_required', status: 'pending' });
      }
      const blob = await deps.repository.image(claim.image_path);
      let bytes: Uint8Array;
      let mime: string;
      try {
        if (blob.size > MAX_IMAGE_BYTES) throw new Error('too_large');
        bytes = new Uint8Array(await blob.arrayBuffer());
        mime = validateImage(bytes, blob.type);
      } catch {
        return respond(422, { error: 'invalid_image', status: 'pending' });
      }
      const result = extractionSchema.parse(await deps.extract(bytes, mime));
      const stored = await deps.repository.finish(
        userId,
        itemId,
        token,
        result,
      );
      if (!stored)
        return respond(409, { error: 'item_changed', status: 'pending' });
      return respond(200, { saved_item_id: itemId, result, cached: false });
    } catch {
      // No raw provider messages, images, prompts or credentials are logged or returned.
      return respond(
        503,
        { error: 'extraction_unavailable', status: 'pending' },
        5,
      );
    } finally {
      if (claimed) {
        try {
          await deps.repository.release(userId, itemId, token);
        } catch {
          /* Fenced 90-second lease expires if cleanup fails. */
        }
      }
    }
  };
}
