# Phase 4 verification

Run `npm run check:all` without credentials. This includes app lint/types/Jest, Edge checks/lint/Deno tests, unchanged migrations in PGlite/PostGIS, the retention-specific SQL suite, and scripted extraction fixtures. Scripted extraction is not vision accuracy. `npm run db:test:retention` independently tests an empty cohort, complete windows, delayed action time, excluded snooze, the exact seven-day boundary, delete-save persistence, deleted-account exclusion, consent/quotas, permissions, nearby ID ownership/freshness, token ownership and rotation, weekly reservation and receipts. Full Supabase Auth/Storage/pgTAP still requires Docker.

For a configured disposable development project:

1. Apply all five migrations and deploy all seven Edge functions. Configure server PostHog and Expo secrets. Set the public EAS project UUID in the app and rebuild; configure FCM/APNs credentials and enhanced Expo push security. Keep secrets out of the client and repository.
2. In Account and privacy, enable optional measurement. Save a screenshot, correct a match, and exercise each reminder action. Verify only the eight events, opaque IDs, enums and booleans in PostHog. Disable consent and verify queued events clear and Edge discards stale batches. Retry with an offline capture/action and inspect UUID deduplication.
3. Snooze a reminder, inspect the scheduled DATE trigger and due time, restart the app and verify there is only one child notification. Use a shortened delay only in an isolated test build, or wait 24 hours. Test denied notifications, Android Doze/reboot, iOS suspension, offline actions, pause, sign-out, visit and deletion. Confirm canceled/future rows never upload as sent.
4. Enable weekly digest and foreground location after reading its proximity disclosure. Verify IDs only, no device lat/lng, and an expiry six hours ahead. Re-enable on a second phone: it becomes the sole recipient; the first phone's automatic refresh/sign-out cannot replace/disable it. Verify timezone and token rotation.
5. Configure Vault secrets and review/install `supabase/schedules/weekly-digest.sql`. Verify the job runs every ten minutes. During Friday's 18:00–18:59 local window, verify one push per user with a fresh nonempty selection. Expired/visited/foreign selections must not send. Receipt failures must not block unrelated sends; DeviceNotRegistered must clear only the original recipient token. A 200 receipt proves provider handoff, not visibility.

The service-only metric query is:

```sql
select * from public.success_metric();
-- Optional reporting cutoff and first-save cohort, inclusive start/exclusive end:
select * from public.success_metric(
  '2026-11-01T00:00:00Z',
  '2026-10-01T00:00:00Z',
  '2026-10-25T00:00:00Z'
);
```

The current query incorporates late replies that have already synchronized; it is not an ingestion-time historical snapshot. A reproducible report requires saving its cutoff and result. first_saved_at is the first backend insertion, not an offline pre-auth capture's device time. Offline actions lost before sync cannot contribute. Record physical test evidence separately; all live delivery and performance checks remain open until actually performed.
