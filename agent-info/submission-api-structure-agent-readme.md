# Submission Structure Rework Agent README

Use this README as an implementation target for the Lean Meta Library
submission-structure rework. Keep this file self-contained and update it as the
structure discussion evolves.

## Goal

The target model moves from the old surface-package framing to
statement/declaration terminology:

- The public declaration side is the statement/declaration package.
- Public entries are `Definition` or `Axiom`.
- Axiom entries are Lean axioms only; theorem declarations belong to proof
  artifacts, not statement files.
- Proof artifacts discharge statements with `proof`, `conditional-proof`, or
  `reduction` entries.

Separate statement/declaration and proof packages are no longer required for
every submission. If either package is present, its package-specific checks
should run. A proof package that depends locally on a statement package remains
allowed, but it is not required.

## Naming Model

Use the checklist names from `structure-update-guidelines`:

- `DeclarationPackage` instead of `Surface Package`.
- `statementLakefilePath` instead of `surfaceLakefilePath`.
- `packageSlug` instead of `namespaceSlug`.
- `submissionTitle` instead of `paperTitle`.
- `bibtex-entries` instead of `bibtex`.
- `statements` instead of `declarations`.
- Statement entry types `Definition` and `Axiom`; do not keep `Statement` as an
  allowed entry type.

Created metadata should also include `githubRepo`, `Lake Proof Package`, and
`Lake Statement Package`, in addition to `submissionIssueNumber` and
`submissionIssueUrl`.

## Metadata Shape

Statement entries should use the checklist shape:

```yaml
statements:
  - Name: MainStatement
    Type: Axiom
    Statement:
      Name: PackageSlug.Statement.MainStatement.main_statement
    File: statements/MainStatement.lean
    Used Surface Files:
      - Package: OtherPackage.Statements
        File: statements/OtherStatement.lean
        Name: OtherPackage.Statement.OtherStatement.other_statement
```

Proof entries should use structured theorem, proof, and used-file records:

```yaml
proofs:
  - Name: MainStatementProof
    Type: proof
    Theorem:
      Package: PackageSlug.Statements
      File: statements/MainStatement.lean
      Name: PackageSlug.Statement.MainStatement.main_statement
    Proof:
      File: proofs/MainStatementProof.lean
      Name: PackageSlug.Proofs.MainStatement.main_statement
    Used Surface Files:
      - Package: OtherPackage.Statements
        File: statements/OtherStatement.lean
        Name: OtherPackage.Statement.OtherStatement.other_statement
```

Proof-level used-file metadata must be supported. The current checker model
authorizes proof imports through declaration-level `usedSurfaceFiles`; the new
model must allow proof entries to declare their own used files.

## Needed Files And Packages

Package checks should be conditional:

- If a statement/declaration package is present, require its `lakefile.lean`.
- For each theorem or definition recorded in metadata, require its Lean file and
  LaTeX file.
- If a proof package is present, require its `lakefile.lean`.
- Lake build checks should build only packages that are present.

Do not require statement/declaration folders to be direct children of a
`surface-package/` folder. Do not require a unique Lean library for each
statement folder. Each statement must still be included in the shared statement
library.

The old `Slug.Surface` package-name rule should be replaced. The target names
are `Slug.Statements` and `Slug.Proofs`, resolved according to the checklist
naming model rather than the old `namespaceSlug` model.

## Statement Declaration Inspection

Statement/declaration packages should contain only expected files. Current
filetype checks allow any permitted extension anywhere in the package; update
them so package contents match the statement/declaration package model.

Use Lean-level inspection for statement files:

- `Definition` entries introduce one `def`.
- `Axiom` entries introduce one `axiom`.
- Theorems, proof declarations, helper constants, private declarations,
  instances, structures, classes, inductives, extra axioms, macros, custom
  syntax, `unsafe`, `run_cmd`, `#eval`, `#print`, `extern`, and `IO` are not
  submitted statement content.

## Dependency Model

Check two dependency graphs:

- Declared dependencies from metadata, including proof-level used-file records.
- Actual dependencies from Lean axiom collection on the proof term.

Require declared dependencies to include actual dependencies. Build the
axiom-remapping substitution from declared dependencies only. Do not use a
global substitution; undeclared axioms should survive and be caught by the axiom
gate.

Imported repository information comes from metadata files and
`submissions.jsonl`. Import registry rows should preserve enough information to
locate both statement/declaration and proof package modes for an imported
repository.

