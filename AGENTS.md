Any agent should add the information I am giving.

This repository is the Lean Meta Library workspace. Keep project notes, structure, and policy details up to date as new instructions arrive.

Use `main` for now, and push changes when a task is complete.

Read this file before making changes, then preserve the existing folder roles:

- `.website`: GitHub Pages site.
- `.github`: GitHub workflows plus import policy and automation helper scripts under `.github/actions`.
- `.cli-tooling`: npm CLI tooling.
- `test-imports`: intentionally failing submission packages for import-check regression testing.
- `submissions.jsonl`: root-level JSON Lines submission log.
- `lml-env.json`: repository-level values that may change later but are fixed for all Lean Meta Library projects right now.

`lml-env.json` is the central policy file for the current Lean toolchain, pinned mathlib repository and revision,
default submission metadata path, allowed submission file types, allowed direct import prefixes, first-run size
limits, checker output limits, and final proof-build base axiom signatures. The Lean toolchain value carries the
Lean version; Lake ships with that toolchain, so separate `lean.version` and `lake.version` fields are not kept.

## Submission dependency policy

Each `submissions.jsonl` row may authorize one imported surface package. The row must include `Repo Url`, `Source Branch`, `Source Commit`, and `Surface Folder`; `Surface Folder` is repository-relative, even when the submission metadata file lives in a package subdirectory. Lake dependencies must use that repository, the source commit, and the surface folder as the dependency subdirectory, and downstream Lean files may import only the required `.Surface` package.

Submission Lean files may directly import Mathlib modules, Std modules, local surface modules, and authorized imported `.Surface` packages only.

## Submission checks

The `.github/actions/test/` folder contains first-run submission package checks. The metadata file is the source of submission information. Run checks with:

```sh
node .github/actions/test/run-all.mjs --meta=path/to/meta.yaml
```

Pass only one metadata file path, preferably with `--meta=path/to/meta.yaml`. The older positional form is accepted for compatibility. If no metadata path is provided, each check falls back to `meta.yaml` in the current working directory; directories are not accepted.

`run-all.mjs` first prepares the Lean packages with `.github/actions/test/prepare-build-cache.mjs`, then runs static checks in parallel, then runs Lean inspector checks in parallel against the prepared build. In the import workflow, `Prepare Lean build/cache` is a separate first step before `Run submission checks`; the check step passes `--skip-build-cache` so preparation is not repeated. The cache fetch is best-effort and reports warnings, but Lake update and build failures reject the submission.

The CLI test command uses the same metadata convention:

```sh
lml test --meta=path/to/meta.yaml
```

If no metadata path is provided, `lml test` checks `meta.yaml` in the current working directory and returns an error when that file is missing.

Each submission consists of declarations and proofs. Declarations live in the surface package and are the trustworthy public surface. A metadata declaration is either a `Definition` or a `Statement`. A statement is classified as a theorem when it has a proof entry of type `proof` or `conditional-proof`; it is classified as a conjecture when it has a proof entry of type `reduction`. The proof checker asks Lean `isDefEq` to compare the compiled types of each surface statement declaration and its matching proof-side theorem. Proof files may rely on declarations, Std, and Mathlib. The proof-file checker separately elaborates proof files, rejects local proof-namespace `axiom` and `unsafe` declarations, rejects declarations whose compiled axiom list includes `sorryAx` such as from `sorry` or `admit`, and asks Lean for each proof theorem's compiled axiom dependencies.

The import workflow also runs a final proof build after the normal first-run checks. That check copies the submitted package into an isolated temporary directory, runs `lake update`, runs `lake clean`, fetches the Lake build cache best-effort, then runs `lake build`. The final check relies on Lean elaboration, build output, and compiled axiom inspection. It rejects build output that reports `sorry`/`sorryAx`, and asks Lean to inspect declared axioms and proof-target axiom dependencies. The permitted axioms are surface statement declarations and axioms with the same Lean types as the constants listed in `lml-env.json` at `checks.allowedMathlibAxioms`, currently `propext`, `Quot.sound`, and `Classical.choice`; the check compares base axiom types rather than accepting names alone.

Surface files may always import other surface modules from the same submission package. Surface imports from other packages or namespaces must be justified by the current declaration's `usedSurfaceFiles` metadata; each `usedSurfaceFiles` item must include a referenced declaration, and metadata validation rejects references in the same namespace as the current declaration. A proof file may import its own surface statement module, but any other surface imports must be justified by that statement declaration's `usedSurfaceFiles` metadata. Accepted proof package dependencies are still reported as warnings.

