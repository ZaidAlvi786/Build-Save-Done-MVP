# Supabase backend (Phases 1–3)

Six versioned migrations define four RLS-protected product tables, PostGIS index, auth profile trigger, private immutable capture uploads, server-only per-user quota and extraction lease RPCs. The server caches strictly validated results; extraction does not confirm or create a geocoded place. Matching and atomic confirmation are implemented in Phase 2. Default throttle is 20 uncached attempts/hour/user; cached reads cost no attempt. Provider deadline is 25 seconds, lease expiry 90 seconds. A crash can cause a provider call to be retried after expiry, but fenced writes and cached successful results prevent stale/duplicate persistence.

## Offline local checks

```powershell
npm ci
npm run backend:check
npm run backend:lint
npm run backend:test
npm run db:test:local
npm run eval:fixture
```

PGlite/PostGIS executes unchanged migrations with minimal managed auth/storage schema equivalents. It validates SQL ownership and rate-limit transactions; it does not run Supabase Auth or Storage APIs. Full Supabase pgTAP tests are separate.

## Full local Supabase stack

Install Docker Desktop (running with sufficient RAM), and Supabase CLI 2.111.0. From repo root:

```powershell
supabase start
supabase db reset
supabase test db
Copy-Item supabase/functions/.env.example supabase/functions/.env.local
# Fill AI_MODEL and AI_API_KEY locally. Never commit secrets.
supabase functions serve extract-place --env-file supabase/functions/.env.local
```

`db reset` is for this disposable local database only and clears its data. Do not run a reset against a linked/remote database. `supabase status` displays local API configuration; keep secret keys private. The project has no personal seeded data. `tests/database/rls.sql` wraps its two-user fixtures and 22 assertions in a rollback transaction.

