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

`lml-env.json` is the central policy file for the fixed Lean version, pinned Mathlib base import, trusted-base axiom
policy, default submission metadata path, allowed submission file types, first-run size limits, and checker output
limits. Each present Lake package has its own package-local `lean-toolchain` file recorded by metadata; checkers
should compare those toolchain files against the fixed Lean version, and Lake files against the Mathlib base import
pin. Std is provided by the fixed Lean version and is not listed separately as a base import.

`meta.config.yaml` is the source of truth for submission metadata shape. Keep
READMEs, generated examples, and checker-facing instructions aligned with its
exact field names, required fields, created fields, and
`DeclarationReferences` records.

## Submission dependency policy

The submission-structure model uses statement package terminology, structured proof metadata, and statement-level proof certificates. Keep documentation aligned with `meta.config.yaml`, `import-submission-expectations.md`, and the executable tests, in that order.

A submission is the Lean Meta Library registry entry, not a repository. A source repository may host a submission, and a submission may contain up to two Lake packages: a statement-package and a proof-package. Each of those packages is a Lake package; use "submission" for the Lean Meta Library unit and reserve "repository" for the source checkout or GitHub repository.

Each `submissions.jsonl` row must preserve enough information to locate imported statement and proof package modes. Older rows may still contain a legacy public-statement folder field, but new imports should write statement/proof package locations through `LakeStatementPackage`, `LakeProofPackage`, `Statement Folder`, and `Proof Folder`.

Submission Lean files may directly import Mathlib modules, Std modules, local statement modules, and authorized imported packages only. Declared dependencies use `CurrentSubmission` or `SubmissionSlug`, plus `LeanStatement`, `LatexDefinition`, and `Name`. Actual dependencies come from Lean axiom collection and must be included in the declared dependencies.

## Submission checks

The `.github/actions/test/` folder contains first-run submission package checks. These checks are organized into
category folders: `general`, `statements`, and `proofs`, with shared root helpers for Lean imports, Lean inspection,
fixture execution, and final proof composition. The metadata file is the source of submission information. Run checks with:

```sh
node .github/actions/test/run-all.mjs --meta=path/to/manifest.yaml
```

Pass only one metadata file path, preferably with `--meta=path/to/manifest.yaml`. The older positional form is accepted for compatibility. If no metadata path is provided, each check falls back to `manifest.yaml` in the current working directory; directories are not accepted.

`run-all.mjs` first prepares the Lean packages with `.github/actions/test/statements/prepare-build-cache.mjs`
and `.github/actions/test/proofs/prepare-build-cache.mjs`, then runs static checks in parallel, then runs Lean
inspector checks in parallel against the prepared build. In the import workflow, `Prepare Lean build/cache` is a
separate first step before `Run submission checks`; the check step passes `--skip-build-cache` so preparation is
not repeated. The cache fetch is best-effort and reports warnings, but Lake availability, Lake update, and build
failures reject the submission.

Statement and proof build preparation remain separate. The shared preparation helper writes package-local marker
files under each Lake package's `.lake/` directory, keyed by `LML_CHECK_RUN_ID`, so post-build checker scripts can
be run directly: if the matching marker is missing they prepare the relevant package, and if it is present they
reuse the existing `.lake/build` output. Preparation refreshes old builds in place and warns when it sees a build
without the current marker; it does not run `lake clean`.

`general/metadata-check.mjs` validates metadata structure against `meta.config.yaml` with Ajv before running
non-file semantic checks that the schema cannot express, such as proof entries targeting metadata `Axiom`
statements. File-existence checks belong in `general/files-present.mjs`.

The CLI test command uses the same metadata convention:

```sh
lml test --meta=path/to/manifest.yaml
```

If no metadata path is provided, `lml test` checks `manifest.yaml` in the current working directory and returns an error when that file is missing.

Run the intentionally failing import fixtures with:

```sh
npm run test:imports
```

This command checks every package under `test-imports/` and fails if any fixture is accepted or rejected for an unexpected reason.
Keep `test-imports/` broad enough to cover each executable checker script in `.github/actions/test/`; helper modules are exercised through those checker fixtures.

Each submission consists of statement entries and proofs. Public entries are `Definition` or `Axiom`; statement files should introduce axioms rather than theorem declarations for axiom entries. A statement is classified as a theorem when it has a proof entry of type `proof` or `conditional-proof`; it is classified as a conjecture when it has a proof entry of type `reduction`. An `assumption` is a conjecture expected to be true, and a `conditional-proof` is a proof that relies only on assumptions. Each proof metadata entry uses structured `Theorem` and `Proof` records, and the checker asks Lean `isDefEq` to compare their compiled types. Proof files may rely on definitions, declared dependencies, Std, and Mathlib. The proof-file checker elaborates proof files, rejects proof-file output that reports `sorry` or `sorryAx`, and asks Lean for each metadata proof theorem's compiled axiom dependencies so submitted proofs may not depend on `sorryAx` or local proof-namespace axioms.

