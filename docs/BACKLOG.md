# Backlog

The user's fifty-day follow-up proposal is recorded in
[PR-WORK-BREAKDOWN.md](PR-WORK-BREAKDOWN.md). Its candidate work items must be
validated against the existing implementation before changes are made. No PRs or
daily schedule have been created; six real commits per branch remain a prerequisite.

## Required later-phase work

- P1 remaining gate: authenticated Supabase/Auth/Storage integration with real vision credentials, run the full-stack pgTAP suite, add 50 labeled real screenshots and establish at least 80% identification. Core migrations, local SQL isolation/quota checks, extraction/schema tests and ten scripted sample cases are complete.
- P2 implementation complete locally; remaining gate: live OTP/Auth/Storage, share extensions, native HEIC/large-image conversion, deletion and under-ten-second confirmation on Android. See PHASE-2-REPORT and TESTING-PHASE-2.
- P3 implemented locally: list/filter/near sort, selected-place map, swipe/buttons, configurable radius, nearest-20 geofences, background permissions, debug screen, notification actions and offline logging. Remaining gate: native builds and walk/drive on two phones; see PHASE-3-REPORT and TESTING-PHASE-3.
- P4 implemented locally: opted-in weekly digest, token lifecycle, six-hour nearby IDs, timed snooze, eight PostHog events and authoritative seven-day cohort query. See PHASE-4-REPORT and TESTING-PHASE-4. Live provider delivery, scheduler installation and physical snooze behavior remain unverified.
- P5 local hardening implemented: Sentry adapter for independently opted-in fixed JS failure categories, recoverable render boundary, onboarding, list virtualization/sort benchmark, source/dependency review, Play draft/checklist and explicit release evidence gate. See PHASE-5-REPORT. Release remains blocked by the evidence manifest. Native fatal crash capture, live monitoring/deletion, compatible dependency remediation, signed/device performance, owner resources and iOS checks remain required.

## Deferred beyond MVP

Products, price alerts, recipes, events, books/tasks, voice notes, calendar integration, friend sharing, payments/subscriptions/affiliate placement, B2B, web app, simultaneous iOS launch. Do not implement before the saved-place metric is proven.

- P5 dependency security: review the 59 current transitive audit findings (58 recorded at Phase 0) recorded in PHASE-0-REPORT; do not force an incompatible SDK downgrade.

- P5 verify remote coordinate cleanup cron and native-region expiry/retention when the OS never wakes the app. Phase 3 excludes expired destinations and provides server refresh; cross-device offline changes remain stale until refresh.
- P5 configure public privacy/terms URLs, provider retention and device-backup behavior before release.
- P5 configure and verify PostHog retention/deletion for opaque event identities, and account deletion against deployed Auth/Storage. Existing analytics opt-out clears local queues and blocks new ingestion; it does not erase already ingested provider events.
- P5 measure digest missed sends from at-most-once attempts, scheduled-task capacity in the one-hour window, timezone/clock behavior and Android Doze/reboot/iOS snooze reliability. Pending/unknown provider attempts must be observable before beta.

- P5 native monitoring: integrate and verify native fatal crash capture, source maps/symbolication and alerts through a privacy-reviewed adapter. Current Sentry integration covers recoverable render and selected handled JS failures only; no SDK credentials are bundled.
- P5 complete the external account-deletion resource and public privacy/support details under verified ownership. In-app deletion alone does not fulfill the store checklist.
