# Test Imports — Negative Fixture Tests

Run the whole suite with `npm run test:imports`. Each test feeds a deliberately
broken package from this directory to a specific checker and passes only when the
checker rejects the package for the intended reason. The tables below group the
fixtures the same way as [README.md](README.md).

Some fixtures carry a real Mathlib dependency; the runner strips it into a
temporary copy first (`stripMathlibDependencyForCheck`) so the checks build
locally without downloading Mathlib.

## Commit and submission identity

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `commit-hash-failure-package` | `general/commit-is-hash.mjs` | The manifest's `Commit` field is set to a branch name instead of a SHA-1 hash; the checker must reject it. |
| `duplicate-slug-package` | `general/slug-unique.mjs` | The manifest's `SubmissionSlug` matches an existing slug in the fixture's local `submissions.jsonl`; the uniqueness checker must reject it. |

## Build and cache preparation

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `build-packages-failure-package` | `proofs/prepare-build-cache.mjs` | The proof package contains an unknown identifier, so its Lean build fails; the proof build-cache preparation step must reject the `lake build`. |
| `prepare-build-cache-failure-package` | `statements/prepare-build-cache.mjs` | The statement package fails to compile during preparation; the statement build-cache step must report the failed `lake build`. |

## Files and manifest integrity

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `missing-abstract-file-package` | `general/files-present.mjs` | The manifest's `AbstractPath` points to a file that does not exist on disk; the files-present checker must report the missing file. |
| `missing-proof-file-package` | `proofs/type-matches-statements.mjs` | The manifest names a `proof` declaration whose source file is absent from the proof package; the package fails to build and the proof declaration cannot be resolved by name. |
| `manifest-disk-state-failure-package` | `statements/no-extra-files.mjs` | A statement Lean file exists on disk but is not listed in the manifest; the check must report the undeclared file. |
| `manifest-check-failure-package` | `general/manifest-check.mjs` | The manifest violates the schema (unexpected extra property `legacyCompatibilityField`); the schema validator must reject it. |

## Submission policy

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `mathlib-version-failure-package` | `general/base-import-versions.mjs` | A package's `lean-toolchain` is not the required version; the version checker must reject the mismatch. |
| `namespaces-correct-failure-package` | `general/namespaces-correct.mjs` | A Lake package name does not match the namespace root derived from `SubmissionSlug`; the namespace checker must reject it. |
| `folder-size-failure-package` | `general/folder-size.mjs` | The package includes a file that exceeds the size limit; the size checker must flag the oversized file. |
| `filetypes-failure-package` | `general/filetypes.mjs` | The package includes a disallowed file type (a `.bin` file); the filetype checker must reject it. |
| `manifest-version-mismatch-package` | `general/manifest-check.mjs` | The manifest sets `leanVersion` and `mathlibVersion` to values that do not match the pinned versions in `lml-env.json`; the manifest checker must reject the mismatched versions. |
| `missing-license-package` | `general/license.mjs` | The manifest has no `LicenseFile`; the license checker must reject the submission for not declaring a license file. |
| `bad-license-content-package` | `general/license.mjs` | The license file contains no recognized license identifier; the license checker must reject its contents. |

## Statement checks

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `statement-file-context-failure-package` | `statements/file-context.mjs` | A statement file uses a forbidden `#eval` command; the file-context checker must reject it. |
| `extra-statement-declaration-package` | `statements/introduced-declarations.mjs` | A statement file introduces an unlisted helper declaration; the declarations checker must reject it. |
| `unauthorized-statement-import-package` | `statements/imports.mjs` | A statement imports an external module not listed in its `DeclarationReferences`; the import checker must reject the unauthorized dependency. |

## Acceptance checks

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `shared-statement-declarations-package` | `statements/introduced-declarations.mjs` | One statement file introduces multiple manifest-listed declarations; the declarations checker must accept it. |

## Proof checks

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `mismatched-proof-type-package` | `proofs/type-matches-statements.mjs` | The proof theorem has the expected name but a Lean type that differs from the statement; the type-matching checker must reject the mismatch. |
| `sorry-proof-package` | `proofs/no-forbidden-axioms.mjs` | The submitted proof uses `sorry`; the axiom checker must reject the resulting `sorryAx` dependency. |

## Final proof build

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `final-proof-build-failure-package` | `final-proof-build.mjs` | The final proof composition leaves a forbidden proof-side axiom; the final build step must reject the composed build. |
| `unused-sorry-proof-package` | `final-proof-build.mjs` | A non-manifest proof module is proved with `sorry`; the final build checker must reject the build output even though the submitted proof target does not depend on it. |
