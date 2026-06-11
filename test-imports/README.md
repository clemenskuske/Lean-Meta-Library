# Import Failure Fixtures

This folder contains small Lean Meta Library submission packages that are meant
to fail import checks. They are regression inputs for the local checker suite
and the GitHub import workflow.

The fixtures track the metadata shape defined by `meta.config.yaml` and the
repository policy in `import-submission-expectations.md`. When updating
fixtures, keep each fixture's intended failure as the first meaningful
rejection.

Run all negative fixtures from the repository root with:

```sh
npm run test:imports
```

Run one fixture manually with:

```sh
node .github/actions/test/run-all.mjs --meta=test-imports/<fixture>/meta.yaml
```

Fixtures:

- `build-packages-failure-package`: the proof package Lean build fails, so
  `general/build-packages.mjs` and `proofs/prepare-build-cache.mjs` should
  reject it.
- `prepare-build-cache-failure-package`: the statement package Lean build fails
  during preparation, so `statements/prepare-build-cache.mjs` should reject it.
- `missing-proof-file-package`: metadata references an absent proof file, so
  `general/files-present.mjs` should reject it.
- `metadata-disk-state-failure-package`: the statement package contains a
  statement Lean file not listed in metadata, so `statements/no-extra-files.mjs`
  should reject it.
- `metadata-check-failure-package`: metadata uses legacy or malformed fields,
  so `general/metadata-check.mjs` should reject it against
  `meta.config.yaml`.
- `mathlib-version-failure-package`: a package `lean-toolchain` is wrong, so
  `general/base-import-versions.mjs` should reject it.
- `namespaces-correct-failure-package`: metadata and Lake package namespaces do
  not match the `submissionSlug`-derived namespace root, so
  `general/namespaces-correct.mjs` should reject it.
- `folder-size-failure-package`: the package contains an oversized text file,
  so `general/folder-size.mjs` should reject it.
- `filetypes-failure-package`: the package contains a `.bin` file, so
  `general/filetypes.mjs` should reject it.
- `statement-file-context-failure-package`: a statement file uses `#eval`, so
  `statements/file-context.mjs` should reject it.
- `mismatched-proof-type-package`: the proof theorem has the expected name but
  a different Lean type from the statement axiom, so
  `proofs/type-matches-statements.mjs` should reject it.
- `sorry-proof-package`: the submitted proof theorem uses `sorry`, so
  `proofs/no-forbidden-axioms.mjs` should reject the resulting `sorryAx`
  dependency.
- `unused-sorry-proof-package`: a non-metadata proof module contains a theorem
  proved with `sorry`, so `final-proof-build.mjs` should reject the final build
  output even though the submitted proof target does not depend on it.
- `extra-statement-declaration-package`: a statement file introduces an extra
  helper declaration, so `statements/introduced-declarations.mjs` should reject
  it.
- `final-proof-build-failure-package`: the final proof composition leaves a
  forbidden proof-side axiom, so `final-proof-build.mjs` should reject it.
- `unauthorized-statement-import-package`: a statement file imports an
  unauthorized external module, so `statements/imports.mjs` should reject it.

Future fixture updates should cover submissions with only a statement package,
submissions with only a proof package, statement theorem rejection, proof-level
external `DeclarationReferences`, declared dependency coverage for actual Lean
axiom dependencies, statement-level dependency DAG acyclicity, axiom-gate
matching by name/type/source module, and final proof-build
dependency/conjecture metadata comparison.

Helper modules in `.github/actions/test/`, such as `common.mjs`,
`general/meta-context.mjs`, `lake-config.mjs`, `lean-imports.mjs`, and
`lean-inspect.mjs`, do not have standalone fixtures because they are exercised
through the checker scripts above.
