# Submission Structure Agent README

Use this file as the implementation reference for the Lean Meta Library
submission structure. Keep it self-contained and update it as the structure
evolves.

## Ground Truth Order

When updating code, fixtures, or prose, use this order:

1. `manifest.config.yaml` for manifest field names and schema shape.
2. `submission-record.config.yaml` for the structure of imported submission
   records in `submissions.jsonl`.
3. `import-submission-expectations.md` for repository-content policy.
4. `.github/actions/test/` and `test-imports/` for currently implemented
   checker behavior.

If these disagree, prefer the earlier source and update the later source.

## Hard Earned Lessons

- Use "submission" for the Lean Meta Library entry. Do not call it a repo. Use
  "repository" only for the actual source-code repository or GitHub URL.
- A submission can contain up to two Lake packages: a statement package and a
  proof package. Either may be absent.
- Statement package and proof package are Lake packages inside a submission, not
  submissions themselves.

## Pinned Environment

- `lml-env.json` pins the Lean version, Mathlib repository and revision, base
  imports, trusted-base axiom policy, allowed file extensions, and size limits.
- Each present Lake package has its own `lean-toolchain` file. Checkers compare
  it against the fixed Lean version from `lml-env.json`.
- Std is provided by the fixed Lean version and is not separately listed as a
  base import.

## Tests And Fixtures

The current fixture suite in `test-imports/` covers:

- package build failure;
- conditional statement/proof build preparation;
- manifest/schema failure;
- manifest path existence;
- statement-package disk closure;
- pinned toolchain and Mathlib version checks;
- namespace/package-name checks;
- folder and file size limits;
- file type policy;
- statement syntax policy;
- proof type matching with Lean `isDefEq`;
- `sorryAx` and local proof-axiom rejection;
- unlisted statement declaration rejection;
- unauthorized statement imports;
- final proof-build forbidden axiom checks.

Future fixture work should add or strengthen coverage for:

- submissions with only a statement package;
- submissions with only a proof package;
- rejection of statement theorem declarations;
- proofs that discharge an external submission's statement axiom by global name;
- statement-level dependency DAG acyclicity;
- axiom-gate matching by name, type, and source module.

## Submission Issue Labeling

Submission import is gated by the GitHub issue label `submission`.

The submit workflow labels issues it creates or updates. For issues opened
directly by public submitters, `.github/workflows/submission-intake.yml`
validates the Lean Meta Library submission marker and required source fields,
then adds the `submission` label with the repository workflow token. The import
workflow should continue to trigger only for issues carrying that label.

## Target Work

### Declared And Actual Dependencies

The dependency model distinguishes two graphs:

- **Declared dependencies** — `SemanticDependencies` on statement entries and
  `ProofObligations` on proof entries record the author's declared intent.
  These define the security boundary for axiom remapping.
- **Actual dependencies** — Lean axiom collection on the compiled proof term
  produces the actual dependency set used for composition.

Target behavior:

- Require declared dependencies to cover the actual dependencies.
- Build the axiom-remapping substitution from declared dependencies only. Do
  not use a global substitution; undeclared axioms must survive to the axiom
  gate rather than being silently rewritten.

### Final Proof Build Rework

The target extends the current build to handle nested imported submissions:

1. Import all nested imported submissions into the root Lake file. Source
   information comes from `submissions.jsonl` records.
2. During the Lean build, recursively follow manifest references.
3. Change proofs so they reference the proof counterpart of a referenced
   statement instead of its statement axiom, when that referenced statement is
   not a conjecture.
4. Use the resulting `.olean` files for axiom testing and related checks.
5. Return computed dependency and conjecture information and compare it to the
   version recorded in the manifest. A mismatch is a failure.

Composed proof outputs should rely only on trusted base axioms and declared
conjectures.

### Statement-Level Proof Certificates

The atomic unit is a statement, not a paper. Paper-level dependency cycles are
allowed; the statement dependency graph must be acyclic.

Target certificate flow:

1. Treat each statement as an axiom with no value.
2. Annotate discharger theorems with which statement they discharge, for example
   with a `discharges` attribute.
3. Require the discharger theorem's type to be definitionally equal to the
   statement axiom's type.
4. Certify a statement by walking the statement DAG in leaves-first topological
   order.
5. For each statement, create a composed constant whose type is the original
   statement type and whose value is the discharger proof term with dependency
   axioms remapped to already-created composed constants.
6. Share composed constants by name across diamonds in the dependency graph.
7. Emit a small certificate that bridges the statement axiom type to the
   composed theorem type in both directions and reports the composed theorem's
   axioms.
8. Re-verify the composed `.olean` output with `lean4checker` in a clean,
   pinned environment.

The composer is not trusted. If it emits a bad term, Lean rejects it; if it
emits extra axioms, the axiom gate catches them.

### Axiom Gate

Current behavior accepts configured base axioms by Lean name and type only.

Target: match trusted base axioms by name, type, and source module/provenance.
Pin the whitelist to a canonical signed trusted base. Run the recheck against
that pinned base, not an adversary-supplied environment. Accepted composed
proofs must bottom out only in trusted base axioms and declared conjectures.

### Lean And Orchestration Split

Lean must own anything that touches Lean semantics: the `discharges` attribute,
reading terms, definitional equality, type comparison, axiom sets, term
rewriting, adding composed declarations, statement-graph construction,
acyclicity checks, typed bridge generation, and the name/type/module axiom gate.

Orchestration glue (Python, Lake, Nix, or similar) should only: discover
libraries, compute build order, run `lake build` per library in sandboxes,
shuttle `.olean` files to isolated `lean4checker`, and aggregate results. Glue
must not compute the axiom-remapping substitution or the whitelist decision.

The small trusted glue exception is signature/hash verification and ensuring the
recheck runs against the pinned base.

### Trusted Computing Base

Trusted: the Lean kernel, `lean4checker`, the canonical signed trusted base,
the guarantee that verification runs against that base, the name/type/module
axiom gate, and the small provenance glue.

Not trusted: the composer, orchestration glue, and every submission's proof
files.

## Suggested Milestone

Start with three toy libraries `C <- B <- A`, one statement each, dischargers
wired up, the composer producing the composed proof for `A`, the certificate
passing, and a `lean4checker` pass.

Then add a second statement per paper and a deliberate paper-level but
statement-acyclic cycle to confirm the graph is statement-granular.
