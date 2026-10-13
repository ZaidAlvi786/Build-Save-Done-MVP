# Fifty-day saved-places work breakdown

Prepared October 14, 2026. This is a proposal for future work, not completed
development history. It contains 50 context-named branches and 300 candidate
work items. Existing implemented features are to be verified and improved where
evidence warrants a change; they must not be recreated just to increase commits.

The historical labels span November 1–December 20, 2025. Actual publication dates
are unset. No scheduler, branches, commits, pushes, or PRs have been created by
this plan. GitHub creation dates cannot be backdated.

## Execution rules

- Establish the current uncommitted app implementation as a reviewed baseline
  before starting follow-up branches. Preserve existing remote history and secrets.
- Start each branch from updated main after its dependencies are integrated.
  The order is a suggested sequence, not a promise that every item fits one day.
- Investigate before changing behavior. Fix only demonstrated gaps; record passing
  evidence without unnecessary implementation or tests.
- The six listed items are candidate work packages, not automatic commit messages.
  Commit coherent real changes, with meaningful messages and validation. A report
  alone does not justify splitting it into multiple artificial commits.
- Open a draft PR only when at least six distinct substantive commits exist, the
  branch passes appropriate checks, and its secret review is complete. If fewer
  changes are justified, leave that PR pending and revise the scope with the user.
- Credentials, phones, owner decisions, provider setup, and native toolchains are
  prerequisites for the corresponding items. Do not fabricate evidence or promote
  release gates merely to meet a daily quota. Deployment/publication remain separate
  actions subject to the user's authorization and actual service costs.
- Keep scope to the Android saved-places MVP. No social, payments, products,
  recipe, calendar, or web feature expansion is included.

## Plan formats

pr-work-plan.json is the editable planning inventory. Its empty commit arrays
intentionally prevent publication. Once all source commits actually exist, prepare
the execution plan.json described in PR-QUEUE.md with each PR body and source SHAs.
The queue runner publishes one selected entry per call; it does not run by itself.
Use genuine current commit dates by default. Historical labels remain planning
metadata. A future actual start date is required before daily scheduling.

## Branches and candidate work

### Day 1: work/android-local-toolchain

Historical label: 2025-11-01; status: planned; actual commits: 0.

1. Discover bundled Studio Java.
2. Discover SDK platform-tools.
3. Report SDK 36 availability.
4. Detect connected test devices.
5. Separate optional EAS checks.
6. Document verified local build.

### Day 2: work/android-development-build

Historical label: 2025-11-02; status: planned; actual commits: 0.

1. Reproduce native build from clean checkout.
2. Resolve confirmed Gradle failures.
3. Verify native plugin manifest.
4. Exercise emulator launch.
5. Exercise USB device launch.
6. Record reproducible build evidence.

### Day 3: work/supabase-development-environment

Historical label: 2025-11-03; status: planned; actual commits: 0.

1. Define disposable project setup.
2. Validate all migrations on full PostgreSQL.
3. Verify email token template.
4. Configure private capture bucket.
5. Verify authenticated Edge routes.
6. Record clean environment teardown.

### Day 4: work/qwen-live-extraction

Historical label: 2025-11-04; status: planned; actual commits: 0.

1. Verify region-specific configuration.
2. Evaluate screenshot request compatibility.
3. Measure complete response handling.
4. Exercise quota and timeout recovery.
5. Compare real labeled extraction results.
6. Record provider retention and cost limits.

### Day 5: work/google-places-live-matching

Historical label: 2025-11-05; status: planned; actual commits: 0.

1. Verify Places New field masks.
2. Exercise ambiguous destination candidates.
3. Check explicit branch selection.
4. Handle zero-result responses.
5. Validate coordinate TTL on real responses.
6. Record provider errors and billing setup.

### Day 6: work/google-static-map-validation

Historical label: 2025-11-06; status: planned; actual commits: 0.

