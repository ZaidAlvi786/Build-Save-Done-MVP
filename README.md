# Saved → Done

Android-first saved places MVP. Phase 2 sign-in, durable capture, extraction and confirmation are implemented locally. Phase 3 saved-place browsing and nearby reminders are implemented locally; physical-device gates remain open. The pasted engineering request controls scope; the idea brief supplies context.

## Setup

Install Node.js 24 LTS and npm 11. From the repository root:

```powershell
npm ci
npm run check
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Captures can be retained before sign-in; live authentication and confirmation need a Supabase URL and public publishable key; these public identifiers are designed for clients and require RLS. No privileged API keys belong in the bundle. Never put an AI, geocoding, or Supabase service-role secret in EXPO_PUBLIC variables.

## Android development build

### Qwen screenshot extraction

The server supports Alibaba Cloud DashScope through its OpenAI-compatible vision
API, as well as the original Anthropic adapter. In `supabase/functions/.env`, use:

```dotenv
AI_PROVIDER=dashscope
AI_MODEL=qwen3-vl-flash
AI_API_KEY=your_server_only_key
AI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

The default endpoint is Singapore. Select an endpoint matching the region where
your key was issued; workspace-specific Alibaba endpoints are also supported.
See [Alibaba's regional endpoint documentation](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-compatible-with-openai).
Model availability and free quota depend on your account and region. Local env
changes do not update a deployed function: configure its secrets and deploy the
updated `extract-place` function separately. Keys stay server-side; no native app
rebuild is needed for this adapter change. Automated adapter tests use mocked
responses and do not establish real screenshot accuracy.

Install Android Studio, its Android SDK/platform tools, JDK 17, and configure ANDROID_HOME. Start an emulator or attach an Android phone with USB debugging enabled. Then:

```powershell
npm run android
npm start
```

The first command compiles and installs a native development build. The second starts Metro explicitly with --dev-client. Share intents and background geofencing do NOT work in Expo Go. Rebuild after native module or plugin changes. Native Android/iOS directories are generated and ignored. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) and [local Android setup](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=simulated&buildEnv=local).

For iOS, use macOS with Xcode and run `npm run ios -w apps/mobile`; Windows cannot build iOS locally. Device signing and store identifiers must be configured before release. `com.saveddone.app` is a provisional identifier.

## Commands and layout

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`: CI gate; `npm run format`: apply formatting.
- `apps/mobile`: strict TypeScript Expo app; feature folders own logic, shared lib holds cross-cutting adapters.
- `supabase`: migrations, functions, seed; backend setup and security checks are documented in supabase/README.md.
- `eval`: AI evaluation harness, ten synthetic screenshots and private real-set instructions.
- `docs`: architecture, ADRs, privacy and backlog.

Jest/React Native Testing Library exercise the entry screen. Later phases add pure domain tests and Deno edge tests; a unit test cannot prove native background behavior. CI runs clean installation and all foundation checks. Lockfile pins the actual dependency graph.

## Phase gates

0. Lint, strict types, tests, formatting, dependency compatibility and Android JS export pass.
1. Authenticated extraction harness works; at least 80% identification on the user's real screenshot set.
2. Share-to-confirm under 10 seconds on a mid-range Android device.
3. Real geofence reminder on two phones; debug evidence retained.
4. Seven-day success metric computable from reminder actions.
5. Security, performance, crash monitoring and release review.

Stop at each phase to report results. Native/device gates cannot be represented as passed by mocks. No production services, paid builds or publication occur during foundations.

## Phase 1 local verification

Run `npm run check:all` for mobile checks, Deno type/lint/tests, real Postgres/PostGIS migration/RLS checks and scripted fixture evaluation. See [backend setup](supabase/README.md) and [evaluation instructions](eval/README.md) for Docker integration and live evaluation. No credential-free test measures AI accuracy. See [Phase 2 report](docs/PHASE-2-REPORT.md) and [device protocol](docs/TESTING-PHASE-2.md). Physical phase gates remain open.

## Phase 2 service setup

Copy the app environment example and fill only the Supabase URL/public key. Enable email OTP and include `{{ .Token }}` in its email template. Configure AI, Google Places API (New) and Maps Static API credentials in the server environment example. Apply all migrations and serve all four functions. No credentials are required for local tests. Native image conversion, share delivery and OTP require a development build for end-to-end verification.

## Phase 3 implemented locally

Saved-place filters, near sort, selected-place map, swipe/accessible visit and delete actions, nearest-20 geofences, explicit background-permission explanation, local notification actions and debug status are available. Rebuild the development client after installing the location/task/notification modules. Open **Nearby reminders and debug** and choose Enable; permission denial keeps the saved list usable. Deploy the new refresh-place function and apply the fourth migration before trying reminder action sync.

See [Phase 3 report](docs/PHASE-3-REPORT.md) and [two-phone protocol](docs/TESTING-PHASE-3.md). No real walk/drive or native compilation has been verified here.

## Phase 4 implemented locally

Account and privacy has optional activity measurement and a Friday 6 pm digest. Both default off. Snooze schedules one reminder 24 hours later; pause/visit/delete/sign-out cancels pending snoozes. PostHog ingestion goes through an authenticated Edge function with a strict eight-event allowlist; provider tokens stay server-side. The digest uses only opted-in, six-hour nearby place IDs derived from foreground location, with one active phone per account.

Apply the fifth migration and deploy `track-events` and `weekly-digest`. Configure POSTHOG_HOST, POSTHOG_PROJECT_TOKEN, DIGEST_CRON_SECRET and EXPO_PUSH_ACCESS_TOKEN in the server example. For push, configure the EAS project, FCM/APNs credentials and enhanced Expo push security, then set only its public UUID as EXPO_PUBLIC_EAS_PROJECT_ID in the app. Configure Vault's saved_done_project_url and saved_done_digest_cron_secret (matching the Edge secret), then review/install `supabase/schedules/weekly-digest.sql`. It runs every ten minutes and selects the user's local Friday evening window. No scheduler or live service has been provisioned here.

`select * from public.success_metric()` computes the authoritative service-only seven-day metric from reminder actions and completed first-save cohorts. It survives deletion of individual saves and excludes deleted accounts. A computed result does not establish the real 15% adoption target. See [Phase 4 report](docs/PHASE-4-REPORT.md), [ADR](docs/adr/009-retention-and-measurement.md) and [verification protocol](docs/TESTING-PHASE-4.md). Sign-out needs a successful server digest-disable request before completing, so an offline failure requires retry. No credentials need to be posted in chat.

## Phase 5 local hardening � release hold

Rendering failures have a recoverable fallback. Optional Sentry error reports have independent consent and send fixed categories/version through the server; they exclude raw error text and user identity. Apply all six migrations, deploy report-error (eight functions total), and configure server-only SENTRY_PROJECT_DSN and SENTRY_ENVIRONMENT before testing reports. This does not capture native fatal crashes; native integration, source maps and live alerts remain required release evidence.

Capture and saved-place cards use FlatList with a bounded rendering window. Near-sort computes each distance once and memoizes unchanged results. `npm run performance:local` measures synthetic sorting on this computer only. `npm run release:check` reports the evidence manifest and intentionally fails until release blockers are verified, separately from functional CI.

See [Phase 5 report](docs/PHASE-5-REPORT.md), [security review](docs/SECURITY-REVIEW.md), [Play listing draft/checklist](docs/PLAY-STORE-LISTING.md) and [release protocol](docs/TESTING-PHASE-5.md). Dependency audit, native/device tests, live services/deletion/retention and owner/store resources remain blockers. No publication or deployment has occurred.
