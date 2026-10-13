# Phase 1 gate report

Date: 2026-10-12 (Asia/Karachi).

## Summary

Implemented authenticated `extract-place`, private capture storage, four-table RLS migrations and durable per-user quotas/idempotency leases. Added strict AI schema validation, a server-only Anthropic vision adapter, ten synthetic screenshots/labels, a live endpoint harness and credential-free scripted mode. No mobile product UI was added. Local checks pass; the real AI gate is **not passed**.

## Gate checks

- `npm run check:all`: PASS locally after fixing the Windows Deno wrapper. ESLint, strict mobile TypeScript, Jest boot test, formatting, Deno type check and lint all pass.
- Deno: 15 tests PASS for schema/image/request validation, auth/ownership rejection, cached replay, concurrent requests, per-user quota, provider failures and retries, stale writes, cleanup, provider payload/truncation and scoring.
- Embedded Postgres/PostGIS: 29 checks PASS. Unmodified migrations execute; A cannot read B's profiles/items/places/reminders/images or write into B's item/image namespace. AI cache, identity, first-save time and quota are protected from client mutation. SQL quota reset, lease expiry, replacement fencing and geospatial generation/index are checked.
- Scripted evaluation: 10/10 PASS; seven positive and three abstention cases. This is a deterministic handler/adapter contract check. It does not measure pixel understanding or vision accuracy.
- Full Supabase pgTAP/Auth/Storage HTTP integration: NOT RUN; Docker is unavailable. A 22-assertion transactional pgTAP suite and CI job are supplied, but remote CI was not executed here.
- Live vision evaluation and >=80% real-set identification: NOT RUN; credentials and real screenshots were intentionally deferred by the user. Real gate output is `NOT_ESTABLISHED`. Do not begin Phase 2 yet.

## Decisions and assumptions

- Start with Anthropic because the brief names Claude. AI_PROVIDER, AI_MODEL and AI_API_KEY are required server secrets; no default model or production mock. A provider swap implements the same extraction port.
- Default quota: 20 uncached attempted extractions/hour/user; failures consume attempts, cached replays do not. Admin-only per-user limit can be raised to 100 for a disposable 50-case eval account and restored afterward.
- Cache validated extraction JSON on saved_items, never auto-confirm. No-place/ambiguous/unreadable outcomes are cached; a new screenshot/new item or manual entry is the recovery path. AI failure leaves the pending item and private image intact.
- Keep exactly four product tables, with server-controlled quota fields on users and lease fields on saved_items. Transactions lock user then item. A 25-second provider deadline fits within a 90-second fenced lease; crashes may repeat a provider call after expiry but cannot produce stale successful writes.
- Supabase gateway JWT verification is disabled for asymmetric-key compatibility; the handler verifies Bearer tokens with Auth getUser before any privileged work. No browser CORS surface in the mobile-only MVP.
- Images capped at 5 MiB, types PNG/JPEG/WebP verified by signature plus MIME. Request body capped at 2 KiB and provider response at 64 KiB. Private object paths only; no arbitrary URL fetching.
- Eval accepts exact Unicode-aware normalized name aliases and labeled area matches; wrong branches/areas fail. Category and abstentions reported separately. Real gate requires at least 50 cases, at least 40 positives, >=80% positive and overall correctness, no transport/cleanup failures. This prevents an easy negative-heavy set from claiming the place-identification gate.

## Failure patterns and prompt changes

No real provider failures or accuracy patterns were measured. Tests exercise malformed output, hallucinated schema fields, category/confidence errors, wrong ownership, over-cap/spoofed MIME, provider failures, concurrent retries, ambiguous/no-place abstentions and exact scoring of wrong area/name. Prompt `places-v1` explicitly treats screenshot text as untrusted, abstains on equal candidates or unreadable content and prohibits invented addresses/areas. There are no evidence-based prompt revisions yet. Real evaluation must group errors and compare any revised prompt on a held-out set.

## Top three risks

1. No measured real-image accuracy, latency, provider refusal or multilingual behavior. Ten scripted fixtures cannot predict the 80% result.
2. Managed Supabase Auth/Storage integration and production JWT/key behavior still need full-stack testing; embedded SQL proves policies but not HTTP services. CI is configured, not remotely observed.
3. Dependency advisories remain (npm install reports 59, 12 moderate/47 high). Release security review remains open; do not force the suggested incompatible Expo downgrade. Provider privacy/retention and log controls also need review before real data.

## Needed to finish the phase gate

Later: a Supabase test project or running Docker stack, vision model/key configured in server secrets, and 50 consented labeled screenshots (mostly positive places). See eval/README.md for the one-command live harness. Do not paste API keys into chat or commit them. Git author name/email is still missing, so no commits were fabricated; files are preserved for review. No cloud resources were created or deployed.
