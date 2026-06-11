# Import Repository Expectations

This file records repository-content expectations for a source repository being
imported into the Lean Meta Library. It is separate from
`repo-structure.config.yaml`: that file describes the physical file layout,
while this file explains the extra checker and policy expectations attached to
those files.

The submission metadata file remains the source of truth for the submitted
entries and paths. It must validate against `meta.config.yaml`.

## Metadata

- The metadata file is selected by the import command or workflow. If no path is
  provided, the default is `meta.yaml`.
- The metadata must use the exact field names and shapes from
  `meta.config.yaml`.
- All metadata paths must be repository-relative and stay inside the repository
  root.
- `statements` and `statementLakefilePath` must appear together.
- `proofs` and `proofLakefilePath` must appear together.
- `abstractPath`, all statement Lean/LaTeX files, theorem target files, proof
  files, and present Lake files must exist on disk.
- A proof entry must target a metadata statement, and that target statement must
  have `Type: Axiom`.
- `DeclarationReferences` records must use either `CurrentSubmission: true` or
  `SubmissionSlug`, plus `LeanStatement`, `LatexDefinition`, and `Name`.
- The `LeanStatement` and `LatexDefinition` paths in a declaration reference
  must be in the same folder.
- Metadata text should be plain ASCII accepted by the checkers. Suspicious shell
  tokens such as backticks, command substitutions, shell separators, and angle
  brackets are rejected.

## Statement Package

The statement package is intentionally strict. When present, it contains only
the files mentioned by metadata plus the statement package Lake file:

- `statementLakefilePath`
- each `statements[].Statement.LeanStatement`
- each `statements[].Statement.LatexDefinition`

No other Lean or LaTeX files may be present in the statement package. Each
metadata statement Lean/LaTeX reference must resolve to a file, and each
statement package Lean/LaTeX file must be referenced by metadata. In particular,
extra statement/declaration folders or unlisted statement files are rejected.

The statement package Lake file must:

- be buildable by Lake;
- declare the statement package/library for the submission;
- expose exactly the metadata-referenced statement Lean files through the shared
  statement library;
- use the namespace/package shape implied by `submissionSlug`, namely
  `<SubmissionSlugAsPascal>.Statements`;
- declare a Lean library named `<SubmissionSlugAsPascal>.Statements`.

Each statement Lean file must:

- build as a Lean module exposed by the statement package Lake file;
- introduce exactly one direct public declaration for its metadata entry;
- introduce a Lean `def` when the metadata entry has `Type: Definition`;
- introduce a Lean `axiom` when the metadata entry has `Type: Axiom`;
- not use theorem declarations for `Axiom` entries;
- not introduce extra public, private, generated, instance, helper, or hidden
  declarations;
- not use abbreviations for submitted definitions;
- not use unsafe declarations;
- not register the submitted declaration as a typeclass instance;
- use a Lean name beginning with the namespace root derived from
  `submissionSlug`;
- avoid the old `.Surface.` namespace marker.

Statement files are checked with a conservative syntax policy. They may use
ordinary imports, namespaces, sections, opens, universes, variables,
declarations, and `noncomputable`; they must not use:

- macros;
- custom syntax;
- elaborators;
- custom commands;
- `unsafe`;
- `run_cmd`;
- `#eval`;
- `#print`;
- `extern`;
- `IO`.

Statement imports are restricted. A statement file may directly import:

- allowed base prefixes from `lml-env.json`, currently `Mathlib.` and `Std.`;
- local statement modules from the same submission;
- external imported-submission packages that are declared in that statement's
  `DeclarationReferences` metadata.

Each statement LaTeX file is the paper-facing text for the matching Lean
statement or definition.

## Proof Package

The proof package is more flexible than the statement package. It may contain
ordinary proof development needed to build the submitted proof targets, but the
submitted proof targets named in metadata are the security boundary.

When present, the proof package must have `proofLakefilePath`, and that Lake file
must:

- be buildable by Lake;
- declare the proof package/library for the submission;
- build the proof package, including every proof file listed by
  `proofs[].Proof.File`;
- use the namespace/package shape implied by `submissionSlug`, namely
  `<SubmissionSlugAsPascal>.Proofs`;
- declare a Lean library named `<SubmissionSlugAsPascal>.Proofs`;
- use only allowed local dependencies: the local statement package for the same
  submission, or the tolerated legacy local surface package during migration.

