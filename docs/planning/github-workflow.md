# GitHub workflow and protections

Repository: [VforVitorio/peercanvas](https://github.com/VforVitorio/peercanvas), public and owner-managed.

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

- Require strict status checks: CI / lint, CI / format, CI / typecheck, CI / test, CI / frontend-build, CI / native-linux, CI / native-macos, and CI / native-windows.
- Require a pull request but require zero approving reviews. This keeps the PR path for a solo maintainer without making a second reviewer a merge prerequisite.
- Require conversation resolution.
- Do not enforce rules on administrators, but block force pushes and branch deletion.

The script skips branch protection when a branch does not exist or any required context is missing or unsuccessful on that branch's latest commit. Re-run it only after main and dev exist and CI has produced the exact successful check names. This prevents branch protection from waiting forever on a nonexistent status check.

No remote branch refs currently exist. Branch protection is therefore not active yet.

## Repository and Actions settings

The setup script enables Issues, disables the wiki, allows merge commits, disables squash/rebase, and deletes merged head branches. It sets workflow default permissions to read-only; individual workflows request only the writes they need.

The setup script is the only path for repository settings, labels, alert toggles, and branch protection. It supports a dry run and is safe to rerun.

## CI and security

- CI runs separate frontend format, lint, typecheck, test, and build checks, plus native Tauri builds on Ubuntu, macOS, and Windows.
- CodeQL scans Rust, JavaScript/TypeScript, and GitHub Actions. It remains advisory until its baseline is reviewed.
- OSV-Scanner checks pull requests; gitleaks checks repository history and pull requests.
- GitHub Dependabot vulnerability alerts, automated security fixes, secret scanning, push protection, and private vulnerability reporting are enabled.
- Dependabot version updates target **dev** weekly on Monday at 08:00 Europe/Madrid for npm, Cargo, and GitHub Actions. GitHub may target security updates at the default branch.
- Every third-party GitHub Action is pinned to a full commit SHA with a release-version comment for Dependabot.
- Labeler runs only for same-repository pull requests; pull requests from forks must be labeled manually.
- No workflow uses **pull_request_target**.
- Release-please uses GitHub's built-in token. GitHub does not trigger a new workflow run for pull requests created with that token, so CI checks on a release PR may need a maintainer to dispatch CI on that PR branch. A dedicated GitHub App or narrowly scoped token can be added later if unattended checks are required; do not store a personal credential in the repository.

The workflows are present locally, but GitHub Actions has not run them because no commit has been pushed. Do not describe a workflow as passing until a run exists.

## Issue hierarchy and board

PLANS.md maps WP-00 through WP-12 to 13 parent Issues, 41 native sub-issues, and milestones S0 through S7. The [subissue map](subissue-map.md) links every OpenSpec task ID to its child Issue. The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) contains all 54 Issues. Status columns group work; milestone and parent issue fields are visible on board cards. The project view selector also exposes the issue table. All items currently start in Todo.

## Setup procedure

After the maintainer creates and pushes the initial **main** and **dev** refs, allow their CI runs to complete and pass. Then run:

```sh
scripts/setup-github.sh
```

The script applies repository settings and labels idempotently, enables security settings, and applies strict branch protection only when both the refs and successful required contexts are available.
