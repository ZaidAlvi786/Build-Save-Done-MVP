# Phase 3 report

## Summary

Built saved-place category filters, near-me sorting, map toggle with selected-place preview, swipe/accessible delete and visited actions, configurable nearby reminders, nearest-20 geofences, local notification actions and persistent debug history. Reminder interactions are queued on-device and synced through an ownership-checked transaction. A Place Details adapter refreshes expired destination coordinates. Weekly digest and PostHog remain Phase 4 work.

## Gate checks

- Lint, strict TypeScript and formatting: pass.
- Mobile: 33 tests pass, including nearest-N selection, expiry/visited exclusion, deterministic ties, action retries and native adapter permission/event flows.
- Edge: 24 Deno tests pass, including coordinate refresh ownership/quota, request scope and sanitized provider failure.
- Real embedded Postgres/PostGIS: 62 checks pass, including cross-user rejection, direct action-write denial, one row across retries, first-action preservation and atomic visited status.
- Android native prebuild and JavaScript export: pass. Generated configuration includes background/foreground location and the foreground service, and disables Android backup. Notification permission comes from the notification module manifest.
- Full Supabase pgTAP coverage includes nine additional reminder assertions, but Docker execution remains unverified locally. Native Android compilation and iOS compilation are unverified.
- **Physical gate NOT ESTABLISHED:** no real walk/drive on two phones was performed. See TESTING-PHASE-3.md. Earlier live vision and ten-second confirmation gates remain open.

## Decisions and assumptions

The user explicitly requested Phase 3 after the Phase 2 report and retained the preference for local verification before credentials. This authorizes implementation with the earlier physical gates deferred; it does not establish those gates.

Use at most 20 nearest confirmed, unvisited places on both platforms. Default radius is 300m, editable from 100–2000m. Foreground and background location are requested only after the in-app explanation and Enable action. Background movement updates are filtered by roughly 1km and five-minute intervals; these are OS hints, not guaranteed timing or Apple's dedicated significant-change API. Android uses a visible foreground service. Device position is used transiently to select regions and is never uploaded or saved in debug history.

Notifications contain Navigate, Snooze and Already been; all open the foreground for consistent Android/iOS handling. Body taps offer the same actions. A stable reminder ID and original timestamp support offline sync; the first explicit action wins on retries. Already been also marks the saved item visited atomically. Snooze suppresses repeat entries for 24 hours; normal cooldown is 12 hours. Timed snooze re-delivery and the weekly digest remain Phase 4. A scheduled notification is counted as sent; OS display is not guaranteed, so device evidence is required.

The map toggle uses a selectable destination's server-rendered Google map, preserving attribution. It does not add a native interactive all-pins map or expose a secret. Expired coordinates cannot be selected, mapped or navigated until refreshed via the server. Coordinate caches/regions are pruned on foreground, movement and geofence task execution. Exact wall-clock purge while an OS never wakes the app cannot be guaranteed and must be resolved/validated before release.

Pause stops native tasks and notifications but keeps the saved-list cache. Sign-out clears coordinate state/debug history and stops tasks; unsynced actions remain account-bound for the next sign-in. Account deletion also erases local reminder events. Local action state prevents visited places from returning to the active selection before sync. Delete-place removes its private image before deleting the saved row; a network failure is surfaced for retry.

## Top three risks

1. OS suspension, battery restrictions, approximate location and background permissions: actual reminder latency/reliability need two-phone field evidence.
2. Credentials and Docker are still absent: deployed Auth/Storage, Places refresh, native SQLite/task persistence and end-to-end action synchronization remain unverified.
3. Provider coordinate retention on a suspended device, cross-device changes and the 59 dependency audit findings need release hardening. Cached reminders cannot instantly learn changes made on another device while offline.

## Needed later

Configure service secrets locally, provide two physical phones with development builds, and run the field protocol. A mid-range Android phone is also needed for the previous ten-second gate. No credentials were requested in chat. Git commits await configured author name/email; no identity was invented. Phase 4 has not started.
