# Paper Submission Readiness Agent Guide

Use this guide when a user brings an arbitrary Lean project and asks an agent to make it ready for Lean Meta Library paper submission. The goal is not just to create files. The goal is to produce a submission package that accurately reflects the user's mathematical intent and passes the checks exposed by the Lean Meta Library CLI.

Assume the consuming agent has the Lean Meta Library CLI and the current `submissions.jsonl` dependency log. Use only those sources for Lean Meta Library policy and dependency information.

## Core Principle

Do not infer the submitted paper surface from the source project alone. Build the submission together with the user. Ask which definitions and statements should become the public declarations, which statements have `proof`, `conditional-proof`, or `reduction` evidence, which assumptions are used, and which project details should stay private implementation.

A submission is ready only when all conditions hold:

- The metadata and surface files represent what the user wants to submit.
- The package passes `lml test --meta=<path-to-meta.yaml>`.
- The user is pleased with the result.

## First Conversation With The User

Before writing the submission package, gather these decisions from the user:

- Check whether a PDF of the paper is present. If it is present, use it to answer the relevant metadata and surface-selection questions where possible; if it is not present, ask the user whether they can provide one.
- The submission title, namespace slug, and short abstract.
- Which Lean project folder, archive, or remote source is the starting point.
- Which declarations should be public surface declarations.
- For each public declaration, whether it is a `Definition` or `Statement`.
- For each statement, whether the proof entry type is `proof`, `conditional-proof`, or `reduction`, and which proof file in the source project should establish it.
- Which conjectures are expected to be true and should be called `assumptions`.
- Whether any declaration depends on another declaration in this submission.
- Whether any declaration depends on a previously imported Lean Meta Library surface package listed in `submissions.jsonl`.
- Bibliographic fields, if known: arXiv URL, DOI, online source, ORCIDs, venue, keywords, and BibTeX.

If the user is unsure, inspect the source project and propose a small surface plan, then ask the user to confirm or revise it.

## Package Shape To Create

Create one submission package folder, normally named `<slug>-package/`. Prefer starting from the CLI skeleton so toolchain and dependency pins match the current CLI policy:

```sh
lml create-paper <slug>
```

Then replace the starter content with the user's actual submission. Preserve this package structure:

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

Do not create an aggregate slug folder under `surface-package/`. Each declaration must be a direct child folder of `surface-package/`.

## Metadata File

Create `meta.yaml` with the user. It is the source of truth for the CLI checks. Start from the CLI-generated metadata when possible and edit it into this shape:

```yaml
pinnedLeanToolchain: <keep the CLI-generated Lean toolchain>
proofLakefilePath: lakefile.lean
paperTitle: User Confirmed Title
namespaceSlug: UserSlug
surfaceLakefilePath: surface-package/lakefile.lean
abstractPath: abstract.tex
declarations:
  - type: Definition
    name: UserSlug.Surface.Definition.EntryName
    folder: surface-package/EntryName
    usedSurfaceFiles: []
  - type: Statement
    name: UserSlug.Surface.Statement.MainStatement
    folder: surface-package/MainStatement
    usedSurfaceFiles: []
proofs:
  - declaration: UserSlug.Surface.Statement.MainStatement.main_statement
    type: proof
    proofFile: proofs/MainStatementProof.lean
bibtex: []
paper:
  paperTitle: User Confirmed Title
  arxivUrl: ""
  onlineSource: ""
  doi: ""
  orcids: []
  journalOrConference: ""
  keywords: []
```

Use `type: proof` for a fully formal proof, `type: conditional-proof` for a proof relying only on assumptions, and `type: reduction` for a reduction that uses unsupervised conjectures. An `assumption` is a conjecture expected to be true. A statement with `proof` or `conditional-proof` is classified as a theorem. A statement with `reduction` is classified as a conjecture:

```yaml
proofs:
  - declaration: UserSlug.Surface.Statement.EntryName.statement_name
    type: reduction
    proofFile: proofs/EntryNameReduction.lean
```

Metadata strings must stay simple ASCII text accepted by the CLI checks. Avoid shell syntax, angle brackets, backticks, semicolons, and nonessential punctuation.

## Surface Package

The surface package records the public mathematical declarations. It should be minimal, trustworthy, and user-confirmed.

The surface `lakefile.lean` must:

- Declare `package UserSlug.Surface where`.
- Require mathlib using the exact source URL and revision generated by `lml create-paper`.
- Declare one `lean_lib <EntryName>` for every declaration.
- Use `globs := #[\`<EntryName>.+]` for each declaration.

Each `surface-package/<EntryName>/Surface.lean` must:

- Import only allowed modules: `Mathlib.*`, `Std.*`, local surface modules, or authorized imported `.Surface` packages.
- Open `namespace UserSlug.Surface.<Type>.<EntryName>`, where `<Type>` is `Definition` or `Statement`.
- Introduce exactly one direct public declaration in that namespace.
- End the same namespace.
- Avoid helper declarations, private declarations, instances, structures, classes, inductives, macros, custom syntax, `unsafe`, `run_cmd`, `#eval`, `#print`, `extern`, and `IO`.