## Final Proof Build Rework

The final proof-build stage should no longer only copy the package, run
`lake update`, `lake clean`, cache fetch, `lake build`, reject `sorry`/`sorryAx`,
and inspect proof-target axioms against statement axioms plus base axioms.

The new approach must:

1. Import all nested imported repositories into the root Lake file.
2. Read repository information from metadata files and `submissions.jsonl`.
3. During the Lean build, run a script that recursively follows metadata
   references.
4. Change proofs so they reference the proof counterpart of a referenced
   statement instead of its statement axiom when that referenced statement is
   not a conjecture.
5. Use the resulting `.olean` files for axiom testing and related checks.
6. Return computed dependency and conjecture information.
7. Compare the computed information to the version recorded in metadata; a
   mismatch is a failure.

Composed proof outputs should rely only on trusted base axioms and conjectures.

## Statement-Level Proof Certificates

The atomic unit is a statement, not a paper. Paper-level dependency cycles are
allowed, but the statement dependency graph must be acyclic.

Target certificate flow:

1. Treat each statement as an axiom with no value.
2. Annotate discharger theorems with which statement they discharge, for example
   with a `discharges` attribute.
3. Require the discharger theorem's type to be definitionally equal to the
   statement axiom's type.
4. Certify a statement by walking the statement DAG rooted at that statement in
   leaves-first topological order.
5. For each statement, create a composed constant whose type is the original
   statement type and whose value is the discharger proof term with dependency
   axioms remapped to already-created composed constants.
6. Share composed constants by name across diamonds in the dependency graph.
7. Emit a small certificate that bridges the statement type to the composed
   theorem type in both directions and reports the composed theorem's axioms.
8. Re-verify the composed `.olean` output with `lean4checker` in a clean,
   pinned environment.

The composer itself is not trusted. If it emits a bad term, Lean rejects it; if
it emits a term with extra axioms, the axiom gate must catch it.

## Axiom Gate

The axiom gate must match axioms by name, type, and source module, not by name
alone. The whitelist must be pinned to a canonical signed trusted base, and the
recheck must run against that pinned base rather than an adversary-supplied
environment.

Accepted composed proofs should bottom out only in trusted base axioms and
declared conjectures.

## Lean And Orchestration Split

Lean must own anything that touches Lean semantics:

- The `discharges` attribute.
- Reading terms, definitional equality, and type comparison.
- Axiom sets and term rewriting.
- Adding composed declarations.
- Statement-graph construction and acyclicity checks.
- Typed bridge generation.
- The name/type/module axiom gate.

Python, Lake, Nix, or other glue should only orchestrate:

- Discover libraries.
- Compute library build order.
- Run `lake build` per library in sandboxes.
- Shuttle `.olean` files to isolated `lean4checker`.
- Aggregate results.

Glue must not compute the axiom-remapping substitution or the whitelist
decision. The small trusted glue exception is signature/hash verification and
ensuring the recheck runs against the pinned base.

## Trusted Computing Base

Trusted:

- The Lean kernel.
- `lean4checker`.
- The canonical signed trusted base.
- The guarantee that verification runs against that base.
- The name/type/module axiom gate.
- The small provenance glue.

Not trusted:

- The composer.
- Orchestration glue.
- Every paper's proof file.

## Tests And Fixtures

Update tests that currently require the old package split or direct
`surface-package/` children. Remove tests that require or enforce the old
separate proof-package and surface-package structure.

Update proof metadata tests that currently require theorem names to contain
`.Surface.Statement.` and proof names to contain `.Proofs.Statement.`. They
should validate the structured `Theorem` and `Proof` fields instead.

Add or update fixtures for:

- Optional package presence.
- Missing required files only when a package is present.
- `Definition` and `Axiom` statement entries.
- Rejection of statement theorem declarations.
- Proof-level used-file metadata.
- Declared dependencies covering actual Lean axiom dependencies.
- Statement-level dependency DAG acyclicity.
- Axiom-gate matching by name, type, and source module.
- Final proof-build composition and metadata dependency/conjecture comparison.

## Suggested Milestone

Start with three toy libraries `C <- B <- A`, one statement each, dischargers
wired up, the composer producing the composed proof for `A`, the certificate
passing, and a `lean4checker` pass.

Then add a second statement per paper and a deliberate paper-level but
statement-acyclic cycle to confirm the graph is statement-granular.