1. Verify server-side map key restriction.
2. Validate marker and viewport behavior.
3. Exercise preview response size bounds.
4. Handle missing preview gracefully.
5. Verify Google attribution visibility.
6. Record signed-device map behavior.

### Day 7: work/capture-share-delivery

Historical label: 2025-11-07; status: planned; actual commits: 0.

1. Exercise Android image shares.
2. Exercise text and URL shares.
3. Verify cold-launch intent persistence.
4. Verify warm-launch duplicate handling.
5. Handle unsupported share types.
6. Measure share-to-local-save latency.

### Day 8: work/capture-image-normalization

Historical label: 2025-11-08; status: planned; actual commits: 0.

1. Exercise real HEIC conversion.
2. Measure large JPEG downsampling.
3. Verify rotated-image orientation.
4. Exercise oversized image fallback.
5. Verify WebP upload compatibility.
6. Record native conversion memory usage.

### Day 9: work/capture-crash-recovery

Historical label: 2025-11-09; status: planned; actual commits: 0.

1. Interrupt capture copy safely.
2. Exercise journal recovery after termination.
3. Verify hash acknowledgement after upload.
4. Exercise partial upload retries.
5. Recover corrupted capture metadata.
6. Verify account tombstone write fencing.

### Day 10: work/email-otp-device-flow

Historical label: 2025-11-10; status: planned; actual commits: 0.

1. Exercise real six-digit OTP.
2. Handle expired-code retry.
3. Handle rate-limited email requests.
4. Exercise interrupted session persistence.
5. Verify foreground token renewal.
6. Record sign-out and reauthentication flow.

### Day 11: work/secure-session-hardening

Historical label: 2025-11-11; status: planned; actual commits: 0.

1. Verify chunked token writes on device.
2. Exercise partial secure-store failures.
3. Validate session removal on sign-out.
4. Verify device-only storage policy.
5. Exercise token rotation races.
6. Inspect backup exclusion evidence.

### Day 12: work/place-confirmation-recovery

Historical label: 2025-11-12; status: planned; actual commits: 0.

1. Exercise edited identity confirmation.
2. Verify explicit address acknowledgement.
3. Exercise simultaneous confirmations.
4. Handle quota-limited confirmation.
5. Recover network loss after server commit.
6. Verify stable saved-item identity.

### Day 13: work/saved-list-accessibility

Historical label: 2025-11-13; status: planned; actual commits: 0.

1. Audit TalkBack reading order.
2. Validate large-font place rows.
3. Improve inaccessible filter controls if found.
4. Verify accessible swipe alternatives.
5. Validate selected-place focus behavior.
6. Record screen-reader device evidence.

### Day 14: work/saved-list-device-performance

Historical label: 2025-11-14; status: planned; actual commits: 0.

1. Capture release-build list baseline.
2. Profile expensive render paths.
3. Reduce measured avoidable row updates.
4. Measure scrolling frame stalls.
5. Measure memory with 1000 places.
6. Record before-and-after device traces.

### Day 15: work/nearby-distance-behavior

Historical label: 2025-11-15; status: planned; actual commits: 0.

1. Validate location-denied ordering.
2. Exercise equal-distance stable ordering.
3. Check edge coordinates and antimeridian.
4. Verify missing-coordinate placement.
5. Exercise location-refresh race handling.
6. Record distance presentation accuracy.

### Day 16: work/maps-navigation-actions

Historical label: 2025-11-16; status: planned; actual commits: 0.

1. Exercise Google Maps app intent.
2. Exercise browser fallback when Maps absent.
3. Verify encoded destination names.
4. Handle stale destination coordinates.
5. Verify action logging before external launch.
6. Record return-from-Maps recovery.

### Day 17: work/foreground-location-permissions

Historical label: 2025-11-17; status: planned; actual commits: 0.

1. Exercise first permission request.
2. Exercise precise-location denial.
3. Exercise permanently denied recovery.
4. Verify explanation before permission dialog.
5. Validate permission revocation while active.
6. Record foreground permission matrix.

