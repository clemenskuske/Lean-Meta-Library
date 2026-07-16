# Vision

We outline the high-level idea of the archive.

## Submissions 

The basic unit of the archive is a **submission**. Each submission is split
into two packages.

The **concept package** pairs
- well-defined mathematical objects (such as a definition or theorem statement
  as it would appear in a paper), presented in natural language, and
- faithful encodings of such objects in lean. 
Each such pairing is a **concept**. Crucially, concepts do not contain proofs.
They are supposed to represent the minimal information needed to fully specify
the semantics of a natural-language statement or definition within lean, but
nothing more. The concept package is supposed to be especially clean lean code
written for and in collaboration with humans.

On the other hand, the **proof package** contains the actual lean proofs to
back up the correctness of the concepts. This package is supposed to compile
without sorries, but otherwise anything goes. As the correctness of proofs
can be checked by lean, the writing of the proof package can be fully outsurced
to to ai agents without compromising correctness. It's proven statements are
orthogonal to the concept package: It may leave proof obligations of the
submissions concept package open, and it may prove proof obligations from other
submissions. 

## Community Review 

While the correctness of the proof packages is checked by lean itself, we still
require human effort to check that the formal concepts match their natural
language counterparts. Contributors can register with their ORCID identity and
publicly approve of flag submitted formalizations, thereby helping us to close
the trust obligations.

## Versioning

Unlike most software projects where code freely changes over time, submissions
are frozen in time. This makes it easy for later submissions to reference
earlier submissions, allowing the organic growth of a dependency network
mirroring the citations of scientific publications. We understand that this
brings along its own problems, which we believe are worth it.
In particular, we pin the version of lean, lake and mathlib.

Bumping the pins later (new toolchain, new mathlib) invalidates every
submission so far. We have no plan how to handle this yet and will figure it
out as we go.

Authors may mark a submission as "work-in-progress" which allows them to
freely overwrite it. However, this prevents downstream submissions from citing
the submission, as we do not allow work-in-progress dependencies.

# Abstract Datastructures

We define the basic abstract datastructures of the archive. They come together
with key-value annotations and form the backbone of the website.

## Submission

A **submission** consists of a **concept package** and a **proof package**.

## Declarations and Atoms

A **declaration** is a single Lean declaration command. Besides its named
constant, a declaration comprises all auxiliary kernel constants its command
generates (e.g., a ``structure`` also generates its constructor and
projections). 

An **Atom** is a declaration within the concept package. Every atom is declared
by one of the commands ``def``, ``abbrev``, ``structure``, ``class``,
``inductive``, ``instance``, or ``axiom``. An atom declared by ``axiom`` is
called a **statement**.

We say **declaration A depends on declaration B** if some constant of B occurs
in the type or body of some constant of A (theorems: type only). 

The **declaration DAG** is the directed graph on the atoms and all declarations
reachable from them, with an edge from A to B if A depends on B. Note that that
non-atoms of the declaration DAG do not depend on atoms. The **declaration DAG
rooted at A** is the declaration DAG induced on all declarations reachable from
A.

The concept package will be written in a restricted subset of Lean (defined
later) to ensure that the semantics of an atom A are fully determined by the
source code of the atoms reachable from A in the declaration DAG (and mathib).

Caveat: declarations in a ``mutual`` block may depend on each other. With
slight abuse of terminology, we still call the graph the declaration DAG: it is
acyclic except for cycles within mutual blocks.


## Concepts

A **concept** is a set of atoms. Every atom belongs to exactly one concept.
Thus, concepts partition the declarations of the concept package.

The **concept DAG** is obtained from the declaration DAG by inducing on atoms
and quotienting by concepts (dropping self-loops). We require the concept DAG
to be acyclic. For a declaration A, the **concept DAG rooted at A** is the
declaration DAG restricted to the nodes reachable from A, induced and
quotiented as above. Note that the concept DAG rooted at A is not necessarily
an induced subgraph of the concept DAG.

## Aliases

An **alias** is an atom that merely re-exposes another atom, its **target**,
under a new id — a symlink. The target may be an atom of the same or of
another submission, and its semantics are exactly those of the target.
Concretely, an alias is an ``abbrev`` or ``instance`` whose body is exactly
one fully-qualified constant naming another atom; the checker recognizes this
shape and records the alias-of relation.

