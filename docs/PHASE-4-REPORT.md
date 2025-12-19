# Phase 4 report

Date: 2026-10-13, Asia/Karachi. Local implementation complete; Phase 5 has not started.

## Summary

Built optional weekly Expo push digests, persistent 24-hour snooze re-delivery, all eight PostHog funnel events, consent controls, and an authoritative SQL success metric. Keys stay in Edge secrets. Four product tables remain, with retention/cohort metadata on users. Nearby digest IDs expire after six hours; continuous device location is never uploaded.

## Gate checks

- **Phase 4 gate passes locally:** the seven-day success metric is computable from reminder actions. SQL tests establish complete-window cohorts, action-time qualification for delayed offline replies, excluded snooze, the exact seven-day boundary, stable first-save/success timestamps after save deletion, and removed contribution on account deletion. Real adoption at or above 15% is **not established**.
- Mobile: 42 Jest/RNTL tests pass, including event validation, queue retry/acknowledgement, nearby digest selection, snooze scheduling recovery and cancellation, and extraction observation failures that cannot break a save.
- Edge: 33 Deno tests pass, including authenticated consent/quota, strict property rejection, sanitized provider errors, scheduler authentication, recipient recheck, receipts and ambiguous delivery handling.
- Embedded Postgres/PostGIS: 62 baseline checks plus 36 retention checks pass, with unchanged product migrations and minimal managed Auth/Storage schema equivalents.
- Lint, strict types, Edge checks/lint, formatting and ten scripted extraction fixtures pass. Fixtures do not measure vision accuracy.
- Android prebuild and JavaScript export pass (962 modules, approximately 3.3 MB bundle at verification). This does not establish native compilation or device behavior. Full Supabase/Docker, live PostHog, Expo push, installed Cron/Vault and physical snooze delivery remain unverified.

## Decisions and assumptions

The user's Continue request resumes Phase 4 with the established local-first preference. Earlier physical gates remain deferred, not passed. Use Friday 18:00 in the installation's IANA time zone, a 5 km digest radius, and six-hour foreground proximity freshness. Both analytics and digest default off. A single explicitly enabled installation owns the push recipient; automatic refresh cannot take over another phone.

PostHog's server HTTP adapter uses the verified account ID and the eight allowlisted events, without person profiles, autocapture or session replay. Its consented funnel is separate from the operational SQL metric. Event queues are capped at 1,000 events/30 days, use stable retry UUIDs and do not hold local locks during network uploads. The SQL denominator is retained users with a completed seven-day period from their first backend save, including pending saves. Both Navigate and Been there count; Snooze and ignored do not. Its [start, end) window deliberately excludes the exact seven-day boundary.

Snooze is a time-based reminder 24 hours after the tap, with a child UUID persisted before scheduling. It does not assert current proximity. Future or canceled rows cannot count as sent. Pause, visit, delete and sign-out cancel pending snoozes. Recovery repeats the original scheduling ID. Weekly send attempts are reserved before external delivery and not retried after ambiguous failures. Receipts report provider handoff, not device visibility. Digest body taps open the saved list and alone do not qualify as a reminder navigation/visit.

No dependencies were added for Phase 4. Git commits still await configured author identity; none was invented. No remote deployment, scheduler installation, paid build or provider request was made. See ADR 009 and TESTING-PHASE-4 for setup and validation.

## Top three risks

1. Actual push and snooze behavior under Doze, reboot and iOS suspension needs development builds and physical device evidence; earlier two-phone geofence and ten-second confirmation gates remain open.
2. At-most-once push attempts can miss a week on ambiguous provider failure. Device-clock errors, unsynced actions and account deletion affect metric coverage. Operational visibility and performance remain Phase 5 work.
3. Provider retention/deletion, Cron/Vault deployment, full Auth/Storage integration and the previously recorded 59 dependency audit findings require release hardening. Opt-out stops new analytics and clears queues but does not erase prior PostHog events.

## Needed later

Nothing is needed to finish this local phase. For live gates, configure service secrets locally, provision EAS/FCM/APNs and Vault/Cron, and test on physical phones. The 50 labeled real screenshots are still needed for the vision gate. Do not post API keys in chat. Stop here at the Phase 4 boundary.