`verify_jwt=false` in the gateway supports asymmetric Auth JWTs; this does **not** make extraction anonymous. The handler requires Bearer auth and verifies it via Auth `getUser` before a service-role RPC or download. Native/CLI clients are the MVP surface; no permissive CORS is enabled. [Supabase Auth guidance](https://supabase.com/docs/guides/functions/auth-legacy-jwt) describes the user verification flow.

## Remote setup (requires credentials; not performed automatically)

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set --env-file supabase/functions/.env.local
supabase functions deploy extract-place
```

Review SQL before remote push. Supabase supplies URL/service-role secrets. Select an available vision-capable Anthropic model in `AI_MODEL`; the function fails closed if provider/model/key is missing. No provider or model is silently substituted. Edge secrets stay server-side. There is no mock provider in production. The Phase 2 app uses authenticated matching and map adapters.

## Contract

POST `/functions/v1/extract-place`, Bearer user access token, JSON `{ "saved_item_id": "UUID" }`. First create the pending item with image_url as a private object path `user-id/item-id/filename`, then upload to `captures` (no upsert). Maximum 5 MiB; PNG/JPEG/WebP declared MIME must match signature. URLs/link-only items return image_required and remain pending for a screenshot/manual entry.

Success: `{ saved_item_id, cached, result: { place: { name, area, address, category, confidence } | null, reason: identified | ambiguous | no_place | unreadable } }`. Missing address/area is null. Null place results are cached and require manual entry or a new screenshot. Identified results still remain pending until user confirmation.

Failures use safe codes: 401 unauthorized; 400 invalid_request; 404 item_not_found; 409 extraction_in_progress/item_changed/item_not_pending; 415 json_required; 422 image_required/invalid_image; 429 rate_limited; 503 extraction_unavailable/temporarily_unavailable. Retry-After is conservative. Failures retain the item/image; no provider response text or image is logged. Request body is capped at 2 KiB, provider response at 64 KiB. No arbitrary URL fetch or screenshot execution.

## Phase 2 additions

The third migration adds atomic `confirm_place`, deletion fencing, matching quota, account image enumeration and expiring coordinates. Deploy/serve `match-place`, `place-map` and `delete-account` as well as `extract-place`. For local development use `supabase functions serve --env-file supabase/functions/.env.local`. Set GEOCODING_PROVIDER=google, GEOCODING_API_KEY and MAPS_STATIC_API_KEY in server secrets; enable Places API (New) and Maps Static API. Both adapters have fixed provider URLs, bounded responses and deadlines, no device-location upload and sanitized errors.

The confirmation RPC takes original user/AI name/area and a selected provider location. It atomically inserts a place and confirms its pending saved item; replays return the existing place. Coordinates expire after 29 days. Verify the hourly pg_cron cleanup is installed on the deployed project; if unavailable, schedule the service-only `expire_place_coordinates` RPC externally before release. Clients must treat expired coordinates as unavailable.

`delete-account` requires an authenticated request with `{ "confirmation": "DELETE" }`. It fences new capture/extraction/matching/confirmation work, removes private objects in batches and deletes Auth identity last (rows cascade). Storage failure leaves identity available for retry. Full deployed Auth/Storage deletion requires integration verification.

## Phase 3 additions

Apply migration 20261012000400_reminder_actions.sql and deploy `refresh-place` with the same server Google credentials. The client requests a place-ID refresh; the function authenticates, checks ownership/status, consumes quota and requests destination coordinates from Place Details (New). It never sends device location.

`record_reminder` is an authenticated RPC for durable notification/event synchronization. It checks place ownership/account availability, preserves the original sent_at/UUID, accepts only the four action values with consistent action_at, and retains the first explicit action across retries. Already been also changes the saved item to visited in that transaction. Direct client reminder inserts/updates are revoked, including column grants. Local tests exercise real SQL; the separate nine-assertion reminder pgTAP suite is included in CI but still needs Docker locally.

## Phase 4 retention and measurement

Apply `20261012000500_retention_measurement.sql`; deploy `track-events` and `weekly-digest` in addition to the existing five functions. Their `.env.example` entries keep PostHog and Expo tokens in server secrets. The digest endpoint accepts only DIGEST_CRON_SECRET, not a user's JWT; track-events verifies a user with Auth getUser, enforces opt-in/quota, and proxies only the allowlisted events. Missing credentials fail closed.

Enable Expo enhanced push security and configure FCM/APNs credentials with the EAS project. The mobile public EAS UUID selects that project; no privileged token belongs in the client. Configure Vault secrets named saved_done_project_url (the project's HTTPS API origin) and saved_done_digest_cron_secret (the same random 32-character-or-longer Edge scheduler secret). Review and run `supabase/schedules/weekly-digest.sql` in that project. It polls every ten minutes, sends at most one attempt per user/local week during Friday's 18:00 hour, and checks Expo receipts on later ticks. At-most-once attempts can miss pushes on ambiguous failure; successful receipts indicate provider handoff only. No scheduler has been installed by local tests.

The service-only `success_metric()` RPC reports eligible_users, successful_users, success_rate and target_met. Eligible users have completed seven days after their first backend save; only Navigate/Been there action_at within that window qualifies. First-save and success timestamps survive individual save deletion; deleted/deleting accounts are excluded. The authoritative SQL metric is independent of optional PostHog consent, and an empty cohort is not success. See docs/TESTING-PHASE-4.md for cutoff/cohort parameters, clock caveats and live verification.

Run `npm run db:test:retention` for dedicated real Postgres retention/consent/token/lease checks. It does not provision Cron/Vault, contact Expo/PostHog or prove device delivery.

## Phase 5 diagnostics

Apply migration 20261013000600_diagnostics_consent.sql and deploy report-error. Configure SENTRY_PROJECT_DSN and SENTRY_ENVIRONMENT server-side. It accepts only authenticated fixed diagnostic categories/version/UUID, enforces independent diagnostics_opt_in (default false), shares the bounded upload budget, and sends a minimal Sentry envelope with no user identity, raw error text, stack, screenshot or location. The mobile app must explicitly enable this preference; PostHog consent does not enable it. Missing secrets fail closed. Native fatal-crash monitoring, deployed alerts and provider retention remain release work. See docs/TESTING-PHASE-5.md.