### Day 18: work/background-location-permissions

Historical label: 2025-11-18; status: planned; actual commits: 0.

1. Exercise Android Always permission flow.
2. Validate Settings return handling.
3. Exercise background permission revocation.
4. Verify foreground-service disclosure.
5. Handle unsupported permission states.
6. Record two-phone permission evidence.

### Day 19: work/geofence-registration-capacity

Historical label: 2025-11-19; status: planned; actual commits: 0.

1. Exercise nearest-20 selection on device.
2. Verify deterministic region replacement.
3. Handle native registration failure.
4. Reconcile app and OS region lists.
5. Validate region removal after visiting.
6. Record region-limit behavior.

### Day 20: work/geofence-cooldown-behavior

Historical label: 2025-11-20; status: planned; actual commits: 0.

1. Exercise repeated boundary entry.
2. Verify 12-hour cooldown persistence.
3. Exercise wall-clock changes.
4. Handle duplicate native callbacks.
5. Verify paused reminders never notify.
6. Record walk-and-drive traces.

### Day 21: work/geofence-background-reliability

Historical label: 2025-11-21; status: planned; actual commits: 0.

1. Exercise screen-off delivery.
2. Exercise Doze delivery delay.
3. Exercise app process termination.
4. Verify battery-optimization recovery guidance.
5. Exercise background task exceptions.
6. Record two-manufacturer delivery evidence.

### Day 22: work/notification-action-routing

Historical label: 2025-11-22; status: planned; actual commits: 0.

1. Exercise Navigate button from locked screen.
2. Exercise Been button from killed app.
3. Exercise Snooze button from foreground.
4. Verify notification body opens saved list.
5. Handle repeated response callbacks.
6. Record Android action routing matrix.

### Day 23: work/notification-snooze-recovery

Historical label: 2025-11-23; status: planned; actual commits: 0.

1. Verify 24-hour alarm calculation.
2. Exercise scheduling failure retry.
3. Exercise child notification resnooze.
4. Verify cancellation after place visit.
5. Verify cancellation after account switch.
6. Record device alarm delivery evidence.

### Day 24: work/reminder-offline-outbox

Historical label: 2025-11-24; status: planned; actual commits: 0.

1. Exercise prolonged offline action queue.
2. Handle reconnect after server acknowledgement.
3. Verify conflicting action precedence.
4. Exercise sync failure without queue loss.
5. Verify account-scoped outbox isolation.
6. Record remote reminder reconciliation.

### Day 25: work/reminder-reboot-recovery

Historical label: 2025-11-25; status: planned; actual commits: 0.

1. Inventory OS state after reboot.
2. Reconcile stale scheduled notification IDs.
3. Exercise reboot before snooze deadline.
4. Verify registration after foreground launch.
5. Handle missing native task support.
6. Document measured reboot limitations.

### Day 26: work/coordinate-expiry-lifecycle

Historical label: 2025-11-26; status: planned; actual commits: 0.

1. Exercise 29-day destination expiry.
2. Verify server coordinate refresh ownership.
3. Verify stale region removal on wake.
4. Exercise cleanup when app stays suspended.
5. Handle provider refresh outage.
6. Record deployed expiry cleanup evidence.

### Day 27: work/cross-device-place-reconciliation

Historical label: 2025-11-27; status: planned; actual commits: 0.

1. Exercise second-device place deletion.
2. Exercise second-device visit action.
3. Reconcile stale local region selection.
4. Handle refresh interrupted by sign-out.
5. Prevent deleted-place resurrection.
6. Record two-device offline scenarios.

### Day 28: work/analytics-consent-validation

Historical label: 2025-11-28; status: planned; actual commits: 0.

1. Verify default opt-out on fresh install.
2. Exercise remote opt-out during flush.
3. Verify consent isolation by account.
4. Validate all eight event allowlists.
5. Exercise quota rejection without loss.
6. Inspect real PostHog payload evidence.

