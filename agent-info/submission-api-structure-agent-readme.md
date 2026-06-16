# Submission Structure Rework Agent README

Use this README as an implementation target for the Lean Meta Library
submission-structure rework. Keep this file self-contained and update it as the
structure discussion evolves.

## Ground Truth Order

When updating code, fixtures, or prose, use this order:

1. `manifest.config.yaml` for metadata field names and schema shape.
2. `import-submission-expectations.md` for repository-content policy.
3. `.github/actions/test/` and `test-imports/` for currently implemented
   checker behavior.

If these disagree, prefer the earlier source and update the later source.

## Current Model

The model uses statement package terminology:

- A submission is the Lean Meta Library entry, not the source repository.
- A submission may contain up to two Lake packages: a statement package and a
  proof package.
- Public entries are `Definition` or `Axiom`.
- `Definition` entries introduce Lean `def`s.
- `Axiom` entries introduce Lean `axiom`s; theorem declarations belong to proof
  artifacts, not statement files.
- Proof artifacts discharge statement axioms; each proof entry names the target
  statement axiom and the proof declaration that establishes it.

Statement-package and proof-package presence is optional: a submission may have
only a statement package, only a proof package, or both. When both are present,
they remain separate packages and must not mix statement and proof content. If
either package is present, its package-specific checks run. A proof package that
depends locally on a present statement package remains allowed.

## Naming Model

Use `manifest.config.yaml` as the source of truth for field names and metadata
shape. The schema uses:

- `abstractPath`
- `submissionTitle`
- `submissionSlug`
- `bibtex-entries`
- `statementRoot`
- `proofRoot`
- `statements`
- `proofs` (entries have only `axiom` and `proof`)
- `Statement`
- `DeclarationReferences`
- `CurrentSubmission`
- `SubmissionSlug`
- `LeanStatement`
- `LatexDefinition`
- `Name`

Created metadata fields are `githubRepo`, `submittedBy`, `LakeProofPackage`,
`LakeStatementPackage`, `submissionIssueNumber`, and `submissionIssueUrl`.
Authors should normally omit these until tooling/workflows populate them. If
present, they must satisfy the schema, for example `githubRepo` must be a URI.

Each present package has its own `lean-toolchain` file. Metadata records the
package root folder with `statementRoot` and `proofRoot`; the checker verifies
that `lakefile.lean` and `lean-toolchain` exist inside each root folder.

The expected Lake package/library names are derived from `submissionSlug` by
converting it to Pascal case:

- `<SubmissionSlugAsPascal>.Statements`
- `<SubmissionSlugAsPascal>.Proofs`

## Metadata Shape

Statement entries use this shape:

```yaml
statements:
  - Name: MainStatement
    Type: Axiom
    Statement:
      CurrentSubmission: true
      LeanStatement: statements/MainStatement.lean
      LatexDefinition: statements/MainStatement.tex
      Name: SubmissionSlug.Statements.MainStatement.main_statement
    DeclarationReferences:
      - SubmissionSlug: other-submission
        LeanStatement: statements/OtherStatement.lean
        LatexDefinition: statements/OtherStatement.tex
        Name: OtherSubmission.Statements.OtherStatement.other_statement
```

Proof entries have exactly two fields, both global Lean names:

```yaml
proofs:
  - axiom: SubmissionSlug.Statements.MainStatement.main_statement
    proof: SubmissionSlug.Proofs.MainStatement.main_statement
```

`axiom` is the global name of the statement axiom the proof discharges, and
`proof` is the global name of the proof declaration in this submission's proof
package. The leading namespace segment of each name is the owning submission's
slug in PascalCase, so the names are unique across submissions. The target
`axiom` may belong to this submission or to another submission.

`DeclarationReferences` metadata is supported on statement entries only.
Reference records must use exactly one of `CurrentSubmission: true` or
`SubmissionSlug`, plus `LeanStatement`, `LatexDefinition`, and `Name`.

## Needed Files And Packages

Package checks are conditional:

- If `statements` is present, require `statementRoot`; the folder at that
  path must contain `lakefile.lean` and `lean-toolchain`.
- If `proofs` is present, require `proofRoot`; the folder at that path must
  contain `lakefile.lean` and `lean-toolchain`.
- If a statement package is present, require each statement's Lean file and
  LaTeX file.
- If a proof package is present, build it so each proof entry's `proof`
  declaration resolves by name.
- Lake build checks build only packages that are present.

Do not require statement folders to be direct children of a fixed package
folder. Do not require a unique Lean library for each statement folder. Each
statement must still be included in the shared statement library.

## Statement Declaration Inspection

Statement packages contain only expected Lean and LaTeX files: metadata-listed
statement files, current-submission declaration reference files, and the
statement package `lakefile.lean`.

Use Lean-level inspection for statement files:

