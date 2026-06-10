Any agent should add the information I am giving.

This repository is the Lean Meta Library workspace. Keep project notes, structure, and policy details up to date as new instructions arrive.

Use `main` for now, and push changes when a task is complete.

Read this file before making changes, then preserve the existing folder roles:

- `.website`: GitHub Pages site.
- `.github`: GitHub workflows plus import policy and automation helper scripts under `.github/actions`.
- `.cli-tooling`: npm CLI tooling.
- `test-imports`: intentionally failing submission packages for import-check regression testing.
- `submissions.jsonl`: root-level JSON Lines submission log.
- `lml-env.json`: repository-level values that may change later but are fixed for all Lean Meta Library projects right now.

`lml-env.json` is the central policy file for the current Lean toolchain, pinned mathlib repository and revision,
default submission metadata path, allowed submission file types, allowed direct import prefixes, first-run size
limits, checker output limits, and final proof-build base axiom signatures. The Lean toolchain value carries the
Lean version; Lake ships with that toolchain, so separate `lean.version` and `lake.version` fields are not kept.

## Submission dependency policy

`structure-update-guidelines` is the ground truth for the upcoming submission-structure rework. When it conflicts with older surface-package wording in this file or in generated examples, follow `structure-update-guidelines` and update the stale documentation.

Each `submissions.jsonl` row must preserve enough information to locate imported statement/declaration and proof package modes. Older rows may still record `Repo Url`, `Source Branch`, `Source Commit`, and `Surface Folder`; the target metadata also records `githubRepo`, `Lake Statement Package`, and `Lake Proof Package`.

Submission Lean files may directly import Mathlib modules, Std modules, local statement/declaration modules, and authorized imported packages only. Declared dependencies use `Package`, `File`, and `Name` records. Actual dependencies come from Lean axiom collection and must be included in the declared dependencies.

## Submission checks

The `.github/actions/test/` folder contains first-run submission package checks. The metadata file is the source of submission information. Run checks with:

```sh
node .github/actions/test/run-all.mjs --meta=path/to/meta.yaml
```

Pass only one metadata file path, preferably with `--meta=path/to/meta.yaml`. The older positional form is accepted for compatibility. If no metadata path is provided, each check falls back to `meta.yaml` in the current working directory; directories are not accepted.

`run-all.mjs` first prepares the Lean packages with `.github/actions/test/prepare-build-cache.mjs`, then runs static checks in parallel, then runs Lean inspector checks in parallel against the prepared build. In the import workflow, `Prepare Lean build/cache` is a separate first step before `Run submission checks`; the check step passes `--skip-build-cache` so preparation is not repeated. The cache fetch is best-effort and reports warnings, but Lake update and build failures reject the submission.

The CLI test command uses the same metadata convention:

```sh
lml test --meta=path/to/meta.yaml
```

If no metadata path is provided, `lml test` checks `meta.yaml` in the current working directory and returns an error when that file is missing.

Run the intentionally failing import fixtures with:

```sh
npm run test:imports
```

This command checks every package under `test-imports/` and fails if any fixture is accepted or rejected for an unexpected reason.
Keep `test-imports/` broad enough to cover each executable checker script in `.github/actions/test/`; helper modules are exercised through those checker fixtures.

Each submission consists of statement/declaration entries and proofs. Public entries are `Definition` or `Axiom`; `Statement` is being replaced by `Axiom`, and statement/declaration files should introduce axioms rather than theorem declarations. A statement is classified as a theorem when it has a proof entry of type `proof` or `conditional-proof`; it is classified as a conjecture when it has a proof entry of type `reduction`. An `assumption` is a conjecture expected to be true, and a `conditional-proof` is a proof that relies only on assumptions. Each proof metadata entry uses structured `Theorem` and `Proof` records, and the checker asks Lean `isDefEq` to compare their compiled types. Proof files may rely on definitions, declared dependencies, Std, and Mathlib. The proof-file checker elaborates proof files, rejects proof-file output that reports `sorry` or `sorryAx`, and asks Lean for each metadata proof theorem's compiled axiom dependencies so submitted proofs may not depend on `sorryAx` or local proof-namespace axioms.

The import workflow's final proof build is being reworked. The target check imports all nested imported repositories into the root Lake file, recursively follows metadata references during the Lean build, rewrites references to proved dependency statements to their proof counterparts while leaving conjectures as conjectures, uses the resulting `.olean` files for axiom testing, and compares computed dependency/conjecture information to metadata.

