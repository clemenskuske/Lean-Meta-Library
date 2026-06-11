# Import Repository Expectations

This file records repository-content expectations for a source repository being
imported into the Lean Meta Library.

The submission metadata file remains the source of truth for the submitted
entries and paths. It must validate against `meta.config.yaml`.

## Metadata

- The metadata file is selected by the import command or workflow. If no path is
  provided, the default is `meta.yaml`.
- The metadata must use the exact field names and shapes from
  `meta.config.yaml`.

## Statement Package

The statement package is intentionally strict. When present, it contains only
the files mentioned by metadata plus its Lake file:
- `statementLakefilePath`
- each `statements[].Statement.LeanStatement`
- each `statements[].Statement.LatexDefinition`

No other Lean or LaTeX files may be present in the statement package.

The statement package Lake file must:

- be buildable by Lake;
- declare a Lean library  anduse the namespace/package shape implied by `submissionSlug`, namely
  `<SubmissionSlug>.Statements`;


Each statement LaTeX file is the paper-facing text for the matching Lean
statement or definition.

### Statement Lean Files
Each statement Lean file must:
- build as a Lean module exposed by the statement package Lake file;
- introduce exactly one direct and public declaration for its metadata entry;
  - of type `def` when the metadata entry has `Type: Definition`;
  - of type `axiom` when the metadata entry has `Type: Axiom`;

Statement files are checked with a conservative syntax policy. They may use
namespaces, sections, opens, universes, variables, declarations, and noncomputable;
They:
- must not introduce extra public, private, generated, instance, helper, or hidden
  declarations;
- must not use unsafe declarations;
- must not register the submitted declaration as a typeclass instance;
- must use a Lean name beginning with the namespace root derived from `submissionSlug`;
- must not contain the following syntax:
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
- the pinned Mathlib base import listed in `lml-env.json` under `baseImports`;
- Std modules provided by the fixed Lean version;
- local statement modules from the same submission;
- external imported-submission packages that are declared in that statement's
  `DeclarationReferences` metadata.



## Proof Package

The proof package is more flexible than the statement package. It may contain
ordinary proof development needed to build the submitted proof targets, but the
submitted proof targets named in metadata are the security boundary.

When present, the proof package must have `proofLakefilePath`, and that Lake file must:

- be buildable by Lake;
- declare the proof package/library for the submission;
- build the proof package, including every proof file listed by
  `proofs[].Proof.File`;
- declare a Lean library using the namespace/package shape implied by `submissionSlug`, namely
  `<SubmissionSlug>.Proofs`;
- may import any modules needed for the proof package to build. For repositories
  already recorded in `submissions.jsonl`, the proof code should prefer importing
  the statement packge and referencing their axioms rather than importing
  whole proof packages.

The proof package is not closed under metadata in the way the statement package
is. It may contain additional Lean files, helper declarations, intermediate
theorems, tactics, and internal proof development that are not listed in the
metadata. Those extra files and declarations are not submitted proof targets
unless a metadata proof entry names them.

### Lean Proof-Theorems
Each listed proof must:
- elaborate with Lean;
- contain a theorem named by `Proof.Name`;
- use a proof name beginning with the namespace root derived from
  `submissionSlug.Proofs`;

For submitted proof targets, the compiled axiom tree must be controlled:
- The proof target must not depend on `sorryAx`.
- The proof target must not depend on local proof-namespace axioms.
- Actual Lean axiom dependencies must be covered by declared dependencies in
  metadata besides the base Mathlib axioms listed in `lml-env.json`.

Proof package imports are allowed insofar as the package builds and the
submitted proof targets pass the axiom-dependency gate. The important check is
not that every proof-side file appears in metadata; it is that every metadata
proof entry is present and that the actual axiom dependencies of each submitted
proof target are declared by metadata.

## Toolchain And Mathlib
- Any statement or proof Lake package used by the submission must use the Lean
  version configured in `lml-env.json` under `lean.version`.
- Each present Lake file must have exactly one git dependency matching the
  `lakeDependency` configured for `baseImports.Mathlib`.
- The Mathlib dependency URL must use the repository configured for
  `baseImports.Mathlib`.
- The Mathlib dependency revision must be exactly the revision configured for
  `baseImports.Mathlib`; floating branches such as `stable` are not accepted.
- The mathlib dependency must not use a subdirectory.

## Imported Dependencies

External submission dependencies are authorized through metadata and
`submissions.jsonl`.

- Non-mathlib git dependencies in Lake files must correspond to imported
  submissions recorded in `submissions.jsonl` when that registry is available.
- Statement/surface imports from a submission recorded in `submissions.jsonl`
  must refer to the source commit recorded for that submission.
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
