# Context

spec1.md is an outdated document that we dont currently work in, but it may provide useful context into motivation and vision.

# Datastructures

We define the basic building blocks of the archive and the constraints we place
on them.

## Submissions

A **submission** is a **concept package** together with a **proof package**.

## Declarations and Atoms

A **declaration** is a single Lean declaration command. Besides its named
constant, a declaration comprises all auxiliary kernel constants its command
generates (e.g., a ``structure`` also generates its constructor and
projections). 

We say **declaration A depends on declaration B** if some constant of B occurs
in the type or body of some constant of A (theorems: type only).

An **Atom** is a declaration within the concept package. Every atom is declared
by one of the commands ``def``, ``abbrev``, ``structure``, ``class``,
``inductive``, ``instance``, or ``axiom``. An atom declared by ``axiom`` is
called a **statement**.

The **declaration DAG** is the directed graph on the atoms and all declarations
reachable from them, with an edge from A to B if A depends on B. We require
that non-atoms of the declaration DAG do not depend on atoms. The **declaration
DAG rooted at A** is the declaration DAG induced on all declarations reachable
from A.

Caveat: declarations in a ``mutual`` block may depend on each other. With
slight abuse of terminology, we still call the graph the declaration DAG: it is
acyclic except for cycles within mutual blocks.


## Concepts

A **concept** is a set of atoms together with a natural-language text. The
intent is that the text states one well-defined mathematical unit (a definition
or theorem as it would appear in a paper) and that the atoms faithfully
formalize it. Every atom belongs to exactly one concept.
Thus, concepts partition the declarations of the concept package.

The **concept DAG** is obtained from the declaration DAG by inducing on atoms
and quotienting by concepts (dropping self-loops). We require the concept DAG
to be acyclic. For a declaration A, the **concept DAG rooted at A** is the
declaration DAG restricted to the nodes reachable from A, induced and
quotiented as above. Note that the concept DAG rooted at A is not necessarily
an induced subgraph of the concept DAG.

## Proofs

A **proof** is a ``theorem`` declaration in the proof package that is annotated
with the statement it proves. Its **conclusion** is that statement. We require
the theorem's type to match the type of the conclusion up to definitional
equality, as checked by the kernel. Its **assumptions** are the statements
occurring in the theorem's axiom set (as reported by ``#print axioms``).
Axioms on the archive environment's ignore list are not counted as
assumptions; an axiom set containing anything that is neither a statement
nor ignored (e.g. ``sorryAx``, or an axiom declared in a proof package) is
rejected.

The **proof network** is the directed hypergraph over the statements where
every proof with assumptions A and conclusion c corresponds to a hyperedge (A →
c). A statement is **proven** if it is the conclusion of some proof all of
whose assumptions are (recursively) proven. Otherwise it is a **conjecture**.
More generally, a statement is **proven relative to** a set C of conjectures if
it becomes proven once the statements in C are taken as proven.


## Key-Value Annotations

We annotate submissions, atoms, concepts, and proofs with various key-value pairs. The list
of required and optional keys may later be extenede.

Submission:
    - id: an archive-wide unique id
    - TBD

Atom:
    - title (optional): natural-language name
    - description (optional): natural-language description

Concept:
    - title: natural-language name like "Ramsey's Theorem"
    - description: natural-language description

Proof:
    - conclusion: id of the conclusion
    - assumptions (optional): ids of all assumptions



# Implementation of These Datastructures 


## Archive Environment

All submissions build against a single **archive environment**: one pinned
Lean toolchain (which also fixes the lake version), one pinned mathlib
revision, and one fixed set of build options.

### More Implementation Details

Besides the versions, the environment also fixes:

- the build options (``autoImplicit`` off for concept packages, none for
  proof packages),
- the axioms ignored when computing a proof's assumptions (``propext``,
  ``Classical.choice``, ``Quot.sound``),
- resource limits on submissions (package and file sizes, build timeouts).

All archive-wide values live in a single machine-readable file,
``lml-env.json``, in the root of the archive repository.

