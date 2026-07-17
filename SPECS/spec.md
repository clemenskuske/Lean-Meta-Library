# Vision

The archive is the social and archival layer for automated Lean formalization.

**Social:** Lean's kernel checks proofs for free, but it cannot check whether
a formal statement means what it claims to mean. The archive provides the
missing trust: contributors publicly endorse formalizations as faithful,
staking their names on them. 

**Archival:** what arxiv is to preprints, the archive is to formalized
mathematics — a decentralized network of independent citable submissions
building on top of each other.


## Concepts and Proofs

The archive's content comes in two kinds.

A **concept** pairs
- a well-defined mathematical object (such as a definition or theorem
  statement as it would appear in a paper), presented in natural language, with
- a faithful encoding of that object in Lean.
Crucially, concepts contain no proofs. They carry the minimal information
needed to fully specify the semantics of a natural-language statement or
definition within Lean, but nothing more. Concepts are especially clean Lean
code written for and in collaboration with humans: they are the trusted
surface of the archive.

A **proof** is ordinary Lean code certifying a claim made by a concept. Since
the kernel checks its correctness, writing proofs can be outsourced entirely
to AI agents without compromising trust.

A **submission** is a single ...
containing concepts and proofs.
Proofs and concepts of a submission are decoupled: A submission may leave its
own proof obligations open, and may discharge obligations of other submissions.

## Datastructures

TODO: write a gentle introduction focusing on the intuition behind and introducing the basic datastructures.
This may include the following, but it actually depends on what is used in the social layer section and therefore requires forshadowing.
- submission
- concept and proof Packages
- atoms, statements
- concepts
- proofs
- what it means for a statement to be proven.


## Versioning

Unlike mathlib, the archive is not a curated library: submissions are
independent and frozen in time, cited like papers rather than merged like
modules of a monorepo. Freezing makes it easy for later submissions to build
on earlier ones, allowing the organic growth of a dependency network mirroring
the citations of scientific publications. The price is that mistakes cannot be
fixed in place: like a published paper, a flawed submission is superseded, not
patched. To keep frozen submissions buildable, we pin the versions of Lean,
Lake and mathlib.

Bumping the pins later (new toolchain, new mathlib) invalidates every
submission so far. We have no plan how to handle this yet and will figure it
out as we go.

===================================================================

# Social Layer

The kernel settles correctness. Everything else the archive promises (meaning,
trust, naming, credit) is social.

## Identities and Authorship?

TODO
We need github and orcid Identities, both serving different roles. outline here.
what is the clear split between these two identities?

old paragraph:

All social actions are performed by
**contributors**, identified by their ORCID. Contributors are pseudonymity-free
by design: the trust layer works by reputation staking, not by tallying
anonymous votes.

In this early phase, we do not need fancy rights management (yet?) to guard who can endorse or submit, anyone with an identity can.



submissions with concepts require at least one orcid author.
proof-only submissions may do without orcid.
This means every concept has a list of authors,
while encouraging anonymous outsiders to discharge proof obligations.

## Lifecycle

local - Submission starts on the dev machine. use our tooling to check if it is accepted by our system and to see how it would look on a local copy of the website.

work-in-progress — freely overwritable, not citable, not allowed to be used in downstream submissions.

registered — frozen, citable, reviewable. The normal terminal state.

superseded — still frozen, still citable and buildable, but carrying
a pointer to a successor submission. Set by the authors. Downstream
submissions may still depend on superseded submissions; the website
displays the successor prominently.

TODO: how do we handle superseding best? a new submission sets the "supersedes:id" entry in the new submission,
and the owners of the old submission need to confirm this on the website? or do you have better ideas?

withdrawn — tombstoned by authors or moderation (license violation,
plagiarism, spam). Still resolvable so that dependents do not break, but
marked, excluded from search, and barred from new dependencies.


## metadata

Submission metadata splits into **given** keys and **derived** keys, computed by the archive at
registration.

**Given.**
    - title: a non-unique title, like the title of the paper the submission formalizes 
    - AuthorsORCID: a list of ORCID ids. May only be empty for proof-only submissions.
    - AuthorsGitHub: a list of GitHub handles. May be empty.
    - TBD

**Derived.** 
- id: the archive-assigned opaque id ``LaxN``, see Implementation Details
- the repository and commit the submission was registered from
- later also the backup link?



## Endorements and Flags

contributors can **endorse** and **flag** individual concepts.
These are public verdicts involving social stake.

For endoresement, the contributor has to agree to the following text or similar.
todo: currently the text is a bit strange. can we improve it?

    I have read this concept's Lean code and and confirm it faithfully represents its
    description.

    I read the descriptions of the 3 upstream concepts it uses (twin-width, graph classes,
    FO logic), and my endorsement is conditional to the assumption that the upstream concepts' lean code faithfully represents them.

This is supposed to mean endoresemtns are "local" and that reviewers dont need to transitively review everything.

For a flag, its required to give a message outlining the problem.

## Trust Calculus

