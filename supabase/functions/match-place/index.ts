import { required, unavailable } from '../_shared/http.ts';
import { matchingBackend } from '../_shared/matching-backend.ts';
import { createMatchHandler } from './handler.ts';
import { googleGeocoder } from './geocoder.ts';
let handler: (request: Request) => Promise<Response>;
try {
  if (required('GEOCODING_PROVIDER') !== 'google')
    throw new Error('unsupported_provider');
  handler = createMatchHandler({
    ...matchingBackend(
      required('SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
    ),
    geocoder: googleGeocoder(required('GEOCODING_API_KEY')),
  });
} catch {
  handler = () => Promise.resolve(unavailable());
}
Deno.serve(handler);
