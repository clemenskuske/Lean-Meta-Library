Import Failure Fixtures
=======================

This folder contains small Lean Meta Library submission packages that are meant
to fail the import checks. They are useful as regression inputs when changing
the local checker suite or the GitHub import workflow.

Run any fixture from the repository root with:

```sh
node .github/actions/test/run-all.mjs --meta=test-imports/<fixture>/meta.yaml
```

Fixtures:

- `missing-proof-file-package`: metadata references a statement proof file that is
  absent, so the files-present check should reject it.
- `mismatched-proof-type-package`: the proof theorem has the expected name but a
  different Lean type from the surface statement, so the declaration-to-proof type check
  should reject it.
- `sorry-proof-package`: the proof theorem uses `sorry`, so proof axiom
  inspection should reject the `sorryAx` dependency.
- `extra-surface-declaration-package`: a statement surface file introduces an
  extra helper declaration, so the surface declaration check should reject it.
- `unauthorized-surface-import-package`: the proof imports another surface module
  without `usedSurfaceFiles` metadata, so the dependency policy check should
  reject it.

The packages are intentionally close to the generated `create-paper` starter
shape. If one begins failing earlier because of an unrelated packaging issue,
update the fixture so its intended failure remains the first meaningful problem.
