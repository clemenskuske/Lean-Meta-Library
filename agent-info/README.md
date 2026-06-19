# Lean Meta Library Agent Startup Guide

Use this guide when you are helping inside a Lean Meta Library workspace or
using the `lml` CLI. It explains the project model, the submission registry, and
the CLI surface without depending on one particular checkout layout.

## Making A Submission Ready

When a user asks you to make an existing Lean project submission-ready, read
`submission-guide.md` in this folder, or run:

```sh
lml submission-instruction
```

## What The Setup Is For

Two schema files are placed in the current folder by `lml init` and `lml update`:

- `manifest.config.yaml` — the schema for author-supplied manifest files. Use
  it as the authoritative reference for required and optional manifest fields,
  statement and proof entry shapes, and created field names.
- `submission-record.config.yaml` — the schema for a single record in
  `submissions.jsonl`. Use it as the authoritative reference for the structure
  of imported submission data.

Lean Meta Library records Lean formalization submissions in a form that can be
checked, imported, and reused by later submissions.

A submission is the Lean Meta Library entry, not the source repository. A source
repository may host a submission. A submission may contain up to two Lake
packages:

- a statement package for public `Definition` and `Axiom` entries;
- a proof package for proofs that discharge statement axioms.

Each package is a Lake package. Use repository terminology only for the source
checkout or GitHub repository that hosts the submission.

The core idea is to separate three things:

- Public statement content: trustworthy `Definition` entries and `Axiom`
  entries. `Definition` entries introduce Lean `def`s. `Axiom` entries
  introduce Lean `axiom`s, not theorem declarations.
- Proof artifacts: Lean files whose declarations discharge statement axioms.
  Each proof entry pairs a target statement axiom with the proof declaration
  that establishes it, both as global Lean names. A proof may discharge its own
  submission's axiom or another submission's axiom.
- Submission manifest: a manifest that tells the checker where the declarations,
  proofs, abstract, toolchains, and bibliographic data live.

Whether a statement reads as a theorem, conjecture, or assumption is a
naming/display classification derived from whether its axiom is discharged by a
proof.

## What The CLI Can Do

Install or link the CLI, then use either `lml` or `lean-meta-library`.

Common commands:

```sh
lml agent-introduction
lml submission-instruction
lml login
lml logout
lml init
lml update
lml create-paper <slug>
lml test --manifest=path/to/manifest.yaml
lml submit --manifest=path/to/manifest.yaml
lml submission-status <issue-id-or-url>
```

The commands have these roles:

- `agent-introduction`: print this startup guide.
- `submission-instruction`: print the step-by-step guide for making a submission ready.
- `login` and `logout`: manage GitHub CLI authentication for commands that need
  GitHub.
- `init` and `update`: check local tooling, synchronize the submission registry,
  and download `manifest.config.yaml` and `submission-record.config.yaml`.
- `create-paper <slug>`: create a starter submission package that an agent can
  adapt with user-approved declarations, manifest, and proofs.
- `test --manifest=path/to/manifest.yaml`: run the local submission checks from
  the manifest file.
- `submit --manifest=path/to/manifest.yaml`: run checks, then dispatch the
  GitHub submit workflow.
- `submission-status <issue-id-or-url>`: report submission issue, workflow,
  import, source commit, and statement-file status. Pass the GitHub issue number
  or the full issue URL.

For structure-update work, read
`development-info/submission-api-structure-agent-readme.md`. It records the target
model and distinguishes implemented checker behavior from future rework.

## How To Use `submissions.jsonl`

```sh
lml update
```

Start by syncing the local registry. `lml update` refreshes `submissions.jsonl`
and the agent guide from the Lean Meta Library repository configured for the
checkout. Use `lml init` instead when setting up a checkout for the first time;
it performs the same manifest sync after checking local tooling.

`submissions.jsonl` is the import registry. It is a JSON Lines file: each
non-empty line is one complete JSON object for one imported submission. The
schema for each record is defined in `submission-record.config.yaml`.

Read it when you need to know what has already been imported, what statement or
proof package a later submission may depend on, or which source repository,
commit, manifest path, and source-repository-relative package folders define
imported submission content.

For dependency work, the registry is the authorization source for imported
submissions. `SemanticDependencies` on statement entries list
fully-qualified declaration names that a statement depends on.
`ProofObligations` on proof entries list the non-base axioms a proof target may
use. Actual proof dependencies come from Lean axiom collection and must be
covered by declared obligations, aside from allowed base axioms. Undeclared
axiom dependencies should survive to the axiom gate rather than being silently
rewritten.

Do not change `submissions.jsonl` by hand. It is synced registry state, and
import automation or `lml update` may recreate or overwrite it from the
canonical repository state at any time.

## Agent Workflow

1. Read the local agent instructions and project README files.
2. Inspect the manifest file before editing submission files.
3. If preparing a new submission, ask the user to confirm the title, submission
   slug, abstract, public `Definition`/`Axiom` entries, proof types, proof
   sources, dependencies, and BibTeX entries.
4. Run `lml update` before depending on imported-submission context.
5. Keep statement content small: every submitted declaration must be listed in
   the manifest, and statement files should contain only those public entries
   plus the matching LaTeX text.
6. Keep proof content focused on the submitted proof targets and any necessary
   internal development.
7. Include a license file pointed to by `LicenseFile` in the manifest. The file
   must contain a recognized license identifier; see `lml-env.json`
   `submission.allowedLicenseIdentifiers` for the full list.
8. Run `lml test --manifest=path/to/manifest.yaml` before calling submission
   work complete.
9. Run `lml submission-status <issue-id-or-url>` when the user wants to know
   whether a submitted package has been uploaded, tested, imported, or changed
   since submission.

Keep the package small and reviewable. Prefer the minimal statement and proof
code needed for the user-approved mathematical submission over copying a whole
source project into the submission package.
