# Submission API Structure Agent README

Use this README as the implementation target for the next Lean Meta Library submission-structure rework. It explains the intended file layout before the checker and CLI code are changed.

The starting point is the current paper-submission readiness guide in `agent-info/paper-submission-readiness-agent-guide.md`. That guide describes the current two-package model. This README keeps the same idea but adds explicit API modules for each package mode and changes how cross-repository references are routed.

## Goal

Every submission repository still has two Lean package modes:

- The surface mode exposes the trustworthy public declarations.
- The proofs mode exposes proved replacements for surface statement axioms.

The rework adds one stable API module for each mode:

- `Repo.API` in the surface package imports `Repo.Surface`.
- `Repo.API` in the proofs package imports `Repo.Proofs`.

All references from one submission repository to another must import the other repository's `Repo.API` module. Downstream code should not import another repository's individual surface or proof modules directly.

The final import-stage proof build should stop relying on a namespace rewrite or regex-like surface-to-proof substitution. Instead, it should build the current submission together with the proof packages of every used repository and then reject any forbidden axioms or sorries found by Lean.

## rules-block

These rules carry forward from the startup guide and the paper-submission readiness guide, adjusted for the API-module structure:

- Treat `meta.yaml` as the submission source of truth. Lean files, package files, abstracts, proof entries, and dependency metadata must match it.
- Build the submission with the user. Do not infer the public mathematical surface from a source project alone; get user approval for the title, namespace slug, abstract, public declarations, proof entry types, assumptions, and bibliography.
- Keep the submission small and reviewable. Copy or adapt only the surface and proof code needed for the user-approved submission.
- Start from `lml create-paper <slug>` once the CLI scaffold supports this layout, so Lean toolchain and mathlib pins come from current policy.
- Keep both `lean-toolchain` files and both Lake files pinned to the toolchain and mathlib revision required by `lml-env.json`.
- Metadata strings should stay simple ASCII accepted by the checker. Avoid shell syntax, angle brackets, backticks, semicolons, and nonessential punctuation.
- Every `Definition` and `Statement` needs a matching declaration folder, `Surface.lean`, and `latex-file.tex`.
- Each surface declaration file introduces exactly one direct public declaration. Do not add helper declarations, private declarations, instances, structures, classes, inductives, extra axioms, macros, custom syntax, `unsafe`, `run_cmd`, `#eval`, `#print`, `extern`, or `IO`.
- A `Definition` entry introduces one `def`. A `Statement` entry may introduce one `axiom` or one `theorem`.
- Every surface statement needs exactly one matching metadata proof entry and proof file. Proof entry type is `proof`, `conditional-proof`, or `reduction`.
- Surface statement axioms and proof-package theorems must expose the same Lean declaration name. The package mode changes; the declaration name does not.
- The proof package may import definitions from the local surface package, but it must not import or depend on axioms from the local surface package. A submitted proof must establish the same theorem name without using its surface axiom as an assumption.
- Proof files must not contain `axiom`, `sorry`, `admit`, or `unsafe`, and compiled proof targets must not depend on `sorryAx` or local proof-side axioms.
- Imports may use `Mathlib.*`, `Std.*`, local modules from the same submission, and authorized external repository APIs. Cross-repository imports must go through `OtherRepo.API`.
- `usedSurfaceFiles` remains the authorization source for external repository references. Any external dependency must be backed by the matching row in `submissions.jsonl`.
- Run `lml update` before dependency work, and do not edit `submissions.jsonl` by hand.
- Run `lml test --meta=path/to/meta.yaml` before calling a submission package done. Treat warnings as review items.

## Target Package Shape

Create one submission package folder, normally named `<slug>-package/`:

```text
<slug>-package/
  lean-toolchain
  lakefile.lean
  meta.yaml
  abstract.tex
  Repo/
    API.lean
    Proofs.lean
  proofs/
    <TheoremName>Proof.lean
  surface-package/
    lean-toolchain
    lakefile.lean
    Repo/
      API.lean
      Surface.lean
    <EntryName>/
      latex-file.tex
      Surface.lean
```

Here `Repo` means the PascalCase namespace root derived from `namespaceSlug`. For example, `namespaceSlug: connected-graphs` uses `ConnectedGraphs`.

The top-level package is the proofs package. The nested `surface-package/` is the surface package. Both package modes need a `Repo/API.lean` file so the Lean module name is `Repo.API`.