The import workflow's final proof build copies the metadata-root package into isolation, runs a clean Lake build, rejects `sorry` output, composes submitted proof targets from metadata `DeclarationReferences`, and accepts only allowed base axioms and declared conjectures. The remaining target work is to import all nested imported submissions into the root Lake file, recursively follow metadata references during the Lean build, rewrite references to proved dependency statements to their proof counterparts while leaving conjectures as conjectures, use the resulting `.olean` files for axiom testing, and compare computed dependency/conjecture information to metadata.

The axiom gate must match axioms by name, type, and source module against a pinned trusted base. Accepted composed proofs should bottom out only in trusted base axioms and declared conjectures.

## Submit workflow

The `.github/workflows/submit.yml` workflow creates or updates a GitHub issue for a submission metadata file. It reads `submissionIssueNumber` from the metadata file when present, otherwise creates a new issue, labels it `submission`, writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file, and commits that metadata update to the source branch. The issue title is the submission title, and the issue body starts with the submission abstract before recording the submitting account login, current repository URL, source branch, source commit, metadata file path, and generated GitHub source URLs. Metadata itself records local paths such as `abstractPath`, not source URLs; URLs are generated from the repository and path.

## Submission status command

The CLI `submission-status` command reports whether a metadata file has a submission issue, whether it has been imported, the related upload/test/finalizing workflow state when available, the distance from the recorded source commit to the current commit, and whether metadata statement files were added, changed, or removed since that source commit.

## Agent introduction command

The CLI `agent-introduction` command prints `agent-info/README.md`, the general Lean Meta Library startup guide for agents. That guide explains the submission model, how to read and preserve `submissions.jsonl`, what the CLI commands do, and points agents to `lml agent-submission-guide` for the paper-submission readiness workflow.

## Agent submission guide command

The CLI `agent-submission-guide` command prints `agent-info/paper-submission-readiness-agent-guide.md`, the guide for agents preparing an arbitrary Lean project as a Lean Meta Library paper submission with user-approved metadata, statement files, and proofs that should pass the local checks.

## Submission structure rework

`agent-info/submission-api-structure-agent-readme.md` records the current submission structure and remaining target rework. Statement-package and proof-package presence is optional, but the package roles remain separate when both are present; do not mix statement and proof content in one package. Package checks run only when the corresponding package is present, statement entries are `Definition` and `Axiom`, metadata uses the exact names in `meta.config.yaml`, proof-level declaration reference metadata is supported, and final proof checking is built around statement-level proof certificates.

## Import submission workflow

The `.github/workflows/import-submission.yml` workflow runs when an issue labeled `submission` is opened, labeled, edited, or reopened. It reads the repository URL, source branch, source commit, metadata file path, and submitted-by login from the issue body, checks out that exact commit, runs the first-run checks from `.github/actions/test/` against the metadata file at that path, then adds or updates the matching submission row in `submissions.jsonl`. Imported rows include the parsed metadata plus source repository, branch, commit, metadata path, source-repository-relative package folder information, issue id/number/url, and submitting user id/login. After a successful import, the workflow comments on and closes the issue.

The import workflow posts issue progress comments after completed milestones so submitters can see which step worked,
how many steps remain, and what runs next. Keep those comments in place for long-running submission checks.

Warning: the import workflow currently passes `GITHUB_TOKEN` as a Git HTTP extra header so it can check out private submitted repositories. This is acceptable temporarily, but it should be removed later when the import path no longer needs private-repository checkout support or has a better long-term authorization design.

## Submission package structure

The CLI `create-paper` command should create the current statement/proof package starter shape. Preserve these target rules:

- A submission may include only a statement package, only a proof package, or
  both; when both are present they remain separate packages and their contents
  must not be mixed.
- A proof package may depend locally on a present statement package.
- Do not require a unique Lean library for each statement folder; each statement must still be included in the shared statement library.
- Use statement package terminology.
- Metadata should use `manifestVersion`, `statementRoot`, `proofRoot`, `submissionSlug`, `submissionTitle`, `bibtex-entries`, `statements`, `proofs`, `Statement`, `Theorem`, `Proof`, `DeclarationReferences`, `LakeStatementPackage`, and `LakeProofPackage`. `statementRoot` and `proofRoot` are folder paths; each must contain a `lakefile.lean` and a `lean-toolchain` file.
- Statement entry types are `Definition` and `Axiom`; statement files only allow axioms for axiom entries.
- If a statement package is present, require its `lakefile.lean`, `lean-toolchain`, and, for each statement entry, a LaTeX file and Lean file.
- If a proof package is present, require its `lakefile.lean` and `lean-toolchain`.
- Generated Lake packages that declare Mathlib must pin it to `lml-env.json`'s exact
  `baseImports.Mathlib.revision`, not to the floating `stable` branch, and package
  `lean-toolchain` files must match `lean.version`.
- Every discharged statement needs one matching proof entry using structured `Theorem` and `Proof` fields, a proof `Type` of `proof`, `conditional-proof`, or `reduction`, and a matching proof file.
