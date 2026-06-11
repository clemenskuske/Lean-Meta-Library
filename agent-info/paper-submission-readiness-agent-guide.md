# Paper Submission Readiness Agent Guide

Use this guide when a user brings an arbitrary Lean project and asks an agent to
make it ready for Lean Meta Library submission. The goal is not just to create
files. The goal is to produce a submission package that accurately reflects the
user's mathematical intent and passes the checks exposed by the Lean Meta
Library CLI.

If generated starter files or checker messages use older package vocabulary,
translate that wording to the Statement Package model below when planning new
work.

Use submission terminology for the Lean Meta Library entry itself. A submission
is not the source repository; it may contain up to two Lake packages, the
statement-package and the proof-package. Reserve repository terminology for the
source checkout or GitHub repository that hosts the submission.

## Core Principle

Do not infer the submitted statement set from the source project alone. Build
the submission together with the user. Ask which definitions and axioms should
become public entries, which statements have `proof`, `conditional-proof`, or
`reduction` evidence, which assumptions are used, and which project details
should stay private implementation.

A submission is ready only when all conditions hold:

- The metadata and statement files represent what the user wants to submit.
- The package passes `lml test --meta=<path-to-meta.yaml>` under the current
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
- For each axiom, whether the proof entry type is `proof`,
  `conditional-proof`, or `reduction`, and which proof file in the source
  project should establish it.
- Which conjectures are expected to be true and should be called `assumptions`.
- Whether any entry depends on another entry in this submission.
- Whether any entry or proof depends on a previously imported Lean Meta Library
  package listed in `submissions.jsonl`.
- Bibliographic fields, if known: arXiv URL, DOI, online source, ORCIDs, venue,
  keywords, and BibTeX entries.

If the user is unsure, inspect the source project and propose a small statement
plan, then ask the user to confirm or revise it.

## Package Shape To Create

Create one submission package folder, normally named `<slug>-package/`. Prefer
starting from the CLI skeleton when it matches the current checker policy:

```sh
lml create-paper <slug>
```

The structure rework no longer requires separate proof and statement packages in
every submission. A statement package and a proof package are both
allowed, but checks that require their Lake files and internal contents should
run only when the corresponding package is present.

When present, a statement package should contain its `lakefile.lean`
plus, for each definition or axiom, a Lean file and a LaTeX file explaining the
entry in paper-facing language. When present, a proof package should contain its
`lakefile.lean` plus the proof files referenced by metadata.

Do not require a unique Lean library for each statement folder. Each statement
must still be included in the shared statement library.

## Metadata File

Create `meta.yaml` with the user. It is the source of truth for the CLI checks.
Use `meta.config.yaml` as the schema source of truth. The author-created
metadata should use the exact field names below; workflow-created fields such as
`githubRepo`, `submittedBy`, `LakeStatementPackage`, `LakeProofPackage`,
`submissionIssueNumber`, and `submissionIssueUrl` should normally be omitted
until tooling writes them.

```yaml
submissionTitle: User Confirmed Title
submissionSlug: UserSlug
statementLakefilePath: statements/lakefile.lean
statementLeanToolchainPath: statements/lean-toolchain
proofLakefilePath: proofs/lakefile.lean
proofLeanToolchainPath: proofs/lean-toolchain
abstractPath: abstract.tex
statements:
  - Name: MainDefinition
    Type: Definition
    Statement:
      CurrentSubmission: true
      LeanStatement: statements/MainDefinition.lean
      LatexDefinition: statements/MainDefinition.tex
      Name: UserSlug.Definition.MainDefinition.main_definition
    DeclarationReferences: []
  - Name: MainStatement
    Type: Axiom
    Statement:
      CurrentSubmission: true
      LeanStatement: statements/MainStatement.lean
      LatexDefinition: statements/MainStatement.tex
      Name: UserSlug.Statement.MainStatement.main_statement
    DeclarationReferences: []
proofs:
  - Name: MainStatementProof
    Type: proof
    Theorem:
      SubmissionSlug: UserSlug
      File: statements/MainStatement.lean
      Name: UserSlug.Statement.MainStatement.main_statement
    Proof:
      File: proofs/MainStatementProof.lean
      Name: UserSlug.Proofs.MainStatement.main_statement
    DeclarationReferences: []
bibtex-entries: []
```

Use `Type: proof` for a fully formal proof, `Type: conditional-proof` for a
proof relying only on assumptions, and `Type: reduction` for a reduction that
uses unresolved conjectures. An `assumption` is a conjecture expected to be
true. A statement with `proof` or `conditional-proof` is classified as a
theorem. A statement with `reduction` is classified as a conjecture.

