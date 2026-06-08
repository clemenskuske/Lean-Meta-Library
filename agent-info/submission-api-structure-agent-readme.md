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

Each declaration file still introduces exactly one direct public declaration under the metadata namespace:

```lean
namespace Repo.Surface.Statement.MainStatement

axiom main_statement : SomeStatement

end Repo.Surface.Statement.MainStatement
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

Each proof file imports its own local surface statement module when needed, plus any authorized external repository APIs:

```lean
import MainStatement.Surface
import OtherRepo.API
```

The local surface package and local proof package both expose a `Repo.API` module as alternate modes for downstream users. Implementation work must make sure the current repository's proof build does not accidentally create a duplicate-module conflict between its local surface API and proof API.

Proof declarations use the same declaration leaf name as their matching surface axiom:

```lean
namespace Repo.Proofs.Statement.MainStatement

theorem main_statement : SomeStatement := by
  ...

end Repo.Proofs.Statement.MainStatement
```

## Name Matching Rule

For every metadata proof entry, the surface axiom and proof theorem must have exactly the same declaration leaf name.

Allowed:

```yaml
proofs:
  - theorem: Repo.Surface.Statement.MainStatement.main_statement
    proof: Repo.Proofs.Statement.MainStatement.main_statement
```

Not allowed:

```yaml
proofs:
  - theorem: Repo.Surface.Statement.MainStatement.main_statement
    proof: Repo.Proofs.Statement.MainStatement.main_statement_proof
```

The namespace still changes from `Repo.Surface...` to `Repo.Proofs...`, but the final identifier must match exactly. This makes proof replacement predictable without rewriting arbitrary names.

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
- Surface statement axioms and proof theorems must have exactly the same leaf name.
- The final proof build uses proof packages for all used repositories.
- The final proof build checks the compiled result for axioms and sorries after normal Lean elaboration and build.

## What Needs To Change In Code

Update the CLI scaffold:

- `create-paper` should generate both `Repo/API.lean` files.
- `create-paper` should generate `surface-package/Repo/Surface.lean`.
- `create-paper` should generate `Repo/Proofs.lean`.
- Generated Lake files should include the aggregate and API modules in their `lean_lib` roots or globs.
- Generated proof names should already satisfy the same-leaf-name rule.

Update metadata and namespace checks:

- Require `surface-package/Repo/API.lean`.
- Require root `Repo/API.lean`.
- Require the aggregate modules `surface-package/Repo/Surface.lean` and `Repo/Proofs.lean`.
- Check that the surface API imports exactly `Repo.Surface`.
- Check that the proof API imports exactly `Repo.Proofs`.
- Check that every proof theorem leaf name matches the corresponding surface theorem leaf name.

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

Update import registry handling:

- Preserve enough information in `submissions.jsonl` to locate both package modes for an imported repository.
- If the surface folder remains the recorded folder, add or derive the proof package folder for final proof builds.
- Ensure imported rows still record repository URL, source branch, source commit, metadata path, and surface folder.

Update tests and fixtures:

- Update the happy-path starter fixture shape to include API modules.
- Add a fixture that rejects a missing surface `Repo/API.lean`.
- Add a fixture that rejects a missing proof `Repo/API.lean`.
- Add a fixture that rejects external direct imports bypassing `OtherRepo.API`.
- Add a fixture that rejects mismatched surface/proof leaf names.
- Update the final-proof-build failure fixture so the failure comes from a real proof-package dependency build, not from name rewriting.

## Migration Notes For Agents

Until the code and tests are updated, the current CLI may still expect the older structure from `paper-submission-readiness-agent-guide.md`. Treat this README as the target design for the upcoming implementation work, not as a guarantee that the present checker already accepts this layout.

When implementing the rework, change tests and code together in small steps. Keep the old guide available until the CLI scaffold and all checks accept the API-module structure.
