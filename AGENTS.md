Any agent should add the information I am giving.

This repository is the Lean Meta Library workspace. Keep project notes, structure, and policy details up to date as new instructions arrive.

Use `main` for now, and push changes when a task is complete.

Read this file before making changes, then preserve the existing folder roles:

- `.website`: GitHub Pages site.
- `.github-actions`: import policy and automation workflows.
- `.cli-tooling`: npm CLI tooling.
- `submissions.jsonl`: root-level JSON Lines submission log.
- `lml-env.json`: repository-level values that may change later but are fixed for all Lean Meta Library projects right now.

`lml-env.json` is the central policy file for the current Lean toolchain, pinned mathlib repository and revision,
default submission metadata path, allowed submission file types, allowed direct import prefixes, first-run size
limits, checker output limits, and final proof-build base axiom signatures. The Lean toolchain value carries the
Lean version; Lake ships with that toolchain, so separate `lean.version` and `lake.version` fields are not kept.

## Submission dependency policy

Each `submissions.jsonl` row may authorize one imported surface package. The row must include `Repo Url`, `Source Branch`, `Source Commit`, and `Surface Folder`; Lake dependencies must use that repository, the source commit, and the surface folder as the dependency subdirectory, and downstream Lean files may import only the required `.Surface` package.

Submission Lean files may directly import Mathlib modules, Std modules, local surface modules, and authorized imported `.Surface` packages only.

## Submission checks

The `.github-actions/test/` folder contains first-run submission package checks. The metadata file is the source of submission information. Run checks with:

```sh
node .github-actions/test/run-all.mjs --meta=path/to/meta.yaml
```

Pass only one metadata file path, preferably with `--meta=path/to/meta.yaml`. The older positional form is accepted for compatibility. If no metadata path is provided, each check falls back to `meta.yaml` in the current working directory; directories are not accepted.

The CLI test command uses the same metadata convention:

```sh
lml test --meta=path/to/meta.yaml
```

If no metadata path is provided, `lml test` checks `meta.yaml` in the current working directory and returns an error when that file is missing.

The proof checker asks Lean to compare the compiled types of each surface theorem declaration and its matching proof theorem. For each surface theorem declaration such as `axiom Surface.statement : SomeStatement`, the proof theorem must have the same Lean type, such as `theorem Proofs.statement : SomeStatement := by ...`. This checks type matching, not textual dependency on the surface axiom. The proof-file checker separately rejects local `axiom`, `sorry`, `admit`, and `unsafe` in proof files, builds the submitted proof theorem code, and asks Lean for each proof theorem's compiled axiom dependencies. A submitted proof theorem must not depend on `sorryAx`, same-submission proof axioms, or same-submission surface axioms.

The import workflow also runs a final-only proof build after the normal first-run checks. That check copies the submitted package into an isolated temporary directory, runs `lake update`, removes `Surface.Theorem` declarations while keeping surface definition and conjecture modules, rewrites proof-side `.Surface.Theorem.` references to `.Proofs.Theorem.`, runs `lake clean`, then runs `lake build`. It rejects rewritten build sources or build output containing `sorry`/`admit`, and asks Lean to inspect declared axioms and proof-target axiom dependencies. The permitted axioms are allowed conjectures and axioms with the same Lean types as the constants listed in `lml-env.json` at `checks.allowedMathlibAxioms`, currently `propext`, `Quot.sound`, and `Classical.choice`; the check compares axiom types rather than accepting names alone.

Surface files may always import other surface modules from the same submission package. Surface imports from other packages or namespaces must be justified by the current surface entry's `usedSurfaceFiles` metadata, and the referenced declaration must live in a different namespace from the current surface entry. A theorem proof file may import its own surface theorem module, but any other surface imports must be justified by that theorem surface entry's `usedSurfaceFiles` metadata. Accepted proof package dependencies are still reported as warnings.

## Submit workflow

The `.github/workflows/submit.yml` workflow creates or updates a GitHub issue for a submission metadata file. It reads `submissionIssueNumber` from the metadata file when present, otherwise creates a new issue, labels it `submission`, writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file, and commits that metadata update to the source branch. The issue body records the current repository URL, source branch, source commit, and metadata file path.

## Submission status command

The CLI `submission-status` command reports whether a metadata file has a submission issue, whether it has been imported, the related upload/test/finalizing workflow state when available, the distance from the recorded source commit to the current commit, and whether metadata surface files were added, changed, or removed since that source commit.

## Agent introduction command

The CLI `agent-introduction` command prints a placeholder lorem ipsum agent introduction.

## Import submission workflow

The `.github/workflows/import-submission.yml` workflow runs when an issue labeled `submission` is opened, labeled, edited, or reopened. It reads the repository URL, source branch, source commit, and metadata file path from the issue body, checks out that exact commit, runs the first-run checks from `.github-actions/test/` against the metadata file at that path, then adds or updates the matching row in `submissions.jsonl`. Imported rows include the parsed metadata plus repository, branch, commit, metadata path, surface folder, issue id/number/url, and submitting user id/login. After a successful import, the workflow comments on and closes the issue.

Warning: the import workflow currently passes `GITHUB_TOKEN` as a Git HTTP extra header so it can check out private submitted repositories. This is acceptable temporarily, but it should be removed later when the import path no longer needs private-repository checkout support or has a better long-term authorization design.

## Submission package structure

The CLI `create-paper` command creates one submission package folder. Preserve this structure:

- `your-submission-package/`
- `your-submission-package/lakefile.lean`: proof package Lake file.
- `your-submission-package/meta.yaml`: submission metadata with dummy first-iteration values.
- `your-submission-package/abstract.tex`: short LaTeX abstract.
- `your-submission-package/surface-package/`: separate Lake package for surface statements.
- `your-submission-package/surface-package/lakefile.lean`: surface package Lake file.
- `your-submission-package/surface-package/<EntryName>/`: one direct child folder per theorem, conjecture, or definition.
- Each surface entry folder contains `latex-file.tex` and `Surface.lean`.
- Do not create an extra slug-named aggregate folder under `surface-package/`; surface modules live only in the entry folders.
- Surface namespaces use `Slug.Surface.Definition.Name`, `Slug.Surface.Theorem.Name`, or `Slug.Surface.Conjecture.Name`.
- Surface and proof files should use `import` to include modules from other files, then prefer fully qualified names for imported surface declarations instead of relying on `open`.
- Each metadata surface entry's `Surface.lean` introduces exactly one direct declaration under its surface namespace; helper declarations, private declarations, generated declarations, instances, structures, classes, inductives, and extra axioms are rejected.
- Lake packages use the dotted metadata slug form: `Slug.Surface` for the surface package and `Slug.Proofs` for the proof package.
- Generated Lake packages must pin mathlib to `lml-env.json`'s exact `mathlib.revision`, not to the floating `stable` branch.
- `your-submission-package/proofs/`: proof files for theorem surface files, kept directly under `proofs/` unless a submission has a reason to organize them further.
- Proof namespaces use `Slug.Proofs.Theorem.Name`.
- The `create-paper` starter proof for `ConnectedIffReachable` must contain a direct Lean proof, not a delegation back to the surface axiom.
- Every surface theorem needs one matching proof file under `proofs/`, using only allowed axioms.
- Every surface conjecture must also be listed in `meta.yaml` under `proofs:`, but without a `proofFile`; mark it with `conjecture: True` so it is recorded as metadata rather than checked as a proof target.
