# Import Submission Expectations

This file records repository-content expectations for a source repository being
imported into the Lean Meta Library.

The submission manifest file is the source of truth for submitted entries and
paths. It must validate against `manifest.config.yaml`; when this file and the
schema disagree, follow the schema.

## Metadata

- The manifest file is selected by the import command or workflow. If no path is
  provided, the default is `manifest.yaml`.
- The import workflow runs for GitHub issues labeled `submission`. Issues
  opened directly by public submitters can receive that label automatically
  when they contain the Lean Meta Library submission marker and valid source
  repository fields.
- The submitted source repository must be public. Private-repository checkout is
  currently unsupported by the import workflow.
- The manifest must use the exact field names and shapes from
  `manifest.config.yaml`.
- Author-supplied required top-level fields are `AbstractPath`, `SubmissionName`,
  `SubmissionSlug`, `BibEntries`, and `LicenseFile`.
- `LicenseFile` must point to a license file whose content contains a recognized
  license identifier. Recognized identifiers are listed in `lml-env.json` under
  `submission.allowedLicenseIdentifiers` and include MIT, Apache, GPL, LGPL,
  AGPL, BSD 2-Clause, BSD 3-Clause, ISC, Creative Commons, and CC0.
- `StatementSubmissions` must be present when a statement package exists. It
  requires `rootFolder` (a repository-relative path to the package folder) and
  `statements`. The folder must contain a `lakefile.lean` and a `lean-toolchain`
  file.
- `ProofSubmissions` must be present when a proof package exists. It requires
  `rootFolder` (a repository-relative path to the package folder) and `proofs`.
  The folder must contain a `lakefile.lean` and a `lean-toolchain` file.
- Workflow/tooling-created fields are `Repo`, `submittedBy`, `Commit`,
  `submissionIssueNumber`, and `submissionIssueUrl`. Authors should omit these
  until tooling writes them.

## Statement Package

The statement package is intentionally strict. When present, it contains only
the submitted statement Lean/LaTeX files and its Lake file. No other Lean or
LaTeX files may be present in the statement package.

The statement package Lake file must:

- be buildable by Lake;
- declare package `<SubmissionSlugAsPascal>.Statements`;
- declare `lean_lib <SubmissionSlugAsPascal>.Statements`;
- use the fixed Lean version from `lml-env.json`;
- pin Mathlib to `lml-env.json`'s `baseImports.Mathlib.revision` whenever it
  declares Mathlib.

Each statement LaTeX file is the paper-facing text for the matching Lean
statement file's public entries.

### Statement Lean Files

Each statement Lean file must:

- build as a Lean module exposed by the statement package Lake file;
- introduce only direct public declarations listed by manifest entries;
- use a Lean declaration name beginning with the namespace root derived from
  `SubmissionSlug`.

Each statement manifest entry must:

- resolve to exactly one direct declaration in its statement file;
- resolve to a Lean `def` when it has `Type: Definition`;
- resolve to a Lean `axiom` when it has `Type: Axiom`.

Statement files are checked with a conservative syntax policy. They may use
imports, namespaces, sections, opens, universes, variables, declarations, and
`noncomputable`.

They must not:

- introduce extra public, private, generated, instance, helper, or hidden
  declarations not listed by manifest entries;
- use theorem declarations as submitted statement content;
- use `abbrev`, unsafe declarations, or typeclass instances for submitted
  declarations;
- use macros, custom syntax, elaborators, custom commands, `unsafe`, `run_cmd`,
  `#eval`, `#print`, `extern`, or `IO`.

Statement imports are restricted. A statement file may directly import:

- the pinned Mathlib base import listed in `lml-env.json` under `baseImports`;
- Std modules provided by the fixed Lean version;
- local statement modules from the same submission;
- external imported-submission statement packages listed by the statement
  entries' `SemanticDependencies` and present in the statement Lake file.

