# Privacy design (pre-release)

Planned storage: authentication identity, reminder preferences, private shared screenshots/link text, extracted place details/confidence, save/visit status, reminder timestamps/actions and push token. These support recovery across devices and the saved-place reminder flow. Images go to the selected vision provider through a server function; provider retention must be reviewed before beta.

Precise and continuous device location stays on-device. Always permission is requested only after a plain explanation; denial preserves manual use. Weekly proximity digests may use expiring nearby saved-place IDs, which imply coarse proximity and require disclosure. PostHog receives event names and opaque IDs, never screenshot contents or raw location; disable session replay by default.

Storage is private with per-user policies and short-lived signed access. Delete-account removes images, product rows and auth identity; analytics deletion and provider retention handling must be verified in release hardening. No production data collection exists in Phase 0. Retention duration, provider identities and contact details remain release decisions tracked in BACKLOG.

## Implemented in Phase 2

Unconfirmed images and link text are kept in the app's private documents directory with SQLite metadata and recovery journals, including before sign-in. Sessions are stored in SecureStore. Android system photo selection avoids broad photo-library access. Failed operations retain originals; after confirmed server acknowledgement local originals are removed. Oversized/unsupported images may be converted to JPEG locally before private upload.

Place-name/area queries and selected place coordinates go to Google through server adapters for matching and a static map preview; current device location is never sent. Preview images and candidate provider text remain transient. Coordinates expire after 29 days, while provider place IDs remain for later refresh. No analytics is active yet.

Account deletion purges account-bound local captures immediately, keeps a minimal opaque account-ID tombstone to prevent late writes, and retries server object/identity deletion on failure. Unbound captures are retained. Review device backups, Google attribution/caching, privacy-policy/terms URLs and provider retention before release.

## Phase 3 on-device data

A private SQLite cache holds saved destinations, selected geofence regions, bounded debug timestamps/event IDs and account-bound reminder action rows. Current location updates are used transiently to sort/select destinations; they are never uploaded or stored in debug events. Android background movement uses a visible foreground service. The user can pause reminders; denying background location leaves manual list/navigation available.

Notification taps are persisted locally before opening Maps, then sent to the owned reminder row with original event time and action time. Maps receives the destination only. Snooze/visit state is maintained offline for the active account. Sign-out clears coordinate/debug state and cancels native reminders while unsynced event rows remain account-bound; account deletion also purges those rows. Android backup is disabled. Device-native coordinate expiry during prolonged OS suspension and iOS backup behavior require release verification.

## Phase 4 optional collection

Analytics and weekly digest both default off. After explicit consent, PostHog receives only the eight funnel event names, opaque account/item/reminder UUIDs, timestamps and allowlisted enum/boolean properties. It has no person profile, session replay or autocapture. Tokens stay in Edge secrets. Local queues are capped at 1,000 events and 30 days, are account-bound, and clear on opt-out, sign-out or deletion. Opt-out is also enforced by the server; an already-submitted request may complete. Previously sent events remain subject to PostHog retention. Configure and verify provider retention/deletion before beta; no live PostHog data has been collected by this local build.

Enabling the Friday digest sends an Expo push token, installation UUID, time zone and a foreground-derived set of nearby saved-place IDs. These IDs imply coarse proximity. Device coordinates are not sent; the selection lasts six hours and the cleanup job removes expired IDs. Push tokens persist until disabled/sign-out/deletion or invalidated by provider receipts. The latest explicitly enabled phone receives one digest per local week. A digest opens the saved list; opening that aggregate message alone does not count as Navigate/Been there. Server reservation/delivery metadata stays on the user's row until the next attempt or account deletion. An in-flight push may arrive after disable/sign-out.

The user's first server save and earliest qualifying reminder action timestamp survive deletion of individual saves to keep the seven-day cohort stable. Account deletion removes both and its contribution. This operational metric applies to all retained users, independently of optional PostHog consent. Snooze notifications contain a saved-place name on the lock screen; users can control notification previews in OS settings. Timed snoozes are canceled on pause, sign-out, visit and deletion.

## Phase 5 diagnostics

Error reporting is a separate default-off preference. Consented signed-in clients can send a random event ID, app version and one of six fixed failure categories to an authenticated Edge function. It checks diagnostic consent/account availability and the shared upload budget, then sends a minimal Sentry envelope. Sentry receives no account identifier, screenshot, raw exception message, stack, breadcrumbs or device location. The server connection has an egress IP, which the provider may retain under its policy; review this before enabling it for users. Sign-out/deletion clears cached diagnostic consent; local deletion tombstones prevent late refresh re-enabling it. Reports are best effort, with no offline diagnostic queue. Previously received events follow provider retention. Native fatal crash capture and provider alerts remain unvalidated.
