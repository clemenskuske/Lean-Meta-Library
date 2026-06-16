# Paper Submission Readiness Agent Guide

Use this guide when a user brings an arbitrary Lean project and asks an agent to
make it ready for Lean Meta Library submission. The goal is not just to create
files. The goal is to produce a submission package that accurately reflects the
user's mathematical intent and passes the checks exposed by the Lean Meta
Library CLI.

Use submission terminology for the Lean Meta Library entry itself. A submission
is not the source repository; it may contain a statement package, a proof
package, or both. Reserve repository terminology for the source checkout or
GitHub repository that hosts the submission.

## Core Principle

Do not infer the submitted statement set from the source project alone. Build
the submission together with the user. Ask which definitions and axioms should
become public entries, which statement axioms have proof evidence, and which
project details should stay private implementation.

A submission is ready only when all conditions hold:

- The metadata and statement files represent what the user wants to submit.
- The package passes `lml test --meta=<path-to-manifest.yaml>` under the current
  checker.
- The user is pleased with the result.

## First Conversation With The User

Before writing the submission package, gather these decisions from the user:

- Check whether a PDF of the paper is present. If it is present, use it to
  answer relevant metadata and statement-selection questions where possible; if
  it is not present, ask the user whether they can provide one.
- The submission title, submission slug, and short abstract.
- Which Lean project folder, archive, or remote source is the starting point.
- Which declarations should be public statement entries.
- For each public entry, whether it is a `Definition` or an `Axiom`.
- For each axiom that is being discharged, the global name of the proof
  declaration that establishes it (the proof may live in this submission or, by
  global name, target another submission's axiom).
- Whether any entry or proof depends on a previously imported Lean Meta Library
  submission listed in `submissions.jsonl`.
- BibTeX entries and any bibliographic context the user wants preserved.

If the user is unsure, inspect the source project and propose a small statement
plan, then ask the user to confirm or revise it.

## Package Shape To Create

Create one metadata-root folder, normally named `<slug>-package/`. Prefer
starting from the CLI skeleton when it matches the current checker policy:

```sh
lml create-paper <slug>
```

A submission may contain only a statement package, only a proof package, or
both. When both are present, keep them separate:

- The statement package contains its `lakefile.lean`, `lean-toolchain`, and the
  Lean/LaTeX statement files named by metadata.
- The proof package contains its `lakefile.lean`, `lean-toolchain`, proof files
  named by metadata, and any internal proof development needed to build those
  proof targets.

Do not require a unique Lean library for each statement folder. Each statement
must still be included in the shared statement package library. The expected
package/library names are derived from `submissionSlug` as
`<SubmissionSlugAsPascal>.Statements` and `<SubmissionSlugAsPascal>.Proofs`.

## Metadata File

Create `manifest.yaml` with the user. It is the source of truth for the CLI checks.
Use `meta.config.yaml` as the schema source of truth. Workflow-created fields
such as `githubRepo`, `submittedBy`, `LakeStatementPackage`,
`LakeProofPackage`, `submissionIssueNumber`, and `submissionIssueUrl` should
normally be omitted until tooling writes them.

The author-supplied required top-level fields are:

```yaml
abstractPath: abstract.tex
submissionTitle: User Confirmed Title
submissionSlug: user-slug
bibtex-entries: []
```

A statement package adds `statements` and `statementRoot` together.
`statementRoot` is the repository-relative folder containing the package;
it must have a `lakefile.lean` and a `lean-toolchain` inside it:

```yaml
statementRoot: statements
statements:
  - Name: MainDefinition
    Type: Definition
    Statement:
      CurrentSubmission: true
      LeanStatement: statements/MainDefinition.lean
      LatexDefinition: statements/MainDefinition.tex
      Name: UserSlug.Statements.MainDefinition.main_definition
    DeclarationReferences: []
  - Name: MainStatement
    Type: Axiom
    Statement:
      CurrentSubmission: true
      LeanStatement: statements/MainStatement.lean
      LatexDefinition: statements/MainStatement.tex
      Name: UserSlug.Statements.MainStatement.main_statement
    DeclarationReferences: []
```

A proof package adds `proofs` and `proofRoot` together. `proofRoot` is the
repository-relative folder containing the package; it must have a
`lakefile.lean` and a `lean-toolchain` inside it:

```yaml
proofRoot: "."
proofs:
  - axiom: UserSlug.Statements.MainStatement.main_statement
    proof: UserSlug.Proofs.MainStatement.main_statement
```

Each proof entry has only `axiom` and `proof`, both global Lean names. `axiom`
is the statement axiom the proof discharges and `proof` is the proof declaration
that establishes it; the leading namespace segment of each name is the owning
submission's slug in PascalCase. The target `axiom` may belong to this
submission or to another submission. Submitted proofs must be complete: their
compiled axiom dependencies may bottom out only in allowed base axioms, not in
other Lean Meta Library axioms.

All repository paths must be relative paths that stay inside the metadata root.
Metadata strings should stay simple ASCII text accepted by the CLI checks.

## Statement Files

The statement content records the public mathematical entries. It should be
minimal, trustworthy, and user-confirmed.

Each submitted statement file must:

- import only pinned Mathlib base modules from `lml-env.json`, Std modules
  provided by the fixed Lean version, local statement modules, or authorized
  imported statement packages;
- introduce exactly one direct public declaration recorded by metadata;
- use a Lean declaration name beginning with the namespace root derived from
  `submissionSlug`;
- avoid helper declarations, private declarations, generated declarations,
  instances, structures, classes, inductives, macros, custom syntax, `unsafe`,
  `run_cmd`, `#eval`, `#print`, `extern`, and `IO`.

The direct declaration rules are:

- `Definition` entries must introduce one `def`.
- `Axiom` entries must introduce one `axiom`.
- Statement entries must not introduce theorems.

The statement package may not contain extra `.lean` or `.tex` files beyond the
metadata-listed statement/reference files and `lakefile.lean`. Every statement
entry should also have a LaTeX file explaining it in paper-facing language.

## Dependencies

Declared dependencies are the security boundary. Declaration reference records
must use the schema shape:

```yaml
DeclarationReferences:
  - SubmissionSlug: other-slug
    LeanStatement: statements/OtherEntry.lean
    LatexDefinition: statements/OtherEntry.tex
    Name: OtherSlug.Statements.OtherEntry.other_statement
```

Use `CurrentSubmission: true` for references inside the current submission and
`SubmissionSlug` for references to another imported submission. A declaration
reference must not use both. `LeanStatement` and `LatexDefinition` should be in
the same folder.

Proof entries may include proof-level `DeclarationReferences` as well as
statement-level `DeclarationReferences`. Actual proof dependencies come from
Lean axiom collection and must be covered by declared dependencies, aside from
allowed base axioms. Build axiom-remapping substitutions from declared
dependencies only; do not silently rewrite undeclared axioms.

For dependency work, run `lml update` first and read `submissions.jsonl`.
Imported rows should preserve enough information to locate statement and proof
package modes for the imported submission.

## Proof Artifacts

Proof artifacts contain typed proof evidence for submitted axioms. Each proof
entry pairs a target statement axiom (`axiom`) with the proof declaration that
discharges it (`proof`), both as global Lean names.

A discharged axiom needs one matching metadata proof entry whose `proof`
declaration builds in the proof package. The CLI compares the compiled Lean type
of the statement axiom and the proof declaration with Lean `isDefEq`; textual
similarity is not enough.

Proof packages may contain helper files and internal declarations, but submitted
proof targets must be clean:

- the proof package must build so each `proof` declaration resolves by name;
- submitted proof targets must not depend on `sorryAx`;
- submitted proof targets must not depend on local proof-namespace axioms;
- actual axiom dependencies may bottom out only in allowed base axioms.

## Final Proof Build

The current final proof build copies the metadata-root package tree into an
isolated directory, runs `lake update`, `lake clean`, a best-effort cache fetch,
and `lake build`, then rejects build output that reports `sorry` or `sorryAx`.

It then composes each submitted proof target onto the statement axiom it
discharges. Composed outputs may rely only on allowed base axioms listed in
`lml-env.json`'s `checks.allowedMathlibAxioms`, matched by Lean name and type.

When `lean4checker` is available, the final checker also rechecks the composed
`.olean` output.

The target rework is to extend this into a fully provenance-aware
statement-level proof certificate system whose trusted-base axiom gate also
matches source module.

## Converting An Existing Lean Project

For an arbitrary project, use this workflow:

1. Inspect its Lake files, toolchain, imports, namespaces, and declarations.
2. Ask the user which declarations form the intended submission statements.
3. Create a CLI starter package if useful for the current checker.
4. Translate selected entries into one-declaration statement files.
5. Copy or adapt only the proof code needed for submitted proof entries.
6. Replace references to source-project namespaces with the new package
   namespaces as needed.
7. Remove implementation-only files that are not needed for the submission or
   that violate file type and size limits reported by the CLI.
8. Keep imports within the allowed policy.
9. Run the CLI checks, fix failures, and repeat until clean.

Do not carry over a large project wholesale if a smaller submission package
proves the chosen statements. Smaller packages are easier for the user to
review and easier for the CLI to accept.

## Required Checks Before Calling The Work Done

Run the CLI check against exactly one metadata file:

```sh
lml test --meta=<slug>-package/manifest.yaml
```

Fix every error. Treat warnings as review items and decide whether they are
acceptable.

Also check:

- `lean-toolchain` files are present for each package and match the fixed Lean
  version from `lml-env.json`.
- Any present Lake files keep the Mathlib source URL and revision required by
  the pinned Mathlib base import unless the CLI explicitly instructs otherwise.
- `lake update` and `lake build` work for each present package.
- Every metadata path exists and stays inside the metadata root.
- No file exceeds the limits reported by `lml test`.
- File extensions are accepted by `lml test`.
- The package contains no `.DS_Store`, generated build caches, or unrelated
  project artifacts.

## Submission Readiness Checklist

Before submitting or asking the user to submit, confirm:

- The user has approved the title, submission slug, abstract, statement entries,
  proof entry types, dependencies, and bibliographic metadata.
- Every `Definition` and `Axiom` has a matching statement file and LaTeX file.
- Every discharged axiom has a matching typed proof file and metadata entry.
- Statement files contain exactly one direct public declaration each.
- Proof targets contain no forbidden placeholders or local proof-package axioms.
- Imports and `DeclarationReferences` metadata explain all declared
  dependencies.
- Any external dependency is backed by a matching row in `submissions.jsonl`.
- `lml test --meta=<slug>-package/manifest.yaml` passes for the exact metadata path.
