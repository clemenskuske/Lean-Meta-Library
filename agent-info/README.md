# Submission-Ready Lean Project Agent Guide

Use this guide when a user brings an arbitrary Lean project and asks an agent to make it ready for Lean Meta Library submission. The goal is not just to create files. The goal is to produce a submission package that accurately reflects the user's mathematical intent and passes the repository checks.

Always read the repository `AGENTS.md`, root `README.md`, and any project-local README or agent instructions before changing files.

## Core Principle

Do not infer the submitted paper surface from the source project alone. Build the submission together with the user. Ask what definitions, theorem statements, and conjectures should become the public surface, which results are required proofs, and which project details should stay private implementation.

A submission is accepted only when both conditions hold:

- The metadata and surface files represent what the user wants to submit.
- The package passes the local submission checks and final proof-build policy.

## First Conversation With The User

Before writing the submission package, gather these decisions from the user:

- The submission title, namespace slug, and short abstract.
- Which Lean project folder or repository is the source.
- Which declarations should be public surface entries.
- For each public entry, whether it is a `Definition`, `Theorem`, or `Conjecture`.
- For each theorem, which proof in the source project should establish it.
- Whether any surface entry depends on another submitted surface entry.
- Whether any surface entry depends on a previously imported Lean Meta Library surface package.
- Bibliographic fields, if known: arXiv URL, DOI, online source, ORCIDs, venue, keywords, and BibTeX.

If the user is unsure, inspect the source project and propose a small surface plan, then ask the user to confirm or revise it.

## Package Shape To Create

Create one submission package folder, normally named `<slug>-package/`. The CLI starter is useful:

```sh
lml create-paper <slug>
```

Then replace the starter content with the user's actual submission. Preserve this structure:

```text
<slug>-package/
  lean-toolchain
  lakefile.lean
  meta.yaml
  abstract.tex
  surface-package/
    lean-toolchain
    lakefile.lean
    <EntryName>/
      latex-file.tex
      Surface.lean
  proofs/
    <TheoremName>Proof.lean
```

Do not create an aggregate slug folder under `surface-package/`. Each surface entry must be a direct child folder of `surface-package/`.

## Metadata File

Create `meta.yaml` with the user. It is the source of truth for the checks. Use this shape:

```yaml
pinnedLeanToolchain: leanprover/lean4:v4.30.0
proofLakefileUrl: .
paperTitle: User Confirmed Title
namespaceSlug: UserSlug
surfaceLakefilePath: surface-package/lakefile.lean
abstractUrl: abstract.tex
surfaceEntries:
  - type: Definition
    name: UserSlug.Surface.Definition.EntryName
    folder: surface-package/EntryName
    usedSurfaceFiles: []
  - type: Theorem
    name: UserSlug.Surface.Theorem.MainTheorem
    folder: surface-package/MainTheorem
    usedSurfaceFiles: []
proofs:
  - theorem: UserSlug.Surface.Theorem.MainTheorem.main_theorem
    proofFile: proofs/MainTheoremProof.lean
bibtex: ""
paper:
  paperTitle: User Confirmed Title
  arxivUrl: ""
  onlineSource: ""
  doi: ""
  orcids: []
  journalOrConference: ""
  keywords: []
```

For a conjecture, add a surface entry with `type: Conjecture` and also add it to `proofs:` without a `proofFile`:

```yaml
proofs:
  - theorem: UserSlug.Surface.Conjecture.EntryName.conjecture_name
    conjecture: True
```

Metadata strings must stay simple ASCII text accepted by the whitelist. Avoid shell syntax, angle brackets, backticks, semicolons, and nonessential punctuation.

## Surface Package

The surface package records the public mathematical statements. It should be minimal and user-confirmed.

The surface `lakefile.lean` must:

- Declare `package UserSlug.Surface where`.
- Require mathlib from the exact `lml-env.json` revision.
- Declare one `lean_lib <EntryName>` for every surface entry.
- Use `globs := #[\`<EntryName>.+]` for each surface entry.

Each `surface-package/<EntryName>/Surface.lean` must:

- Import only allowed modules: `Mathlib.*`, `Std.*`, local surface modules, or authorized imported `.Surface` packages.
- Open `namespace UserSlug.Surface.<Type>.<EntryName>`.
- Introduce exactly one direct public declaration in that namespace.
- End the same namespace.
- Avoid helper declarations, private declarations, instances, structures, classes, inductives, macros, custom syntax, `unsafe`, `run_cmd`, `#eval`, `#print`, `extern`, and `IO`.

The direct declaration rules are:

- `Definition` entries must introduce one `def`.
- `Theorem` entries may introduce one `axiom` or `theorem`.
- `Conjecture` entries may introduce one `axiom` or `theorem`.

