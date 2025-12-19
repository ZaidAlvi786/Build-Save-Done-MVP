# Release verification follow-up

Reviewed locally on 2026-10-13. The planned implementation phases end at Phase 5;
this follow-up strengthens release verification. Release remains on hold.

## Changes and validation

The release checker now requires the exact ten gate IDs. Replacing a required
blocker, omitting it, duplicating a gate, using a stale app version, or marking a
device/provider gate as merely locally verified fails validation. Evidence paths
must still refer to existing files inside `docs`. These are checks of recorded
evidence, not independent proof that a release passes.

`npm run release:test` passed seven checks. It is included in `check:all`.
`npm run release:check` correctly exits with a release hold: nine required gates
remain blocked. No gate was promoted by this work.

## Local prerequisites

`npm run release:preflight` checks command availability and file presence without
reading or displaying configuration values. It does not connect to providers or
validate credentials, signing, or phone behavior. This machine reported:

- Java runtime unavailable.
- Android device bridge (`adb`) unavailable.
- Docker engine unavailable to the preflight.
- `apps/mobile/.env.local` absent.
- `supabase/functions/.env` absent.
- `apps/mobile/eas.json` absent.

Environment variables supplied through another mechanism can replace local env
files; a missing file alone does not establish that credentials do not exist.
EAS profiles are needed only when taking the EAS build path. Docker is needed for
the full local Supabase integration tests; the existing PGlite tests run without it.

## Next execution steps

1. Provision the Android development toolchain and attach two physical phones.
   Follow the Phase 2/3/5 test protocols for sharing, background reminders, snooze,
   cold starts, and native failure handling.
2. Supply public mobile identifiers and server secrets through the environment
   setup documented in README. Keep server secrets out of the mobile bundle.
   Run actual provider extraction against the real screenshot evaluation set,
   then verify deployed account isolation, deletion, analytics, and digest jobs.
3. Resolve or explicitly review the dependency advisories in the security review,
   complete native crash monitoring, and collect signed build evidence.
4. Complete the owner-specific store/privacy assets. Update the release manifest
   only after collecting the required evidence, then rerun `release:check`.

No toolchain was installed, cloud build started, service deployed, or app published
in this follow-up. Credentials remain deferred per the user's local-first request.
