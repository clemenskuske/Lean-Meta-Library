# Import Fixtures

This folder holds small Lean Meta Library submission packages used as regression
inputs for the local checker suite and the GitHub import workflow. Most
fixtures are deliberately broken and are **meant to fail** an import check; a
small acceptance section records valid edge cases that must continue to pass.

The fixtures follow the manifest shape defined in `manifest.config.yaml` and the
policy described in `development-info/import-submission-expectations.md`. When you edit a fixture,
make sure its intended failure is the *first* meaningful rejection — otherwise an
unrelated error could mask the behavior the fixture is meant to guard. For
acceptance fixtures, keep them minimal enough that failures point clearly at the
behavior under test.

## Running

Run the fixture suite from the repository root:

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

### Commit and submission identity

- **`commit-hash-failure-package`** — the manifest's `Commit` field is set to a
  branch name instead of a SHA-1 hash, so `general/commit-is-hash.mjs` must
  reject it.
- **`duplicate-slug-package`** — the manifest's `SubmissionSlug` matches an
  existing slug in the fixture's local `submissions.jsonl`, so
  `general/slug-unique.mjs` must reject it.
- **`update-unknown-slug-package`** — the manifest has a `SubmissionSlug` that
  does not exist in the fixture's local `submissions.jsonl`, so
  `general/submission-update-policy.mjs` must reject it as a non-update.
- **`update-missing-statement-package`** — the matching existing submission has
  a public statement that is absent from the updated manifest, so
  `general/submission-update-policy.mjs` must reject it.
- **`update-lean-statement-changed-package`** — the matching existing
  submission has a stored `InlineLeanStatement` for a public statement, and the
  updated manifest changes that Lean statement, so
  `general/submission-update-policy.mjs` must reject it.

### Build and cache preparation

- **`build-packages-failure-package`** — the proof package contains an unknown
  identifier, so its Lean build fails. `proofs/prepare-build-cache.mjs` must
  reject the `lake build`.
- **`prepare-build-cache-failure-package`** — the statement package fails to
  compile during preparation, so `statements/prepare-build-cache.mjs` must
  report the failed `lake build`.

### Files and manifest integrity

- **`missing-abstract-file-package`** — the manifest's `AbstractPath` points to
  a file that does not exist on disk, so `general/files-present.mjs` must report
  the missing file.
- **`missing-proof-file-package`** — the manifest names a `proof` declaration
  whose source file is absent from the proof package, so the package fails to
  build and `proofs/type-matches-statements.mjs` cannot resolve the proof.
- **`manifest-disk-state-failure-package`** — the package contains a statement
  Lean file that the manifest does not list, so `statements/no-extra-files.mjs`
  must report the undeclared file.
- **`manifest-check-failure-package`** — the manifest violates the schema in
  `manifest.config.yaml` (an unexpected extra property `legacyCompatibilityField`),
  so `general/manifest-check.mjs` must reject it.
- **`statement-dependency-cycle-package`** — two current-submission statement
  entries list each other in `SemanticDependencies`, so `general/manifest-check.mjs`
  must reject the manifest-level cycle.

### Submission policy

- **`mathlib-version-failure-package`** — a package's `lean-toolchain` is not the
  required version, so `general/base-import-versions.mjs` must reject it.
- **`namespaces-correct-failure-package`** — a Lake package name does not match
  the namespace root derived from `SubmissionSlug`, so
  `general/namespaces-correct.mjs` must reject it.
- **`folder-size-failure-package`** — the package includes an oversized file, so
  `general/folder-size.mjs` must reject it.
- **`filetypes-failure-package`** — the package includes a disallowed file type
  (a `.bin` file), so `general/filetypes.mjs` must reject it.
- **`manifest-version-mismatch-package`** — the manifest sets `leanVersion` and
  `mathlibVersion` fields to values that do not match the pinned versions in
  `lml-env.json`, so `general/manifest-check.mjs` must reject the mismatched
  versions.