Statements cannot be aliases (an ``abbrev`` whose body is an ``axiom`` is a
proof-valued definition, not a statement).

## Proofs

A **proof** is a ``theorem`` declaration in the proof package that is annotated
with the statement it proves. Its **conclusion** is that statement. We require
the theorem's type to match the type of the conclusion up to definitional
equality, as checked by the kernel. Its **assumptions** are the statements
occurring in the theorem's axiom set (as reported by ``#print axioms``).

The **proof network** is the directed hypergraph over the statements where
every proof with assumptions A and conclusion c corresponds to a hyperedge (A →
c). A statement is **proven** if it is the conclusion of some proof all of
whose assumptions are (recursively) proven. Otherwise it is a **conjecture**.
More generally, a statement is **proven relative to** a set C of conjectures if
it becomes proven once the statements in C are taken as proven.


## Key-Value Annotations

We annotate submissions, atoms, concepts, and proofs with various key-value pairs. The list
of required and optional keys may later be exteneded.

Submission:
    - id: an archive-wide unique id in UpperCamelCase
    - TBD

Atom:
    - title (optional): natural-language name
    - description (optional): natural-language description

Concept:
    - title: natural-language name of the mathematical object, like "Ramsey's Theorem"
    - description: natural-language description of the mathematical object the
      concept represents. The whole validity of the archive rests on the
      assumption that the Lean side of the concept faithfully represents the
      natural-language description.

Proof:
    - conclusion: id of the conclusion
    - assumptions (optional): ids of all assumptions
    - description (optional): Additional information about the proof, like
      attribution or high level idea.


## Reviews

Everything above is derived from the frozen submissions. Reviews are the one
mutable layer on top. A **review** is a registered user's verdict on a
concept: **approve** — the Lean side faithfully represents the description —
or **flag** — it does not. One verdict per user per concept, revisable at any
time. We may also add a comment section per concept (TBD).


# Implementation Details

## Archive Environment

All submissions build against a single **archive environment**, which fixes

- one pinned Lean toolchain (which also fixes the lake version),
- one pinned mathlib revision
- the build options (``autoImplicit`` off for concept packages, none for proof
  packages),
- the allowed background axioms in proofs (``propext``, ``Classical.choice``,
  ``Quot.sound``),
- resource limits on submissions (package and file sizes, build timeouts).
- TBD

Implementation Note: All these archive-wide values live in ``lml-env.json`` in
the root of the archive repository.

## Submissions

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus stays
in the authors' repositories and attribution is clear. (To guard against link rot, we
may keep backup copies, e.g. via https://archive.softwareheritage.org/save/.)

**Registering** a submission means running the archive's checks against its
(repository, commit, folder) triple and, on success, recording the triple
under the submission's id. Only registered submissions can be referenced by
other submissions.

Each submission has an **id**, an archive-wide unique submission id in
UpperCamelCase, doubling as the Lean namespace. Ids are claimed at registration
time and must not collide with a top-level namespace of the trusted base (a
submission named ``Nat`` or ``Mathlib`` is rejected).

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

The concepts and proofs package folders are literally named ``cpts`` and
``prfs``, since other submissions reference them via ``subDir`` in the lakefile.

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

Implementation note: The registry is ``submissions.jsonl`` in the root of the
archive repository, one line per registered submission.

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

We only allow ``lakefile.toml``, never ``lakefile.lean``, and enforce the
following rules.

Further rules:

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


A module of the concept package may only contain:

- ``import`` commands for modules of the declared dependencies (Lean only
  permits them at the top of a module),
- ``namespace`` / ``end``,
- module docstrings ``/-! … -/``, allowed only directly before a
  ``namespace`` (concept annotations, see the Annotations section),
- normal docstrings ``/-- … -/``, allowed only directly before atoms
- the atom commands ``def``, ``abbrev``, ``structure``, ``class``,
  ``inductive``, ``instance``, ``axiom``, each with an optional docstring
  and optionally prefixed by ``open … in``,
- ``mutual`` blocks of the atom commands.

Further rules:

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


### Additional thoughts by Claude

