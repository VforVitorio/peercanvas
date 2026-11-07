#!/usr/bin/env bash
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-VforVitorio/peercanvas}"
BRANCHES=(main dev)
REQUIRED_CONTEXTS=(
  "lint"
  "format"
  "typecheck"
  "test"
  "frontend-build"
  "native-linux"
  "native-macos"
  "native-windows"
)
LABELS=(
  "bug|d73a4a|Something is not working"
  "task|c5def5|Subtask tracked under a working-package issue"
  "enhancement|a2eeef|New capability or improvement"
  "epic|5319e7|Groups related work packages"
  "infra|1d76db|Repository and engineering infrastructure"
  "dependencies|0366d6|Dependency update or review"
  "security|b60205|Security-related work"
  "documentation|0075ca|Documentation change"
  "priority: high|b60205|High priority"
  "priority: medium|fbca04|Medium priority"
  "priority: low|0e8a16|Low priority"
  "area: desktop|0052cc|Tauri and native desktop"
  "area: frontend|1d76db|React and frontend"
  "area: collaboration|5319e7|Yjs, WebRTC and sessions"
  "area: ai|d876e3|Codex, providers and MCP"
  "area: interchange|006b75|draw.io and document formats"
  "area: security|b60205|Security and privacy"
  "area: docs|0075ca|Documentation and specifications"
  "area: ci-cd|0e8a16|CI, release and repository automation"
  "area: deps|0366d6|Dependency management"
)

DRY_RUN=false
if [[ "$#" -gt 1 ]]; then
  printf 'Usage: %s [--dry-run]\n' "$0" >&2
  exit 2
fi
if [[ "$#" -eq 1 ]]; then
  [[ "$1" == "--dry-run" ]] || { printf 'Unknown option: %s\n' "$1" >&2; exit 2; }
  DRY_RUN=true
fi

command -v gh >/dev/null || { printf 'GitHub CLI (gh) is required.\n' >&2; exit 1; }
gh auth status >/dev/null
gh repo view "$REPO" --json name >/dev/null

printf 'Configuring GitHub repository %s\n' "$REPO"

for context in "${REQUIRED_CONTEXTS[@]}"; do
  explicit_job="  $context:"
  matrix_job="check: $context"
  if ! grep -Fq "$explicit_job" .github/workflows/ci.yml || ! grep -Fq "name: $context" .github/workflows/ci.yml; then
    if [[ "$context" != native-* ]] || ! grep -Fq "  native-build:" .github/workflows/ci.yml || ! grep -Fq "$matrix_job" .github/workflows/ci.yml; then
      printf 'Required check %s must match a named job in .github/workflows/ci.yml.\n' "$context" >&2
      exit 1
    fi
  fi
done

if "$DRY_RUN"; then
  printf '[dry-run] repository merge and issue settings\n'
else
  gh api -X PATCH "repos/$REPO" --input - >/dev/null <<'JSON'
{
  "has_issues": true,
  "has_wiki": false,
  "allow_merge_commit": true,
  "allow_squash_merge": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true
}
JSON
fi

if "$DRY_RUN"; then
  printf '[dry-run] set Actions workflow permissions to read-only\n'
else
  gh api -X PUT "repos/$REPO/actions/permissions/workflow" --input - >/dev/null <<'JSON'
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
JSON
fi

if "$DRY_RUN"; then
  printf '[dry-run] enable Dependabot alerts, secret scanning, push protection, and private vulnerability reports\n'
else
  gh api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null
  gh api -X PUT "repos/$REPO/automated-security-fixes" >/dev/null
  gh api -X PUT "repos/$REPO/private-vulnerability-reporting" >/dev/null
  if ! gh api -X PATCH "repos/$REPO" --input - >/dev/null <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
  then
    printf 'Warning: GitHub did not enable secret scanning or push protection. Check repository Security settings.\n' >&2
  fi
fi

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color description <<< "$entry"
  if "$DRY_RUN"; then
    printf '[dry-run] label %s (%s)\n' "$name" "$color"
  else
    gh label create "$name" --color "$color" --description "$description" --force
  fi
done

for branch in "${BRANCHES[@]}"; do
  if ! gh api "repos/$REPO/branches/$branch" --jq .name >/dev/null 2>&1; then
    printf 'Skipping protection for %s: branch ref does not exist yet.\n' "$branch"
    continue
  fi

  if "$DRY_RUN"; then
    printf '[dry-run] apply strict PR protection to %s\n' "$branch"
  else
    contexts_json="$(printf '"%s",' "${REQUIRED_CONTEXTS[@]}")"
    contexts_json="[${contexts_json%,}]"
    payload="$(cat <<JSON
{
  "required_status_checks": {"strict": true, "contexts": $contexts_json},
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "required_conversation_resolution": true,
  "restrictions": null,
  "lock_branch": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
    )"
    printf '%s\n' "$payload" | gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null
  fi
done

printf 'GitHub settings complete. CodeQL and vulnerability scans remain advisory until their baselines are reviewed.\n'
