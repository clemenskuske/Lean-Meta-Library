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

A submission consists of declarations and proofs. Declarations live in the surface package and are the trustworthy public surface: definitions are Lean `def`s, and statements are usually Lean `axiom`s or `theorem`s.

```lean
axiom Surface.Statement.entry : SomeStatement
```

Proofs live in the proof package. A proof entry has type `proof`, `conditional-proof`, or `reduction`, and it must provide a proof-side theorem with the same Lean type as the surface statement:

```lean
theorem Proofs.Statement.entry : SomeStatement := by
  ...
```

When `lml test` runs, each proof metadata entry explicitly names the surface theorem constant and the proof theorem constant. The checker passes both Lean names to Lean and asks `isDefEq` to compare their compiled types. A statement is classified as a theorem when it has a `proof` or `conditional-proof`; it is classified as a conjecture when it has a `reduction`. An `assumption` is a conjecture expected to be true, and a `conditional-proof` is a proof that relies only on assumptions. Proof files may rely on declarations, Std, and Mathlib. The proof checker elaborates proof files, but only the metadata proof targets are trusted as submitted proofs: it asks Lean for each proof theorem's compiled axiom dependencies and rejects dependencies on `sorryAx` or local proof-namespace axioms. Unused declarations or imported declarations with `sorry` do not fail this check unless a submitted proof theorem depends on them.

At the end of the import workflow, a final proof build runs in an isolated temporary copy. It runs `lake update`, `lake clean`, fetches the Lake build cache best-effort, then runs `lake build`. The final check relies on Lean elaboration and compiled proof-target axiom inspection. It asks Lean to verify that each metadata proof theorem's dependencies are either surface statement declarations or have the same types as the constants listed in `lml-env.json` at `checks.allowedMathlibAxioms`, currently `propext`, `Quot.sound`, and `Classical.choice`.

Surface files may always import other surface modules from the same submission package. Surface imports from other packages or namespaces must be justified by the current declaration's `usedSurfaceFiles` metadata; each `usedSurfaceFiles` item must include a referenced declaration, and metadata validation rejects references in the same namespace as the current declaration. A proof file may import its own surface statement module, but any other surface imports must be justified by that statement declaration's `usedSurfaceFiles` metadata. Accepted proof package dependencies are still reported as warnings.

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

```yaml
proofs:
  - theorem: MySlug.Surface.Statement.SomeEntry.some_statement
    proof: MySlug.Proofs.Statement.SomeEntry.some_statement
    type: reduction
    proofFile: proofs/SomeEntryReduction.lean
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
file, a mismatched proof type, `sorry`, an extra surface declaration, or an
unauthorized surface import.

Run them with:

```sh
npm run test:imports
```