### Day 29: work/analytics-provider-retention

Historical label: 2025-11-29; status: planned; actual commits: 0.

1. Define opaque-identity retention policy.
2. Exercise provider deletion workflow.
3. Verify retention configuration in test project.
4. Handle deletion retry observability.
5. Verify no screenshot or GPS ingestion.
6. Record consent and deletion evidence.

### Day 30: work/digest-push-credentials

Historical label: 2025-11-30; status: planned; actual commits: 0.

1. Validate EAS public project identifier.
2. Configure test FCM push credentials.
3. Exercise token acquisition on physical phone.
4. Verify enhanced Expo push authentication.
5. Exercise invalid-token cleanup.
6. Record end-to-end push receipt evidence.

### Day 31: work/digest-token-device-races

Historical label: 2025-12-01; status: planned; actual commits: 0.

1. Exercise last-device consent takeover.
2. Exercise old-device token refresh rejection.
3. Verify disable affects matching installation.
4. Exercise token rotation during send.
5. Verify account deletion fences delivery.
6. Record concurrent device traces.

### Day 32: work/digest-weekly-scheduler

Historical label: 2025-12-02; status: planned; actual commits: 0.

1. Install reviewed test-project Vault entries.
2. Validate pg_cron and pg_net access.
3. Exercise Friday local-time claim.
4. Verify one reservation per week.
5. Exercise scheduler outage recovery limits.
6. Record scheduled invocation evidence.

### Day 33: work/digest-timezone-boundaries

Historical label: 2025-12-03; status: planned; actual commits: 0.

1. Exercise Pakistan local Friday window.
2. Exercise daylight-saving transition zones.
3. Exercise timezone preference changes.
4. Exercise stale nearby snapshot rejection.
5. Verify empty-nearby digest suppression.
6. Record timestamp boundary results.

### Day 34: work/digest-delivery-observability

Historical label: 2025-12-04; status: planned; actual commits: 0.

1. Distinguish accepted from visible push.
2. Exercise unknown provider send outcome.
3. Exercise delayed receipt polling.
4. Surface invalid-token outcomes safely.
5. Measure missed at-most-once attempts.
6. Record delivery operational runbook.

### Day 35: work/success-metric-live-validation

Historical label: 2025-12-05; status: planned; actual commits: 0.

1. Create disposable seven-day cohorts.
2. Verify reminder success window boundaries.
3. Verify individual deletion keeps milestone.
4. Verify account deletion removes cohort member.
5. Compare SQL metric with fixture counts.
6. Record live metric and target interpretation.

### Day 36: work/native-crash-consent-design

Historical label: 2025-12-06; status: planned; actual commits: 0.

1. Define minimal native diagnostics payload.
2. Evaluate consent before SDK initialization.
3. Specify native offline-cache deletion.
4. Review provider metadata exposure.
5. Define release and environment mapping.
6. Record privacy-reviewed integration decision.

### Day 37: work/native-crash-capture

Historical label: 2025-12-07; status: planned; actual commits: 0.

1. Integrate chosen native monitor in test build.
2. Capture deliberate native fatal failure.
3. Verify opt-out blocks new reports.
4. Verify sign-out clears queued reports.
5. Verify deletion clears local diagnostic state.
6. Record native crash capture evidence.

### Day 38: work/native-symbolication-alerts

Historical label: 2025-12-08; status: planned; actual commits: 0.

1. Configure protected symbol upload workflow.
2. Verify native stack symbolication.
3. Verify JavaScript release matching.
4. Exercise diagnostic grouping stability.
5. Verify test alert delivery.
6. Record monitoring ownership runbook.

### Day 39: work/deployed-rls-isolation

Historical label: 2025-12-09; status: planned; actual commits: 0.

1. Exercise two-user profile isolation.
2. Exercise two-user saved-item isolation.
3. Exercise two-user place isolation.
4. Exercise two-user reminder isolation.
5. Verify service-only RPC denial.
6. Record deployed RLS security evidence.

