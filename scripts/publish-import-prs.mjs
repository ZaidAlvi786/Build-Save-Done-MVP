// Publish draft PRs for the already-pushed, stacked import branches.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
const repo = 'ZaidAlvi786/Build-Save-Done-MVP';
const records = JSON.parse(
  await readFile('dist/backdated-export/branches.json', 'utf8'),
);
if (records.length !== 50)
  throw new Error('Expected the complete 50-branch export');
const auth = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\nusername=ZaidAlvi786\n\n',
  encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
});
const token = auth.stdout
  ?.split(/\r?\n/)
  .find((line) => line.startsWith('password='))
  ?.slice(9);
if (auth.status !== 0 || !token)
  throw new Error('GitHub API authentication unavailable');
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'Content-Type': 'application/json',
      'User-Agent': 'saved-done-stacked-import',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(
      `GitHub API ${method} failed with HTTP ${response.status}; inspect repository and rate limits before retrying.`,
    );
  return response.json();
}
const identity = await api('/user');
if (identity.login.toLowerCase() !== 'zaidalvi786')
  throw new Error('Unexpected GitHub account');
const existing = await api(`/repos/${repo}/pulls?state=all&per_page=100`);
const results = [];
for (const item of records) {
  const found = existing.find(
    (pr) => pr.head.ref === item.branch && pr.base.ref === item.base,
  );
  const title = `${String(item.day).padStart(2, '0')}/50: ${item.branch.slice(7).replaceAll('-', ' ')}`;
  const body =
    `Import the existing Saved Done implementation for ${item.branch.slice(7).replaceAll('-', ' ')}.\n\n` +
    `This is part ${item.day} of a stacked, 50-PR source import. Review against ${item.base}; preserve that dependency when merging. ` +
    `This portion contains ${item.commits.length} nonempty file-import commits.\n\n` +
    `Files:\n${item.files.map((file) => '- ' + file).join('\n')}\n\n` +
    `Commit author and committer timestamps were set to ${item.historicalDate} at the owner's request. ` +
    `These are retrospective import timestamps, not evidence that development or PR creation occurred then. ` +
    `GitHub publication timestamps reflect the actual import.\n\n` +
    `Validation: local import verifies the final tip matches the reviewed working-tree snapshot and excludes local secret environment files. ` +
    `Intermediate stacked imports are partial assemblies; full-app validation applies to the complete stack. ` +
    `Release remains on hold for the documented live-provider, device, native-monitoring, security, and owner evidence gates.`;
  const pr =
    found ||
    (await api(`/repos/${repo}/pulls`, 'POST', {
      title,
      body,
      head: item.branch,
      base: item.base,
      draft: true,
    }));
  results.push({
    ...item,
    url: pr.html_url,
    number: pr.number,
    draft: pr.draft,
  });
  await writeFile(
    'dist/backdated-export/pull-requests.json',
    JSON.stringify(results, null, 2),
  );
  console.log(`${item.day}/50 ${pr.html_url}`);
  if (!found) await new Promise((resolve) => setTimeout(resolve, 1800));
}
await writeFile(
  'dist/backdated-export/REPORT.md',
  '# Backdated source import\n\n' +
    '50 stacked draft PRs; historical Git dates November 1–December 20, 2025. GitHub creation dates are actual publication dates. No PRs merged.\n\n' +
    '| Part | Branch | Git date | Commits | PR |\n|---|---|---|---:|---|\n' +
    results
      .map(
        (item) =>
          `| ${item.day} | ${item.branch} | ${item.historicalDate} | ${item.commits.length} | [#${item.number}](${item.url}) |`,
      )
      .join('\n') +
    '\n',
);
console.log(
  `Complete: ${results.length} draft PRs. Evidence in dist/backdated-export/REPORT.md.`,
);
