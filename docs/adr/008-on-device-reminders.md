# ADR 008: On-device trigger and durable reminder actions

Status: accepted for Phase 3 local implementation; field gate pending.

Add only expo-location, expo-task-manager and expo-notifications in their Expo SDK 57 compatible versions. They implement the fixed stack's native location, headless tasks and local notification APIs. Task definitions load at module scope from index.ts. No map/gesture dependency is added: Google server previews reuse Phase 2, and React Native PanResponder offers swipes with accessible button alternatives.

The pure selector excludes visited/expired/null coordinates, deduplicates place IDs, sorts by Haversine distance with stable tie breaking and caps regions at 20. Use the same bound on Android/iOS. Reconcile on app foreground, mutations and coarse background movement updates. Expo's distance/time filters are used as movement hints; these do not guarantee exact frequency or provide a dedicated significant-change listener. Android displays a foreground-service notification. Foreground/background and notification permission requests follow the user's explicit Enable action and explanation.

SQLite holds account-bound destination snapshots, expected regions, bounded debug events and reminder outbox rows. Position updates are never persisted/uploaded. Persist an event UUID before scheduling; reuse it if acknowledgement is interrupted. Persist interaction before navigation; server RPC retries use the same ID. A conditional acknowledgement does not clear a newer action written while a sent-row upload is in flight. Already-been state is applied locally and atomically on the server. First explicit action wins; a later reminder has a new ID. Snooze is a 24-hour entry suppression in Phase 3, with timed re-delivery deferred to Phase 4.

Privileged coordinate refresh checks ownership and matching quota before calling the fixed Google Place Details endpoint, requests only destination location and writes a fresh expiry. Device caches purge expired coordinates at task/foreground opportunities. OS-native regions may remain dormant until a wake opportunity; verify provider retention and practical expiry behavior before release. Cross-device mutations are learned on refresh, not instantly while offline.

Stop tasks/notifications on pause and sign-out; clear coordinate/debug data on sign-out and purge local reminder events on account deletion. Keep unsynced actions account-bound across sign-out so reconnecting can preserve the metric.

References: [Expo Location SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [Expo notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [Google Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details).
