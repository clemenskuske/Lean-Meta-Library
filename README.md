# Lean Meta Library

Lean Meta Library workspace.

## Beta CLI Package

The beta CLI package is available as [lean-meta-library-cli.tgz](lean-meta-library-cli.tgz).

For repository users who want only the npm package without cloning the repository:

```sh
gh api "repos/clemenskuske/Lean-Meta-Library/contents/lean-meta-library-cli.tgz?ref=main" --jq .content | base64 --decode > lean-meta-library-cli.tgz
npm install -g ./lean-meta-library-cli.tgz
lml --help
```

## Project Environment

Repository-level values that may change later but are fixed for all projects right now live in `lml-env.json`.
CLI tooling and submission checks import this file for the Lean toolchain, mathlib revision, default metadata path,
allowed submission file/import policy, first-run size limits, checker output limits, and final proof-build base axiom signatures.

## Submission Contract

A submission consists of public statement/declaration entries, proof artifacts,
and metadata. The structure rework moves the checker and CLI vocabulary toward
statement/declaration packages, structured proof metadata, and statement-level
proof certificates.

Statement entries use the new metadata vocabulary:

- `Definition` entries introduce Lean `def`s.
- `Axiom` entries introduce Lean `axiom`s. Statement files must not introduce
  theorem declarations as submitted statement content.
- Metadata uses `packageSlug`, `submissionTitle`, `statementLakefilePath`,
  `statements`, and `bibtex-entries` rather than the older surface-oriented
  names.

```lean
axiom Statements.Entry.entry : SomeStatement
```

Proof entries have type `proof`, `conditional-proof`, or `reduction`. They name
the discharged theorem and proof target with structured `Theorem` and `Proof`
records containing `Package`, `File`, and `Name`. The proof target must have the
same Lean type as the statement axiom:

```lean
theorem Proofs.Entry.entry : SomeStatement := by
  ...
```

When `lml test` runs, each proof metadata entry lets Lean compare the compiled
types with `isDefEq`. A statement is classified as a theorem when it has a
`proof` or `conditional-proof`; it is classified as a conjecture when it has a
`reduction`. An `assumption` is a conjecture expected to be true, and a
`conditional-proof` is a proof that relies only on assumptions. Proof files may
rely on definitions, declared dependencies, Std, and Mathlib, but submitted proof
targets must not depend on `sorryAx` or local proof-side axioms.

The final proof-build design is being reworked around statement-level proof
certificates. The build must recursively follow metadata references through
`submissions.jsonl`, compose proof outputs in statement-dependency order, and
verify that composed proofs bottom out only in the trusted base axioms and
declared conjectures. The axiom gate must match trusted axioms by name, type,
and source module against a pinned trusted base.

Declared dependency metadata defines the security boundary. Used-file records
use `Package`, `File`, and `Name`; proof entries may also record proof-level
`Used Surface Files`. Actual dependencies come from Lean axiom collection and
must be included in the declared dependencies.

## CLI Tooling

The command line source lives in `.cli-tooling`; npm package metadata lives at the repository root.

Install it locally from the repository root:

```sh
npm install
npm link
```

After linking, the CLI is available as either `lml` or `lean-meta-library`:

```sh
lml --help
lean-meta-library --help
```

Common commands:

```sh
lml agent-introduction
lml agent-submission-guide
lml login
lml logout
lml init
lml update
lml test path/to/meta.yaml
lml submit path/to/meta.yaml
lml submission-status path/to/meta.yaml
lml create-paper
```

The `agent-introduction` command prints `agent-info/README.md`, a general startup guide for agents working with the Lean Meta Library setup, `submissions.jsonl`, and the CLI.

The `agent-submission-guide` command prints `agent-info/paper-submission-readiness-agent-guide.md`, the guide for agents turning an arbitrary Lean project into a submission package whose statements, metadata, and proofs are user-approved and checker-ready.

The `test` command runs `.github/actions/test/run-all.mjs` using the metadata file as the source of submission information:

```sh
lml test path/to/meta.yaml
```

The first-run checker prepares the Lean build/cache first, runs static checks in parallel, and then runs the Lean inspector checks in parallel. In the import workflow, the preparation runs as its own `Prepare Lean build/cache` step before `Run submission checks`.

```yaml
proofs:
  - Name: SomeEntryReduction
    Type: reduction
    Theorem:
      Package: MySlug.Statements
      File: Statements/SomeEntry.lean
      Name: MySlug.Statement.SomeEntry.some_statement
    Proof:
      File: proofs/SomeEntryReduction.lean
      Name: MySlug.Proofs.SomeEntry.some_statement
    Used Surface Files: []
```

The `submit` command runs the submission checks first, then dispatches `.github/workflows/submit.yml` for the current repository, branch, commit, and metadata file:

```sh
lml submit path/to/meta.yaml
lml submit --no-prior-test path/to/meta.yaml
```

The `submission-status` command reports whether the metadata file has been submitted or imported, whether a related workflow is currently uploading, testing, or finalizing the submission, and how the recorded source commit compares with the current commit and statement files:

```sh
lml submission-status path/to/meta.yaml
```

## Submission Workflow

The `Submit` GitHub Actions workflow can be run manually with a metadata path. It creates a submission issue when `submissionIssueNumber` is missing, or updates that issue when the field is present. The workflow labels the issue `submission`, names it with the submission title, starts the issue body with the submission abstract, records the submitting account login plus the repository URL, source branch, source commit, metadata file path, and generated source URLs, then writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file.

The `Import Submission` workflow starts from issues labeled `submission`. It checks out the submitted repository at the recorded branch and commit, runs `.github/actions/test/run-all.mjs` against the metadata file path from the issue, then adds or updates the corresponding `submissions.jsonl` row with the submitted-by account and closes the issue.

During import, the workflow posts issue comments after completed milestones. Each progress comment says which step
worked, how many steps remain, and which step will run next.

For a one-off run without linking:

```sh
npm run smoke
```

## Import Failure Fixtures

Negative import-check fixtures live in `test-imports/`. Each package is a small
submission that should fail for one documented reason, such as a missing proof
file, a mismatched proof type, `sorry`, an extra statement declaration, or an
unauthorized statement/dependency import.

Run them with:

```sh
npm run test:imports
```
