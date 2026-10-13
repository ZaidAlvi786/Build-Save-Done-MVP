# Phase 5 report

Date: 2026-10-13, Asia/Karachi. Local hardening implemented. **Release remains on hold.**

## Summary

Added recoverable JavaScript error handling, independently opted-in sanitized Sentry diagnostics through an Edge function, onboarding/share guidance, virtualized capture/saved-place cards, memoized near sorting and a repeatable desktop benchmark. Completed the source security/dependency review, Play listing draft/checklist and explicit release evidence gate. No service, store listing or native release was deployed.

## Verification

- Functional local gate: lint, strict TypeScript and formatting pass. 44 Jest/RNTL tests, 35 Deno tests, 62 baseline plus 44 retention/diagnostic Postgres checks, and 10 scripted extraction fixtures pass. Fixtures do not establish real vision accuracy.
- Android prebuild and JavaScript export pass: 968 modules, approximately 3.3 MB. Neither compiles a signed native app nor proves native crash/delivery behavior.
- Desktop warm near-sort sample: 100 places median 0.052 ms/p95 0.154 ms; 1,000 median 1.025 ms/p95 2.078 ms; 5,000 median 4.410 ms/p95 6.333 ms. These are Node 24.13.1 observations on this host, not phone performance. The script warms up and samples 25 runs; timing changes between runs are expected.
- Dependency review: current registry audit still reports 59 affected package entries (12 moderate, 47 high, 0 critical), from four root advisories. npm repair dry-run fails with ERESOLVE; no major dependency changes, forced downgrades or peer bypass were applied.
- `release:check` intentionally fails while physical, provider, dependency and store evidence is blocked. A local passing suite does not clear those entries.

## Decisions and limitations

Continue the user's local-first preference. Sentry credentials remain server-only. Diagnostic collection defaults off independently of PostHog consent, is authenticated/quota limited, and uses only allowlisted feature categories and app release. It excludes raw exception text, stacks, account identity, screenshots and location. No new dependency was added. Reports are best effort; a rendering failure offers a retry without deleting captures. Native fatal-crash capture, source maps and live alert validation are not established and remain release blockers. See ADR 010.

FlatList limits initially rendered/batched cards to eight with a bounded window. Variable-height rows remain accessible. Near-sort distances are computed once per destination; filtering/sort results are memoized. Cold start, memory, frame behavior and earlier under-ten-second Android confirmation remain unmeasured. Play copy is a draft; package identifiers and support/privacy/deletion resources require owner verification.

The final security review covers every original security/privacy requirement and distinguishes source/local evidence from live evidence. In-app product/Auth/image deletion exists and has local tests, but actual provider retention, external deletion link and deployed Auth/Storage removal are unverified. Privileged keys stay outside the client; inspecting the signed artifact is still required. Git commits await an author identity; none was invented.

## Top three risks

1. Unresolved dependency advisories and failed compatible repair: release security cannot be declared passed.
2. Missing native/device/service evidence: two-phone reminders/snooze, actual vision accuracy, share latency, native crash reporting, signed builds and live providers remain open.
3. Owner/store/privacy evidence: package ownership/signing, working public policy/deletion resources, provider retention/deletion and Play declarations are not yet established.

## Needed later

Configure service credentials locally and provide a disposable Supabase project/Docker, real labeled screenshots, two phones, Android build tooling and macOS for iOS checks. Configure final developer/package/signing ownership and public privacy/support/deletion resources. Native monitoring and compatible dependency remediation need verified release evidence. No API keys should be pasted in chat. No additional product phase or publication has started.