- **`missing-license-package`** — the manifest has no `LicenseFile`, so
  `general/license.mjs` must reject the submission.
- **`bad-license-content-package`** — the license file contains no recognized
  license identifier, so `general/license.mjs` must reject its contents.

### Statement checks

- **`statement-file-context-failure-package`** — a statement file uses a
  forbidden `#eval` command, so `statements/file-context.mjs` must reject it.
- **`extra-statement-declaration-package`** — a statement file introduces an
  unlisted helper declaration, so
  `statements/introduced-declarations.mjs` must reject it.
- **`unauthorized-statement-import-package`** — a statement imports an external
  module that is not listed in its `DeclarationReferences` (derived from
  `SemanticDependencies` in the manifest), so `statements/imports.mjs` must
  reject it.
- **`statement-wrong-commit-package`** — a statement imports an external
  statement package listed in `submissions.jsonl`, but the statement lakefile
  pins the dependency to the wrong commit, so `statements/imports.mjs` must
  reject it.

### Acceptance checks

- **`statement-only-package`** — a submission with `StatementSubmissions` and no
  `ProofSubmissions`; the full first-run checker must accept it.
- **`proof-only-package`** — a submission with `ProofSubmissions` and no
  `StatementSubmissions`; the full first-run checker must accept the package
  shape when there are no submitted proof targets.
- **`shared-statement-declarations-package`** — one statement Lean file
  introduces multiple manifest-listed declarations, so
  `statements/introduced-declarations.mjs` must accept it.
- **`unused-sorry-proof-package`** — a non-manifest proof module contains a
  theorem proved with `sorry`, but the submitted proof target does not depend on
  it, so `final-proof-build.mjs` must accept it.
- **`update-compatible-package`** — an existing submission is updated while
  preserving every stored public statement name and Lean statement, so
  `general/submission-update-policy.mjs` must accept it.

### Proof checks

- **`mismatched-proof-type-package`** — the proof theorem has the expected name
  but a Lean type that differs from the statement, so
  `proofs/type-matches-statements.mjs` must reject the mismatch.
- **`non-prop-proof-target-package`** — the proof declaration has the same
  non-proposition type as the referenced statement axiom, so
  `proofs/type-matches-statements.mjs` must reject the proof target.
- **`sorry-proof-package`** — the submitted proof uses `sorry`, so
  `proofs/no-forbidden-axioms.mjs` must reject the resulting `sorryAx`
  dependency.
- **`undeclared-proof-obligation-package`** — the submitted proof depends on a
  statement axiom that is not listed in the proof entry's `ProofObligations`, so
  `proofs/no-forbidden-axioms.mjs` must reject the undeclared axiom dependency.
- **`proof-obligation-wrong-commit-package`** — a proof lists an external
  submitted statement in `ProofObligations`, but the proof lakefile pins the
  corresponding statement package to the wrong commit, so `proofs/imports.mjs`
  must reject it.
- **`proof-statement-wrong-commit-package`** — a proof targets an external
  submitted statement, but the proof lakefile pins that statement package to the
  wrong commit, so `proofs/imports.mjs` must reject it.

### Final proof build

- **`final-proof-build-failure-package`** — the final proof composition leaves a
  forbidden proof-side axiom, so `final-proof-build.mjs` must reject the
  composed build.
- **`unused-sorry-proof-package`** — an accepted proof fixture whose copied
  output manifest must be updated with generated `AxiomDependencies` before the
  final proof build runs.

## Notes for future fixtures

Coverage still to add: statement-theorem rejection; proof-level external
`SemanticDependencies`; axiom-gate matching by name, type, and source module;
and final proof-build conjecture manifest comparison.

Helper modules in `.github/actions/test/` — such as `common.mjs`,
`general/manifest-context.mjs`, `lake-config.mjs`, `lean-imports.mjs`, and
`lean-inspect.mjs` — have no standalone fixtures because the checker scripts
above exercise them.
