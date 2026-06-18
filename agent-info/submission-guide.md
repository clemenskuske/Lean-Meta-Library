# Submission Guide

Use this guide when a user brings an arbitrary Lean project and asks you to make
it ready for Lean Meta Library submission. The goal is not just to create files
— it is to produce a submission package that accurately reflects the user's
mathematical intent and passes the checks exposed by the Lean Meta Library CLI.

Use submission terminology for the Lean Meta Library entry itself. A submission
is not the source repository; it may contain a statement package, a proof
package, or both.

## Core Principle

Do not infer the submitted statement set from the source project alone. Build
the submission together with the user. Ask which definitions and axioms should
become public entries, which statement axioms have proof evidence, and which
project details should stay private implementation.

A submission is ready only when all conditions hold:

- The manifest and statement files represent what the user wants to submit.
- The package passes `lml test --manifest=<path-to-manifest.yaml>` under the
  current checker.
- The user is pleased with the result.

## What A Ready Submission Means

A Lean Meta Library submission is meant to be a small public mathematical
object, not a dump of a working project. It should say, as clearly as possible:
these are the definitions and statements I want other people to see, these are
the proofs that justify the axioms I am claiming as proved, and these are the
dependencies and sources needed to understand the result.

The central distinction is between the public face of the submission and the
private work that produced it. The statement package is the public face. It
should contain only the declarations that are being contributed to the library:
definitions as Lean `def`s and statement-like claims as Lean `axiom`s. Each
statement should be small enough to inspect, named in the submission namespace,
and accompanied by human-facing LaTeX text. The proof package may contain more
ordinary Lean development, but the manifest names the specific proof
declarations that matter. Those proof declarations are the evidence offered for
the submitted axioms.

Readiness is therefore not just "Lean builds". A ready submission has made its
intent explicit. The manifest tells the checker and future readers what the
submission is called, where its abstract and license live, which declarations
are public, which proofs discharge which axioms, and which imported Lean Meta
Library statements are being relied on. Nothing essential should be implicit in
folder layout, comments, or local naming conventions alone.

The statement files should be deliberately boring. They are the interface that
future submissions may import, so they should avoid clever machinery,
implementation helpers, generated declarations, custom commands, and project
scaffolding. If a declaration is not part of the public mathematical claim, it
belongs outside the statement package. If a dependency matters semantically, it
belongs in the manifest.

The proof files carry the complexity instead. They may use helper lemmas and
internal organization, but each submitted proof target must have a compiled Lean
type definitionally equal to the axiom it discharges. The checker does not trust
textual resemblance or author intention; it asks Lean whether the proof has the
right type, whether it depends on forbidden placeholders such as `sorryAx`, and
whether its remaining axioms are only the trusted base axioms configured for the
library.

A ready submission is also reproducible. It uses the Lean version and Mathlib
revision fixed by the library, includes an accepted license, keeps paths inside
the manifest root, stays within the file and size policy, and excludes build
caches or unrelated source-project artifacts. This makes the submission
portable: the import workflow can check the same thing the author checked
locally.

In short, a submission is ready when a reader, the CLI, and the Lean kernel can
all agree on the same story:

- what mathematical objects are being offered;
- which of them are definitions and which are axioms;
- which axioms are backed by proof declarations;
- which prior imported statements are being used;
- under which fixed Lean and Mathlib environment the claim was checked;
- under which license the files are being contributed.

If that story is clear, minimal, user-approved, and accepted by
`lml test --manifest=<path-to-manifest.yaml>`, the submission is ready to send.

## First Conversation With The User

Before writing the submission package, gather these decisions from the user:

- Check whether a PDF of the paper is present. If it is, use it to answer
  relevant manifest and statement-selection questions where possible; if not,
  ask the user whether they can provide one.