## Submissions

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus
stays in the authors' repositories and attribution is clear. Since a
submission is identified by a fixed commit, it is immutable; updating it
means submitting a new commit. (To guard against link rot, we may keep
backup copies, e.g. via https://archive.softwareheritage.org/save/.)

The folder contains a manifest file with the submission's metadata and the
two packages.

**Registering** a submission means running the archive's checks against its
(repository, commit, folder) triple and, on success, recording the triple
under the submission's id. Only registered submissions can be required by
other submissions.

### More Implementation Details

The folder layout is fixed:

    mysubmission/
      manifest.yaml
      cpts/
        lakefile.toml
        lean-toolchain
        lake-manifest.json
        Mysubmission/Cpts/...      -- modules of the concept package
      prfs/
        lakefile.toml
        lean-toolchain
        lake-manifest.json
        Mysubmission/Prfs/...      -- modules of the proof package

The package folders are literally named ``cpts`` and ``prfs``, since other
submissions reference them via ``subDir``.

``manifest.yaml`` holds the metadata: the submission's id and title,
pointers to abstract and license, bibliography entries, and the environment
it was built against. This environment must match the archive environment.
Example:

    manifestVersion: "1"
    id: Mysubmission
    leanVersion: "v4.30.0"
    mathlibVersion: "c5ea00351c28e24afc9f0f84379aa41082b1188f"
    SubmissionName: My Submission
    AbstractPath: abstract.tex
    LicenseFile: LICENSE
    BibEntries: []

The ``id`` is the archive-wide unique submission id from the Datastructures
section: UpperCamelCase, doubling as the Lean namespace. The package names
``mysubmission-cpts``/``-prfs`` are its lowercasing. Ids are claimed at
registration time and must not collide with a top-level namespace of the
trusted base (a submission named ``Nat`` or ``Mathlib`` is rejected). The
registry is ``submissions.jsonl`` in the root of the archive repository,
one line per registered submission.

Further rules (to discuss):

- **File whitelist.** A submission may only contain whitelisted file types
  (``.lean``, ``.tex``, ``.yaml``, ``.json``, ``.bib``, ``.md``, ``.txt``,
  plus ``lean-toolchain``, ``LICENSE``, ``README``) and must stay within the
  archive-wide size limits.
- **License.** The submission must carry one of the accepted open licenses.

## Packages

Each submission ``Mysubmission`` creates two Lake packages: a **concept
package** ``mysubmission-cpts`` containing its concepts and atoms and a **proof
package** ``mysubmission-prfs`` containing its proofs.

Besides mathlib, the concept package may require only other submissions'
concept packages, and proof packages may require only other submissions' proof
and concept packages. We discourage requiring other submissions' proof packages
for safety and hygiene reasons.

### More Implementation Details

We only allow ``lakefile.toml``, never ``lakefile.lean``, and enforce the
following rules.

- **Whitelisted keys only.** The file may contain exactly ``name``,
  ``defaultTargets``, ``[[require]]`` entries, and one ``[[lean_lib]]``.
  Additionally build-options must match the archive-wide standard:
  - ``autoImplicit`` off for concept packages,
  - no build-options for proof packages.

- **Fixed names.** The package name is ``mysubmission-cpts`` resp.
  ``mysubmission-prfs``. The single ``lean_lib`` is named ``Mysubmission.Cpts``
  resp. ``Mysubmission.Prfs`` and is the only default target. With Lake's
  default layout, module files therefore live under ``Mysubmission/Cpts/``
  resp. ``Mysubmission/Prfs/``.

- **Dependencies.** 
  As stated above (and besides mathlib), concept packages can only require
  concept packages and proof packages may require both.
  We issue a warning when a proof package is required.
  Mathlib must be pinned to the archive-wide revision. 
  Proof and concept packages are added by pinning the full commit hash and
  subfolder of the submission's repository. Every such (repository, rev,
  subfolder) triple must resolve to a registered submission.
  Only exception: The proof package may require its own concept package via
  a relative path to the folder.

- **Pinned toolchain.** ``lean-toolchain`` must contain the archive-wide
  toolchain verbatim.

