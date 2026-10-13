# Extraction evaluation

## Local transport check (no credentials)

```powershell
npm ci
npm run backend:check
npm run backend:test
npm run db:test:local
npm run eval:fixture
```

Ten fictional PNG screenshots and labels are committed in `eval/cases`. Cases cover a cafe, restaurant, map card, shop, attraction, no-place image, multiple places, prompt injection text, missing area, and unreadable text. `fixture-responses.json` contains deliberately scripted provider outputs. Fixture mode uses the real HTTP handler, request/schema/image checks, storage adapter contract, persistence and scoring, with injected memory/Auth/provider adapters. It prints `NOT_ESTABLISHED` for the real gate. 10/10 here is a transport check, not AI performance, and does not prove deployed authentication or RLS.

## Live endpoint evaluation

1. Follow `supabase/README.md` to start a local stack or deploy after credentials are configured.
2. Create/sign in a disposable email user in Supabase Auth and obtain its short-lived access token. Copy `eval/.env.example` to `eval/.env.local`, fill the URL, public publishable key (or local anon key), and `EVAL_USER_JWT`. Never use a service-role key as a user JWT.
3. To evaluate 50 screenshots in one hour, an administrator may set **only this disposable user's** `public.users.extraction_limit` to 100, then restore 20 afterward. Default app users remain limited to 20 attempted extractions/hour; failed attempts count. The client cannot change its quota.
4. Put consented screenshots in `eval/private/` with a `labels.json`. It must be an object with `set_kind: "real"` and `cases` shaped like the committed synthetic labels. Each case has unique `id`, basename `file`, and expected `names` (accepted exact spelling aliases), `area`, `category`, `reason`. Unreadable/no-place/ambiguous cases use empty names, null category and null area. This directory is ignored by Git.
5. Run from repo root:

```powershell
npm run deno -- run --env-file=eval/.env.local --allow-read --allow-env --allow-net eval/run.ts eval/private
```

The harness inserts a fresh pending item, uploads actual bytes through user-scoped Storage, calls the authenticated Edge Function, validates/scorers its response, and deletes its temporary image/item. No raw provider errors, screenshots, names or tokens are printed. IDs appear in output; keep IDs pseudonymous. Interrupted processes may leave evaluation items; delete them or delete the disposable account after the run. Cleanup failures fail the command. Do not run the harness against a real user's account: it contributes first saves/analytics data in later phases.

## Scoring and gate

Exact normalized name match (Unicode-aware, casing/punctuation ignored) and labeled area match are required. Unknown area must remain null rather than invented. Branch/area mistakes count as wrong identification; category accuracy is reported separately. Abstentions are reported separately so easy negatives cannot inflate positive identification accuracy. HTTP/provider/schema failures count as failures and never disappear from the denominator.

The real gate requires live mode, 50 or more cases, at least 40 positive place cases, and at least 80% correct place identification. Add negative examples too; inspect false positives and category failures before release. Synthetic/live sample results cannot establish the real gate. A run below 80% or with transport/cleanup failures exits nonzero; fixture mode exits nonzero if any scripted case fails. Preserve output for review without committing personal data.

## Prompt iterations

`places-v1` rejects screenshot instructions, requires one identifiable physical place, explicitly abstains on ambiguous/unreadable/no-place input, and forbids guessed area/address. No vision failure pattern has been measured yet. On the real set, group failures into wrong name, wrong/missing area, invented area, missed place, false positive, wrong abstention, schema/transport. Change one prompt rule at a time and rerun the same held-out set; do not add ground-truth names to prompts.
