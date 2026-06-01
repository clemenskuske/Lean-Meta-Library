Any agent should add the information I am giving.

This repository is the Lean Meta Library workspace. Keep project notes, structure, and policy details up to date as new instructions arrive.

Use `main` for now, and push changes when a task is complete.

Read this file before making changes, then preserve the existing folder roles:

- `.website`: GitHub Pages site.
- `.github-actions`: import policy and automation workflows.
- `.cli-tooling`: npm CLI tooling.
- `submissions.jsonl`: root-level JSON Lines submission log.

## Submission checks

The `.github-actions/test/` folder contains first-run submission package checks. Run them with:

```sh
node .github-actions/test/run-all.mjs path/to/submission-package
```

Each check accepts an optional `--meta path/to/meta.yaml`. If no metadata path is provided, the check uses `path/to/submission-package/meta.yaml`, falling back to a root-level `meta.yaml` in the current working directory.

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
- `your-submission-package/proofs/`: proofs for theorem surface files.
- Proof namespaces use `Slug.Proof.Theorem.Name`.
- Every surface theorem needs one matching proof file under `proofs/`, using only allowed axioms.
