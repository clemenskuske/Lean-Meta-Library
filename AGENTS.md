Any agent should add the information I am giving.

This repository is the Lean Meta Library workspace. Keep project notes, structure, and policy details up to date as new instructions arrive.

Use `main` for now, and push changes when a task is complete.

Read this file before making changes, then preserve the existing folder roles:

- `.website`: GitHub Pages site.
- `.github-actions`: import policy and automation workflows.
- `.cli-tooling`: npm CLI tooling.
- `submissions.jsonl`: root-level JSON Lines submission log.
- `lml-env.json`: repository-level values that may change later but are fixed for all Lean Meta Library projects right now.

## Submission dependency policy

Each `submissions.jsonl` row may authorize one imported surface package. The row must include `Repo Url`, `Source Branch`, `Source Commit`, and `Surface Folder`; Lake dependencies must use that repository, the source commit, and the surface folder as the dependency subdirectory, and downstream Lean files may import only the required `.Surface` package.

## Submission checks

The `.github-actions/test/` folder contains first-run submission package checks. The metadata file is the source of submission information. Run checks with:

```sh
node .github-actions/test/run-all.mjs path/to/meta.yaml
```

Do not pass both a submission package path and a metadata path. If no metadata path is provided, each check falls back to a root-level `meta.yaml` in the current working directory.

## Submission package structure

The CLI `create-paper` command creates one submission package folder. Preserve this structure:

- `your-submission-package/`
- `your-submission-package/lakefile.lean`: proof package Lake file.
- `your-submission-package/meta.yaml`: submission metadata with dummy first-iteration values.
- `your-submission-package/abstract.tex`: short LaTeX abstract.
- `your-submission-package/surface-package/`: separate Lake package for surface statements.
- `your-submission-package/surface-package/lakefile.lean`: surface package Lake file.
- `your-submission-package/surface-package/definition/<name>/`: one folder per definition.
- `your-submission-package/surface-package/theorem/<name>/`: one folder per theorem.
- `your-submission-package/surface-package/conjecture/<name>/`: one folder per conjecture.
- Each surface entry folder contains `latex-file.tex` and `surface-file.lean`.
- Surface namespaces use `Slug.Surface.Definition.Name`, `Slug.Surface.Theorem.Name`, or `Slug.Surface.Conjecture.Name`.
- Lake packages use the dotted metadata slug form: `Slug.Surface` for the surface package and `Slug.Proofs` for the proof package.
- `your-submission-package/proofs/`: proofs for theorem surface files.
- Proof namespaces use `Slug.Proofs.Theorem.Name`.
- Every surface theorem needs one matching proof file under `proofs/`, using only allowed axioms.