TODO: **Attributes.** None for now. Downstream proof packages can re-attach
them locally (``attribute [simp] …``), so this costs no ergonomics. The
exception is ``instance``, which must take effect already in the concept
package so that later atoms elaborate — hence it is an atom command.

TODO: **Deriving.** ``deriving`` clauses run arbitrary metaprograms; banned
initially. We may later whitelist standard handlers (``DecidableEq``, ``Repr``,
…), counting the generated instances as auxiliary constants of the atom.

TODO: Enforcement is layered. a purely syntactic linter checks every top-level
command against the whitelist before elaboration; after elaboration, an
environment diff checks that exactly the atoms and their auxiliary constants
were added (the backstop against whitelist escapes); finally the DAG checks
from the Datastructures section. In the beginning, the dialect is defined
implicitly by whatever the checker accepts.

TODO: typeclass resolution is ambient — an ``instance`` atom silently
changes which instance a later atom picks up, invisible in the raw source.
Do reviewers review the raw source, or a canonical rendering with resolved
identifiers and instances shown on demand? Probably the latter.

TODO: allow ``variable`` for ergonomics? Would require the renderer to
splice the used variables back into each displayed declaration. Postponed.


## Proofs

The proof package is ordinary Lean — any command, any syntax. Correctness
is delegated entirely to the kernel: the archive only inspects the proof
theorems' types and axiom sets, so nothing in the proof package extends the
trusted surface. (This is also why writing proof packages can be outsourced
to AI agents without compromising correctness.)

Further rules:

A ``theorem`` whose docstring frontmatter carries the ``conclusion`` key is
a proof (see the example in the Annotations section). All other
declarations are helpers and are ignored by the archive. The optional
``assumptions`` key, when present, must list exactly the assumptions the
checker computes — a redundant sanity check for authors, not an input.

Checks per proof:

1. The ``conclusion`` id resolves to a statement (an ``axiom`` atom) of the
   submission itself or of a registered dependency.
2. The theorem's type is definitionally equal to the conclusion's type (kernel
   check).
3. Every axiom reported by ``#print axioms`` is either a statement (an
   assumption) or on the archive environment's whitelist of background axioms.
   Any other axiom — such as ``sorryAx`` — is forbidden.

## Annotations

We use docstrings to annotate concepts, atoms, and proofs. Atoms and proofs
carry ordinary declaration docstrings ``/-- … -/``. Concepts are annotated
by a module docstring ``/-! … -/`` placed directly before the ``namespace``
that opens them — legal vanilla Lean, associated with the namespace
positionally by the checker.

Each annotation is a docstring that we parse as markdown with optional yaml
frontmatter (common pattern for static site generators). When placing the whole
docstring into json, the markdown at the end gets placed into the
``description`` key

    /--
    ---
    key1: value
    key2: value
    key3: value
    ---
    description
    -/

When no frontmatter is given we do the following: For concepts and axioms, we
parse the #-headline as ``title`` key and everything below as ``description``
key. For proofs, we parse the #-headline as ``conclusion`` key and everything
below as ``description`` key.

An example module within the concept package:

    namespace Mysubmission.Cpts

    /-!
    # Title of concept A
    description of concept A 
    -/
    namespace A

    /-- 
    # Title of atom X
    description of atom X
    -/
    axiom X [...]

    [...]

    end A

    /-!
    ---
    title: title of concept B
    ---
    description of concept B
    -/
    namespace B

    [...]

    end B

    end Mysubmission.Cpts


An example module within the proof package:

    namespace Mysubmission.Prfs

    /--
    # Mysubmission.Cpts.Myconcept.Mystatement
    description of proof P
    -/
    theorem P ...

    /--
    ---
    conclusion: Mysubmission.Cpts.Myconcept.Mystatement
    ---
    description of proof Q
    -/
    theorem Q ...

    end Mysubmission.Prfs


Further rules:

- A ``/-! … -/`` must be immediately followed by a ``namespace`` command and
  annotates the namespace it opens; every other placement is rejected.
- A concept namespace may be opened many times (even across modules), but
  must be annotated at exactly one opening. (Atoms directly in
  ``Mysubmission.Cpts`` would belong to no concept and are rejected.)