### Day 40: work/private-storage-isolation

Historical label: 2025-12-10; status: planned; actual commits: 0.

1. Exercise unauthorized capture downloads.
2. Exercise unauthorized capture uploads.
3. Verify immutable object overwrite rejection.
4. Verify MIME and size restriction.
5. Verify capture ownership path checks.
6. Record deployed storage security evidence.

### Day 41: work/account-deletion-failure-recovery

Historical label: 2025-12-11; status: planned; actual commits: 0.

1. Interrupt deletion during object removal.
2. Verify Auth identity remains retryable.
3. Exercise late extraction during deletion.
4. Verify complete database cascade.
5. Verify second account remains intact.
6. Record deployed deletion retry evidence.

### Day 42: work/local-data-deletion-audit

Historical label: 2025-12-12; status: planned; actual commits: 0.

1. Inspect capture file removal on deletion.
2. Inspect reminder SQLite purge.
3. Inspect analytics SQLite purge.
4. Inspect secure session purge.
5. Verify tombstone prevents delayed writes.
6. Record filesystem and backup evidence.

### Day 43: work/dependency-security-remediation

Historical label: 2025-12-13; status: planned; actual commits: 0.

1. Refresh authoritative dependency findings.
2. Map affected runtime versus build paths.
3. Evaluate compatible maintained fixes.
4. Implement validated fixes where available.
5. Run SDK and native regression checks.
6. Record unresolved advisory decisions.

### Day 44: work/signed-android-bundle-audit

Historical label: 2025-12-14; status: planned; actual commits: 0.

1. Inspect release manifest permissions.
2. Inspect bundled public environment values.
3. Verify privileged keys absent from bundle.
4. Verify screenshot data absent from logs.
5. Inspect network endpoint inventory.
6. Record signed artifact audit evidence.

### Day 45: work/android-cold-start-performance

Historical label: 2025-12-15; status: planned; actual commits: 0.

1. Measure ten release cold launches.
2. Measure offline first-screen readiness.
3. Profile startup work on device.
4. Reduce measured startup bottlenecks.
5. Repeat on second physical phone.
6. Record median and p95 launch evidence.

### Day 46: work/android-share-confirm-performance

Historical label: 2025-12-16; status: planned; actual commits: 0.

1. Measure screenshot-to-confirm baseline.
2. Profile conversion and upload latency.
3. Profile extraction and matching latency.
4. Improve measured redundant work.
5. Exercise slow-network recovery usability.
6. Record ten-second gate evidence.

### Day 47: work/beta-regression-matrix

Historical label: 2025-12-17; status: planned; actual commits: 0.

1. Verify fresh-install onboarding.
2. Verify upgrade retains captures.
3. Verify offline manual-place path.
4. Verify auth and account-switch regression.
5. Verify background reminder regression.
6. Record reproducible beta test matrix.

### Day 48: work/privacy-and-deletion-resources

Historical label: 2025-12-18; status: planned; actual commits: 0.

1. Draft actual collected-data inventory.
2. Verify provider retention disclosures.
3. Prepare owner-approved privacy content.
4. Prepare external deletion request resource.
5. Validate support and contact details.
6. Record owner review and resource links.

### Day 49: work/play-store-submission-evidence

Historical label: 2025-12-19; status: planned; actual commits: 0.

1. Prepare real-device store screenshots.
2. Validate listing claims against app.
3. Prepare background-location explanation video.
4. Prepare foreground-service justification.
5. Complete owner-reviewed Data Safety answers.
6. Record internal-testing submission checklist.

### Day 50: work/release-evidence-reconciliation

Historical label: 2025-12-20; status: planned; actual commits: 0.

1. Review all ten required release gates.
2. Attach signed build and device evidence.
3. Attach provider and deletion evidence.
4. Review remaining security decisions.
5. Verify metric gate remains accurately represented.
6. Record final go-or-hold decision.