The schema requires `statements`, `statementLakefilePath`, and
`statementLeanToolchainPath` to appear together, and `proofs`,
`proofLakefilePath`, and `proofLeanToolchainPath` to appear together. All
repository paths must be relative paths that stay inside the repository root.
Metadata strings should stay simple ASCII text accepted by the CLI checks.

## Statement Files

The statement content records the public mathematical entries. It should be
minimal, trustworthy, and user-confirmed.

Each submitted statement file must:

- Import only pinned base modules from `lml-env.json` such as `Mathlib.*` and
  `Std.*`, local statement modules, or authorized imported package APIs.
- Introduce exactly one direct public declaration recorded by metadata.
- Avoid helper declarations, private declarations, instances, structures,
  classes, inductives, macros, custom syntax, `unsafe`, `run_cmd`, `#eval`,
  `#print`, `extern`, and `IO`.

The direct declaration rules are:

- `Definition` entries must introduce one `def`.
- `Axiom` entries must introduce one `axiom`.
- Statement/declaration entries must not introduce theorems.

Every entry should also have a LaTeX file explaining it in paper-facing
language.

## Dependencies

Declared dependencies are the security boundary. Declaration reference records
must use the schema shape:

```yaml
DeclarationReferences:
  - SubmissionSlug: OtherSlug
    LeanStatement: statements/OtherEntry.lean
    LatexDefinition: statements/OtherEntry.tex
    Name: OtherSlug.Statement.OtherEntry.other_statement
```

Proof entries may include proof-level `DeclarationReferences` as well as
statement-level `DeclarationReferences`. Actual dependencies come from Lean
axiom collection and must be included in declared dependencies. Build
axiom-remapping substitutions from declared dependencies only; do not silently
rewrite undeclared axioms.

For dependency work, run `lml update` first and read `submissions.jsonl`.
Imported rows should preserve enough information to locate both statement and
proof package modes for the imported submission.

## Proof Artifacts

Proof artifacts contain typed proof evidence for submitted axioms. They may
contain `proof`, `conditional-proof`, and `reduction` entries.

Every submitted axiom that is to be discharged needs one matching metadata proof
entry and proof file. The CLI should compare the compiled Lean type of the
statement axiom and proof theorem with Lean `isDefEq`; textual similarity is not
enough.

Proof files must not contain `axiom`, `sorry`, `admit`, or `unsafe`. The
compiled proof theorem must not depend on `sorryAx` or local proof-side axioms.
It may rely on definitions, declared dependencies, Std, and Mathlib.

## Final Proof Build Target

The final proof-build stage is being reworked. The target design is:

1. Import all nested imported submissions into the root Lake file using
   metadata and `submissions.jsonl`.
2. During the Lean build, recursively follow metadata references.
3. Replace references to proved dependency statement axioms with the proof
   counterpart; leave conjectures as declared conjectures.
4. Use the resulting `.olean` files for axiom testing and related checks.
5. Return computed dependency and conjecture information, then compare it to the
   version recorded in metadata.

Composed proof outputs should rely only on trusted base axioms and conjectures.
The axiom gate must match allowed axioms by name, type, and source module
against a canonical signed trusted base.

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
proves the chosen statements. Smaller packages are easier for the user to review
and easier for the CLI to accept.

## Required Checks Before Calling The Work Done

Run the CLI check against exactly one metadata file:

```sh
lml test --meta=<slug>-package/meta.yaml
```

Fix every error. Treat warnings as review items and decide whether they are
acceptable.

Also check:

- `lean-toolchain` files are present for each package and match the fixed Lean
  version from `lml-env.json`.
- Any present Lake files keep the Mathlib source URL and revision required by
  the pinned Mathlib base import unless the CLI explicitly instructs otherwise.
- `lake update` and `lake build` work for each present package.
- Every metadata path exists and stays inside the package.
- No file exceeds the limits reported by `lml test`.
- File extensions are accepted by `lml test`.
- The package contains no `.DS_Store`, generated build caches, or unrelated
  project artifacts.

## Submission Readiness Checklist

Before submitting or asking the user to submit, confirm:

- The user has approved the title, submission slug, abstract, statement entries,
  proof entry types, and bibliographic metadata.
- Every `Definition` and `Axiom` has a matching statement file and LaTeX file.
- Every discharged axiom has a matching typed proof file and metadata entry.
- Statement files contain exactly one direct public declaration each.
- Proof files contain no forbidden placeholders or local axioms.
- Imports and `DeclarationReferences` metadata explain all declared
  dependencies.
- Any external dependency is backed by a matching row in `submissions.jsonl`.
- `lml test --meta=<slug>-package/meta.yaml` passes for the exact metadata path.
