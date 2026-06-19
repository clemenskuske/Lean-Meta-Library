# Lean Meta Library

Lean Meta Library is a curated registry of Lean 4 formalizations. Each entry — a *submission* — contributes one or more public mathematical statements alongside the proofs that establish them, making formalized results available for reuse in later work.

**Browse submissions:** [clemenskuske.github.io/Lean-Meta-Library](https://clemenskuske.github.io/Lean-Meta-Library/)

**CLI for submitting and using submissions:**
```sh
gh api "repos/clemenskuske/Lean-Meta-Library/contents/lean-meta-library-cli.tgz?ref=main" \
  --jq .content | base64 --decode > lean-meta-library-cli.tgz
npm install -g ./lean-meta-library-cli.tgz
lml --help
```

## What Is a Submission

A submission is a Lean Meta Library entry — not a GitHub repository. It consists of:

- **Statements** — public `Definition` or `Axiom` declarations, the main results of a submission.
- **Proofs** — Lean proof declarations that discharge the statement axioms.
- **Manifest** — a `manifest.yaml` tying everything together: title, abstract, bibliography, and the locations of statements and proofs.

A source repository hosts the submission files. The CLI and the import workflow read the manifest, check the package, and record the result in the shared registry (`submissions.jsonl`).

Once a submission is imported, its public statement declarations can be referenced as semantic dependencies in your own submission's manifest. The local registry (`submissions.jsonl`) is the source of truth for what has been imported; run `lml update` to keep it current.


## Why You Can Trust Imported Statements

Lean Meta Library statements are `axiom` declarations. Importing one extends your trusted base — the set of things your proofs rely on as given. That is fine as long as you know what you are importing, and nothing unknown has to run on your machine to use them.

Each submission is one of two kinds:

- **Proven fact** — a proof exists and the registry has verified it against the statement. When you import one, you are using a result the Lean kernel has already confirmed.
- **Conjecture** — the statement is assumed true but not yet proven. The manifest says so explicitly. Importing one knowingly extends your trusted base with an unproven assumption.


## How to Create a Submission

A submission requires two things: a Lean package containing the statement and proof files, and a `manifest.yaml` declaring the title, abstract, bibliography, and file locations.

The CLI is designed to help agents work through this process. Run `lml agent-introduction` after installation to get the full agent startup guide — it covers the submission model and the CLI commands for creating, rewriting, and pushing a submission.