External statement dependencies are matched through `submissions.jsonl` by
global declaration name when the registry is available.

## Proof Package

The proof package is more flexible than the statement package. It may contain
ordinary proof development needed to build the submitted proof targets, but the
submitted proof targets named in the manifest are the security boundary.

When present, the proof package Lake file must:

- be buildable by Lake;
- declare package `<SubmissionSlugAsPascal>.Proofs`;
- declare `lean_lib <SubmissionSlugAsPascal>.Proofs`;
- use the fixed Lean version from `lml-env.json`;
- pin Mathlib to `lml-env.json`'s `baseImports.Mathlib.revision` whenever it
  declares Mathlib;
- build so every declaration named by `ProofSubmissions.proofs[].Name` is
  available;
- use only local Lake dependencies on the current submission's
  `StatementSubmissions` package when local dependencies are present.

Proof packages may contain additional Lean files, helper declarations,
intermediate theorems, tactics, and internal proof development not listed in the
manifest. Those extra declarations are not submitted proof targets unless a
manifest proof entry names them.

### Lean Proof Targets

Each proof entry has `Name` (the global name of the proof declaration) and
`AxiomReference` (the global name of the statement axiom it discharges). Each
listed proof must:

- resolve, by name, to a declaration in the built proof package;
- have a `Name` beginning with the namespace root derived from `SubmissionSlug`;
- have a compiled Lean type definitionally equal to the type of the
  `AxiomReference` declaration, as checked by Lean `isDefEq`.

For submitted proof targets, compiled axiom dependencies are controlled:

- The proof target must not depend on `sorryAx`.
- The proof target must not depend on local proof-namespace axioms.
- Any non-base axiom dependency must be explicitly listed in that proof entry's
  `ProofObligations`.
- Otherwise, the proof target may bottom out only in allowed base axioms from
  `lml-env.json`.

The `AxiomReference` may belong to this submission or to another submission;
the leading namespace segment of its global name identifies the owning
submission. When the target axiom belongs to another submission, the proof
checker augments proof Lake files with the required external statement-package
dependency when it can find a matching `submissions.jsonl` row.

## Final Proof Build

The final proof-build check copies the manifest-root package tree into an
isolated directory, runs `lake update`, `lake clean`, a best-effort cache fetch,
and `lake build`. Build output from declarations outside the submitted proof
targets is not treated as part of the proof trust boundary.

It then composes each submitted proof target onto the statement axiom it
discharges. Composed proof outputs may bottom out only in allowed base axioms
listed in `lml-env.json`'s `checks.allowedMathlibAxioms`, matched by Lean name
and type.

The final checker attempts an additional `lean4checker` pass over the composed
`.olean` output when `lean4checker` is available.

Before the final proof build, the proof axiom dependency generator expands each
proof entry's declared `ProofObligations` through the current manifest and
`submissions.jsonl`, then writes the expected non-Mathlib final axiom names into
the workflow-created `AxiomDependencies` field. The final proof build compares
that field against the axiom names collected from each final composed proof
target and emits a warning if they differ. The import workflow carries the
generated field into the checked manifest artifact and then into
`submissions.jsonl`.

The longer-term target is to extend the axiom gate so trusted-base matches are
also tied to source module/provenance.

## License

Every submission must include a license file. The `LicenseFile` manifest field
must be set and the file it points to must exist. The file content must contain
at least one of the allowed license identifiers configured in `lml-env.json`
under `submission.allowedLicenseIdentifiers`.

The current recognized license identifiers are:

- `MIT License`
- `Apache License`
- `GNU General Public License`
- `GNU Lesser General Public License`
- `GNU Affero General Public License`
- `BSD 2-Clause License`
- `BSD 3-Clause License`
- `ISC License`
- `Creative Commons`
- `CC0 1.0 Universal`

The `general/license.mjs` checker enforces this requirement.

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

The file policy applies to the repository subtree rooted at the manifest file.

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
