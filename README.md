# Lean Meta Library

Lean Meta Library workspace.

## Project Environment

Repository-level values that may change later but are fixed for all projects right now live in `lml-env.json`.
CLI tooling and submission checks import this file for Lean/Lake/mathlib versions and first-run size limits.

## CLI Tooling

The command line tool lives in `.cli-tooling`.

Install it locally from the repository root:

```sh
cd .cli-tooling
npm install
npm link
```

After linking, the CLI is available as either `lml` or `lean-meta-library`:

```sh
lml --help
lean-meta-library --help
```

Common commands:

```sh
lml login
lml logout
lml init
lml update
lml test path/to/meta.yaml
lml submit path/to/meta.yaml
lml create-paper
```

The `test` command runs `.github-actions/test/run-all.mjs` using the metadata file as the source of submission information:

```sh
lml test path/to/meta.yaml
```

The `submit` command runs the submission checks first, then dispatches `.github/workflows/submit.yml` for the current repository, branch, commit, and metadata file:

```sh
lml submit path/to/meta.yaml
lml submit --no-prior-test path/to/meta.yaml
```

## Submission Workflow

The `Submit` GitHub Actions workflow can be run manually with a metadata path. It creates a submission issue when `submissionIssueNumber` is missing, or updates that issue when the field is present. The workflow labels the issue `submission`, records the repository URL, source branch, source commit, and metadata contents in the issue body, then writes `submissionIssueNumber` and `submissionIssueUrl` back to the metadata file.

The `Import Submission` workflow starts from issues labeled `submission`. It checks out the submitted repository at the recorded branch and commit, runs `.github-actions/test/run-all.mjs` against the embedded metadata file from the issue, then adds or updates the corresponding `submissions.jsonl` row and closes the issue.

For a one-off run without linking:

```sh
cd .cli-tooling
node ./src/cli.js --help
```
