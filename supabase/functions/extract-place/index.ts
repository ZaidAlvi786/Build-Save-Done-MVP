import { createHandler } from './handler.ts';
import { backend } from './repository.ts';
import { createVisionProvider } from './provider.ts';
const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error('configuration_missing');
  return value;
};
// Fail closed with a sanitized response when secrets are missing.
let handler: (request: Request) => Promise<Response>;
try {
  handler = createHandler({
    ...backend(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY')),
    extract: createVisionProvider({
      provider: required('AI_PROVIDER'),
      model: required('AI_MODEL'),
      apiKey: required('AI_API_KEY'),
      baseUrl: Deno.env.get('AI_BASE_URL'),
    }),
  });
} catch {
  handler = () =>
    Promise.resolve(
      new Response(JSON.stringify({ error: 'temporarily_unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}
Deno.serve(handler);
