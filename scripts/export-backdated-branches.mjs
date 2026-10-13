// Import the existing working-tree snapshot into 50 stacked branches.
// Git timestamps are requested historical metadata, not actual development dates.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
function git(args, env = {}, input) {
  const result = spawnSync(
    'git',
    ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    {
      cwd: root,
      encoding: 'utf8',
      input,
      env: { ...process.env, ...env },
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (result.status !== 0)
    throw new Error(`Git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
const groups = [
  [
    'workspace-tooling',
    /^(package(-lock)?\.json|eslint\.config\.js|\.prettier)/,
  ],
  [
    'expo-native-configuration',
    /^apps\/mobile\/(package\.json|app\.json|tsconfig\.json|index\.ts|\.env\.example)$/,
  ],
  [
    'supabase-project-configuration',
    /^supabase\/(README\.md|config\.toml|functions\/\.env\.example|seed\/|migrations\/\.gitkeep)/,
  ],
  ['places-database-schema', /20261012000100_places\.sql$/],
  ['extraction-database-leases', /20261012000200_extraction_leases\.sql$/],
  ['atomic-place-confirmation', /20261012000300_confirmation\.sql$/],
  ['reminder-action-rpc', /20261012000400_reminder_actions\.sql$/],
  ['retention-and-digest-schema', /20261012000500_retention_measurement\.sql$/],
  ['diagnostics-consent-schema', /20261013000600_diagnostics_consent\.sql$/],
  [
    'edge-request-contracts',
    /^supabase\/functions\/_shared\/(contracts|http|io)\.ts$/,
  ],
  [
    'extraction-storage-repository',
    /^supabase\/functions\/extract-place\/repository\.ts$/,
  ],
  [
    'qwen-and-anthropic-vision',
    /^supabase\/functions\/extract-place\/provider(_test)?\.ts$/,
  ],
  [
    'authenticated-extraction-handler',
    /^supabase\/functions\/extract-place\/(handler(_test)?\.ts|index\.ts|deno\.json)$/,
  ],
  [
    'matching-backend-port',
    /^supabase\/functions\/_shared\/matching-backend\.ts$/,
  ],
  ['google-place-matching', /^supabase\/functions\/match-place\//],
  ['private-static-map-preview', /^supabase\/functions\/place-map\//],
  ['destination-coordinate-refresh', /^supabase\/functions\/refresh-place\//],
  ['server-account-deletion', /^supabase\/functions\/delete-account\//],
  [
    'consented-analytics-ingestion',
    /^(supabase\/functions\/track-events\/|shared\/events\.ts$)/,
  ],
  ['weekly-digest-push-service', /^supabase\/functions\/weekly-digest\//],
  ['sanitized-error-reporting', /^supabase\/functions\/report-error\//],
  [
    'local-postgres-verification',
    /^supabase\/tests\/(local-db|local-postgres)\.mjs$/,
  ],
  ['retention-sql-verification', /^supabase\/tests\/retention-local\.mjs$/],
  ['database-isolation-tests', /^supabase\/tests\/database\//],
  ['weekly-digest-scheduler', /^supabase\/schedules\//],
  ['vision-evaluation-harness', /^eval\/(?!cases\/)/],
  ['synthetic-vision-fixtures', /^eval\/cases\//],
  [
    'email-otp-and-onboarding',
    /^apps\/mobile\/src\/features\/auth\/(AuthScreen|Onboarding|useAuth|README)\./,
  ],
  [
    'account-privacy-and-deletion',
    /^apps\/mobile\/src\/features\/auth\/(AccountScreen|useDeleteAccount)\./,
  ],
  [
    'durable-local-captures',
    /^apps\/mobile\/src\/features\/capture\/(local-store\.ts|types\.ts|__tests__\/local-store\.test\.ts)$/,
  ],
  [
    'capture-upload-service',
    /^apps\/mobile\/src\/features\/capture\/(remote\.ts|service\.ts|__tests__\/service\.test\.ts)$/,
  ],
  [
    'capture-lifecycle-hooks',
    /^apps\/mobile\/src\/features\/capture\/(useCapture|useEntries)\.ts$/,
  ],
  [
    'capture-list-components',
    /^apps\/mobile\/src\/features\/capture\/(CaptureCard|CaptureScreen|README)\./,
  ],
  [
    'capture-screen-verification',
    /^apps\/mobile\/src\/features\/capture\/__tests__\/screen\.test\.tsx$/,
  ],
  [
    'saved-place-domain',
    /^apps\/mobile\/src\/features\/places\/(model\.ts|native\.ts|remote\.ts|service\.ts|README\.md|__tests__\/)/,
  ],
  [
    'place-confirmation-screen',
    /^apps\/mobile\/src\/features\/places\/(ConfirmScreen|useConfirmation)\./,
  ],
  [
    'saved-place-row-actions',
    /^apps\/mobile\/src\/features\/places\/(PlaceRow|useSavedActions)\./,
  ],
  [
    'saved-map-components',
    /^apps\/mobile\/src\/features\/places\/(SavedMap|useSavedMap)\./,
  ],
  [
    'geofence-region-selection',
    /^apps\/mobile\/src\/features\/reminders\/(selection\.ts|__tests__\/selection\.test\.ts)$/,
  ],
  [
    'reminder-state-and-actions',
    /^apps\/mobile\/src\/features\/reminders\/(store\.ts|remote\.ts|actions\.ts|__tests__\/actions\.test\.ts)$/,
  ],
  [
    'native-background-reminders',
    /^apps\/mobile\/src\/features\/reminders\/(native\.ts|tasks\.ts|__tests__\/native\.test\.ts)$/,
  ],
  [
    'reminder-settings-lifecycle',
    /^apps\/mobile\/src\/features\/reminders\/(ReminderScreen|useReminderLifecycle|useReminderSettings|README)\./,
  ],
  ['local-analytics-outbox', /^apps\/mobile\/src\/features\/analytics\//],
  ['retention-preferences-ui', /^apps\/mobile\/src\/features\/retention\//],
  [
    'client-diagnostics-boundary',
    /^(apps\/mobile\/src\/lib\/(diagnostics\.ts|ErrorBoundary\.tsx)|apps\/mobile\/__tests__\/ErrorBoundary\.test\.tsx|shared\/diagnostics\.ts)$/,
  ],
  [
    'secure-supabase-client',
    /^apps\/mobile\/src\/lib\/(README\.md|secure-session\.ts|supabase\.ts|ui\.tsx)$/,
  ],
  [
    'application-root-wiring',
    /^apps\/mobile\/(App\.tsx|src\/app\/|__tests__\/App\.test\.tsx)/,
  ],
  ['architecture-decisions', /^docs\/(adr\/|ARCHITECTURE\.md)/],
  [
    'verification-and-release-workflow',
    /^(scripts\/|deno\.(json|lock)$|\.github\/|docs\/(?!adr\/|ARCHITECTURE\.md))/,
  ],
  ['project-setup-guide', /^README\.md$/],
];
const changed = git(['diff', '--name-only', 'HEAD'])
  .split('\n')
  .filter(Boolean);
const untracked = git(['ls-files', '--others', '--exclude-standard'])
  .split('\n')
  .filter(Boolean);
const files = [...new Set([...changed, ...untracked])].sort();
const buckets = groups.map(([slug]) => ({
  branch: `import/${slug}`,
  files: [],
}));
const secretValues = [];
for (const envPath of ['supabase/functions/.env', 'apps/mobile/.env.local']) {
  try {
    const content = await readFile(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(
        /^(?:AI_API_KEY|GEOCODING_API_KEY|MAPS_STATIC_API_KEY|POSTHOG_PROJECT_TOKEN|DIGEST_CRON_SECRET|EXPO_PUSH_ACCESS_TOKEN|SENTRY_PROJECT_DSN)=(.+)$/,
      );
      if (match && match[1].trim().length >= 12)
        secretValues.push(match[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const file of files) {
  const matches = groups
    .map(([, pattern], index) => (pattern.test(file) ? index : -1))
    .filter((index) => index !== -1);
  if (matches.length !== 1)
    throw new Error(`File needs exactly one context group: ${file}`);
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example'))
    throw new Error('Secret environment file rejected');
  const bytes = await readFile(file);
  const text = bytes.toString('utf8');
  if (
    secretValues.some((value) => text.includes(value)) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
  )
    throw new Error(`Potential secret rejected in ${file}`);
  buckets[matches[0]].files.push(file);
}
if (buckets.length !== 50 || buckets.some((group) => !group.files.length))
  throw new Error('Expected exactly 50 nonempty context groups');
await mkdir('dist/backdated-export', { recursive: true });
await writeFile(
  'dist/backdated-export/grouping.json',
  JSON.stringify(buckets, null, 2),
);
console.log(
  `Reviewed ${files.length} changed/untracked files in 50 nonempty groups. Secrets excluded.`,
);
if (!process.argv.includes('--build')) process.exit(0);
git(['fetch', 'origin', 'main']);
const base = git(['rev-parse', 'origin/main']);
const index = resolve('dist/backdated-export/index');
const env = { GIT_INDEX_FILE: index };
git(['read-tree', base], env);
let parent = base;
const results = [];
for (const [dayIndex, group] of buckets.entries()) {
  if (git(['branch', '--list', group.branch]))
    throw new Error(`Branch exists: ${group.branch}`);
  const commits = [];
  for (const [fileIndex, file] of group.files.entries()) {
    const blob = git(['hash-object', '-w', '--path', file, file]);
    git(
      ['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`],
      env,
    );
    const tree = git(['write-tree'], env);
    const date = new Date(Date.UTC(2025, 10, dayIndex + 1, 4, fileIndex));
    const dateEnv = {
      ...env,
      GIT_AUTHOR_DATE: date.toISOString(),
      GIT_COMMITTER_DATE: date.toISOString(),
    };
    const message = `Import ${file} for ${group.branch.slice(7).replaceAll('-', ' ')}`;
    const commit = git(
      ['commit-tree', tree, '-p', parent, '-m', message],
      dateEnv,
    );
    if (git(['rev-parse', `${parent}^{tree}`]) === tree)
      throw new Error(`Empty import commit rejected: ${file}`);
    commits.push(commit);
    parent = commit;
  }
  git([
    'update-ref',
    `refs/heads/${group.branch}`,
    parent,
    '0000000000000000000000000000000000000000',
  ]);
  results.push({
    day: dayIndex + 1,
    historicalDate: new Date(Date.UTC(2025, 10, dayIndex + 1))
      .toISOString()
      .slice(0, 10),
    branch: group.branch,
    base: dayIndex ? buckets[dayIndex - 1].branch : 'main',
    tip: parent,
    commits,
    files: group.files,
  });
  await writeFile(
    'dist/backdated-export/branches.json',
    JSON.stringify(results, null, 2),
  );
  console.log(
    `Built ${dayIndex + 1}/50: ${group.branch} (${commits.length} commits)`,
  );
}
// Verify the exported tip contains exactly the reviewed snapshot for every imported file.
for (const file of files) {
  if (
    git(['rev-parse', `${parent}:${file}`]) !==
    git(['hash-object', '--path', file, file])
  )
    throw new Error(`Snapshot mismatch: ${file}`);
}
console.log(
  'Verified complete exported snapshot. Original main and working tree are unchanged.',
);
if (process.argv.includes('--push')) {
  git([
    'push',
    '--atomic',
    'origin',
    ...results.map((item) => `${item.branch}:refs/heads/${item.branch}`),
  ]);
  console.log('Pushed all 50 stacked branches without force.');
}
