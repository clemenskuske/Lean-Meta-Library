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

## Proof Checking Contract

Surface theorem files state public declarations, usually as axioms:

```lean
axiom Surface.statement : SomeStatement
```

Proof files must provide a theorem with the same statement without relying on the surface axiom:

```lean
theorem Proofs.statement : SomeStatement := by
  ...
```

When `lml test` runs, the checker asks Lean to compare the compiled types of each surface theorem declaration and its matching proof theorem. This checks matching by Lean type, not by textual dependency on the surface axiom. Separately, the proof-file checker elaborates proof files, rejects local proof-namespace `axiom` and `unsafe` declarations, rejects declarations whose compiled axiom list includes `sorryAx` such as from `sorry` or `admit`, and asks Lean for each submitted proof theorem's compiled axiom dependencies. A submitted proof theorem must not depend on `sorryAx`, same-submission proof axioms, or same-submission surface axioms.

At the end of the import workflow, a final-only proof build runs in an isolated temporary copy. It runs `lake update`, removes `Surface.Theorem` declarations while keeping surface definition and conjecture modules, rewrites proof-side `.Surface.Theorem.` references to `.Proofs.Theorem.`, runs `lake clean`, fetches the Lake build cache best-effort, then runs `lake build`. The final check relies on Lean elaboration, build output, and compiled axiom inspection rather than a separate rewritten-source text scan for `sorry` or `admit`. It rejects build output that reports `sorry`/`sorryAx`, then asks Lean to verify that declared axioms in checked submission namespaces and proof-target axiom dependencies are either allowed conjectures or have the same types as the constants listed in `lml-env.json` at `checks.allowedMathlibAxioms`, currently `propext`, `Quot.sound`, and `Classical.choice`.

Surface files may always import other surface modules from the same submission package. Surface imports from other packages or namespaces must be justified by the current surface entry's `usedSurfaceFiles` metadata; each `usedSurfaceFiles` item must include a referenced declaration, and metadata validation rejects references in the same namespace as the current surface entry. A theorem proof file may import its own surface theorem module, but any other surface imports must be justified by that theorem surface entry's `usedSurfaceFiles` metadata. Accepted proof package dependencies are still reported as warnings.

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

The `agent-submission-guide` command prints `agent-info/paper-submission-readiness-agent-guide.md`, the guide for agents turning an arbitrary Lean project into a paper submission package whose surface, metadata, and proofs are user-approved and checker-ready.

The `test` command runs `.github/actions/test/run-all.mjs` using the metadata file as the source of submission information:

```sh
lml test path/to/meta.yaml
```

The first-run checker prepares the Lean build/cache first, runs static checks in parallel, and then runs the Lean inspector checks in parallel. In the import workflow, the preparation runs as its own `Prepare Lean build/cache` step before `Run submission checks`.

Conjecture surface declarations are recorded in the metadata `proofs:` list, but they do not have proof files yet. Mark them with `conjecture: True` and omit `proofFile`:

```yaml
proofs:
  - theorem: MySlug.Surface.Conjecture.SomeEntry.some_conjecture
    conjecture: True
```

The `submit` command runs the submission checks first, then dispatches `.github/workflows/submit.yml` for the current repository, branch, commit, and metadata file:

```sh
lml submit path/to/meta.yaml
lml submit --no-prior-test path/to/meta.yaml
```

The `submission-status` command reports whether the metadata file has been submitted or imported, whether a related workflow is currently uploading, testing, or finalizing the submission, and how the recorded source commit compares with the current commit and surface files:

```sh
lml submission-status path/to/meta.yaml
```

## Submission Workflow

The `Submit` GitHub Actions workflow can be run manually with a metadata path. It creates a submission issue when `submissionIssueNumber` is missing, or updates that issue when the field is present. The workflow labels the issue `submission`, names it with the submission title, starts the issue body with the submission abstract, records the submitting account login plus the repository URL, source branch, source commit, and metadata file path, then writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file.

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
file, a mismatched proof type, `sorry`, an extra surface declaration, or an
unauthorized surface import.
