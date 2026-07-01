This file is the system prompt for AI agents working **on this repository** —
implementing checkers, updating workflows, maintaining documentation, or making
structural changes. Tools like Claude Code load it automatically at session
start.

It is distinct from `agent-info/README.md`, which is the guide for AI agents
helping **users prepare and submit** Lean proofs. That guide is printed by
`lml agent-introduction` and is synced to users' local checkouts; it has a
different audience and a different purpose.

This repository is the Lean Meta Library workspace. Read this file before making
changes, then keep project notes, structure, and policy details up to date as
new instructions arrive.

Use `main` for now, and push changes when a task is complete.

## Folder Roles

- `.website`: GitHub Pages site.
- `.github`: GitHub workflows plus import policy and automation helper scripts
  under `.github/actions`.
- `.cli-tooling`: npm CLI tooling.
- `agent-info`: agent startup guide for working with submissions (`README.md`) and creating submissions
  (`submission-guide.md`), synced to users by `lml init`/`lml update`.
- `development-info`: implementation reference and repository-content policy
  for maintainers (`submission-api-structure-agent-readme.md`,
  `import-submission-expectations.md`). Not synced to users.
- `test-imports`: intentionally failing submission packages for import-check
  regression testing.
- `submissions.jsonl`: root-level JSON Lines submission registry.
- `lml-env.json`: repository-level policy file — fixed Lean version, pinned
  Mathlib base import, trusted-base axiom policy, default manifest path, allowed
  file types, and size limits.

## Authoritative Sources

Always prefer the earlier source in this order when files disagree; update the
later source to match:

1. `manifest.config.yaml` — source of truth for manifest field names and shape.
   Keep all READMEs, examples, and checker instructions aligned with its exact
   field names and required/created fields.
2. `submission-record.config.yaml` — source of truth for the structure of
   imported submission records in `submissions.jsonl`.
3. `development-info/import-submission-expectations.md` — repository-content policy enforced by
   the import checks.
4. `.github/actions/test/` and `test-imports/` — currently implemented checker
   behavior.

## Key Commands

Run submission checks against a manifest file:

```sh
node .github/actions/test/run-all.mjs --manifest=path/to/manifest.yaml
# or via CLI:
lml test --manifest=path/to/manifest.yaml
```

Run the intentionally failing import fixtures:

```sh
npm run test:imports
```

Every package under `test-imports/` must be rejected for its documented reason.
Keep `test-imports/` broad enough to cover each executable checker script in
`.github/actions/test/`.

## Checker Architecture

`.github/actions/test/` organizes checks into category folders: `general`,
`statements`, and `proofs`, with shared root helpers for Lean imports,
inspection, fixture execution, and final proof composition.

`run-all.mjs` first prepares Lean packages (statement and proof build
preparation remain separate), then runs static checks in parallel, then runs
Lean inspector checks in parallel. The import workflow runs preparation as a
separate step and passes `--skip-build-cache` to the check step to avoid
repeating it.

The preparation helper writes package-local marker files under each Lake
package's `.lake/` directory, keyed by `LML_CHECK_RUN_ID`. Post-build checker
scripts reuse the existing `.lake/build` output when the marker matches, or
prepare the package themselves when it is missing.

`general/manifest-check.mjs` validates manifest structure against
`manifest.config.yaml` with Ajv before running semantic checks the schema cannot
express. File-existence checks belong in `general/files-present.mjs`.

## Submit Workflow

`.github/workflows/submit.yml` creates or updates a GitHub issue for a
submission manifest. It reads `submissionIssueNumber` from the manifest when
present, otherwise creates a new issue, labels it `submission`, names it with
the `SubmissionName` value, starts the body with the `AbstractPath` content, and
records the submitting login, repository URL, source branch, source commit, and
manifest file path. It then writes `submissionIssueNumber`, `submissionIssueUrl`,
and `Commit` back to the manifest and commits that update to the source branch.

## Import Workflow

`.github/workflows/submission-intake.yml` runs when an issue is opened, edited,
or reopened. If the issue body contains the Lean Meta Library submission marker
and the required source fields are well formed, it adds the `submission` label
using the repository workflow token. This lets public submitters create
submission issues without needing label permissions.

`.github/workflows/import-submission.yml` runs when an issue labeled
`submission` is opened, labeled, edited, or reopened. It reads the repository
URL, source branch, source commit, manifest path, and submitted-by login from
the issue body, checks out that exact commit from a public GitHub repository,
runs the first-run checks, then adds or updates the matching row in
`submissions.jsonl`. After a successful import it comments on and closes the
issue. Progress comments are posted after each completed milestone so submitters
can see which step worked and what runs next. Failed or cancelled import runs
post an issue comment with the failed job and step.

## Submission Quality Guardrails and Pitfalls

When preparing or reviewing Lean Meta Library submissions, prioritize transparency over brevity.
Definitions must be fully unpacked. Do not hide mathematical content behind opaque helper predicates,
bundled abbreviations, or underspecified local definitions. Every submitted definition should spell out
its substance directly, bottoming out in Mathlib definitions, Lean core definitions, or previously
accepted/proven LML statements. If a helper definition is introduced, its own entry must be equally
transparent and its role must be clear from the Lean statement and TeX.

For intendedly self-contained submissions, never leave an axiom or declared assumption without a proof path.
Every axiom-like dependency must be either:
- already part of Lean/Mathlib/classical logic,
- an already accepted proven LML statement, or
- accompanied by a complete submitted proof in the same dependency chain.

Do not submit an intendedly self-contained result if any part of the proof is merely asserted, skipped,
hidden behind a contract, or represented by an unproved axiom. If a dependency is intentionally unproved,
the submission must be marked and described as conditional.

For every entry, check the associated TeX before submission. The TeX must clearly correspond to the Lean entry,
explain the same mathematical statement, and make the match between the prose mathematics and the Lean
hypotheses/conclusion transparent. The TeX should not describe a stronger, weaker, or merely related theorem;
it should track the submitted Lean statement closely enough that a reviewer can compare them line by line.