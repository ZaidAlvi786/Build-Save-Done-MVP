# Phase 5 verification and release protocol

Local: run `npm run check:all`, `npm run performance:local` and Android prebuild/JavaScript export. Run `npm run release:check` separately: it deliberately fails until required release evidence is verified. CI passing is not release clearance.

## Monitoring

Apply the sixth migration and deploy report-error; configure server-only SENTRY_PROJECT_DSN and SENTRY_ENVIRONMENT (development/staging/production). In Account and privacy, opt into error reports independently of PostHog. Trigger a rendering failure in an isolated test build: the fallback must exclude raw exception text and let the screen reopen without losing captures. Trigger each instrumented failure category and verify Sentry grouping/release; deny consent and inspect that nothing reaches Sentry. Test quotas, missing config and provider timeout. There is no native fatal-crash SDK integration or offline diagnostic outbox; validate/add native capture, source maps/symbolication and alert delivery before release. Diagnostics omit user identity and sensitive exception details.

## Performance

The local script measures only filtering/near sorting on synthetic 100, 1,000 and 5,000-place lists after warmup (25 samples). Record machine/runtime, median/p95 and the artifact under dist. It does not measure a phone.

On a mid-range Android **release** build, record ten cold launches after process termination, median/p95 to usable first screen, local/authenticated/offline modes, screenshot-to-confirm time, peak memory and frame behavior while scrolling 1,000 mixed captures/places. FlatList must render only its window, preserve swipes/buttons, support screen readers and large fonts, and restore selection/category/map behavior. Test 0/1/100/1,000 items, long names, expired coordinates, denied location and no network. Verify behavior when the app returns from Maps/share sheet. Retain video/trace/build/device/OS evidence rather than inventing timings. Repeat on the second phone; iOS compilation and relevant behavior require macOS/device evidence.

## Deletion/security

Run local SQL and pgTAP against a disposable Docker-backed project. In a deployed development project, create two users, capture/upload/confirm, schedule snooze/digest, opt into telemetry, delete A with an interrupted storage call and retry. Verify no private objects, owned product/profile/Auth rows remain for A; B must remain intact. Try late uploads, old tokens, cross-user objects/actions, and delayed responses. Inspect local filesystem/SQLite/secure session state, opaque tombstones, and provider retention/deletion. Review screenshots/URLs/coordinates and accidental secret leakage in the signed bundle and logs. Exercise expired-coordinate and digest cleanup jobs while the app remains suspended.

## Release evidence

Address every blocked entry in release-readiness.json with real evidence. Update status only after verification, keep links/build identifiers/results, regenerate dependency audit and retain compatible remediation decisions. Follow PLAY-STORE-LISTING.md. No publish/deploy/paid action is authorized by this local report or readiness script.
