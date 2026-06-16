# Import Submission Expectations

This file records repository-content expectations for a source repository being
imported into the Lean Meta Library.

The submission metadata file is the source of truth for submitted entries and
paths. It must validate against `meta.config.yaml`; when this file and the
schema disagree, follow the schema.

## Metadata

- The metadata file is selected by the import command or workflow. If no path is
  provided, the default is `manifest.yaml`.
- The metadata must use the exact field names and shapes from
  `meta.config.yaml`.
- Author-supplied required top-level fields are `abstractPath`,
  `submissionTitle`, `submissionSlug`, and `bibtex-entries`.
- `statements` and `statementRoot` must appear together when a statement
  package is present. `statementRoot` is a repository-relative folder path;
  the folder must contain a `lakefile.lean` and a `lean-toolchain` file.
- `proofs` and `proofRoot` must appear together when a proof package is
  present. `proofRoot` is a repository-relative folder path; the folder must
  contain a `lakefile.lean` and a `lean-toolchain` file.
- Workflow/tooling-created fields include `githubRepo`, `submittedBy`,
  `LakeStatementPackage`, `LakeProofPackage`, `submissionIssueNumber`, and
  `submissionIssueUrl`.
- Declaration references use exactly one of `CurrentSubmission: true` or
  `SubmissionSlug`, plus `LeanStatement`, `LatexDefinition`, and `Name`.
  `LeanStatement` and `LatexDefinition` must be in the same folder.

## Statement Package

The statement package is intentionally strict. When present, it contains only
the submitted statement Lean/LaTeX files, current-submission declaration
reference Lean/LaTeX files, and its Lake file. No other Lean or LaTeX files may
be present in the statement package.

The statement package Lake file must:

- be buildable by Lake;
- declare package `<SubmissionSlugAsPascal>.Statements`;
- declare `lean_lib <SubmissionSlugAsPascal>.Statements`;
- use the fixed Lean version from `lml-env.json`;
- pin Mathlib to `lml-env.json`'s `baseImports.Mathlib.revision` whenever it
  declares Mathlib.

Each statement LaTeX file is the paper-facing text for the matching Lean
statement or definition.

### Statement Lean Files

Each statement Lean file must:

- build as a Lean module exposed by the statement package Lake file;
- introduce exactly one direct public declaration for its metadata entry;
- introduce a Lean `def` when the metadata entry has `Type: Definition`;
- introduce a Lean `axiom` when the metadata entry has `Type: Axiom`;
- use a Lean declaration name beginning with the namespace root derived from
  `submissionSlug`.

Statement files are checked with a conservative syntax policy. They may use
imports, namespaces, sections, opens, universes, variables, declarations, and
`noncomputable`.

They must not:

- introduce extra public, private, generated, instance, helper, or hidden
  declarations;
- use theorem declarations as submitted statement content;
- use `abbrev`, unsafe declarations, or typeclass instances for submitted
  declarations;
- use macros, custom syntax, elaborators, custom commands, `unsafe`, `run_cmd`,
  `#eval`, `#print`, `extern`, or `IO`.

Statement imports are restricted. A statement file may directly import:

- the pinned Mathlib base import listed in `lml-env.json` under `baseImports`;
- Std modules provided by the fixed Lean version;
- local statement modules from the same submission;
- external imported-submission statement packages that are both present in the
  statement Lake file and declared in that statement's `DeclarationReferences`.

External statement dependencies are matched through `submissions.jsonl` by
repository URL, source branch or commit, and package folder information when the
registry is available.

## Proof Package

The proof package is more flexible than the statement package. It may contain
ordinary proof development needed to build the submitted proof targets, but the
submitted proof targets named in metadata are the security boundary.

When present, the proof package Lake file must:

- be buildable by Lake;
- declare package `<SubmissionSlugAsPascal>.Proofs`;
- declare `lean_lib <SubmissionSlugAsPascal>.Proofs`;
- use the fixed Lean version from `lml-env.json`;
- pin Mathlib to `lml-env.json`'s `baseImports.Mathlib.revision` whenever it
  declares Mathlib;
- build so every declaration named by `proofs[].proof` is available;
- use only local Lake dependencies on the current submission's statement package
  when local dependencies are present.

Proof packages may contain additional Lean files, helper declarations,
intermediate theorems, tactics, and internal proof development that are not
listed in the metadata. Those extra files and declarations are not submitted
proof targets unless a metadata proof entry names them.

### Lean Proof Targets

Each proof entry names a target statement axiom (`axiom`) and a proof
declaration (`proof`), both as global Lean names. Each listed proof must:

- resolve, by name, to a declaration in the built proof package;
- use a `proof` name beginning with the namespace root derived from
  `submissionSlug`;
- have a compiled Lean type definitionally equal to the type of the `axiom`
  declaration it discharges, as checked by Lean `isDefEq`.

For submitted proof targets, compiled axiom dependencies are controlled:

- The proof target must not depend on `sorryAx`.
- The proof target must not depend on local proof-namespace axioms.
- The proof target may bottom out only in allowed base axioms from
  `lml-env.json`.

The target `axiom` may belong to this submission or to another submission; the
leading namespace segment of its global name identifies the owning submission.
When the target axiom belongs to another submission, the proof checker augments
proof Lake files with the required external statement-package dependency when it
can find a matching `submissions.jsonl` row.

## Final Proof Build

The final proof-build check copies the metadata-root package tree into an
isolated directory, runs `lake update`, `lake clean`, a best-effort cache fetch,
and `lake build`, then rejects build output reporting `sorry` or `sorryAx`.

It then composes each submitted proof target onto the statement axiom it
discharges. Composed proof outputs may bottom out only in allowed base axioms
listed in `lml-env.json`'s `checks.allowedMathlibAxioms`, matched by Lean name
and type.

The final checker attempts an additional `lean4checker` pass over the composed
`.olean` output when `lean4checker` is available.

The longer-term target is to extend the axiom gate so trusted-base matches are
also tied to source module/provenance.

## Toolchain And Mathlib

- Any statement or proof Lake package used by the submission must use the Lean
  version configured in `lml-env.json` under `lean.version`.
- The Mathlib dependency URL must be
  `https://github.com/leanprover-community/mathlib4.git`.
- The Mathlib dependency revision must be exactly the revision configured for
  `baseImports.Mathlib`; floating branches such as `stable` are not accepted.
- Std is provided by the fixed Lean version and is not listed separately as a
  base import.

## Files, Folders, And Size Limits

The file policy applies to the repository subtree rooted at the metadata file.

- `.DS_Store` files are rejected.
- Unknown extensionless files are rejected.
- Files with extensions outside the allowed extension list in `lml-env.json` are
  rejected.
- Ignored directories are `.git`, `.lake`, and `node_modules`.
- Package size, folder size, and individual file size must stay within
  `lml-env.json`'s submission limits.

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
