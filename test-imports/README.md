Import Failure Fixtures
=======================

This folder contains small Lean Meta Library submission packages that are meant
to fail the import checks. They are useful as regression inputs when changing
the local checker suite or the GitHub import workflow.

These fixtures currently document the old checker suite. As the
submission-structure rework lands, remove fixtures that only enforce the old
required proof-package and surface-package split, and add replacements for the
optional statement/declaration and proof package model.

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
- `prepare-build-cache-failure-package`: declaration package Lean build fails
  during preparation, so `prepare-build-cache.mjs` should reject it while that
  package is present.
- `missing-proof-file-package`: metadata references a statement proof file that is
  absent, so `files-present.mjs` should reject it.
- `metadata-disk-state-failure-package`: the disk contains a declaration folder
  not listed in metadata, so `files-present.mjs` should reject it.
- `metadata-check-failure-package`: metadata uses legacy or malformed
  bibliographic fields, so `metadata-check.mjs` should reject it.
- `mathlib-version-failure-package`: the root Lean toolchain is wrong, so
  `mathlib-version.mjs` should reject it.
- `namespaces-correct-failure-package`: metadata names a different namespace
  root from the package, so `namespaces-correct.mjs` should reject it.
- `folder-size-failure-package`: the package contains an oversized text file, so
  `folder-size.mjs` should reject it.
- `filetypes-failure-package`: the package contains a `.bin` file, so
  `filetypes.mjs` should reject it.
- `surface-file-context-failure-package`: a statement/declaration file uses
  `#eval`, so `surface-file-context.mjs` should reject it.
- `mismatched-proof-type-package`: the proof theorem has the expected name but a
  different Lean type from the statement axiom, so `declarations-to-proofs.mjs`
  should reject it.
- `sorry-proof-package`: the proof theorem uses `sorry`, so proof axiom
  inspection in `proofs-axioms-sorrys.mjs` should reject the `sorryAx`
  dependency.
- `unused-sorry-proof-package`: a non-metadata proof module contains a theorem
  proved with `sorry`, so `proofs-axioms-sorrys.mjs` should reject the proof
  package and `final-proof-build.mjs` should reject the final build output even
  though the submitted proof target does not depend on it.
- `extra-surface-declaration-package`: a statement/declaration file introduces
  an extra helper declaration, so `surface-declarations.mjs` should reject it.
- `final-proof-build-failure-package`: the final proof build finds a proof-side
  axiom, so `final-proof-build.mjs` should reject it.
- `unauthorized-surface-import-package`: the proof imports another
  statement/declaration module without declared used-file metadata, so
  `dependency-check.mjs` should reject it.

The packages are intentionally close to the generated `create-paper` starter
shape for the checker generation they test. If one begins failing earlier
because of an unrelated packaging issue, update the fixture so its intended
failure remains the first meaningful problem.

Future fixture updates should cover `Definition` and `Axiom` statement entries,
structured `Theorem` and `Proof` metadata, proof-level used-file metadata,
conditional package checks, dependency/conjecture metadata comparison, and
axiom-gate matching by name, type, and source module.

Helper modules in `.github/actions/test/`, such as `common.mjs`,
`lake-config.mjs`, `lean-imports.mjs`, and `lean-inspect.mjs`, do not have
standalone fixtures because they are exercised through the checker scripts above.