- `Definition` entries introduce one `def`.
- `Axiom` entries introduce one `axiom`.
- Theorems, proof declarations, helper constants, private declarations,
  instances, structures, classes, inductives, extra axioms, macros, custom
  syntax, `unsafe`, `run_cmd`, `#eval`, `#print`, `extern`, and `IO` are not
  submitted statement content.

The current syntax checker warns for command kinds outside the first-run
whitelist and rejects the explicitly forbidden syntax above.

## Dependency Model

Each submitted proof must be a complete proof of its target statement axiom.
Collect the actual Lean axiom dependencies of each proof term; they must bottom
out only in allowed base axioms. A proof that depends on any other Lean Meta
Library axiom (a statement axiom that is not its own target) is rejected by the
axiom gate.

Imported submission information comes from metadata files and
`submissions.jsonl`. Import registry rows should preserve enough source
repository information to locate statement and proof package modes for an
imported submission.

## Current Final Proof Build

The current final proof build:

1. Copies the metadata-root package tree into an isolated directory.
2. Runs `lake update`, `lake clean`, a best-effort `lake exe cache get`, and
   `lake build`.
3. Rejects build output that reports `sorry` or `sorryAx`.
4. Builds a composed Lean module from metadata proof entries.
5. Composes each submitted proof target onto the statement axiom it discharges.
6. Accepts only allowed base axioms from `lml-env.json` by Lean name and type.
7. Runs `lean4checker` over the composed `.olean` output when available.

The current implementation does not yet make trusted-base acceptance depend on
source module/provenance.

## Target Final Proof Build Rework

The target system should extend the current build so it:

1. Imports all nested imported submissions into the root Lake file.
2. Reads submission and source checkout information from metadata files and
   `submissions.jsonl`.
3. During the Lean build, recursively follows metadata references.
4. Changes proofs so they reference the proof counterpart of a referenced
   statement instead of its statement axiom when that referenced statement is
   not a conjecture.
5. Uses the resulting `.olean` files for axiom testing and related checks.
6. Returns computed dependency and conjecture information.
7. Compares the computed information to the version recorded in metadata; a
   mismatch is a failure.

Composed proof outputs should rely only on trusted base axioms and declared
conjectures.

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

Current behavior accepts configured base axioms by Lean name and type only.

The target axiom gate must match trusted base axioms by name, type, and source
module/provenance, not by name alone. The whitelist must be pinned to a
canonical signed trusted base, and the recheck must run against that pinned base
rather than an adversary-supplied environment.

Accepted composed proofs should bottom out only in trusted base axioms and
declared conjectures.

## Lean And Orchestration Split

Lean must own anything that touches Lean semantics:

- the `discharges` attribute;
- reading terms, definitional equality, and type comparison;
- axiom sets and term rewriting;
- adding composed declarations;
- statement-graph construction and acyclicity checks;
- typed bridge generation;
- the name/type/module axiom gate.

Python, Lake, Nix, or other glue should only orchestrate:

- discover libraries;
- compute library build order;
- run `lake build` per library in sandboxes;
- shuttle `.olean` files to isolated `lean4checker`;
- aggregate results.

Glue must not compute the axiom-remapping substitution or the whitelist
decision. The small trusted glue exception is signature/hash verification and
ensuring the recheck runs against the pinned base.

## Trusted Computing Base

Trusted:

- the Lean kernel;
- `lean4checker`;
- the canonical signed trusted base;
- the guarantee that verification runs against that base;
- the name/type/module axiom gate;
- the small provenance glue.

Not trusted:

- the composer;
- orchestration glue;
- every submission's proof file.

## Tests And Fixtures

The current fixture suite in `test-imports/` covers:

- package build failure;
- conditional statement/proof build preparation;
- metadata/schema failure;
- metadata path existence;
- statement-package disk closure;
- pinned toolchain and Mathlib version checks;
- namespace/package-name checks;
- folder and file size limits;
- file type policy;
- statement syntax policy;
- proof type matching with Lean `isDefEq`;
- `sorryAx` and local proof-axiom rejection;
- extra statement declaration rejection;
- unauthorized statement imports;
- final proof-build forbidden axiom checks.

Future fixture work should add or strengthen coverage for:

- submissions with only a statement package;
- submissions with only a proof package;
- rejection of statement theorem declarations;
- proofs that discharge an external submission's statement axiom by global name;
- statement-level dependency DAG acyclicity;
- axiom-gate matching by name, type, and source module.

## Suggested Milestone

Start with three toy libraries `C <- B <- A`, one statement each, dischargers
wired up, the composer producing the composed proof for `A`, the certificate
passing, and a `lean4checker` pass.

Then add a second statement per paper and a deliberate paper-level but
statement-acyclic cycle to confirm the graph is statement-granular.