## Submit workflow

The `.github/workflows/submit.yml` workflow creates or updates a GitHub issue for a submission metadata file. It reads `submissionIssueNumber` from the metadata file when present, otherwise creates a new issue, labels it `submission`, writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file, and commits that metadata update to the source branch. The issue title is the submission title, and the issue body starts with the submission abstract before recording the submitting account login, current repository URL, source branch, source commit, metadata file path, and generated GitHub source URLs. Metadata itself records local paths such as `abstractPath`, not source URLs; URLs are generated from the repository and path.

## Submission status command

The CLI `submission-status` command reports whether a metadata file has a submission issue, whether it has been imported, the related upload/test/finalizing workflow state when available, the distance from the recorded source commit to the current commit, and whether metadata surface files were added, changed, or removed since that source commit.

## Agent introduction command

The CLI `agent-introduction` command prints `agent-info/README.md`, the general Lean Meta Library startup guide for agents. That guide explains the submission model, how to read and preserve `submissions.jsonl`, what the CLI commands do, and points agents to `lml agent-submission-guide` for the paper-submission readiness workflow.

## Agent submission guide command

The CLI `agent-submission-guide` command prints `agent-info/paper-submission-readiness-agent-guide.md`, the guide for agents preparing an arbitrary Lean project as a Lean Meta Library paper submission with user-approved metadata, surface files, and proofs that should pass the local checks.

## Import submission workflow

The `.github/workflows/import-submission.yml` workflow runs when an issue labeled `submission` is opened, labeled, edited, or reopened. It reads the repository URL, source branch, source commit, metadata file path, and submitted-by login from the issue body, checks out that exact commit, runs the first-run checks from `.github/actions/test/` against the metadata file at that path, then adds or updates the matching row in `submissions.jsonl`. Imported rows include the parsed metadata plus repository, branch, commit, metadata path, repository-relative surface folder, issue id/number/url, and submitting user id/login. After a successful import, the workflow comments on and closes the issue.

The import workflow posts issue progress comments after completed milestones so submitters can see which step worked,
how many steps remain, and what runs next. Keep those comments in place for long-running submission checks.

Warning: the import workflow currently passes `GITHUB_TOKEN` as a Git HTTP extra header so it can check out private submitted repositories. This is acceptable temporarily, but it should be removed later when the import path no longer needs private-repository checkout support or has a better long-term authorization design.

## Submission package structure

The CLI `create-paper` command creates one submission package folder. Preserve this structure:

- `your-submission-package/`
- `your-submission-package/lakefile.lean`: proof package Lake file.
- `your-submission-package/meta.yaml`: submission metadata with dummy first-iteration values.
- `your-submission-package/abstract.tex`: short LaTeX abstract.
- `your-submission-package/surface-package/`: separate Lake package for trustworthy declarations.
- `your-submission-package/surface-package/lakefile.lean`: surface package Lake file.
- `your-submission-package/surface-package/<EntryName>/`: one direct child folder per statement or definition.
- Each declaration folder contains `latex-file.tex` and `Surface.lean`.
- Do not create an extra slug-named aggregate folder under `surface-package/`; surface modules live only in the entry folders.
- Surface namespaces use `Slug.Surface.Definition.Name` or `Slug.Surface.Statement.Name`.
- Surface and proof files should use `import` to include modules from other files, then prefer fully qualified names for imported surface declarations instead of relying on `open`.
- Each metadata declaration's `Surface.lean` introduces exactly one direct declaration under its surface namespace; helper declarations, private declarations, generated declarations, instances, structures, classes, inductives, and extra axioms are rejected.
- Lake packages use the dotted metadata slug form: `Slug.Surface` for the surface package and `Slug.Proofs` for the proof package.
- Generated Lake packages must pin mathlib to `lml-env.json`'s exact `mathlib.revision`, not to the floating `stable` branch.
- `your-submission-package/proofs/`: proof files for statement declarations, kept directly under `proofs/` unless a submission has a reason to organize them further.
- Proof namespaces use `Slug.Proofs.Statement.Name`.
- The `create-paper` starter proof for `ConnectedIffReachable` must contain a direct Lean proof, not a delegation back to the surface axiom.
- Every surface statement needs one matching proof entry under `proofs:` with `type: proof`, `type: conditional-proof`, or `type: reduction`, and a matching proof file under `proofs/`.
- `bibtex` in `meta.yaml` is a list so a submission can record multiple BibTeX entries.
