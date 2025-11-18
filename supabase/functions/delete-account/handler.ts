import { body, json, user } from '../_shared/http.ts';
import { z } from 'zod';
export interface DeleteDependencies {
  authenticate: (token: string) => Promise<string | null>;
  begin: (uid: string) => Promise<void>;
  paths: (uid: string) => Promise<string[]>;
  removeImages: (paths: string[]) => Promise<void>;
  removeUser: (uid: string) => Promise<void>;
}
export function createDeleteHandler(deps: DeleteDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST')
      return json(405, { error: 'method_not_allowed' });
    try {
      const uid = await user(request, deps.authenticate);
      if (!uid) return json(401, { error: 'unauthorized' });
      try {
        await body(
          request,
          z.object({ confirmation: z.literal('DELETE') }).strict(),
        );
      } catch {
        return json(400, { error: 'confirmation_required' });
      }
      // Delete images first; keep Auth/rows if image removal fails so retry remains possible.
      await deps.begin(uid);
      const paths = await deps.paths(uid);
      for (let i = 0; i < paths.length; i += 100)
        await deps.removeImages(paths.slice(i, i + 100));
      await deps.removeUser(uid);
      return json(200, { deleted: true });
    } catch {
      return json(503, { error: 'deletion_incomplete_retry' });
    }
  };
}
