# Supabase owns the backend

Status: accepted for foundations

Use Supabase Auth, Postgres/PostGIS, private Storage and TypeScript Edge Functions; no custom server. RLS is the authorization boundary even when clients are modified. Service role only inside functions, explicit ownership checks before privileged writes. Integrations and RLS tests arrive in Phase 1.