## Surface Package

The surface package records public definitions and statement axioms. Its package name remains:

```lean
package Repo.Surface where
```

The surface package should expose a single aggregate module and a single API module:

```text
surface-package/Repo/API.lean
surface-package/Repo/Surface.lean
```

`surface-package/Repo/Surface.lean` imports all local declaration modules:

```lean
import EntryOne.Surface
import EntryTwo.Surface
```

`surface-package/Repo/API.lean` imports the aggregate surface module:

```lean
import Repo.Surface
```

Declaration files stay one folder per metadata declaration:

```text
surface-package/<EntryName>/Surface.lean
surface-package/<EntryName>/latex-file.tex
```

Each declaration file still introduces exactly one direct public declaration under the metadata namespace. The declaration namespace should not include the package-mode marker `Surface`, because the proof package must expose the same Lean declaration name:

```lean
namespace Repo.Statement.MainStatement

axiom main_statement : SomeStatement

end Repo.Statement.MainStatement
```

Local imports inside the same submission may still use local declaration modules. Imports from another submission repository must go through that repository's API module, for example:

```lean
import OtherRepo.API
```

## Proof Package

The root package is the proof package. Its package name remains:

```lean
package Repo.Proofs where
```

It should expose a single aggregate proof module and a single API module:

```text
Repo/API.lean
Repo/Proofs.lean
```

`Repo/Proofs.lean` imports all submitted proof files:

```lean
import MainStatementProof
import OtherStatementProof
```

`Repo/API.lean` imports the aggregate proof module:

```lean
import Repo.Proofs
```

Each proof file imports Mathlib, Std, local proof helpers, local modules that do not define the same constant being replaced, local surface definitions, and any authorized external repository APIs. A proof file must not import the local surface module that defines the exact same constant it is proving, because the proof package exposes that constant name itself:

```lean
import Mathlib.SomeModule
import DefinitionEntry.Surface
import OtherRepo.API
```

The proof package is allowed to use local surface definitions. It is not allowed to use local surface axioms, including statement axioms from the same submission. The checker should reject proof targets whose compiled axiom dependencies include local surface-package statement axioms.

The local surface package and local proof package both expose a `Repo.API` module as alternate modes for downstream users. Implementation work must make sure the current repository's proof build does not accidentally create a duplicate-module or duplicate-constant conflict between its local surface mode and proof mode.

Proof declarations use exactly the same Lean declaration name as their matching surface axiom:

```lean
namespace Repo.Statement.MainStatement

theorem main_statement : SomeStatement := by
  ...

end Repo.Statement.MainStatement
```

## Name Matching Rule

For every metadata proof entry, the surface axiom and proof theorem must have exactly the same Lean declaration name. They live in different package modes, so Lean sees only the surface version or only the proof version in a given external dependency, but the exported constant name is identical.

Allowed:

```yaml
proofs:
  - theorem: Repo.Statement.MainStatement.main_statement
    proof: Repo.Statement.MainStatement.main_statement
```

Not allowed:

```yaml
proofs:
  - theorem: Repo.Statement.MainStatement.main_statement
    proof: Repo.Proofs.Statement.MainStatement.main_statement
```

Also not allowed:

```yaml
proofs:
  - theorem: Repo.Statement.MainStatement.main_statement
    proof: Repo.Statement.MainStatement.main_statement_proof
```

The surface package exposes:

```lean
namespace B

axiom main_theorem : SomeStatement

end B
```

The proof package exposes the same name:

```lean
namespace B

theorem main_theorem : SomeStatement := by
  ...

end B
```

The type must still elaborate to the same compiled Lean type. Textual similarity is not enough.

## Cross-Repository Dependency Policy

Each imported repository has two usable modes:

- Surface mode for first-run surface checking and public references.
- Proof mode for final proof builds.

References from a submission to another repository must import only:

```lean
import OtherRepo.API
```

The Lake dependency decides whether that API resolves to surface declarations or proof declarations:

- In ordinary surface checking, the dependency points at `OtherRepo.Surface`.
- In final proof checking, the dependency points at `OtherRepo.Proofs`.

This keeps source imports stable while allowing the final build to replace external surface axioms with their proof-package theorems.

## Final Proof Build

The target final check is:

