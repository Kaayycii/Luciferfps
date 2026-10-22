# Security and access

The public website is intended for browsing, feedback and personal planning. Website visitors cannot publish repository changes. Browser tools can change a visitor's own screen, not the deployed site. Anyone who can load public pages can inspect their delivered JavaScript, images and bundled data; these must never contain secrets or confidential reports.

Repository visibility and website access are separate controls. A private repository restricts its original source and history to authorized GitHub users and installed integrations, while the Vercel website can remain public. Previous public copies and forks cannot be recalled. Repository privacy is not a guarantee against attacks.

## Automated checks

`Security checks` runs on pushes, pull requests, manual dispatch and Mondays at 14:00 UTC. It grants read-only repository and pull-request access. Its official actions are pinned to immutable commits.

- Gitleaks 8.30.1 scans the pushed or proposed commit range. Manual and scheduled runs scan the fetched Git history. Output is redacted; PR comments, summary reports and report artifact uploads are disabled. The action needs no license key for this personal-account repository. No blanket ignore rules are installed.
- `npm audit --package-lock-only --audit-level=high` checks the lockfile against the registry's current advisories, without installing packages or automatically changing dependencies. High and critical findings fail the check; lower-severity findings remain visible for review. An unavailable registry also fails the job.
- The existing Monday data updater validates data, tests, media, build and dependency advisories. When data changes, it commits locally, scans the resulting Git history, and only then pushes. This prevents the updater's own `GITHUB_TOKEN` push from skipping the secret check: GitHub normally does not launch an ordinary push workflow from that token.

These are detection checks, not GitHub's native pre-push secret protection. Ordinary developer pushes have already reached GitHub when the workflow runs. Checks do not automatically block Vercel deployments or owner merges unless the host and repository rules are configured to require them. A green result covers recognized patterns and known advisories, not every vulnerability. Review failures promptly; revoke or rotate a real exposed credential even if it has been removed from the latest file. Do not silence findings with broad file exclusions.

## Private work and account access

The analyst workspace currently saves reports in the user's browser and does not publish them automatically. Those local reports are unencrypted; other users of the same browser profile can access them. Optional analyst cloud backup requires a separately configured Supabase project with tested owner-only database rules. Its sign-in is not a whole-site gate or a reviewer-invitation system. Public map rooms must not be used for confidential team work.

Keep GitHub and Vercel account access limited to intended maintainers. Enable owner-controlled two-factor authentication or passkeys and retain recovery methods securely. Review installed apps and collaborators before granting access. Never put service-role keys, passwords or deployment-hook URLs in source files, browser-prefixed environment variables, issue comments or screenshots. Store deployment secrets only in the appropriate encrypted host or GitHub Actions settings. Security checks do not configure account MFA on the owner's behalf.

Primary references: [GitHub repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility), [Gitleaks action and personal-account licensing](https://github.com/gitleaks/gitleaks-action), [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/), and [GitHub token workflow behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
