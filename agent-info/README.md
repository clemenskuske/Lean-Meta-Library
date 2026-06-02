# Lean Meta Library Agent Startup Guide

Use this guide when you are helping inside a Lean Meta Library workspace or using the `lml` CLI. It explains the project model, the submission registry, and the CLI surface without depending on one particular checkout layout.

## What The Setup Is For

Lean Meta Library records Lean formalization submissions in a form that can be checked, imported, and reused by later submissions.

The core idea is to separate three things:

- The public mathematical surface: definitions, theorem statements, and conjectures that a submission exposes.
- The proof package: Lean files proving the submitted theorems without relying on the submitted surface theorem axioms.
- The submission metadata: a small manifest that tells the checker where the surface entries, proofs, abstract, toolchain, and bibliographic data live.

Agents should treat the metadata file as the submission source of truth. The Lean files should match it, and the checks should be run from it.

## How To Use `submissions.jsonl`

`submissions.jsonl` is the import registry. It is a JSON Lines file: each non-empty line is one complete JSON object for one imported submission.

Read it when you need to know what has already been imported, what surface package a later submission may depend on, or which repository, branch, commit, metadata path, and surface folder define an imported surface.

Important fields include:

- `Repo Url`, `Source Branch`, and `Source Commit`: the exact source revision for the imported submission.
- `Metadata File`: the metadata path used for the import.
- `Surface Folder`: the folder containing the imported surface package.
- `surfaceEntries`: the public definition, theorem, and conjecture entries recorded for that submission.
- `proofs`: theorem proof targets and conjecture markers.
- `paper`: paper title and bibliographic metadata.
- `User Login`, `Issue Number`, and `Issue Url`: submission provenance from the import workflow.

For dependency work, the registry is the authorization source. A later submission may use at most the imported surface package authorized by its metadata row, and its Lake dependency must point to the recorded repository, source commit, and surface folder. Downstream Lean files should import only the required `.Surface` package from that dependency.

Do not treat `submissions.jsonl` as a scratch log. Import automation normally creates or updates rows after checks pass. If you must edit it by hand, preserve JSON Lines format: one compact valid JSON object per line, no trailing commas, no pretty-printed multi-line objects.

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
- `create-paper <slug>`: create a starter submission package that an agent can adapt with user-approved surface entries, metadata, and proofs.
- `test --meta=path/to/meta.yaml`: run the local submission checks from the metadata file.
- `submit --meta=path/to/meta.yaml`: run checks, then dispatch the GitHub submit workflow.
- `submission-status path/to/meta.yaml`: report submission issue, workflow, import, source commit, and surface-file status.

When a user asks you to make an arbitrary Lean project submission ready, start with:

```sh
lml agent-submission-guide
```

That command prints the guide for turning a Lean project into a checked Lean Meta Library submission. Use `lml create-paper <slug>` for the starter package, then replace the starter content with the user's actual title, abstract, surface declarations, proof files, and bibliographic metadata.

## Agent Workflow

1. Read the local agent instructions and project README files.
2. Inspect the metadata file before editing submission files.
3. If preparing a new submission, ask the user to confirm the title, namespace slug, abstract, public surface entries, theorem/conjecture split, and proof sources.
4. Use `submissions.jsonl` only for imported-surface context and dependency authorization.
5. Run `lml test --meta=path/to/meta.yaml` before calling submission work complete.
6. Use `lml submission-status path/to/meta.yaml` when the user wants to know whether a submitted package has been uploaded, tested, imported, or changed since submission.

Keep the package small and reviewable. Prefer the minimal surface and proof code needed for the user-approved mathematical submission over copying a whole source project into the submission package.
