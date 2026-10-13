import { required, unavailable } from '../_shared/http.ts';
import { matchingBackend } from '../_shared/matching-backend.ts';
import { createMapHandler, staticMap } from './handler.ts';
let handler: (request: Request) => Promise<Response>;
try {
  handler = createMapHandler({
    ...matchingBackend(
      required('SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
    ),
    image: staticMap(required('MAPS_STATIC_API_KEY')),
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