- **Lock file.** Submissions may include ``lake-manifest.json`` so that a plain
  ``lake build`` works for humans cloning the repository, but the checker
  treats it as untrusted and regenerates. We may issue a warning if the two
  artifacts do not match (graph equality, not byte equality).

Example ``lakefile.toml`` of a concept package:

    # mysubmission/cpts/lakefile.toml
    name = "mysubmission-cpts"
    defaultTargets = ["Mysubmission.Cpts"]

    [[require]]
    name = "mathlib"
    git = "https://github.com/leanprover-community/mathlib4"
    rev = "c5ea00351c28e24afc9f0f84379aa41082b1188f"   # archive-wide pin

    # concept package of another submission this one builds on
    [[require]]
    name = "othersubmission-cpts"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "cpts"

    [[lean_lib]]
    name = "Mysubmission.Cpts"

Example ``lakefile.toml`` of the corresponding proof package:

    # mysubmission/prfs/lakefile.toml
    name = "mysubmission-prfs"
    defaultTargets = ["Mysubmission.Prfs"]

    [[require]]
    name = "mysubmission-cpts"
    path = "../cpts"

    # discouraged, but allowed: reusing another submission's proofs
    [[require]]
    name = "othersubmission-prfs"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "prfs"

    [[lean_lib]]
    name = "Mysubmission.Prfs"

## Namespaces

Each submission with id ``Mysubmission`` corresponds to a top-level namespace
``Mysubmission``. All proofs of the submission are placed into the namespace
``Mysubmission.Prfs``. All atoms of a concept ``Myconcept`` are placed within
the namespace ``Mysubmission.Cpts.Myconcept``. Both proofs and atoms may be
arbitrarily nested within subnamespaces. Submission ids are UpperCamelCase,
since they double as Lean namespaces.

Example:
- id of submission: ``Mysubmission``
- id of an atom of concept ``Myconcept`` within the submission:
  ``Mysubmission.Cpts.Myconcept.OptionalNestedSubNamespaces.Myatom``
- id of a proof within the submission:
  ``Mysubmission.Prfs.OptionalNestedSubNamespaces.Myproof``

## Concept Lean Dialect

Modules of the concept package are written in a restricted dialect of Lean.
Its purpose is **locality**: the unit of review on the website is a single
atom, and its meaning must be reconstructible from its source text, its
fully-qualified id, and its dependencies alone — a reviewer never consults
the surrounding module. Any command that invisibly mutates elaborator state
breaks locality.

Since Lean offers a million ways to mutate ambient state (macros, notation,
attributes, options, …), the dialect whitelists what is allowed rather than
enumerating what is forbidden. Term-level syntax is unrestricted: all
notation and implicit machinery of core Lean and the pinned mathlib remains
available as trusted base. Submissions merely cannot extend it.

### More Implementation Details

A module of the concept package may only contain:

- ``import`` commands for modules of the declared dependencies (Lean only
  permits them at the top of a module),
- ``namespace`` / ``end``,
- module docstrings ``/-! … -/``, allowed only directly before a
  ``namespace`` (concept annotations, see the Annotations section),
- the atom commands ``def``, ``abbrev``, ``structure``, ``class``,
  ``inductive``, ``instance``, ``axiom``, each with an optional docstring
  and optionally prefixed by ``open … in``,
- ``mutual`` blocks of the atom commands.

- **Namespaces.** ``namespace Foo.Bar`` prefixes declared names and opens
  ``Foo`` and ``Foo.Bar`` — both derivable from the atom's id, whose
  prefixes are exactly the opened namespaces. So namespaces are the one
  piece of ambient state we allow, arbitrarily nested. A standalone
  ``open`` leaves no trace in the id and is banned; ``open … in def …`` is
  part of the reviewed text and fine.

- **Modifiers.** No ``partial``, no ``unsafe`` (their semantics are opaque
  or absent); ``noncomputable`` is fine.

- **Sorries.** The concept package must be sorry-free: a sorried ``def``
  body elaborates fine but leaves a hole in the trusted surface. Checked on
  the axiom set of every atom.