The trust level of a concept A is the minimal number of endoresements on the concepts in the concept dag rooted at A.
An endoresement is a self-endorsement if the person doing it is author of the concept.
The trust level should be displayed as: X (Y excluding self-endorsements).
Probably with a clean explaination on the website that redefines what the trust level actually is.
If some concept in the dependency has a flag, this should be displayed even more prominently next to the trust level.


## Maintainers

TODO

Maintainers can
- undo flags/endorsements of concepts
- ban contributors?
- what else?



===================================================================


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
whose assumptions are (recursively) proven, and **unproven** otherwise. More
generally, a statement is **proven relative to** a set C of statements if it
becomes proven once the statements in C are taken as proven.


## Key-Value Annotations

We annotate submissions, atoms, concepts, and proofs with various key-value pairs. The list
of required and optional keys may later be exteneded.

Submission:
    - all the keys listed in the socal section and maybe some more?

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

Each submission has an **id**, assigned by the archive: ``LaxN`` where ``N``
is the registration number (e.g. ``Lax261``). Ids are opaque and permanent and
double as the Lean namespace; human-readable naming lives in the title
metadata. Opaque ids prevent the squatting of nice names like
``RamseyTheory`` and by construction cannot collide with a top-level namespace
of the trusted base. Since the id appears in lakefiles and module paths,
authors reserve the id first, bake it into the submission, and then register
the finished commit.

The folder layout is fixed (example for a submission with id ``Lax261``):

    mysubmission/
      manifest.yaml
      concepts/
        lakefile.toml
        lean-toolchain
        lake-manifest.json
        Lax261/...                 -- modules of the concept package
      proofs/
        lakefile.toml
        lean-toolchain
        lake-manifest.json
        Lax261Proofs/...           -- modules of the proof package

The concepts and proofs package folders are literally named ``concepts`` and
``proofs``, since other submissions reference them via ``subDir`` in the
lakefile.

``manifest.yaml`` holds the metadata: the submission's id and title,
pointers to abstract and license, bibliography entries, and the environment
it was built against. This environment must match the archive environment.
Example:

    manifestVersion: "1"
    id: Lax261
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

Each submission ``Lax261`` creates two Lake packages: a **concept
package** ``Lax261`` containing its concepts and atoms and a **proof
package** ``Lax261Proofs`` containing its proofs.

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

- **Fixed names.** The package name and the name of the single ``lean_lib``
  are both ``Lax261`` resp. ``Lax261Proofs``; the lib is the only default
  target. With Lake's default layout, module files therefore live under
  ``Lax261/`` resp. ``Lax261Proofs/``.

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

    # mysubmission/concepts/lakefile.toml
    name = "Lax261"
    defaultTargets = ["Lax261"]

    [[require]]
    name = "mathlib"
    git = "https://github.com/leanprover-community/mathlib4"
    rev = "c5ea00351c28e24afc9f0f84379aa41082b1188f"   # archive-wide pin

    # concept package of another submission this one builds on
    [[require]]
    name = "Lax042"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "concepts"

    [[lean_lib]]
    name = "Lax261"

Example ``lakefile.toml`` of the corresponding proof package:

    # mysubmission/proofs/lakefile.toml
    name = "Lax261Proofs"
    defaultTargets = ["Lax261Proofs"]

    [[require]]
    name = "Lax261"
    path = "../concepts"

    # discouraged, but allowed: reusing another submission's proofs
    [[require]]
    name = "Lax042Proofs"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "proofs"

    [[lean_lib]]
    name = "Lax261Proofs"

## Namespaces

Each submission with id ``Lax261`` owns two top-level namespaces: its atoms
live in ``Lax261`` and its proofs in ``Lax261Proofs``. All atoms of a concept
``Myconcept`` are placed within the namespace ``Lax261.Myconcept``. Both
proofs and atoms may be arbitrarily nested within subnamespaces.

Example:
- id of submission: ``Lax261``
- id of an atom of concept ``Myconcept`` within the submission:
  ``Lax261.Myconcept.OptionalNestedSubNamespaces.Myatom``
- id of a proof within the submission:
  ``Lax261Proofs.OptionalNestedSubNamespaces.Myproof``

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

    namespace Lax261

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

    end Lax261


An example module within the proof package:

    namespace Lax261Proofs

    /--
    # Lax261.Myconcept.Mystatement
    description of proof P
    -/
    theorem P ...

    /--
    ---
    conclusion: Lax261.Myconcept.Mystatement
    ---
    description of proof Q
    -/
    theorem Q ...

    end Lax261Proofs


Further rules:

- A ``/-! … -/`` must be immediately followed by a ``namespace`` command and
  annotates the namespace it opens; every other placement is rejected.
- A concept namespace may be opened many times (even across modules), but
  must be annotated at exactly one opening. (Atoms directly in
  ``Lax261`` would belong to no concept and are rejected.)

# Website

This is a work in progress. I am just gathering some thoughts here to later turn into a proper website layout.

## Contributor ranking

rank contributors with respect to multiple criteria
- verified concepts
- flaged concepts
- created concepts
- created proofs


## Contributor page

Shows the identity of the contributor and their statistics (nr of approvals, nr of flags, nr of submissions etc)

