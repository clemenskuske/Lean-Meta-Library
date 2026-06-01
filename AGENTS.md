Any agent should add the information I am giving.

This repository is the Lean Meta Library workspace. Keep project notes, structure, and policy details up to date as new instructions arrive.

Use `main` for now, and push changes when a task is complete.

Read this file before making changes, then preserve the existing folder roles:

- `.website`: GitHub Pages site.
- `.github-actions`: import policy and automation workflows.
- `.cli-tooling`: npm CLI tooling.
- `submissions.jsonl`: root-level JSON Lines submission log.

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