The proof package is not closed under metadata in the way the statement package
is. It may contain additional Lean files, helper declarations, intermediate
theorems, tactics, and internal proof development that are not listed in the
metadata. Those extra files and declarations are not submitted proof targets
unless a metadata proof entry names them.

Each metadata proof entry must:

- have `Type: proof`, `Type: conditional-proof`, or `Type: reduction`;
- name a theorem target with `Theorem.SubmissionSlug`, `Theorem.File`, and
  `Theorem.Name`;
- name a proof declaration with `Proof.File` and `Proof.Name`;
- have the file named by `Proof.File` present in the proof package;
- have the declaration named by `Proof.Name` present in that proof file;
- have a proof declaration whose compiled type is definitionally equal to the
  target statement's compiled type.

Each listed proof file must:

- elaborate with Lean;
- contain a theorem named by `Proof.Name`;
- import the target statement module;
- use a proof name beginning with the namespace root derived from
  `submissionSlug`;
- not report `sorry` or `sorryAx` in Lean output for submitted proof targets.

For submitted proof targets, the compiled axiom tree must be controlled:

- The proof target must not depend on `sorryAx`.
- The proof target must not depend on local proof-namespace axioms.
- Actual Lean axiom dependencies must be covered by declared dependencies in
  metadata.
- For final proof checking, allowed axioms are trusted base Mathlib axioms from
  `lml-env.json` plus declared conjecture axioms from `reduction` entries.
- Any other axiom in a submitted proof target is rejected.

Proof package imports are allowed insofar as the package builds and the
submitted proof targets pass the axiom-dependency gate. The important check is
not that every proof-side file appears in metadata; it is that every metadata
proof entry is present and that the actual axiom dependencies of each submitted
proof target are declared by metadata.

## Toolchain And Mathlib

The current checker suite still verifies package toolchain and mathlib policy,
even though `lean-toolchain` files are not part of the physical layout contract
in `repo-structure.config.yaml`.

- `pinnedLeanToolchain` in metadata must equal `lml-env.json`'s
  `lean.toolchain`.
- Each present Lake package currently must have a `lean-toolchain` file.
- Each present package `lean-toolchain` file must contain exactly the configured
  Lean toolchain from `lml-env.json`.
- Each present Lake file must have exactly one git dependency named `mathlib`.
- The mathlib dependency URL must be the repository from `lml-env.json`.
- The mathlib dependency revision must be exactly `lml-env.json`'s
  `mathlib.revision`; floating branches such as `stable` are not accepted.
- The mathlib dependency must not use a subdirectory.

## Imported Dependencies

External submission dependencies are authorized through metadata and
`submissions.jsonl`.

- Non-mathlib git dependencies in Lake files must correspond to imported
  submissions recorded in `submissions.jsonl` when that registry is available.
- External Lake dependencies must be listed through statement-level or
  proof-level `DeclarationReferences`.
- Undeclared imports from imported submissions are rejected.
- Dependency records are matched by repository URL, source branch or commit, and
  package folder information.

## Files, Folders, And Size Limits

The file policy applies to the repository subtree rooted at the metadata file.

- `.DS_Store` files are rejected.
- Unknown extensionless files are rejected.
- Files with extensions outside the allowed extension list in `lml-env.json` are
  rejected.
- Ignored directories are `.git`, `.lake`, and `node_modules`.
- Package size, folder size, and individual file size must stay within
  `lml-env.json`'s first-run submission limits.

The current allowed file extensions are:

- `.lean`
- `.tex`
- `.yaml`
- `.yml`
- `.json`
- `.bib`
- `.md`
- `.txt`

The current allowed extensionless files are:

- `lean-toolchain`
- `LICENSE`
- `README`

## Build Flow

First-run checks prepare packages before running static and Lean checks.

- Lake must be available on `PATH`.
- For each present package, `lake update` must succeed.
- `lake exe cache get` is best-effort; failure is a warning.
- `lake build` must succeed for each present package.
- Statement files are individually built and inspected.
- Proof files listed in metadata are elaborated and inspected.
- The final proof build copies the package tree into isolation, excluding
  `.git`, `.lake`, and `node_modules`, then runs `lake update`, `lake clean`,
  optional cache fetch, and `lake build`.

The final proof build rejects submitted proof targets that are missing, report
`sorry`, or depend on axioms outside the allowed trusted base and declared
conjectures.
