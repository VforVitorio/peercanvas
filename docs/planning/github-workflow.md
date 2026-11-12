# GitHub workflow and protections

Repository: [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas), public and owner-managed.

## Branch and pull request flow

- **main** is the default, stable branch.
- **dev** is the integration branch.
- Short-lived **feature/** branches start from **dev** and use pull requests back to **dev**.
- Sprint promotion pull requests move reviewed, working batches from **dev** to **main**.
- Use merge commits. Squash and rebase merges are disabled. Merged short-lived feature branches are deleted.
- Do not create a long-lived **test** branch.
- Each WP is an epic parent issue, and each checkbox in the OpenSpec task list has one native child issue under that WP. Child issues carry the WP's sprint milestone and task ID.
- A task PR is single-concern, links the child issue and parent WP, and closes the child. Close the parent only after every child is complete and the parent acceptance criteria are verified. Sprint milestones group related work; they do not replace issues.
- No planned or empty PRs are created. The maintainer owns commits, pushes, and merges.
- The default PR checklist is in .github/pull_request_template.md. Use .github/PULL_REQUEST_TEMPLATE/feature-to-dev.md for feature branches and .github/PULL_REQUEST_TEMPLATE/dev-promotion-to-main.md for sprint promotion.

The default PR template is .github/pull_request_template.md. GitHub also offers the focused feature-to-dev template in .github/PULL_REQUEST_TEMPLATE/feature-to-dev.md and the sprint promotion template in .github/PULL_REQUEST_TEMPLATE/dev-promotion-to-main.md.

## Branch protection

The reproducible source of truth is scripts/setup-github.sh. Its exact policy for **main** and **dev** is:

- Require strict status checks with the exact job names emitted by Actions: `lint`, `format`, `typecheck`, `test`, `frontend-build`, `native-linux`, `native-macos`, and `native-windows`.
- Require a pull request but require zero approving reviews. This keeps the PR path for a solo maintainer without making a second reviewer a merge prerequisite.
- Require conversation resolution.
- Enforce rules for administrators, block force pushes and branch deletion.

The script skips branch protection when a branch does not exist and checks that every required context matches a named job in `.github/workflows/ci.yml`. Verify the exact check names on a pull request before applying the policy; status checks are enforced on subsequent pull requests, even when the initial scaffold predates the native build jobs.

As of 2026-11-10, GitHub API readback confirms that the policy is active on both **main** and **dev**. PR #61 verified the eight required check names; PR #71 passed the full check set and the test-only native canvas smoke on Linux, macOS, and Windows.

## Repository and Actions settings

The setup script enables Issues, disables the wiki, allows merge commits, disables squash/rebase, and deletes merged head branches. It sets workflow default permissions to read-only; individual workflows request only the writes they need.

The setup script is the only path for repository settings, labels, alert toggles, and branch protection. It supports a dry run and is safe to rerun.

## CI and security

- CI runs separate frontend format, lint, typecheck, test, and build checks on pull requests to **dev** and **main**, plus on pushes to **main**. It no longer repeats the full matrix on every push to `dev`; merged PRs have already passed the required PR checks. The native matrix preserves the required `native-linux`, `native-macos`, and `native-windows` contexts. It runs persistence tests and production Tauri builds on all three systems for application, Tauri, dependency, and workflow changes. Documentation, history, test-only, UI-mock, and unrelated workflow/settings changes keep those contexts green while skipping expensive native steps; an unknown event or failed change classification falls back to full checks.
- The test-only WebDriver canvas probe runs on changes to its Tauri/Weave/canvas harness, native dependencies/build configuration, or through `workflow_dispatch`; unrelated application/documentation changes skip it. It validates one isolated fixture, not product document workflows or release accessibility. The production isolation check remains part of every native-sensitive build.
- GitHub Actions cancels an older run only when a newer commit updates the same pull request. Main-branch validation and manual dispatches are not cancelled.
- CodeQL scans Rust, JavaScript/TypeScript, and GitHub Actions. It remains advisory until its baseline is reviewed.
- OSV-Scanner checks pull requests; gitleaks checks repository history and pull requests.
- GitHub Dependabot vulnerability alerts, automated security fixes, secret scanning, push protection, and private vulnerability reporting are enabled.
- Dependabot version updates target **dev** weekly on Monday at 08:00 Europe/Madrid for npm, Cargo, and GitHub Actions. GitHub may target security updates at the default branch.
- Every third-party GitHub Action is pinned to a full commit SHA with a release-version comment for Dependabot.
- Prettier excludes only the root and `src-tauri/` Release Please-generated changelogs; maintained documentation remains formatted and checked.
- Labeler runs only for same-repository pull requests; pull requests from forks must be labeled manually.
- No workflow uses **pull_request_target**.
- Release-please uses a short-lived GitHub App installation token because the organization blocks `GITHUB_TOKEN` from creating or approving pull requests. Configure repository variable `RELEASE_PLEASE_APP_CLIENT_ID` and secret `RELEASE_PLEASE_APP_PRIVATE_KEY`; install the App only on `Peer2Canvas` with Contents, Issues, and Pull requests write permissions. The workflow further scopes its token to that repository and those three permissions. Default `GITHUB_TOKEN` permissions remain read-only, and no workflow auto-approves or auto-merges. App-created release PRs can trigger the normal pull-request workflows. Do not store a personal credential in the repository.
- `gitleaks` uses the pinned, checksum-verified open-source CLI so secret scanning runs without the commercial GitHub Action license. Output is redacted; the job scans repository history on push and pull-request events.
- Prettier excludes the root and `src-tauri/` changelogs generated by Release Please; maintained documentation remains formatted and checked.

The test-only native smoke adds interaction evidence to the native builds. It does not replace manual product, accessibility, recovery, or peer-network smoke checks. Report checks as passing only when the linked Actions run shows success.

## Issue hierarchy and board

PLANS.md maps the current work packages and sprint milestones. The [subissue map](subissue-map.md) links OpenSpec tasks to their child Issues. The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) currently contains 69 items: 16 WP parents, 52 task issues, and supplemental issue #81 across 11 milestones (S0–S10). Status columns group work; milestone and parent issue fields are visible on board cards. Infrastructure maintenance issue #111 is tracked under WP-11 but has no product OpenSpec task. Parent WPs close only when all child tasks and acceptance criteria pass.

## Setup procedure

After a pull request run has verified the required check names and all checks pass, run:

```sh
scripts/setup-github.sh
```

The script applies repository settings and labels idempotently, enables security settings, and applies strict branch protection to existing **main** and **dev** refs. Its required check contexts are read from the named jobs in `.github/workflows/ci.yml`; confirm the Actions check-run names on a pull request before applying the policy.
