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
| `update-unknown-slug-package` | `general/submission-update-policy.mjs` | The manifest has a `SubmissionSlug` that does not exist in the fixture's local `submissions.jsonl`; the update policy checker must reject it as a non-update. |
| `update-missing-statement-package` | `general/submission-update-policy.mjs` | The matching existing submission has a public statement that is absent from the updated manifest; the update policy checker must reject it. |
| `update-lean-statement-changed-package` | `general/submission-update-policy.mjs` | The matching existing submission has a stored `InlineLeanStatement` for a public statement, and the updated manifest changes that Lean statement; the update policy checker must reject it. |

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
| `statement-dependency-cycle-package` | `general/manifest-check.mjs` | Two current-submission statement entries list each other in `SemanticDependencies`; the manifest checker must reject the cycle. |

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
| `statement-wrong-commit-package` | `statements/imports.mjs` | A statement imports an external submitted statement package, but its Lake dependency is pinned to a different commit than `submissions.jsonl`; the import checker must reject it. |

## Acceptance checks

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `statement-only-package` | `run-all.mjs` | A submission with statements but no proof package must pass the full first-run checker. |
| `proof-only-package` | `run-all.mjs` | A submission with a proof package but no statement package must pass the full first-run checker when it has no submitted proof targets. |
| `shared-statement-declarations-package` | `statements/introduced-declarations.mjs` | One statement file introduces multiple manifest-listed declarations; the declarations checker must accept it. |
| `unused-sorry-proof-package` | `final-proof-build.mjs` | A non-manifest proof module is proved with `sorry`, but the submitted proof target does not depend on it; the final build checker must accept it. |
| `update-compatible-package` | `general/submission-update-policy.mjs` | An existing submission is updated while preserving every stored public statement name and Lean statement; the update policy checker must accept it. |
| `duplicate-slug-update-package` | `general/slug-unique.mjs` | A manifest reuses an existing `SubmissionSlug` with the same `submissionIssueNumber`; the slug uniqueness checker must accept it as an update to the same submission. |

## Proof checks

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `mismatched-proof-type-package` | `proofs/type-matches-statements.mjs` | The proof theorem has the expected name but a Lean type that differs from the statement; the type-matching checker must reject the mismatch. |
| `non-prop-proof-target-package` | `proofs/type-matches-statements.mjs` | The proof declaration has the same non-proposition type as the referenced statement axiom; the type-matching checker must reject the proof target. |
| `sorry-proof-package` | `proofs/no-forbidden-axioms.mjs` | The submitted proof uses `sorry`; the axiom checker must reject the resulting `sorryAx` dependency. |
| `undeclared-proof-obligation-package` | `proofs/no-forbidden-axioms.mjs` | The submitted proof uses an axiom that is not listed in `ProofObligations`; the axiom checker must reject the undeclared dependency. |
| `proof-obligation-wrong-commit-package` | `proofs/imports.mjs` | A proof lists an external submitted statement in `ProofObligations`, but its Lake dependency is pinned to a different commit than `submissions.jsonl`; the proof import checker must reject it. |
| `proof-statement-wrong-commit-package` | `proofs/imports.mjs` | A proof targets an external submitted statement, but its Lake dependency is pinned to a different commit than `submissions.jsonl`; the proof import checker must reject it. |

## Final proof build

| Fixture Package | Checker | What It Tests |
|----------------|---------|---------------|
| `final-proof-build-failure-package` | `final-proof-build.mjs` | The final proof composition leaves a forbidden proof-side axiom; the final build step must reject the composed build. |