- **Attributes.** None for now. Downstream proof packages can re-attach
  them locally (``attribute [simp] …``), so this costs no ergonomics. The
  exception is ``instance``, which must take effect already in the concept
  package so that later atoms elaborate — hence it is an atom command.

- **Deriving.** ``deriving`` clauses run arbitrary metaprograms; banned
  initially. We may later whitelist standard handlers (``DecidableEq``,
  ``Repr``, …), counting the generated instances as auxiliary constants of
  the atom.

### Additional thoughts

TODO
Enforcement is layered: a purely syntactic linter checks every top-level
command against the whitelist before elaboration; after elaboration, an
environment diff checks that exactly the atoms and their auxiliary
constants were added (the backstop against whitelist escapes); finally the
DAG checks from the Datastructures section. In the beginning, the dialect
is defined implicitly by whatever the checker accepts.

TODO: typeclass resolution is ambient — an ``instance`` atom silently
changes which instance a later atom picks up, invisible in the raw source.
Do reviewers review the raw source, or a canonical rendering with resolved
identifiers and instances shown on demand? Probably the latter.

TODO: allow ``variable`` for ergonomics? Would require the renderer to
splice the used variables back into each displayed declaration. Postponed.


## Annotations

We use docstrings to annotate concepts, atoms, and proofs. Atoms and proofs
carry ordinary declaration docstrings ``/-- … -/``. Concepts are annotated
by a module docstring ``/-! … -/`` placed directly before the ``namespace``
that opens them — legal vanilla Lean, associated with the namespace
positionally by the checker.

An example module within the concept package:

    namespace Mysubmission.Cpts

    /-! annotation of concept A -/
    namespace A

    /-- annotation of atom X -/
    def X ...

    /-- annotation of atom Y -/
    axiom Y ...

    end A

    /-! annotation of concept B -/
    namespace B

    /-- annotation of atom U -/
    def U ...

    /-- annotation of atom V -/
    axiom V ...

    end B

    end Mysubmission.Cpts

The association is made canonical by three placement rules:

- A ``/-! … -/`` must be immediately followed by a ``namespace`` command and
  annotates the namespace it opens; every other placement is rejected.
- The concepts are exactly the namespaces directly below
  ``Mysubmission.Cpts``. Deeper namespaces are organization, not concepts,
  and are never annotated.
- A concept namespace may be opened many times (even across modules), but
  must be annotated at exactly one opening. (Atoms directly in
  ``Mysubmission.Cpts`` would belong to no concept and are rejected.)


An example module within the proof package:

    namespace Mysubmission.Prfs

    /--
    ---
    conclusion: Mysubmission.Cpts.Myconcept.Mystatement
    ---
    annotation of proof P
    -/
    theorem P ...

    end Mysubmission.Prfs

Each annotation is a docstring that we parse as markdown with optional yaml frontmatter (common pattern for static site generators).
When placing the whole docstring into json, the markdown at the end gets placed into the ``description`` key

    /--
    ---
    key: value
    key: value
    key: value
    ---
    description
    -/

## Proofs

The proof package is ordinary Lean — any command, any syntax. Correctness
is delegated entirely to the kernel: the archive only inspects the proof
theorems' types and axiom sets, so nothing in the proof package extends the
trusted surface. (This is also why writing proof packages can be outsourced
to AI agents without compromising correctness.)

### More Implementation Details

A ``theorem`` whose docstring frontmatter carries the ``conclusion`` key is
a proof (see the example in the Annotations section); all other
declarations are helpers and are ignored by the archive. The optional
``assumptions`` key, when present, must list exactly the assumptions the
checker computes — a redundant sanity check for authors, not an input.

Checks per proof:

1. The ``conclusion`` id resolves to a statement (an ``axiom`` atom) of the
   submission itself or of a registered dependency.
2. The theorem's type is definitionally equal to the conclusion's type
   (kernel check).
3. Every axiom reported by ``#print axioms`` is either a statement (an
   assumption) or on the archive environment's ignore list; any other
   axiom — ``sorryAx``, an axiom declared in the proof package itself —
   rejects the proof.
