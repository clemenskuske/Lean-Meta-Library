# Paper Submission Readiness Agent Guide

Use this guide when a user brings an arbitrary Lean project and asks an agent to
make it ready for Lean Meta Library submission. The goal is not just to create
files. The goal is to produce a submission package that accurately reflects the
user's mathematical intent and passes the checks exposed by the Lean Meta
Library CLI.

`structure-update-guidelines` is the ground truth for the current structure
rework. If generated starter files or older checker messages still use the
surface-package vocabulary, translate that wording to the statement/declaration
model below when planning new work.

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
- The submission title, package slug, and short abstract.
- Which Lean project folder, archive, or remote source is the starting point.
- Which declarations should be public statement/declaration entries.
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
every submission. A statement/declaration package and a proof package are both
allowed, but checks that require their Lake files and internal contents should
run only when the corresponding package is present.

When present, a statement/declaration package should contain its `lakefile.lean`
plus, for each definition or axiom, a Lean file and a LaTeX file explaining the
entry in paper-facing language. When present, a proof package should contain its
`lakefile.lean` plus the proof files referenced by metadata.

Do not require a unique Lean library for each statement folder. Each statement
must still be included in the shared statement library.

## Metadata File

Create `meta.yaml` with the user. It is the source of truth for the CLI checks.
Use the new target field names:

```yaml
pinnedLeanToolchain: <keep the CLI-generated Lean toolchain>
githubRepo: owner/name
submissionTitle: User Confirmed Title
packageSlug: UserSlug
statementLakefilePath: statements/lakefile.lean
proofLakefilePath: proofs/lakefile.lean
Lake Statement Package: statements
Lake Proof Package: proofs
abstractPath: abstract.tex
statements:
  - Name: MainDefinition
    Type: Definition
    Statement:
      Name: UserSlug.Definition.MainDefinition.main_definition
    File: statements/MainDefinition.lean
    Latex File: statements/MainDefinition.tex
    Used Surface Files: []
  - Name: MainStatement
    Type: Axiom
    Statement:
      Name: UserSlug.Statement.MainStatement.main_statement
    File: statements/MainStatement.lean
    Latex File: statements/MainStatement.tex
    Used Surface Files: []
proofs:
  - Name: MainStatementProof
    Type: proof
    Theorem:
      Package: UserSlug.Statements
      File: statements/MainStatement.lean
      Name: UserSlug.Statement.MainStatement.main_statement
    Proof:
      File: proofs/MainStatementProof.lean
      Name: UserSlug.Proofs.MainStatement.main_statement
    Used Surface Files: []
bibtex-entries: []
submissionIssueNumber:
submissionIssueUrl:
```

Use `Type: proof` for a fully formal proof, `Type: conditional-proof` for a
proof relying only on assumptions, and `Type: reduction` for a reduction that
uses unresolved conjectures. An `assumption` is a conjecture expected to be
true. A statement with `proof` or `conditional-proof` is classified as a
theorem. A statement with `reduction` is classified as a conjecture.

Metadata strings must stay simple ASCII text accepted by the CLI checks. Avoid
shell syntax, angle brackets, backticks, semicolons, and nonessential
punctuation.

## Statement/Declaration Files

The statement/declaration content records the public mathematical entries. It
should be minimal, trustworthy, and user-confirmed.

Each submitted statement/declaration file must:

- Import only allowed modules: `Mathlib.*`, `Std.*`, local statement modules,
  or authorized imported package APIs.
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

Declared dependencies are the security boundary. Used-file records should use
the target checklist shape:

```yaml
Used Surface Files:
  - Package: OtherSlug.Statements
    File: statements/OtherEntry.lean
    Name: OtherSlug.Statement.OtherEntry.other_statement
```

Proof entries may include proof-level `Used Surface Files` as well as
statement-level used-file metadata. Actual dependencies come from Lean axiom
collection and must be included in declared dependencies. Build axiom-remapping
substitutions from declared dependencies only; do not silently rewrite
undeclared axioms.

For dependency work, run `lml update` first and read `submissions.jsonl`.
Imported rows should preserve enough information to locate both statement and
proof package modes for the imported repository.

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

1. Import all nested imported repositories into the root Lake file using
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

- `lean-toolchain` files match the toolchain generated by the CLI starter or the
  current repository policy.
- Any present Lake files keep the mathlib source URL and revision required by
  current policy unless the CLI explicitly instructs otherwise.
- `lake update` and `lake build` work for each present package.
- Every metadata path exists and stays inside the package.
- No file exceeds the limits reported by `lml test`.
- File extensions are accepted by `lml test`.
- The package contains no `.DS_Store`, generated build caches, or unrelated
  project artifacts.

## Submission Readiness Checklist

Before submitting or asking the user to submit, confirm:

- The user has approved the title, package slug, abstract, statement entries,
  proof entry types, and bibliographic metadata.
- Every `Definition` and `Axiom` has a matching statement file and LaTeX file.
- Every discharged axiom has a matching typed proof file and metadata entry.
- Statement files contain exactly one direct public declaration each.
- Proof files contain no forbidden placeholders or local axioms.
- Imports and used-file metadata explain all declared dependencies.
- Any external dependency is backed by a matching row in `submissions.jsonl`.
- `lml test --meta=<slug>-package/meta.yaml` passes for the exact metadata path.
