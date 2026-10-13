# Local backend verification without credentials

Status: accepted for Phase 1

Use Deno 2.9.6 as a workspace dev tool; Supabase deploys its own Deno runtime. Pin zod 3.25.76 for strict validation and supabase-js 2.57.4 for Auth/Storage/RPC adapters; no mobile bundle imports these backend modules. Keep Deno's cache and lockfile separate from npm using DENO_NO_PACKAGE_JSON=1.

Use PGlite 0.5.8 and matching PostGIS 0.2.8 only for local tests when Docker is unavailable. It executes unmodified product SQL against actual Postgres policies. Minimal auth/storage schemas and auth.uid represent managed Supabase objects; this is not a substitute for GoTrue or Storage HTTP integration. Maintain a pgTAP suite for the full Supabase stack and CI. Neither test adapter nor fixture vision responses can be selected by environment in the deployed function.

The first vision adapter uses Anthropic Messages because the brief names Claude; provider and model come from secrets, with no default model. Validate output with zod even when provider returns JSON. Swapping providers requires implementing the same extraction port and evaluation, rather than changing the mobile app. See [Anthropic vision](https://platform.claude.com/docs/en/build-with-claude/vision) and [Supabase Auth](https://supabase.com/docs/reference/javascript/auth-getuser).