The axiom gate must match axioms by name, type, and source module against a pinned trusted base. Accepted composed proofs should bottom out only in trusted base axioms and declared conjectures.

## Submit workflow

The `.github/workflows/submit.yml` workflow creates or updates a GitHub issue for a submission metadata file. It reads `submissionIssueNumber` from the metadata file when present, otherwise creates a new issue, labels it `submission`, writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file, and commits that metadata update to the source branch. The issue title is the submission title, and the issue body starts with the submission abstract before recording the submitting account login, current repository URL, source branch, source commit, metadata file path, and generated GitHub source URLs. Metadata itself records local paths such as `abstractPath`, not source URLs; URLs are generated from the repository and path.

## Submission status command

The CLI `submission-status` command reports whether a metadata file has a submission issue, whether it has been imported, the related upload/test/finalizing workflow state when available, the distance from the recorded source commit to the current commit, and whether metadata statement/declaration files were added, changed, or removed since that source commit.

## Agent introduction command

The CLI `agent-introduction` command prints `agent-info/README.md`, the general Lean Meta Library startup guide for agents. That guide explains the submission model, how to read and preserve `submissions.jsonl`, what the CLI commands do, and points agents to `lml agent-submission-guide` for the paper-submission readiness workflow.

## Agent submission guide command

The CLI `agent-submission-guide` command prints `agent-info/paper-submission-readiness-agent-guide.md`, the guide for agents preparing an arbitrary Lean project as a Lean Meta Library paper submission with user-approved metadata, statement/declaration files, and proofs that should pass the local checks.

## Submission structure rework

`agent-info/submission-api-structure-agent-readme.md` records the target submission structure rework before checker and CLI code changes are made. It follows `structure-update-guidelines`: separate proof and statement/declaration packages are optional, package checks run only when the corresponding package is present, statement entries are `Definition` and `Axiom`, metadata uses the new checklist names, proof-level used-file metadata is supported, and final proof checking is built around statement-level proof certificates.

## Import submission workflow

The `.github/workflows/import-submission.yml` workflow runs when an issue labeled `submission` is opened, labeled, edited, or reopened. It reads the repository URL, source branch, source commit, metadata file path, and submitted-by login from the issue body, checks out that exact commit, runs the first-run checks from `.github/actions/test/` against the metadata file at that path, then adds or updates the matching row in `submissions.jsonl`. Imported rows include the parsed metadata plus repository, branch, commit, metadata path, repository-relative package folder information, issue id/number/url, and submitting user id/login. After a successful import, the workflow comments on and closes the issue.

The import workflow posts issue progress comments after completed milestones so submitters can see which step worked,
how many steps remain, and what runs next. Keep those comments in place for long-running submission checks.

Warning: the import workflow currently passes `GITHUB_TOKEN` as a Git HTTP extra header so it can check out private submitted repositories. This is acceptable temporarily, but it should be removed later when the import path no longer needs private-repository checkout support or has a better long-term authorization design.

## Submission package structure

The CLI `create-paper` command may still create the older starter shape until the rework is implemented. For new structure work, preserve these target rules from `structure-update-guidelines`:

- Submissions no longer need separate proof and statement/declaration packages.
- A proof package depending locally on `Slug.Surface` from `./surface-package` remains allowed, but is not expected.
- Do not require a unique Lean library for each statement folder; each statement must still be included in the shared statement library.
- Use `DeclarationPackage` instead of `Surface Package`.
- Metadata should move from `surfaceLakefilePath`, `namespaceSlug`, `paperTitle`, `bibtex`, `declarations`, and `usedSurfaceFiles` to `statementLakefilePath`, `packageSlug`, `submissionTitle`, `bibtex-entries`, `statements`, and used-file records with `Package`, `File`, and `Name`.
- Statement entry types are `Definition` and `Axiom`; statement/declaration files only allow axioms for statement entries.
- If a statement/declaration package is present, require its `lakefile.lean` and, for each theorem or definition, a LaTeX file and Lean file.
- If a proof package is present, require its `lakefile.lean`.
- Generated Lake packages must pin mathlib to `lml-env.json`'s exact `mathlib.revision`, not to the floating `stable` branch.
- Every discharged statement needs one matching proof entry using structured `Theorem` and `Proof` fields, a proof `Type` of `proof`, `conditional-proof`, or `reduction`, and a matching proof file.
