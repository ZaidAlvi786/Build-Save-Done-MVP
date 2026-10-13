# Fifty-day PR queue

The future-work proposal is in [PR-WORK-BREAKDOWN.md](PR-WORK-BREAKDOWN.md) and
[pr-work-plan.json](pr-work-plan.json). It contains candidate tasks, not completed
source commits, and cannot be passed directly to this publisher.

This script publishes one selected entry per invocation. It needs Git, GitHub CLI
(`gh auth login`), write access to the remote, and a configured Git author.
It creates draft PRs, preserves source commit messages, and uses isolated worktrees
so current uncommitted app files remain untouched. It never merges or force pushes.

Prepare `plan.json` as an array of exactly 50 objects with this shape:

```json
[
  {
    "branch": "work/expo-app-foundation",
    "base": "main",
    "title": "Add the Expo app foundation",
    "body": "Describe the actual change and validation here.",
    "commits": ["SIX_OR_MORE_UNIQUE_FULL_SOURCE_COMMIT_SHAS"]
  }
]
```

The example is deliberately incomplete and will fail validation. Do not use dummy
SHAs or empty commits. The full plan requires at least 300 distinct, substantive
source commits, ordered so each branch builds and its dependencies are present.
File count does not determine commit count. Snapshot files cannot automatically
recover an earlier development history. Create and review real implementation
commits first; keep them on an unpublished source branch available locally.

Each base must already exist on origin when that entry executes. Use `main` for
independent changes. For dependent work, use the preceding context branch as the
base and keep it available until dependent PRs are rebased or merged appropriately.
Do not use already-merged source commits: empty cherry-picks stop execution.

Preview entry 1:

```powershell
node scripts/pr-queue.mjs --plan plan.json --day 1
```

Publish that entry after reviewing its source commits for secrets and correctness:

```powershell
node scripts/pr-queue.mjs --plan plan.json --day 1 --execute
```

Run day 2 on the following actual day, continuing through day 50. This script does
not install a scheduler or enforce daily spacing. No automation has been created.
For automatic scheduling, choose a future start date and arrange an authenticated
machine to execute the corresponding entry once daily.

Historical labels start November 1, 2025 and end December 20, 2025. Optionally add
`--historical-commit-dates` to set both Git author and committer dates to each
entry's historical day, with distinct minute timestamps starting 09:00 Pakistan
time. This rewrites commit hashes. It does not reconstruct the actual chronology:
GitHub PR creation, activity, and push dates remain the real execution dates.
Existing commits are never rewritten in place; their cherry-picked copies receive
the optional dates. Source attribution and messages are preserved.

On failure, inspect the printed worktree path. Resolve conflicts there or abort
the cherry-pick. An existing branch causes a later invocation to stop, preventing
duplicate publication. If push succeeded but PR creation failed, create the PR
for that branch manually. The env-path check is only a guard, not a full secret
scanner; review every selected commit before publication.
