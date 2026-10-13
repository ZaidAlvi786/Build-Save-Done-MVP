// Run from a dedicated checkout containing the real source commits in the plan.
import { readFile, mkdtemp, rmdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function run(command, args, cwd = process.cwd(), env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error?.message || result.stderr || result.stdout}`,
    );
  return result.stdout.trim();
}
const git = (args, cwd, env) => run('git', args, cwd, env);
const argv = process.argv.slice(2);
const argument = (name) => argv[argv.indexOf(name) + 1];
if (!argv.includes('--plan') || !argv.includes('--day'))
  throw new Error(
    'Usage: node scripts/pr-queue.mjs --plan plan.json --day 1 [--execute] [--historical-commit-dates]',
  );
const day = Number(argument('--day'));
const plan = JSON.parse(await readFile(argument('--plan'), 'utf8'));
if (
  !Number.isInteger(day) ||
  day < 1 ||
  day > 50 ||
  !Array.isArray(plan) ||
  plan.length !== 50
)
  throw new Error('Plan must contain exactly 50 entries; day must be 1..50.');
const branches = new Set(),
  commits = new Set();
for (const entry of plan) {
  if (
    !entry ||
    !/^work\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.branch) ||
    branches.has(entry.branch) ||
    typeof entry.base !== 'string' ||
    !entry.base ||
    typeof entry.title !== 'string' ||
    !entry.title.trim() ||
    typeof entry.body !== 'string' ||
    !entry.body.trim() ||
    !Array.isArray(entry.commits) ||
    entry.commits.length < 6 ||
    entry.commits.length > 600
  )
    throw new Error(
      'Each entry needs a unique work/context-name branch, base, title, body, and 6..600 real commit SHAs.',
    );
  branches.add(entry.branch);
  for (const sha of entry.commits) {
    if (!/^[a-f0-9]{40}$/.test(sha) || commits.has(sha))
      throw new Error('Use unique full commit SHAs across the entire plan.');
    commits.add(sha);
  }
}
const entry = plan[day - 1];
const historicalDay = new Date(Date.UTC(2025, 10, day))
  .toISOString()
  .slice(0, 10);
console.log(
  `Entry ${day}/50: ${entry.branch}, ${entry.commits.length} source commits, PR base ${entry.base}`,
);
console.log(
  `Historical plan date: ${historicalDay}. GitHub push/PR creation dates will be TODAY.`,
);
if (!argv.includes('--execute')) {
  console.log('DRY RUN: no branches, commits, pushes, or PRs created.');
  process.exit(0);
}
run('gh', ['auth', 'status']);
git(['fetch', 'origin']);
git(['rev-parse', '--verify', `origin/${entry.base}^{commit}`]);
if (
  git(['branch', '--list', entry.branch]) ||
  git(['ls-remote', '--heads', 'origin', `refs/heads/${entry.branch}`])
)
  throw new Error(
    'Branch already exists; inspect it manually rather than overwrite or duplicate a PR.',
  );
for (const sha of entry.commits) {
  const parents = git(['rev-list', '--parents', '-n', '1', sha]).split(' ');
  if (parents.length !== 2)
    throw new Error(
      'Source commits must have exactly one parent (no roots or merges).',
    );
  if (!git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]))
    throw new Error('Empty source commits are not permitted.');
  const files = git([
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    sha,
  ]).split('\n');
  if (
    files.some(
      (file) =>
        /(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example'),
    )
  )
    throw new Error('A source commit contains a secret environment file.');
}
const temp = await mkdtemp(join(tmpdir(), 'saved-done-pr-'));
const workspace = join(temp, 'checkout');
git(['worktree', 'add', '-b', entry.branch, workspace, `origin/${entry.base}`]);
console.log(
  `Isolated checkout: ${workspace}. Failures leave it intact for inspection.`,
);
for (const [index, sha] of entry.commits.entries()) {
  git(['cherry-pick', '-x', sha], workspace);
  if (argv.includes('--historical-commit-dates')) {
    const date = new Date(`${historicalDay}T09:00:00+05:00`);
    date.setUTCMinutes(date.getUTCMinutes() + index);
    const timestamp = date.toISOString();
    git(['commit', '--amend', '--no-edit', '--date', timestamp], workspace, {
      ...process.env,
      GIT_COMMITTER_DATE: timestamp,
    });
  }
}
// No force pushes or automatic merging. Failures and empty cherry-picks stop the queue.
git(['push', '-u', 'origin', entry.branch], workspace);
const url = run(
  'gh',
  [
    'pr',
    'create',
    '--draft',
    '--base',
    entry.base,
    '--head',
    entry.branch,
    '--title',
    entry.title,
    '--body',
    entry.body,
  ],
  workspace,
);
console.log(`Created draft PR: ${url}`);
git(['worktree', 'remove', workspace]);
await rmdir(temp);
