# ADR 010: Local hardening and explicit release evidence

Status: accepted for local Phase 5, 2026-10-13. Production release remains blocked.

Use a React error boundary for recoverable JavaScript rendering failures and Sentry's envelope API through an authenticated Supabase Edge adapter for fixed failure categories. SENTRY_PROJECT_DSN and environment are server-only; no SDK or new dependency is added. Diagnostics have independent, default-off consent and share a bounded server upload budget with analytics. Reports contain a random event UUID, app release and an allowlisted failure category; no account identity, raw error message, stack, breadcrumbs, screenshot, device position or replay. This avoids accidentally sending private share contents through exception text. Failure grouping is coarse and reporting is best effort, not an offline crash queue.

This is JavaScript recovery and selected caught-operation monitoring, not native fatal-crash capture. React boundaries do not catch asynchronous/event-handler/native failures; explicit reporting adapters cover selected handled operations. Native crash SDK/relay integration, symbolication/source maps, end-to-end Sentry alerts and release-build crash verification are still release requirements. Missing credentials fail closed. Do not represent a unit test as live monitoring evidence.

Virtualize pending and saved cards with FlatList, memoize filter/sort results, and calculate each destination distance once per sort. Keep variable-height accessible rows; avoid fixed-height assumptions or aggressive clipping. Desktop pure-sort measurements diagnose algorithm costs only, never cold start, scrolling, memory or Android share-to-confirm latency.

Maintain a release-readiness evidence manifest and an explicit `release:check` that fails when any required release evidence remains blocked. It does not authorize publication. Functional CI remains separate from release eligibility. Review npm advisories and compatible updates without forcing an Expo/RN downgrade or bypassing dependency peers. A conflicting repair and unresolved advisories are blockers, not waived findings.

Sources: [Sentry envelope protocol](https://develop.sentry.dev/sdk/data-model/envelopes/), [React error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary), [React Native FlatList](https://reactnative.dev/docs/flatlist).