1. Copy the submitted package into an isolated temporary directory.
2. Read metadata and `usedSurfaceFiles` to determine all external repositories used by the submission.
3. Add every used repository to the root proof-package Lake file.
4. For each external repository, choose the proof package, not the surface package.
5. Run `lake update`.
6. Run `lake clean`.
7. Fetch the Lake build cache best-effort.
8. Run `lake build`.
9. Reject build output that reports `sorry` or `sorryAx`.
10. Ask Lean to inspect compiled declarations for forbidden axioms or sorries.

The important behavioral change is that final proof checking should use actual proof-package dependencies for used repositories. It should not import a surface package and then rewrite or reinterpret names with a special regex rule.

## What Changed

- Each package mode now has an `API.lean` file.
- Each package mode now has an aggregate module: `Repo.Surface` and `Repo.Proofs`.
- Cross-repository Lean imports go through `OtherRepo.API`.
- Surface statement axioms and proof theorems must have exactly the same Lean declaration name.
- The final proof build uses proof packages for all used repositories.
- The final proof build checks the compiled result for axioms and sorries after normal Lean elaboration and build.

## What Needs To Change In Code

Update the CLI scaffold:

- `create-paper` should generate both `Repo/API.lean` files.
- `create-paper` should generate `surface-package/Repo/Surface.lean`.
- `create-paper` should generate `Repo/Proofs.lean`.
- Generated Lake files should include the aggregate and API modules in their `lean_lib` roots or globs.
- Generated proof names should already satisfy the same-Lean-declaration-name rule.

Update metadata and namespace checks:

- Require `surface-package/Repo/API.lean`.
- Require root `Repo/API.lean`.
- Require the aggregate modules `surface-package/Repo/Surface.lean` and `Repo/Proofs.lean`.
- Check that the surface API imports exactly `Repo.Surface`.
- Check that the proof API imports exactly `Repo.Proofs`.
- Check that every proof theorem name is exactly the same Lean name as the corresponding surface theorem name.
- Check that proof-package imports and compiled proof dependencies may use local surface definitions but not local surface axioms.

Update dependency checks:

- Treat cross-repository `import OtherRepo.API` as the only allowed external repository import form.
- Keep using `usedSurfaceFiles` as the authorization source for external repository references.
- In surface/package checks, resolve `OtherRepo.API` through a surface package Lake dependency.
- In final proof checks, resolve `OtherRepo.API` through a proof package Lake dependency.
- Reject direct cross-repository imports such as `OtherRepo.Surface...`, `OtherRepo.Proofs...`, or individual external entry modules.

Update final proof build:

- Before `lake update`, rewrite or synthesize the isolated root Lake dependency list so each used external repository is required in proof mode.
- Build against those proof dependencies directly.
- Remove the special surface-to-proof regex-style replacement from the final checker.
- Keep the existing build-output sorry detection.
- Keep the Lean-level axiom inspection, but make it inspect the modules built through the API/proof-package dependency graph.
- Ensure the Lean-level axiom inspection rejects local surface-package axioms used by proof-package theorems while allowing local surface definitions.

Update import registry handling:

- Preserve enough information in `submissions.jsonl` to locate both package modes for an imported repository.
- If the surface folder remains the recorded folder, add or derive the proof package folder for final proof builds.
- Ensure imported rows still record repository URL, source branch, source commit, metadata path, and surface folder.

Update tests and fixtures:

- Update the happy-path starter fixture shape to include API modules.
- Add a fixture that rejects a missing surface `Repo/API.lean`.
- Add a fixture that rejects a missing proof `Repo/API.lean`.
- Add a fixture that rejects external direct imports bypassing `OtherRepo.API`.
- Add a fixture that rejects mismatched surface/proof Lean declaration names.
- Add a fixture that rejects a proof theorem depending on its local surface axiom, while accepting proof code that imports local surface definitions.
- Update the final-proof-build failure fixture so the failure comes from a real proof-package dependency build, not from name rewriting.

## Migration Notes For Agents

Until the code and tests are updated, the current CLI may still expect the older structure from `paper-submission-readiness-agent-guide.md`. Treat this README as the target design for the upcoming implementation work, not as a guarantee that the present checker already accepts this layout.

When implementing the rework, change tests and code together in small steps. Keep the old guide available until the CLI scaffold and all checks accept the API-module structure.
