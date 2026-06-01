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
lml create-paper
```

The `test` command runs `.github-actions/test/run-all.mjs` using the metadata file as the source of submission information:

```sh
lml test path/to/meta.yaml
```

For a one-off run without linking:

```sh
cd .cli-tooling
node ./src/cli.js --help
```
