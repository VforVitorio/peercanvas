# Reusable Codex prompts

These prompts are starting points. They do not grant implementation or publication permission. The maintainer authorizes each product change.

## Start a work package

```text
Read AGENTS.md, PLANS.md, the parent WP issue, the matching child sub-issue, its OpenSpec task, relevant product requirements/specs, linked ADRs, and risk entries. Summarize the approved scope, dependencies, acceptance criteria, and unresolved decisions. Do not edit files yet. Identify the smallest coherent OpenSpec change and ask for approval if behavior or scope would materially change.
```

## Prepare an OpenSpec change

```text
Use the repository's OpenSpec Codex skill and configured spec-driven schema. Read all dependent artifacts from disk, create the proposal/specification/design/tasks needed for this one change, and verify them with OpenSpec. Do not implement product code. Stop with a concise Spanish summary of scope, decisions, tasks, risks, and evidence.
```

## Implement an approved change

```text
Implement only the user-approved OpenSpec change and linked child sub-issue under its parent WP. Preserve the canonical document command boundary, security constraints, and ownership rules in AGENTS.md. Add the smallest tests needed for the changed behavior. Do not commit, push, merge, or publish unless the user explicitly authorizes each action for this task. If acceptance criteria or scope must change, stop and report why.
```

## Verify a change

```text
Run only the checks relevant to this change plus the repository-required CI checks. Report each exact command and whether it passed. Separate automated, native OS, manual, and untested behavior. Do not claim a platform, network path, license, or performance target was validated unless the evidence exists.
```

## Review a PR

```text
Review the complete changed code and its callers against the issue, approved OpenSpec, requirements, security boundary, and tests. Report actionable findings with file and line, severity, impact, and a concrete fix. Do not edit the branch or submit a GitHub review unless explicitly requested.
```

## Close a work package and hand off

```text
Compare the merged work with its acceptance criteria. Update requirement/OpenSpec/ADR/risk/traceability records only where the evidence requires it. Update docs/handoff/START_HERE.md with verified status, exact checks, remaining risks, and the next approved task. Do not create a commit.
```
