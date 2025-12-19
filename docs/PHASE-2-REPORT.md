# Phase 2 report

## Built

Email OTP sign-in with SecureStore sessions; durable pre-auth image/link capture and recovery; private uploads and server extraction; editable matching and map-pin confirmation; recent saved places and account deletion. The native share extension requires an Expo development build. No provider secrets enter the app.

## Verification

- Mobile: 14 tests passed (capture recovery, account separation, duplicate delivery, deletion tombstones, confirmation and entry screen).
- Edge: 22 tests passed, including matching, map authorization and retryable deletion.
- Database: 48 real local Postgres/PostGIS checks passed, including RLS, atomic confirmation, coordinate expiry and deletion fencing.
- Ten scripted extraction cases pass transport/schema checks; they do not measure vision accuracy.
- Android JavaScript export and native prebuild passed. The generated manifest contains image/text SEND filters and removes broad media/storage/audio permissions. Native compilation and device performance are unverified.
- Phase 2 device gate: **NOT ESTABLISHED**. Share-to-confirm under ten seconds requires a mid-range Android phone and live services. No phone, Android build toolchain or credentials are available here.

## Decisions and assumptions

The user chose local verification before credentials and subsequently requested the next phase; Phase 2 local implementation proceeded while the Phase 1 real-screenshot gate remained open. Email codes avoid a phone/SMS provider dependency. Links stay pending for manual name/area entry; no arbitrary link fetch. Google Places matching is behind a port. A server-rendered Google map avoids bundling privileged map credentials. Original image files remain private until upload and confirmation succeed; supported images over 5 MiB and unsupported formats are converted locally to JPEG, with the original retained. Backend uploads still enforce the cap and signature. Native conversion needs device verification.

Google coordinates expire after 29 days; a scheduled cleanup is installed when pg_cron exists. Phase 3 must refresh expired coordinates before geofence use. Provider names/addresses remain transient; confirmed names/areas come from the user/AI. Deleting an account immediately purges its local captures and writes a deletion tombstone; server cleanup can be retried if image deletion fails. Late writes cannot restore deleted local captures. Unbound captures remain available.

## Top three risks

1. Real share-extension/file-URI behavior, OTP delivery and the ten-second gate are unverified on hardware.
2. Full Supabase Auth/Storage integration and real vision accuracy await Docker/services and the 50 labeled screenshots.
3. Provider configuration, coordinate cleanup scheduling and dependency security findings require verification before release.

## Needed later

Configure Supabase public app identifiers and server-only vision/Places/Static Maps secrets locally; supply the labeled screenshots and an Android test device. Git commits also require a configured author identity; none was invented. Phase 3 and its two-phone field gate remain pending.
