# Lean Meta Library

Lean Meta Library workspace.

## Project Environment

Repository-level values that may change later but are fixed for all projects right now live in `lml-env.json`.
CLI tooling and submission checks import this file for the Lean toolchain, mathlib revision, default metadata path,
allowed submission file/import policy, first-run size limits, and checker output limits.

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

When `lml test` runs, the checker generates `ProofCheck.lean` at the submission package root. For each surface theorem, it asks Lean to verify that the proof theorem has the same type as the surface declaration, using lines shaped like:

```lean
example : Surface.statement := Proofs.statement
```

This checks matching by Lean type, not by textual dependency on the surface axiom. Separately, the proof-file checker rejects local `axiom`, `sorry`, `admit`, and `unsafe` in proof files, builds the submitted proof theorem code, and asks Lean for each proof theorem's compiled axiom dependencies. A submitted proof theorem must not depend on `sorryAx`, same-submission proof axioms, or same-submission surface axioms.

At the end of the import workflow, a final-only rewritten proof build runs in an isolated temporary copy. It runs `lake update`, rewrites literal `.Surface.` references to `.Proofs.` references in the copied package and downloaded Lake packages, runs `lake clean`, then runs `lake build`. The check rejects `sorry`/`admit` in the rewritten build and asks Lean to verify that declared axioms and proof-target axiom dependencies have only the same types as the three base axioms `propext`, `Quot.sound`, and `Classical.choice`.

Surface files may always import other surface modules from the same submission package. Surface imports from other packages or namespaces must be justified by the current surface entry's `usedSurfaceFiles` metadata, and the referenced declaration must live in a different namespace from the current surface entry. Proof files may import accepted proof or surface dependencies, but those imports are reported as warnings.

## CLI Tooling

The command line tool lives in `.cli-tooling`.

Install it locally from the repository root:

```sh
cd .cli-tooling
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
lml login
lml logout
lml init
lml update
lml test path/to/meta.yaml
lml submit path/to/meta.yaml
lml submission-status path/to/meta.yaml
lml create-paper
```

The `test` command runs `.github-actions/test/run-all.mjs` using the metadata file as the source of submission information:

```sh
lml test path/to/meta.yaml
```

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

The `Submit` GitHub Actions workflow can be run manually with a metadata path. It creates a submission issue when `submissionIssueNumber` is missing, or updates that issue when the field is present. The workflow labels the issue `submission`, records the repository URL, source branch, source commit, and metadata file path in the issue body, then writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file.

The `Import Submission` workflow starts from issues labeled `submission`. It checks out the submitted repository at the recorded branch and commit, runs `.github-actions/test/run-all.mjs` against the metadata file path from the issue, then adds or updates the corresponding `submissions.jsonl` row and closes the issue.

For a one-off run without linking:

```sh
cd .cli-tooling
node ./src/cli.js --help
```