Every surface entry folder must also include `latex-file.tex` explaining the entry in paper-facing language.

## Surface Dependencies

Surface files may freely import other local surface modules from the same submission package. Prefer fully qualified names over `open`.

If a surface entry imports a surface module from another Lean Meta Library submission, the dependency must already be authorized by `submissions.jsonl`, the Lake dependency must point to that repository, source commit, and surface folder, and the current entry must list it in `usedSurfaceFiles`.

Use this metadata shape:

```yaml
usedSurfaceFiles:
  - githubRepo: owner/repo
    slug: OtherSlug
    surfaceFile: surface-package/OtherEntry/Surface.lean
    definition: OtherSlug.Surface.Definition.OtherEntry.other_decl
```

The referenced definition must live in a different namespace from the current surface entry.

## Proof Package

The root proof package proves every submitted surface theorem. It must not prove conjectures.

The root `lakefile.lean` must:

- Declare `package UserSlug.Proofs where`.
- Require mathlib from the exact `lml-env.json` revision.
- Require the local surface package with `require UserSlug.Surface from "./surface-package"`.
- Declare `lean_lib UserSlug.Proofs where`.
- Set `srcDir := "proofs"`.
- Include roots or module layout matching the proof files.

Every surface theorem declaration needs exactly one matching metadata proof entry and proof file. If the surface theorem is:

```lean
namespace UserSlug.Surface.Theorem.MainTheorem

axiom main_theorem : SomeStatement

end UserSlug.Surface.Theorem.MainTheorem
```

then the proof file must import its own surface theorem module and prove the same constant name in the proof namespace:

```lean
import MainTheorem.Surface

namespace UserSlug.Proofs.Theorem.MainTheorem

theorem main_theorem : SomeStatement := by
  ...

end UserSlug.Proofs.Theorem.MainTheorem
```

The checker compares the compiled Lean types of the surface declaration and proof theorem. Textual similarity is not enough. The proof theorem must elaborate with exactly the same type.

Proof files must not contain `axiom`, `sorry`, `admit`, or `unsafe`. The compiled proof theorem must not depend on `sorryAx`, same-submission proof axioms, or same-submission surface axioms. The final proof build may use only accepted conjecture axioms and the allowed mathlib axiom signatures listed in `lml-env.json`.

## Converting An Existing Lean Project

For an arbitrary project, use this workflow:

1. Inspect its Lake files, toolchain, imports, namespaces, and theorem declarations.
2. Ask the user which declarations form the intended submission surface.
3. Translate those declarations into one-declaration surface files under the required namespaces.
4. Copy or adapt only the proof code needed for submitted theorems into `proofs/`.
5. Replace references to source-project namespaces with the new surface/proof namespaces as needed.
6. Remove implementation-only files that are not needed for the submission or that violate file type and size limits.
7. Keep imports within the allowed policy.
8. Run the checks, fix failures, and repeat until clean.

Do not carry over a large project wholesale if a smaller submission package proves the chosen surface. Smaller packages are easier for the user to review and easier for the checker to accept.

## Required Checks Before Calling The Work Done

From the repository root, run:

```sh
node .github-actions/test/run-all.mjs --meta=<slug>-package/meta.yaml
```

or, if the CLI is linked:

```sh
lml test --meta=<slug>-package/meta.yaml
```

Fix every error. Treat warnings as review items and decide whether they are acceptable.

Also check:

- `lean-toolchain` files match `lml-env.json`.
- Both Lake files pin mathlib to `lml-env.json` `mathlib.revision`.
- `lake update` and `lake build` work for the proof package and surface package.
- Every metadata path exists and stays inside the package root.
- Every surface entry folder is a direct child of `surface-package/`.
- No file exceeds the configured size limits.
- File extensions are allowed by `lml-env.json`.
- The package contains no `.DS_Store`, generated build caches, or unrelated project artifacts.

## Submission Readiness Checklist

Before submitting or asking the user to submit, confirm:

- The user has approved the title, slug, abstract, surface entries, theorem/conjecture split, and bibliographic metadata.
- Every `Definition`, `Theorem`, and `Conjecture` has a matching surface folder, `Surface.lean`, and `latex-file.tex`.
- Every theorem surface declaration has a matching proof file and metadata entry.
- Every conjecture has a `conjecture: True` metadata entry and no proof file.
- Surface files contain exactly one direct public declaration each.
- Proof files contain no forbidden placeholders or local axioms.
- Imports and `usedSurfaceFiles` metadata explain all surface dependencies.
- The local submission checks pass with the exact metadata path.
- The repository is on `main` unless the user or repository instructions say otherwise.
- Completed changes are committed and pushed when the task is complete, following the repository instructions.