- The submission title, submission slug, and short abstract.
- Which Lean project folder, archive, or remote source is the starting point.
- Which declarations should be public statement entries.
- For each public entry, whether it is a `Definition` or an `Axiom`.
- For each axiom that is being discharged, the global name of the proof
  declaration that establishes it (the proof may live in this submission or
  target another submission's axiom by global name).
- Whether any entry or proof depends on a previously imported Lean Meta Library
  submission listed in `submissions.jsonl`.
- BibTeX entries and any bibliographic context the user wants preserved.

If the user is unsure, inspect the source project and propose a small statement
plan, then ask the user to confirm or revise it.

## Package Shape

Create one manifest-root folder, normally named `<slug>-package/`. Prefer
starting from the CLI skeleton when it matches the current checker policy:

```sh
lml create-paper <slug>
```

A submission may contain only a statement package, only a proof package, or
both. When both are present, keep them separate:

- The statement package contains its `lakefile.lean`, `lean-toolchain`, and the
  Lean and LaTeX statement files named by the manifest.
- The proof package contains its `lakefile.lean`, `lean-toolchain`, proof files
  named by the manifest, and any internal proof development needed to build
  those proof targets.

The expected package/library names are derived from `SubmissionSlug` as
`<SubmissionSlugAsPascal>.Statements` and `<SubmissionSlugAsPascal>.Proofs`.

## Manifest File

Create `manifest.yaml` with the user. It is the source of truth for the CLI
checks. Use `manifest.config.yaml` as the schema source of truth.
Workflow-created fields (`Repo`, `submittedBy`, `Commit`, `submissionIssueNumber`,
`submissionIssueUrl`) should normally be omitted until tooling writes them.

The author-supplied required top-level fields are:

```yaml
AbstractPath: abstract.tex
LicenseFile: LICENSE
SubmissionName: User Confirmed Title
SubmissionSlug: user-slug
BibEntries: []
```

`LicenseFile` must point to a file that exists in the submission package. The
file content must contain a recognized license identifier from
[`lml-env.json`](../lml-env.json) `submission.allowedLicenseIdentifiers`
(MIT License, Apache License, GNU General Public License, GNU Lesser General
Public License, GNU Affero General Public License, BSD 2-Clause License, BSD
3-Clause License, ISC License, Creative Commons, CC0 1.0 Universal). Use a
standard license text for the chosen identifier.

A statement package is added as `StatementSubmissions` with `rootFolder` and
`statements`. The `rootFolder` is the repository-relative folder containing
the package; it must contain a `lakefile.lean` and a `lean-toolchain`:

```yaml
StatementSubmissions:
  rootFolder: statements
  statements:
    - Name: UserSlug.Statements.MainDefinition.main_definition
      Type: Definition
    - Name: UserSlug.Statements.MainStatement.main_statement
      Type: Axiom
```

A proof package is added as `ProofSubmissions` with `rootFolder` and `proofs`.
The `rootFolder` is the repository-relative folder containing the package; it
must contain a `lakefile.lean` and a `lean-toolchain`:

```yaml
ProofSubmissions:
  rootFolder: proofs
  proofs:
    - Name: UserSlug.Proofs.MainStatement.main_statement
      AxiomReference: UserSlug.Statements.MainStatement.main_statement
```

Each proof entry has `Name` (the global name of the proof declaration) and
`AxiomReference` (the global name of the statement axiom it discharges). The
leading namespace segment of each name is the owning submission's slug in
PascalCase. The target axiom may belong to this submission or to another
submission. All repository paths must be relative paths that stay inside the
manifest root.

## Statement Files

The statement content records the public mathematical entries. It should be
minimal, trustworthy, and user-confirmed.

Each submitted statement file must:

- import only pinned Mathlib base modules from `lml-env.json`, Std modules
  provided by the fixed Lean version, local statement modules, or authorized
  imported statement packages;
- introduce exactly one direct public declaration recorded by the manifest;
- use a Lean declaration name beginning with the namespace root derived from
  `SubmissionSlug`;
- avoid helper declarations, private declarations, generated declarations,
  instances, structures, classes, inductives, macros, custom syntax, `unsafe`,
  `run_cmd`, `#eval`, `#print`, `extern`, and `IO`.

The direct declaration rules are:

- `Definition` entries must introduce one `def`.
- `Axiom` entries must introduce one `axiom`.
- Statement entries must not introduce theorems.

The statement package may not contain extra `.lean` or `.tex` files beyond the
manifest-listed statement files and `lakefile.lean`. Every statement entry
should also have a LaTeX file explaining it in paper-facing language.

## Dependencies

`SemanticDependencies` on statement entries lists fully-qualified declaration
names that the statement depends on. Actual proof dependencies come from Lean
axiom collection and must be covered by declared dependencies, aside from
allowed base axioms. Undeclared axiom dependencies should survive to the axiom
gate rather than being silently rewritten.

For dependency work, run `lml update` first and read `submissions.jsonl`.
External dependencies must be backed by a matching row in `submissions.jsonl`.

## Proof Artifacts

Proof artifacts contain typed proof evidence for submitted axioms. Each proof
entry in `ProofSubmissions.proofs` pairs a target statement axiom
(`AxiomReference`) with the proof declaration that discharges it (`Name`), both
as global Lean names.

A discharged axiom needs one matching manifest proof entry whose `Name`
declaration builds in the proof package. The CLI compares the compiled Lean type
of the statement axiom and the proof declaration with Lean `isDefEq`; textual
similarity is not enough.

Proof packages may contain helper files and internal declarations, but submitted
proof targets must be clean:

- the proof package must build so each `Name` declaration resolves;
- submitted proof targets must not depend on `sorryAx`;
- submitted proof targets must not depend on local proof-namespace axioms;
- actual axiom dependencies may bottom out only in allowed base axioms.

## Final Proof Build

The current final proof build copies the manifest-root package tree into an
isolated directory, runs `lake update`, `lake clean`, a best-effort cache fetch,
and `lake build`, then rejects build output that reports `sorry` or `sorryAx`.

It then composes each submitted proof target onto the statement axiom it
discharges. Composed outputs may rely only on allowed base axioms listed in
`lml-env.json`'s `checks.allowedMathlibAxioms`, matched by Lean name and type.

When `lean4checker` is available, the final checker also rechecks the composed
`.olean` output.

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

Run the CLI check against exactly one manifest file:

```sh
lml test --manifest=<slug>-package/manifest.yaml
```

Fix every error. Treat warnings as review items and decide whether they are
acceptable.

Also check:

- A license file exists at `LicenseFile` and its content contains a recognized
  license identifier from `lml-env.json`'s `submission.allowedLicenseIdentifiers`.
- `lean-toolchain` files are present for each package and match the fixed Lean
  version from `lml-env.json`.
- Any present Lake files keep the Mathlib source URL and revision required by
  the pinned Mathlib base import unless the CLI explicitly instructs otherwise.
- `lake update` and `lake build` work for each present package.
- Every manifest path exists and stays inside the manifest root.
- No file exceeds the limits reported by `lml test`.
- File extensions are accepted by `lml test`.
- The package contains no `.DS_Store`, generated build caches, or unrelated
  project artifacts.

## Submission Readiness Checklist

Before submitting or asking the user to submit, confirm:

- The user has approved the title, submission slug, abstract, statement entries,
  proof entry types, dependencies, and bibliographic manifest.
- A license file is present at `LicenseFile` with a recognized license
  identifier (MIT License, Apache License, GNU General Public License, GNU
  Lesser General Public License, GNU Affero General Public License, BSD
  2-Clause License, BSD 3-Clause License, ISC License, Creative Commons, CC0
  1.0 Universal); see [`lml-env.json`](../lml-env.json)
  `submission.allowedLicenseIdentifiers` for the canonical list.
- Every `Definition` and `Axiom` entry has a matching statement file and LaTeX
  file.
- Every discharged axiom has a matching typed proof file and manifest entry.
- Statement files contain exactly one direct public declaration each.
- Proof targets contain no forbidden placeholders or local proof-package axioms.
- Any external dependency is backed by a matching row in `submissions.jsonl`.
- `lml test --manifest=<slug>-package/manifest.yaml` passes for the exact
  manifest path.
