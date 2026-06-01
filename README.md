# Lean Meta Library

Lean Meta Library workspace.

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
lml test path/to/submission-package
lml create-paper
```

The `test` command runs `.github-actions/test/run-all.mjs` and forwards extra arguments:

```sh
lml test path/to/submission-package --meta path/to/meta.yaml
```

For a one-off run without linking:

```sh
cd .cli-tooling
node ./src/cli.js --help
```
