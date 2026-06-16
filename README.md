# Lean Meta Library

Lean Meta Library workspace.

## Beta CLI Package

The beta CLI package is available as [lean-meta-library-cli.tgz](lean-meta-library-cli.tgz).

For repository users who want only the npm package without cloning the
repository:

```sh
gh api "repos/clemenskuske/Lean-Meta-Library/contents/lean-meta-library-cli.tgz?ref=main" --jq .content | base64 --decode > lean-meta-library-cli.tgz
npm install -g ./lean-meta-library-cli.tgz
lml --help
```

## Project Environment

Repository-level values that may change later but are fixed for all projects
right now live in `lml-env.json`. CLI tooling and submission checks import this
file for the fixed Lean version, pinned Mathlib base import, trusted-base axiom
policy, default manifest path, allowed submission file policy, first-run size
limits, and checker output limits.

Each present Lake package has its own package-local `lean-toolchain` file
recorded by manifest. Checkers compare those files against the fixed Lean
version and compare Lake Mathlib dependencies against the pinned Mathlib
revision. Std is provided by the fixed Lean version and is not listed separately
as a base import.

`manifest.config.yaml` is the source of truth for submission manifest shape. It is
the JSON Schema used by `general/manifest-check.mjs`; documentation, generated
examples, and checker-facing instructions should follow its exact field names,
required fields, created fields, and declaration-reference shape.

`import-submission-expectations.md` records the repository-content policy that
the import checks enforce.

## Submission Contract

A submission is the Lean Meta Library entry, not the source repository. A source
repository may host a submission, and a submission may contain up to two Lake
packages: a statement package and a proof package. Package presence is optional,
but when both are present their roles stay separate.

Author-supplied manifest requires:

- `abstractPath`
- `submissionTitle`
- `submissionSlug`
- `bibtex-entries`
- `licensePath` (path to a recognized open-source license file)

Statement manifest, when present, uses `statements` and `statementRoot`
together. Proof manifest, when present, uses `proofs` and `proofRoot`
together. `statementRoot` and `proofRoot` are repository-relative folder
paths; each folder must contain a `lakefile.lean` and a `lean-toolchain`
file. Workflow-created fields include
`githubRepo`, `submittedBy`, `LakeStatementPackage`, `LakeProofPackage`,
`submissionIssueNumber`, and `submissionIssueUrl`.

Public statement entries are:

- `Definition`: introduces one Lean `def`.
- `Axiom`: introduces one Lean `axiom`.

Statement files must not introduce theorem declarations as submitted statement
content. Each statement entry uses a structured `Statement` record with exactly
one of `CurrentSubmission: true` or `SubmissionSlug`, plus `LeanStatement`,
`LatexDefinition`, and `Name`. `DeclarationReferences` records use the same
shape and may appear on statements.

```yaml
statements:
  - Name: MainStatement
    Type: Axiom
    Statement:
      CurrentSubmission: true
      LeanStatement: statements/MainStatement.lean
      LatexDefinition: statements/MainStatement.tex
      Name: MySlug.Statements.MainStatement.main_statement
    DeclarationReferences: []
```

Each proof entry has exactly two fields: `axiom`, the global name of the
statement axiom it discharges, and `proof`, the global name of the proof
declaration in this submission's proof package. Both are global Lean names whose
leading namespace segment is the owning submission's slug in PascalCase, so they
identify declarations uniquely across all submissions. The target `axiom` may
belong to this submission or to another submission. The checker resolves both
declarations by name in the built packages and asks Lean `isDefEq` to compare
the compiled statement type and proof target type.

```yaml
proofs:
  - axiom: MySlug.Statements.MainStatement.main_statement
    proof: MySlug.Proofs.MainStatement.main_statement
```

Proof files may rely on definitions, declared dependencies, Std, and Mathlib,
but submitted proof targets must not depend on `sorryAx` or local proof-package
axioms. The final proof build composes submitted proof outputs and accepts only
allowed base axioms.

## CLI Tooling

The command line source lives in `.cli-tooling`; npm package metadata lives at
the repository root.

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
lml create-paper
lml test --manifest=path/to/manifest.yaml
lml submit --manifest=path/to/manifest.yaml
lml submission-status path/to/manifest.yaml
lml readme
lml readme --short
```

The `agent-introduction` command prints `agent-info/README.md`, a general
startup guide for agents working with the Lean Meta Library setup,
`submissions.jsonl`, and the CLI.

The `agent-submission-guide` command prints
`agent-info/paper-submission-readiness-agent-guide.md`, the guide for agents
turning an arbitrary Lean project into a submission package whose statements,
manifest, and proofs are user-approved and checker-ready.

The `test` command runs `.github/actions/test/run-all.mjs` using the manifest
file as the source of submission information:

```sh
lml test --manifest=path/to/manifest.yaml
```

If no manifest path is provided, the checks use `manifest.yaml` in the current
working directory. Pass exactly one manifest file path; directories are not
accepted.

`run-all.mjs` prepares statement and proof Lake build/cache output first unless
`--skip-build-cache` is passed, runs static checks in parallel, and then runs
Lean inspector checks in parallel. Preparation writes package-local marker
files under each present Lake package's `.lake/` directory, keyed by
`LML_CHECK_RUN_ID`, so post-build checker scripts can reuse the build prepared
for the same run.

The checker groups are:

- `general`: manifest shape, required files, license file, package builds, toolchain/Mathlib
  pins, namespace shape, file size, and file type policy.
- `statements`: statement-package closure, statement syntax policy, statement
  imports, and introduced declaration inspection.
- `proofs`: proof build preparation, proof theorem type matching, and forbidden
  proof axiom checks.
- root helpers: shared Lean import/inspection code and the final proof-build
  composition check.

The `submit` command runs the submission checks first, then dispatches
`.github/workflows/submit.yml` for the current repository, branch, commit, and
manifest file:

```sh
lml submit --manifest=path/to/manifest.yaml
lml submit --no-prior-test --manifest=path/to/manifest.yaml
```

The `submission-status` command reports whether the manifest file has been
submitted or imported, whether a related workflow is currently uploading,
testing, or finalizing the submission, and how the recorded source commit
compares with the current commit and statement files:

```sh
lml submission-status path/to/manifest.yaml
```

The `readme` command prints this README file. Pass `--short` (or `-s`) to print
a condensed quick-reference instead:

```sh
lml readme
lml readme --short
```

## Submission Workflow

The `Submit` GitHub Actions workflow can be run manually with a manifest path.
It creates a submission issue when `submissionIssueNumber` is missing, or
updates that issue when the field is present. The workflow labels the issue
`submission`, names it with the submission title, starts the issue body with the
submission abstract, records the submitting account login plus the repository
URL, source branch, source commit, manifest file path, and generated source
URLs, then writes `submissionIssueNumber` and `submissionIssueUrl` back to the
manifest file.

The `Import Submission` workflow starts from issues labeled `submission`. It
checks out the submitted repository at the recorded branch and commit, prepares
Lean build/cache output, runs `.github/actions/test/run-all.mjs
--skip-build-cache` against the manifest file path from the issue, then adds or
updates the corresponding `submissions.jsonl` row with source and submitted-by
provenance. After a successful import, it comments on and closes the issue.

During import, the workflow posts issue comments after completed milestones. Each
progress comment says which step worked, how many steps remain, and which step
will run next.

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
