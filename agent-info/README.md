# Lean Meta Library Agent Startup Guide

Use this guide when you are helping inside a Lean Meta Library workspace or
using the `lml` CLI. It explains the project model, the submission registry, and
the CLI surface without depending on one particular checkout layout.

## What The Setup Is For

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
  Each proof entry pairs a target statement axiom (`axiom`) with the proof
  declaration that establishes it (`proof`), both as global Lean names. A proof
  may discharge its own submission's axiom or another submission's axiom.
- Submission metadata: a manifest that tells the checker where the declarations,
  proofs, abstract, toolchains, and bibliographic data live.

Whether a statement reads as a theorem, conjecture, or assumption is a
naming/display classification derived from whether its axiom is discharged by a
proof. It is not a field on the proof entry, which carries only `axiom` and
`proof`.

Agents should treat the metadata file as the submission source of truth. For
metadata shape, treat `manifest.config.yaml` as authoritative: it defines the
required author-supplied fields, optional statement/proof sections, exact
created field names, and `DeclarationReferences` record shape.

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
lml test --meta=path/to/manifest.yaml
lml submit --meta=path/to/manifest.yaml
lml submission-status path/to/manifest.yaml
```

The commands have these roles:

- `agent-introduction`: print this startup guide.
- `agent-submission-guide`: print the detailed paper-submission readiness guide
  for agents.
- `login` and `logout`: manage GitHub CLI authentication for commands that need
  GitHub.
- `init` and `update`: check local tooling and synchronize repository metadata.
- `create-paper <slug>`: create a starter submission package that an agent can
  adapt with user-approved declarations, metadata, and proofs.
- `test --meta=path/to/manifest.yaml`: run the local submission checks from the
  metadata file.
- `submit --meta=path/to/manifest.yaml`: run checks, then dispatch the GitHub submit
  workflow.
- `submission-status path/to/manifest.yaml`: report submission issue, workflow,
  import, source commit, and statement-file status.

When a user asks you to make an arbitrary Lean project submission ready, start
with:

```sh
lml agent-submission-guide
```

That command prints the guide for turning a Lean project into a checked Lean
Meta Library submission. Use `lml create-paper <slug>` for the starter package
when it matches the current checker, then replace the starter content with the
user's actual title, abstract, statement entries, proof files, and bibliographic
metadata.

For structure-update work, read
`agent-info/submission-api-structure-agent-readme.md`. It records the target
model and distinguishes implemented checker behavior from future rework.

## How To Use `submissions.jsonl`

```sh
lml update
```

Start by syncing the local registry. `lml update` refreshes `submissions.jsonl`
and the agent guide from the Lean Meta Library repository configured for the
checkout. Use `lml init` instead when setting up a checkout for the first time;
it performs the same metadata sync after checking local tooling.

`submissions.jsonl` is the import registry. It is a JSON Lines file: each
non-empty line is one complete JSON object for one imported submission.

Read it when you need to know what has already been imported, what statement or
proof package a later submission may depend on, or which source repository,
branch, commit, metadata path, and source-repository-relative package folders
define imported submission content.

Important fields include:

- `Repo Url`, `Source Branch`, and `Source Commit`: the exact source revision
  for the imported submission.
- `Metadata File`: the metadata path used for the import.
- `LakeStatementPackage` and `LakeProofPackage`: created metadata fields for
  locating the statement and proof package folders. Older rows may still
  contain a legacy public-statement folder field, but new imports should not
  write it.
- `statementRoot` and `proofRoot`: repository-relative folder paths for the
  statement and proof packages. Each folder must contain a `lakefile.lean`
  and a `lean-toolchain` file.
- `submissionSlug`, `submissionTitle`, and `bibtex-entries`: schema-level
  submission identity and bibliographic metadata.
- `statements`: public `Definition` and `Axiom` entries.
- `proofs`: proof entries, each pairing a target statement axiom (`axiom`) with
  the proof declaration that discharges it (`proof`).
- `User Login`, `Issue Number`, and `Issue Url`: submission provenance from the
  import workflow.

For dependency work, the registry is the authorization source for imported
submissions. Declared dependencies should use `DeclarationReferences` records
with exactly one of `CurrentSubmission: true` or `SubmissionSlug`, plus
`LeanStatement`, `LatexDefinition`, and `Name`. Local current-submission
references point at files in the current metadata root; external
`SubmissionSlug` references are resolved through imported statement packages.

Actual proof dependencies come from Lean axiom collection and must be covered by
the declared dependencies, aside from allowed base axioms. Undeclared axiom
dependencies should survive to the axiom gate rather than being silently
rewritten.

Do not change `submissions.jsonl` by hand. It is synced registry state, and
import automation or `lml update` may recreate or overwrite it from the
canonical repository state at any time.

## Agent Workflow

1. Read the local agent instructions and project README files.
2. Inspect the metadata file before editing submission files.
3. If preparing a new submission, ask the user to confirm the title, submission
   slug, abstract, public `Definition`/`Axiom` entries, proof types, proof
   sources, dependencies, and BibTeX entries.
4. Run `lml update` before depending on imported-submission context.
5. Keep statement content small: one submitted declaration per statement file,
   plus the matching LaTeX file.
6. Keep proof content focused on the submitted proof targets and any necessary
   internal development.
7. Run `lml test --meta=path/to/manifest.yaml` before calling submission work
   complete.
8. Run `lml submission-status path/to/manifest.yaml` when the user wants to know
   whether a submitted package has been uploaded, tested, imported, or changed
   since submission.

Keep the package small and reviewable. Prefer the minimal statement and proof
code needed for the user-approved mathematical submission over copying a whole
source project into the submission package.
