# Lean Meta Library

Lean Meta Library is a curated registry of Lean 4 formalizations. Each entry — a *submission* — contributes one or more public mathematical statements alongside the proofs that establish them, making formalized results available for reuse in later work.

**Browse submissions:** [clemenskuske.github.io/Lean-Meta-Library](https://clemenskuske.github.io/Lean-Meta-Library/)

**CLI for submitting and using submissions:**
```sh
gh api \
  -H "Accept: application/vnd.github.raw" \
  "repos/clemenskuske/Lean-Meta-Library/contents/lean-meta-library-cli.tgz?ref=main" \
  > lean-meta-library-cli.tgz
npm install -g ./lean-meta-library-cli.tgz
lml --help
```

## What Is a Submission

A submission is a Lean Meta Library entry. It consists of:

- **Statements** — public `Definition` or `Axiom` declarations, the main results of a submission.
- **Proofs** — Lean proof declarations that discharge the statement axioms.
- **Manifest** — a `manifest.yaml` tying everything together: title, abstract, bibliography, and the locations of statements and proofs.

A public source repository hosts the submission files. The CLI and the import workflow read the manifest, check the correctness of the proofs and the safety and usability of the statements, and record the result in the shared registry (`submissions.jsonl`). Well-formed submission issues are labeled automatically so public submitters do not need repository label permissions.

Once a submission is imported, its public statement declarations can be referenced as semantic dependencies in your own submission's manifest. Run `lml update` to download the latest submissions.


## Why You Can Trust Imported Statements

Lean Meta Library statements are `Definition` or `axiom` declarations — formalized mathematical results with a known provenance. You are not importing random axioms; each statement is either a proven fact or a declared conjecture, and nothing unknown runs on your machine to use them.

Each submission is one of two kinds:

- **Proven fact** — a proof exists and the registry has verified it against the statement. When you import one, you are using a result the Lean kernel has already confirmed.
- **Conjecture** — the statement is assumed true but not yet proven.


## How to Create a Submission

A submission requires a Lean package for the statements, a separate Lean package for the proofs, and a `manifest.yaml` declaring the title, abstract, bibliography, and their locations.

The CLI is designed to help agents work through this process. Run `lml agent-introduction` after installation to get the full agent startup guide — it covers the submission model and the CLI commands for creating, rewriting, and pushing a submission.
