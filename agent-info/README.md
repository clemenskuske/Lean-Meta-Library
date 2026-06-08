# Lean Meta Library Agent Startup Guide

Use this guide when you are helping inside a Lean Meta Library workspace or using the `lml` CLI. It explains the project model, the submission registry, and the CLI surface without depending on one particular checkout layout.

## What The Setup Is For

Lean Meta Library records Lean formalization submissions in a form that can be checked, imported, and reused by later submissions.

The core idea is to separate three things:

- The public mathematical surface: trustworthy declarations, either definitions or statements.
- The proof package: Lean files for `proof`, `conditional-proof`, and `reduction` entries. A statement with a `proof` or `conditional-proof` is a theorem; a statement with a `reduction` is a conjecture. An `assumption` is a conjecture expected to be true, and a `conditional-proof` is a proof relying only on assumptions.
- The submission metadata: a small manifest that tells the checker where the declarations, proofs, abstract, toolchain, and bibliographic data live.

Agents should treat the metadata file as the submission source of truth. The Lean files should match it, and the checks should be run from it.

## What The CLI Can Do

Install or link the CLI, then use either `lml` or `lean-meta-library`.

Common commands:

```sh
lml agent-introduction
lml agent-submission-guide
lml login
lml logout
lml init
lml update
lml create-paper <slug>
lml test --meta=path/to/meta.yaml
lml submit --meta=path/to/meta.yaml
lml submission-status path/to/meta.yaml
```

The commands have these roles:

- `agent-introduction`: print this startup guide.
- `agent-submission-guide`: print the detailed paper-submission readiness guide for agents.
- `login` and `logout`: manage GitHub CLI authentication for commands that need GitHub.
- `init` and `update`: check local tooling and synchronize repository metadata.
- `create-paper <slug>`: create a starter submission package that an agent can adapt with user-approved declarations, metadata, and proofs.
- `test --meta=path/to/meta.yaml`: run the local submission checks from the metadata file.
- `submit --meta=path/to/meta.yaml`: run checks, then dispatch the GitHub submit workflow.
- `submission-status path/to/meta.yaml`: report submission issue, workflow, import, source commit, and surface-file status.

When a user asks you to make an arbitrary Lean project submission ready, start with:

```sh
lml agent-submission-guide
```

That command prints the guide for turning a Lean project into a checked Lean Meta Library submission. Use `lml create-paper <slug>` for the starter package, then replace the starter content with the user's actual title, abstract, surface declarations, proof files, and bibliographic metadata.

For the upcoming API-module submission-structure rework, also read `agent-info/submission-api-structure-agent-readme.md`. That README is the target design for the new layout before the checker and CLI scaffold are updated.


## How To Use `submissions.jsonl`

```sh
lml update
```

Start by syncing the local registry. `lml update` refreshes `submissions.jsonl` and the agent guide from the Lean Meta Library repository configured for the checkout. Use `lml init` instead when setting up a checkout for the first time; it performs the same metadata sync after checking local tooling.

`submissions.jsonl` is the import registry. It is a JSON Lines file: each non-empty line is one complete JSON object for one imported submission.

Read it when you need to know what has already been imported, what surface package a later submission may depend on, or which repository, branch, commit, metadata path, and repository-relative surface folder define an imported surface.

Important fields include:

- `Repo Url`, `Source Branch`, and `Source Commit`: the exact source revision for the imported submission.
- `Metadata File`: the metadata path used for the import.
- `Surface Folder`: the repository-relative folder containing the imported surface package.
- `declarations`: the public definition and statement declarations recorded for that submission.
- `proofs`: typed proof targets using `proof`, `conditional-proof`, or `reduction`.
- `paper`: paper title and bibliographic metadata.
- `User Login`, `Issue Number`, and `Issue Url`: submission provenance from the import workflow.

For dependency work, the registry is the authorization source. A later submission may use at most the imported surface package authorized by its metadata row, and its Lake dependency must point to the recorded repository, source commit, and repository-relative surface folder. Downstream Lean files should import only the required `.Surface` package from that dependency.

Do not change `submissions.jsonl` by hand. It is synced registry state, and import automation or `lml update` may recreate or overwrite it from the canonical repository state at any time.


## Agent Workflow

1. Read the local agent instructions and project README files.
2. Inspect the metadata file before editing submission files.
3. If preparing a new submission, ask the user to confirm the title, namespace slug, abstract, public declarations, proof types, and proof sources.
4. `lml update`: refresh `submissions.jsonl`, then use it only for imported-surface context and dependency authorization.
5. `lml test --meta=path/to/meta.yaml`: run this before calling submission work complete.
6. `lml submission-status path/to/meta.yaml`: run this when the user wants to know whether a submitted package has been uploaded, tested, imported, or changed since submission.

Keep the package small and reviewable. Prefer the minimal surface and proof code needed for the user-approved mathematical submission over copying a whole source project into the submission package.
