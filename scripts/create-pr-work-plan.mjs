// Regenerates the proposed work breakdown; never commits, pushes, or creates PRs.
import { writeFile, access } from 'node:fs/promises';
let existing = false;
try {
  await access('docs/pr-work-plan.json');
  existing = true;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (existing)
  throw new Error(
    'Plan already exists. Edit it in place; regeneration could erase recorded progress.',
  );
const rows = [
  [
    'android-local-toolchain',
    'Discover bundled Studio Java|Discover SDK platform-tools|Report SDK 36 availability|Detect connected test devices|Separate optional EAS checks|Document verified local build',
  ],
  [
    'android-development-build',
    'Reproduce native build from clean checkout|Resolve confirmed Gradle failures|Verify native plugin manifest|Exercise emulator launch|Exercise USB device launch|Record reproducible build evidence',
  ],
  [
    'supabase-development-environment',
    'Define disposable project setup|Validate all migrations on full PostgreSQL|Verify email token template|Configure private capture bucket|Verify authenticated Edge routes|Record clean environment teardown',
  ],
  [
    'qwen-live-extraction',
    'Verify region-specific configuration|Evaluate screenshot request compatibility|Measure complete response handling|Exercise quota and timeout recovery|Compare real labeled extraction results|Record provider retention and cost limits',
  ],
  [
    'google-places-live-matching',
    'Verify Places New field masks|Exercise ambiguous destination candidates|Check explicit branch selection|Handle zero-result responses|Validate coordinate TTL on real responses|Record provider errors and billing setup',
  ],
  [
    'google-static-map-validation',
    'Verify server-side map key restriction|Validate marker and viewport behavior|Exercise preview response size bounds|Handle missing preview gracefully|Verify Google attribution visibility|Record signed-device map behavior',
  ],
  [
    'capture-share-delivery',
    'Exercise Android image shares|Exercise text and URL shares|Verify cold-launch intent persistence|Verify warm-launch duplicate handling|Handle unsupported share types|Measure share-to-local-save latency',
  ],
  [
    'capture-image-normalization',
    'Exercise real HEIC conversion|Measure large JPEG downsampling|Verify rotated-image orientation|Exercise oversized image fallback|Verify WebP upload compatibility|Record native conversion memory usage',
  ],
  [
    'capture-crash-recovery',
    'Interrupt capture copy safely|Exercise journal recovery after termination|Verify hash acknowledgement after upload|Exercise partial upload retries|Recover corrupted capture metadata|Verify account tombstone write fencing',
  ],
  [
    'email-otp-device-flow',
    'Exercise real six-digit OTP|Handle expired-code retry|Handle rate-limited email requests|Exercise interrupted session persistence|Verify foreground token renewal|Record sign-out and reauthentication flow',
  ],
  [
    'secure-session-hardening',
    'Verify chunked token writes on device|Exercise partial secure-store failures|Validate session removal on sign-out|Verify device-only storage policy|Exercise token rotation races|Inspect backup exclusion evidence',
  ],
  [
    'place-confirmation-recovery',
    'Exercise edited identity confirmation|Verify explicit address acknowledgement|Exercise simultaneous confirmations|Handle quota-limited confirmation|Recover network loss after server commit|Verify stable saved-item identity',
  ],
  [
    'saved-list-accessibility',
    'Audit TalkBack reading order|Validate large-font place rows|Improve inaccessible filter controls if found|Verify accessible swipe alternatives|Validate selected-place focus behavior|Record screen-reader device evidence',
  ],
  [
    'saved-list-device-performance',
    'Capture release-build list baseline|Profile expensive render paths|Reduce measured avoidable row updates|Measure scrolling frame stalls|Measure memory with 1000 places|Record before-and-after device traces',
  ],
  [
    'nearby-distance-behavior',
    'Validate location-denied ordering|Exercise equal-distance stable ordering|Check edge coordinates and antimeridian|Verify missing-coordinate placement|Exercise location-refresh race handling|Record distance presentation accuracy',
  ],
  [
    'maps-navigation-actions',
    'Exercise Google Maps app intent|Exercise browser fallback when Maps absent|Verify encoded destination names|Handle stale destination coordinates|Verify action logging before external launch|Record return-from-Maps recovery',
  ],
  [
    'foreground-location-permissions',
    'Exercise first permission request|Exercise precise-location denial|Exercise permanently denied recovery|Verify explanation before permission dialog|Validate permission revocation while active|Record foreground permission matrix',
  ],
  [
    'background-location-permissions',
    'Exercise Android Always permission flow|Validate Settings return handling|Exercise background permission revocation|Verify foreground-service disclosure|Handle unsupported permission states|Record two-phone permission evidence',
  ],
  [
    'geofence-registration-capacity',
    'Exercise nearest-20 selection on device|Verify deterministic region replacement|Handle native registration failure|Reconcile app and OS region lists|Validate region removal after visiting|Record region-limit behavior',
  ],
  [
    'geofence-cooldown-behavior',
    'Exercise repeated boundary entry|Verify 12-hour cooldown persistence|Exercise wall-clock changes|Handle duplicate native callbacks|Verify paused reminders never notify|Record walk-and-drive traces',
  ],
  [
    'geofence-background-reliability',
    'Exercise screen-off delivery|Exercise Doze delivery delay|Exercise app process termination|Verify battery-optimization recovery guidance|Exercise background task exceptions|Record two-manufacturer delivery evidence',
  ],
  [
    'notification-action-routing',
    'Exercise Navigate button from locked screen|Exercise Been button from killed app|Exercise Snooze button from foreground|Verify notification body opens saved list|Handle repeated response callbacks|Record Android action routing matrix',
  ],
  [
    'notification-snooze-recovery',
    'Verify 24-hour alarm calculation|Exercise scheduling failure retry|Exercise child notification resnooze|Verify cancellation after place visit|Verify cancellation after account switch|Record device alarm delivery evidence',
  ],
  [
    'reminder-offline-outbox',
    'Exercise prolonged offline action queue|Handle reconnect after server acknowledgement|Verify conflicting action precedence|Exercise sync failure without queue loss|Verify account-scoped outbox isolation|Record remote reminder reconciliation',
  ],
  [
    'reminder-reboot-recovery',
    'Inventory OS state after reboot|Reconcile stale scheduled notification IDs|Exercise reboot before snooze deadline|Verify registration after foreground launch|Handle missing native task support|Document measured reboot limitations',
  ],
  [
    'coordinate-expiry-lifecycle',
    'Exercise 29-day destination expiry|Verify server coordinate refresh ownership|Verify stale region removal on wake|Exercise cleanup when app stays suspended|Handle provider refresh outage|Record deployed expiry cleanup evidence',
  ],
  [
    'cross-device-place-reconciliation',
    'Exercise second-device place deletion|Exercise second-device visit action|Reconcile stale local region selection|Handle refresh interrupted by sign-out|Prevent deleted-place resurrection|Record two-device offline scenarios',
  ],
  [
    'analytics-consent-validation',
    'Verify default opt-out on fresh install|Exercise remote opt-out during flush|Verify consent isolation by account|Validate all eight event allowlists|Exercise quota rejection without loss|Inspect real PostHog payload evidence',
  ],
  [
    'analytics-provider-retention',
    'Define opaque-identity retention policy|Exercise provider deletion workflow|Verify retention configuration in test project|Handle deletion retry observability|Verify no screenshot or GPS ingestion|Record consent and deletion evidence',
  ],
  [
    'digest-push-credentials',
    'Validate EAS public project identifier|Configure test FCM push credentials|Exercise token acquisition on physical phone|Verify enhanced Expo push authentication|Exercise invalid-token cleanup|Record end-to-end push receipt evidence',
  ],
  [
    'digest-token-device-races',
    'Exercise last-device consent takeover|Exercise old-device token refresh rejection|Verify disable affects matching installation|Exercise token rotation during send|Verify account deletion fences delivery|Record concurrent device traces',
  ],
  [
    'digest-weekly-scheduler',
    'Install reviewed test-project Vault entries|Validate pg_cron and pg_net access|Exercise Friday local-time claim|Verify one reservation per week|Exercise scheduler outage recovery limits|Record scheduled invocation evidence',
  ],
  [
    'digest-timezone-boundaries',
    'Exercise Pakistan local Friday window|Exercise daylight-saving transition zones|Exercise timezone preference changes|Exercise stale nearby snapshot rejection|Verify empty-nearby digest suppression|Record timestamp boundary results',
  ],
  [
    'digest-delivery-observability',
    'Distinguish accepted from visible push|Exercise unknown provider send outcome|Exercise delayed receipt polling|Surface invalid-token outcomes safely|Measure missed at-most-once attempts|Record delivery operational runbook',
  ],
  [
    'success-metric-live-validation',
    'Create disposable seven-day cohorts|Verify reminder success window boundaries|Verify individual deletion keeps milestone|Verify account deletion removes cohort member|Compare SQL metric with fixture counts|Record live metric and target interpretation',
  ],
  [
    'native-crash-consent-design',
    'Define minimal native diagnostics payload|Evaluate consent before SDK initialization|Specify native offline-cache deletion|Review provider metadata exposure|Define release and environment mapping|Record privacy-reviewed integration decision',
  ],
  [
    'native-crash-capture',
    'Integrate chosen native monitor in test build|Capture deliberate native fatal failure|Verify opt-out blocks new reports|Verify sign-out clears queued reports|Verify deletion clears local diagnostic state|Record native crash capture evidence',
  ],
  [
    'native-symbolication-alerts',
    'Configure protected symbol upload workflow|Verify native stack symbolication|Verify JavaScript release matching|Exercise diagnostic grouping stability|Verify test alert delivery|Record monitoring ownership runbook',
  ],
  [
    'deployed-rls-isolation',
    'Exercise two-user profile isolation|Exercise two-user saved-item isolation|Exercise two-user place isolation|Exercise two-user reminder isolation|Verify service-only RPC denial|Record deployed RLS security evidence',
  ],
  [
    'private-storage-isolation',
    'Exercise unauthorized capture downloads|Exercise unauthorized capture uploads|Verify immutable object overwrite rejection|Verify MIME and size restriction|Verify capture ownership path checks|Record deployed storage security evidence',
  ],
  [
    'account-deletion-failure-recovery',
    'Interrupt deletion during object removal|Verify Auth identity remains retryable|Exercise late extraction during deletion|Verify complete database cascade|Verify second account remains intact|Record deployed deletion retry evidence',
  ],
  [
    'local-data-deletion-audit',
    'Inspect capture file removal on deletion|Inspect reminder SQLite purge|Inspect analytics SQLite purge|Inspect secure session purge|Verify tombstone prevents delayed writes|Record filesystem and backup evidence',
  ],
  [
    'dependency-security-remediation',
    'Refresh authoritative dependency findings|Map affected runtime versus build paths|Evaluate compatible maintained fixes|Implement validated fixes where available|Run SDK and native regression checks|Record unresolved advisory decisions',
  ],
  [
    'signed-android-bundle-audit',
    'Inspect release manifest permissions|Inspect bundled public environment values|Verify privileged keys absent from bundle|Verify screenshot data absent from logs|Inspect network endpoint inventory|Record signed artifact audit evidence',
  ],
  [
    'android-cold-start-performance',
    'Measure ten release cold launches|Measure offline first-screen readiness|Profile startup work on device|Reduce measured startup bottlenecks|Repeat on second physical phone|Record median and p95 launch evidence',
  ],
  [
    'android-share-confirm-performance',
    'Measure screenshot-to-confirm baseline|Profile conversion and upload latency|Profile extraction and matching latency|Improve measured redundant work|Exercise slow-network recovery usability|Record ten-second gate evidence',
  ],
  [
    'beta-regression-matrix',
    'Verify fresh-install onboarding|Verify upgrade retains captures|Verify offline manual-place path|Verify auth and account-switch regression|Verify background reminder regression|Record reproducible beta test matrix',
  ],
  [
    'privacy-and-deletion-resources',
    'Draft actual collected-data inventory|Verify provider retention disclosures|Prepare owner-approved privacy content|Prepare external deletion request resource|Validate support and contact details|Record owner review and resource links',
  ],
  [
    'play-store-submission-evidence',
    'Prepare real-device store screenshots|Validate listing claims against app|Prepare background-location explanation video|Prepare foreground-service justification|Complete owner-reviewed Data Safety answers|Record internal-testing submission checklist',
  ],
  [
    'release-evidence-reconciliation',
    'Review all ten required release gates|Attach signed build and device evidence|Attach provider and deletion evidence|Review remaining security decisions|Verify metric gate remains accurately represented|Record final go-or-hold decision',
  ],
];
if (rows.length !== 50) throw new Error('Expected 50 branches');
const plan = rows.map(([slug, items], index) => ({
  day: index + 1,
  historicalLabel: new Date(Date.UTC(2025, 10, index + 1))
    .toISOString()
    .slice(0, 10),
  actualScheduledDate: null,
  branch: `work/${slug}`,
  base: 'main',
  title: slug.replaceAll('-', ' '),
  status: 'planned',
  commits: [],
  workItems: items.split('|'),
}));
if (plan.some((item) => item.workItems.length !== 6))
  throw new Error('Expected six candidate items per branch');
await writeFile('docs/pr-work-plan.json', JSON.stringify(plan, null, 2) + '\n');
const intro = `# Fifty-day saved-places work breakdown

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

`;
const sections = plan
  .map(
    (item) => `### Day ${item.day}: ${item.branch}

Historical label: ${item.historicalLabel}; status: planned; actual commits: 0.

${item.workItems.map((task, index) => `${index + 1}. ${task}.`).join('\n')}
`,
  )
  .join('\n');
await writeFile('docs/PR-WORK-BREAKDOWN.md', intro + sections);
console.log(
  'Prepared 50 planned branches and 300 candidate work items; no publication performed.',
);
