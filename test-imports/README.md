# Import Failure Fixtures

This folder holds small Lean Meta Library submission packages that are **meant to
fail** an import check. Each one is a deliberately broken submission used as a
regression input for the local checker suite and the GitHub import workflow: the
test passes only when the matching checker rejects the package for the intended
reason.

The fixtures follow the manifest shape defined in `manifest.config.yaml` and the
policy described in `import-submission-expectations.md`. When you edit a fixture,
make sure its intended failure is the *first* meaningful rejection — otherwise an
unrelated error could mask the behavior the fixture is meant to guard.

## Running

Run the full negative suite from the repository root:

```sh
npm run test:imports
```

To reproduce a single fixture, point its intended checker at the fixture's
manifest. For example:

```sh
node .github/actions/test/general/manifest-check.mjs \
  --manifest=test-imports/manifest-check-failure-package/manifest.yaml
```

Some fixtures carry a real Mathlib dependency. The suite strips that dependency
into a temporary copy before running, so the checks build locally without
downloading Mathlib. When running a checker by hand you may need to do the same.

## Fixtures

### Build and cache preparation

- **`build-packages-failure-package`** — the proof package contains an unknown
  identifier, so its Lean build fails. `proofs/prepare-build-cache.mjs` must
  reject the `lake build`.
- **`prepare-build-cache-failure-package`** — the statement package fails to
  compile during preparation, so `statements/prepare-build-cache.mjs` must
  report the failed `lake build`.

### Files and manifest integrity

- **`missing-proof-file-package`** — the manifest names a `proof` declaration
  whose source file is absent from the proof package, so the package fails to
  build and `proofs/type-matches-statements.mjs` cannot resolve the proof.
- **`manifest-disk-state-failure-package`** — the package contains a statement
  Lean file that the manifest does not list, so `statements/no-extra-files.mjs`
  must report the undeclared file.
- **`manifest-check-failure-package`** — the manifest violates the schema in
  `manifest.config.yaml` (a missing `bibtex-entries` field or an unexpected extra
  property), so `general/manifest-check.mjs` must reject it.

### Submission policy

- **`mathlib-version-failure-package`** — a package's `lean-toolchain` is not the
  required version, so `general/base-import-versions.mjs` must reject it.
- **`namespaces-correct-failure-package`** — a Lake package name does not match
  the namespace root derived from `submissionSlug`, so
  `general/namespaces-correct.mjs` must reject it.
- **`folder-size-failure-package`** — the package includes an oversized file, so
  `general/folder-size.mjs` must reject it.
- **`filetypes-failure-package`** — the package includes a disallowed file type
  (a `.bin` file), so `general/filetypes.mjs` must reject it.
- **`missing-license-package`** — the manifest has no `licensePath`, so
  `general/license.mjs` must reject the submission.
- **`bad-license-content-package`** — the license file contains no recognized
  license identifier, so `general/license.mjs` must reject its contents.

### Statement checks

- **`statement-file-context-failure-package`** — a statement file uses a
  forbidden `#eval` command, so `statements/file-context.mjs` must reject it.
- **`extra-statement-declaration-package`** — a statement file introduces an
  extra helper declaration instead of exactly one, so
  `statements/introduced-declarations.mjs` must reject it.
- **`unauthorized-statement-import-package`** — a statement imports an external
  module that is not declared in its `DeclarationReferences`, so
  `statements/imports.mjs` must reject it.

### Proof checks

- **`mismatched-proof-type-package`** — the proof theorem has the expected name
  but a Lean type that differs from the statement, so
  `proofs/type-matches-statements.mjs` must reject the mismatch.
- **`sorry-proof-package`** — the submitted proof uses `sorry`, so
  `proofs/no-forbidden-axioms.mjs` must reject the resulting `sorryAx`
  dependency.

### Final proof build

- **`final-proof-build-failure-package`** — the final proof composition leaves a
  forbidden proof-side axiom, so `final-proof-build.mjs` must reject the
  composed build.
- **`unused-sorry-proof-package`** — a non-manifest proof module contains a
  theorem proved with `sorry`. `final-proof-build.mjs` must reject the final
  build output even though the submitted proof target does not depend on it.

## Notes for future fixtures

Coverage still to add: submissions with only a statement package or only a proof
package; statement-theorem rejection; proof-level external
`DeclarationReferences`; declared-dependency coverage for the actual Lean axiom
dependencies; statement-level dependency-DAG acyclicity; axiom-gate matching by
name, type, and source module; and final proof-build dependency and conjecture
manifest comparison.

Helper modules in `.github/actions/test/` — such as `common.mjs`,
`general/manifest-context.mjs`, `lake-config.mjs`, `lean-imports.mjs`, and
`lean-inspect.mjs` — have no standalone fixtures because the checker scripts
above exercise them.