The direct declaration rules are:

- `Definition` entries must introduce one `def`.
- `Statement` entries may introduce one `axiom` or `theorem`.

Every declaration folder must also include `latex-file.tex` explaining the entry in paper-facing language.

## Surface Dependencies

Surface files may freely import other local surface modules from the same submission package. Prefer fully qualified names over `open`.

If a declaration imports a surface module from another Lean Meta Library submission, first find the matching authorization row in `submissions.jsonl`. The Lake dependency must use that row's source URL, source commit, and repository-relative surface folder. The current declaration must also list the dependency in `usedSurfaceFiles`.

Use this metadata shape:

```yaml
usedSurfaceFiles:
  - githubRepo: owner/name
    slug: OtherSlug
    surfaceFile: surface-package/OtherEntry/Surface.lean
    definition: OtherSlug.Surface.Definition.OtherEntry.other_decl
```

The referenced declaration must live in a different namespace from the current declaration.

## Proof Package

The proof package contains typed proof artifacts for submitted surface statements. It may contain `proof`, `conditional-proof`, and `reduction` entries.

The top-level proof `lakefile.lean` must:

- Declare `package UserSlug.Proofs where`.
- Require mathlib using the exact source URL and revision generated by `lml create-paper`.
- Require the local surface package with `require UserSlug.Surface from "./surface-package"`.
- Declare `lean_lib UserSlug.Proofs where`.
- Set `srcDir := "proofs"`.
- Include module layout settings matching the proof files.

Every surface statement declaration needs exactly one matching metadata proof entry and proof file. If the surface statement is:

```lean
namespace UserSlug.Surface.Statement.MainStatement

axiom main_statement : SomeStatement

end UserSlug.Surface.Statement.MainStatement
```

then the proof file must import its own surface statement module and prove the same constant name in the proof namespace:

```lean
import MainStatement.Surface

namespace UserSlug.Proofs.Statement.MainStatement

theorem main_statement : SomeStatement := by
  ...

end UserSlug.Proofs.Statement.MainStatement
```

The CLI compares the compiled Lean types of the surface declaration and proof theorem. Textual similarity is not enough. The proof theorem must elaborate with exactly the same type.

Proof files must not contain `axiom`, `sorry`, `admit`, or `unsafe`. The compiled proof theorem must not depend on `sorryAx` or same-submission proof axioms. It may rely on surface declarations, Std, and Mathlib. The final proof build accepts surface statement axioms and the base axioms allowed by the CLI policy.

## Converting An Existing Lean Project

For an arbitrary project, use this workflow:

1. Inspect its Lake files, toolchain, imports, namespaces, and declarations.
2. Ask the user which declarations form the intended submission surface.
3. Create a CLI starter package with `lml create-paper <slug>`.
4. Translate the selected declarations into one-declaration surface files under the required namespaces.
5. Copy or adapt only the proof code needed for submitted statement proof entries into `proofs/`.
6. Replace references to source-project namespaces with the new surface/proof namespaces as needed.
7. Remove implementation-only files that are not needed for the submission or that violate file type and size limits reported by the CLI.
8. Keep imports within the allowed policy.
9. Run the CLI checks, fix failures, and repeat until clean.

Do not carry over a large project wholesale if a smaller submission package proves the chosen surface. Smaller packages are easier for the user to review and easier for the CLI to accept.

## Required Checks Before Calling The Work Done

Run the CLI check against exactly one metadata file:

```sh
lml test --meta=<slug>-package/meta.yaml
```

Fix every error. Treat warnings as review items and decide whether they are acceptable.

Also check:

- `lean-toolchain` files match the toolchain generated by the CLI starter.
- Both Lake files keep the mathlib source URL and revision generated by the CLI starter unless the CLI explicitly instructs otherwise.
- `lake update` and `lake build` work for the proof package and surface package.
- Every metadata path exists and stays inside the package.
- Every declaration folder is a direct child of `surface-package/`.
- No file exceeds the limits reported by `lml test`.
- File extensions are accepted by `lml test`.
- The package contains no `.DS_Store`, generated build caches, or unrelated project artifacts.

## Submission Readiness Checklist

Before submitting or asking the user to submit, confirm:

- The user has approved the title, slug, abstract, declarations, proof entry types, and bibliographic metadata.
- Every `Definition` and `Statement` has a matching surface folder, `Surface.lean`, and `latex-file.tex`.
- Every statement declaration has a matching typed proof file and metadata entry.
- Surface files contain exactly one direct public declaration each.
- Proof files contain no forbidden placeholders or local axioms.
- Imports and `usedSurfaceFiles` metadata explain all surface dependencies.
- Any external surface dependency is backed by a matching row in `submissions.jsonl`.
- `lml test --meta=<slug>-package/meta.yaml` passes for the exact metadata path.
