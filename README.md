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

- **Statements** — public `Definition` or `Axiom` declarations, each in its own Lean file with a matching LaTeX description.
- **Proofs** — Lean proof declarations that discharge the statement axioms.
- **Manifest** — a `manifest.yaml` tying everything together: title, abstract, bibliography, and the locations of the statement and proof packages.

A source repository hosts the submission files. The CLI and the import workflow read the manifest, check the package, and record the result in the shared registry (`submissions.jsonl`).


## When Is a Submission Ready

A submission is ready when it is a clear, reproducible mathematical object rather than a snapshot of a whole working project. It should expose the definitions and statement axioms that other people are meant to use, provide proof declarations for the axioms that are claimed as proved, and describe that public surface in a manifest that both humans and the checker can read.

The statement package is intentionally small and quiet: one public declaration per statement file, named under the submission namespace, with matching LaTeX text. The proof package may contain the ordinary Lean work needed to establish those statements, but the manifest names the proof declarations that matter and the axiom each one discharges.

Readiness means the same story is visible in three places: the user's mathematical intention, the manifest, and the Lean artifacts. The package uses the library's fixed Lean and Mathlib versions, includes an accepted license, declares any imported Lean Meta Library dependencies, avoids unrelated build caches or project files, and passes:

```sh
lml test --manifest=path/to/manifest.yaml
```

In short: a ready submission is minimal enough to review, explicit enough to import, and checked enough that later work can depend on its public statements.


## Why You Can Trust Imported Statements

Lean Meta Library statements are Lean `axiom` declarations. In ordinary Lean, importing an axiom extends your trusted base — you assert it true without a proof. Here that concern is handled before the statement ever enters the registry:

1. A proof is submitted alongside the statement and built in an isolated environment under a fixed Lean and Mathlib version.
2. The compiled types of the proof declaration and the statement axiom are compared by the Lean kernel using `isDefEq`.
3. The proof's axiom dependencies are collected and checked against an allowlist of trusted base axioms — no undeclared Lean Meta Library axioms may slip through.
4. The composed proof is re-verified by `lean4checker`.

When you import a Lean Meta Library statement, you are not taking anything on faith. You are using a fact that the Lean kernel has already confirmed under the same trusted base your own code runs on.


## Using Imported Submissions

Once a submission is imported, its public statement declarations can be referenced as semantic dependencies in your own submission's manifest. The local registry (`submissions.jsonl`) is the source of truth for what has been imported; run `lml update` to keep it current.
## Getting Started With the CLI

Run `lml agent-introduction` after installation to get the full agent startup guide — it covers the submission model, CLI commands, and how to prepare a submission from an existing Lean project.
