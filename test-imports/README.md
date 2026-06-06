Import Failure Fixtures
=======================

This folder contains small Lean Meta Library submission packages that are meant
to fail the import checks. They are useful as regression inputs when changing
the local checker suite or the GitHub import workflow.

Run all negative fixtures from the repository root with:

```sh
npm run test:imports
```

Run one fixture manually with:

```sh
node .github/actions/test/run-all.mjs --meta=test-imports/<fixture>/meta.yaml
```

Fixtures:

- `build-packages-failure-package`: proof package Lean build fails, so
  `build-packages.mjs` should reject it.
- `prepare-build-cache-failure-package`: surface package Lean build fails during
  preparation, so `prepare-build-cache.mjs` should reject it.
- `missing-proof-file-package`: metadata references a statement proof file that is
  absent, so `files-present.mjs` should reject it.
- `metadata-check-failure-package`: metadata uses a scalar `bibtex` value, so
  `metadata-check.mjs` should reject it.
- `mathlib-version-failure-package`: the root Lean toolchain is wrong, so
  `mathlib-version.mjs` should reject it.
- `namespaces-correct-failure-package`: metadata names a different namespace
  root from the package, so `namespaces-correct.mjs` should reject it.
- `folder-size-failure-package`: the package contains an oversized text file, so
  `folder-size.mjs` should reject it.
- `filetypes-failure-package`: the package contains a `.bin` file, so
  `filetypes.mjs` should reject it.
- `surface-file-context-failure-package`: a surface file uses `#eval`, so
  `surface-file-context.mjs` should reject it.
- `mismatched-proof-type-package`: the proof theorem has the expected name but a
  different Lean type from the surface statement, so `declarations-to-proofs.mjs`
  should reject it.
- `sorry-proof-package`: the proof theorem uses `sorry`, so proof axiom
  inspection in `proofs-axioms-sorrys.mjs` should reject the `sorryAx`
  dependency.
- `surface-sorry-statement-package`: the statement surface file contains a
  theorem proved with `sorry`, so `surface-declarations.mjs` and
  `final-proof-build.mjs` should reject the package.
- `extra-surface-declaration-package`: a statement surface file introduces an
  extra helper declaration, so `surface-declarations.mjs` should reject it.
- `final-proof-build-failure-package`: the final proof build finds a proof-side
  axiom, so `final-proof-build.mjs` should reject it.
- `unauthorized-surface-import-package`: the proof imports another surface module
  without `usedSurfaceFiles` metadata, so `dependency-check.mjs` should
  reject it.

The packages are intentionally close to the generated `create-paper` starter
shape. If one begins failing earlier because of an unrelated packaging issue,
update the fixture so its intended failure remains the first meaningful problem.

Helper modules in `.github/actions/test/`, such as `common.mjs`,
`lake-config.mjs`, `lean-imports.mjs`, and `lean-inspect.mjs`, do not have
standalone fixtures because they are exercised through the checker scripts above.
