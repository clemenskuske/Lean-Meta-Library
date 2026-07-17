# Vision

The archive is the social and archival layer for automated Lean formalization.

**Social:** Lean's kernel checks proofs for free, but it cannot check whether
a formal statement means what it claims to mean. The archive aims to provide the
missing trust: reviewers can publicly endorse formalizations as faithful,
staking their names on them. 

**Archival:** what arXiv is to preprints, the archive shall be to formalized
mathematics: a decentralized network of independent citable submissions
building on top of each other.


## Concepts and Proofs

The archive's content comes in two kinds.

A **concept** pairs a well-defined mathematical object presented in natural
language (a definition or theorem statement as it would appear in a paper),
with a faithful encoding of that object in Lean. Crucially, concepts contain no
proofs: they carry exactly the information needed to pin down the semantics of
a natural-language statement or definition within Lean, and nothing more.
Concepts are especially clean Lean code written for and in collaboration with
humans.

A **proof** is ordinary Lean code certifying a claim made by a concept. Since
the kernel checks its correctness, writing proofs can be outsourced entirely
to AI agents without compromising trust.

A **submission** is a single citable unit of work containing concepts and
proofs. The two are decoupled: a submission may leave its own proof
obligations open, and may discharge obligations of other submissions.


## Datastructures

Within a submission, the concepts form its **concept package** and the proofs
its **proof package**. Concepts consist of **atoms** (single Lean
declarations); atoms that assert something are **statements** — the claims of
the archive. Concepts reference each other, within and across submissions,
forming the **concept DAG**. A proof derives a single statement from a set of
assumed statements. Together, proofs weave the statements of the archive into
the **proof network**. Precise definitions follow in the Abstract
Datastructures section.

Every statement thus carries two orthogonal quality signals:

- **proven** — machine-checked, computed by the kernel from the proof network;
- **faithful** — the Lean code means what its description claims. No machine
  can check this; producing this signal is the job of the trust layer.


## Versioning

Unlike mathlib, the archive is not a curated library: submissions are
independent and frozen in time, cited like papers rather than merged like
modules of a monorepo. Freezing makes it easy for later submissions to build
on earlier ones, allowing the organic growth of a dependency network mirroring
the citations of scientific publications. Freezing also underpins the trust
layer: an endorsement pins immutable content, not a moving target. The price
is that mistakes cannot be fixed in place: like a published paper, a flawed
submission is superseded, not patched. To keep frozen submissions buildable, we pin the versions of Lean,
Lake and mathlib.

Bumping the pins later (new toolchain, new mathlib) invalidates every
submission so far. We have no plan how to handle this yet and will figure it
out as we go.


# Metadata Full Reference

Each submission carries two central files: ``manifest.yaml``, written by the
author, and ``artifacts.json``, derived by the build. Some fields will only
start making sense once you have read the whole document.

## manifest.yaml

- manifestVersion: version of the manifest format.

- id: The archive-assigned opaque id ``LaxN``, where N is a natural number.
  Absent on the very first submit. Every later submit carries it as a given
  key.

- title: A non-unique title, like the title of the paper the submission formalizes.

- authors: An ordered, possibly empty, list of typed entries, each an ORCID id
  or a GitHub handle. Used for credit only, not rights-management.

- owners: A non-empty list of GitHub handle forming the owner set. Used for
  rights-management only, not credits.

- draft: Whether the submission is still an overwritable draft. Submitting
  with ``draft: false`` registers it. Irreversible.

- supersedes: Id of the submission this one supersedes. Optional. See
  Lifecycle.

- leanVersion, mathlibVersion: The environment the submission was built
  against; must match the archive environment.

- abstractPath, licenseFile, bibEntries: Pointers to abstract and license (an
  accepted open license required), plus bibliography entries.

## artifacts.json

This contains build artifacts and mostly information derived from the source
code and consumed by the website. For example, the individual concepts of a
submission. TBD.



# The Social Layer

## The Submission Layer

An **owner** is a GitHub account listed in a submission's owner set, and is
thereby allowed to act on the submission (e.g., submitting and editing).
Owners take action on the submission layer.

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus stays
in the authors' repositories and attribution is clear. (To guard against link
rot, we may keep backup copies, e.g. via
https://archive.softwareheritage.org/save/.)

### Lifecycle

Submissions can be in four possible states.

**local:** the submission starts on the dev machine. Our tooling checks
whether it would be accepted and previews it on a local copy of the website.

**draft:** visible on the website, overwritable by its owners, not citable,
not reviewable, not allowed to be used in downstream submissions.

**registered:** immutable, citable, reviewable. The normal terminal state.

**superseded:** still immutable, citable, and reviewable, but carrying a
prominently displayed pointer to its successor. Downstream submissions may
still depend on superseded submissions.

### Actions

TODO: I think we should allow an init submission action that takes a folder containing only the bare minimum manifest (only author names are required?), registers an id, and puts it into the manifest.
changes to propagate: submit does not allow empty submissions anymore. also text here and there...

Opaque ids prevent the squatting of nice names like ``RamseyTheory``.

Every action happens via our CLI tool. It has exactly one write action,
**submit**, which hands the archive a (repository, commit, folder) triple. The
manifest inside decides what the submit means:

- **has no id** — creates a new draft submission. Requires ``draft: true``. The new
  submission has id ``LaxN``, where N is the next free natural number.
- **has id of a draft submission** — overwrites the draft.
- **has draft: false** — registers the submission.
- **has supersedes: LaxN** — declares the submission the successor of ``LaxN``.

The action is **authorized** if the submitting GitHub account appears in the
owner list of the submitted manifest. If the submission references an existing
id (``id`` or ``supersedes``), we further require the account to appear in the
owner list of that submission (as stored by the archive).

Supersession is self-replacement, as on arXiv. It takes effect when the
successor is registered, and is accepted only if ``LaxN`` is registered and has
no successor yet (plus the owner condition above). Successors thus form a
chain. Revocation amounts to superseding by an empty submission.

### License

To display the submission on our website and to make and serve backup copies, we require submissions to be poperly licensed.
TODO: what license(s) do we accept?


## The Trust Layer

A **reviewer** is a verified ORCID identity (via OAuth) with a real-world name,
leading to trust by reputation. Reviewers act on the trust layer.

### Endorsements and Flags

Reviewers can **endorse** and **flag** individual concepts. Both are public
verdicts staked on the reviewer's verified ORCID and performed explicitly on
the website — endorsement is opt-in, never implied by authorship.

**Endorsing** means signing the following attestation, displayed at the moment
of endorsement:

    I have read this concept's description and its Lean code, and I attest
    that the code faithfully formalizes the description.

    This concept directly uses the following upstream concepts: (list). I
    have read their descriptions and interpreted their Lean names
    accordingly. My endorsement is conditional on each of them faithfully
    matching its own description.

Endorsements are local: the endorser reads upstream descriptions, not upstream
code — upstream faithfulness is someone else's endorsement. Endorsements are
revocable.

A **flag** is the opposite verdict and requires a message outlining the
problem. A flag is a staked claim, not a final verdict: it stands until the
flagger retracts it. The natural fix for a
justified flag is superseding the submission, since content is frozen.

### Trust Calculus

The **trust level** of a concept A is the minimum number of endorsements over
the concepts in the concept DAG rooted at A (including A itself). The trust
level is just a proxy, and the real trust lies in checking and trusting the
individual names behind the endorsements.

Consequences and display rules:

- Trust 0 means nobody has vouched for some concept in the rooted DAG, not even
  its author.
- The website shows the weakest link: the concepts attaining the minimum are
  exactly where review effort should go.
- Self-endorsements are not treated specially in the count. Instead, the
  concept page shows the author and endorser lists, so the check for
  self-endorsement is only one click away.
- An open flag anywhere in the rooted DAG is displayed prominently next to the
  trust level, but does not alter the number: a flag is a claim, not a verdict.


## Beyond this Prototype

We would later need maintenance mechanisms, anti-spam measures, etc. We
intentionally don't discuss them for now.






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

An **Atom** is a declaration within the concept package. An atom declared by
``axiom`` is called a **statement**. The lean dialect of the concept package
controlls which atoms are allowed.

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

We annotate atoms, concepts, and proofs with various key-value pairs. The list
of required and optional keys may later be exteneded.

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




# Concept Lean Dialect

TODO: I am very unsure about this section. I think it should be checked with a real lean expert?

Modules of the concept package are written in a restricted dialect of Lean. Its
purpose is **locality**: the unit of review on the website are individual
concepts. Therefore the meaning of atoms must be reconstructible from its
source text, its fully-qualified id, and its dependencies alone — a reviewer
never consults the surrounding module. Any command that invisibly mutates
elaborator state breaks locality.

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

- TODO: no deriving, no extends on class?

## Aliases

An **alias** is an atom that merely re-exposes another atom, its **target**,
under a new id (like a symlink). The target may be an atom of the same or of
another submission, and its semantics are exactly those of the target.
Concretely, an alias is an ``abbrev`` whose body is exactly one fully-qualified
constant naming another atom; the checker recognizes this shape and records the
alias-of relation.

Statements cannot be aliases (an ``abbrev`` whose body is an ``axiom`` is a
proof-valued definition, not a statement).





# Full Specification Valid Submissions

This section provides all remaining details on what it means for a submission
to be accepted by our system.

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

Every **submit** hands the archive a (repository, commit, folder) triple. The
archive runs its checks and, on success, records the triple under the
submission's id. Only registered submissions can be referenced by other
submissions.

Implementation note: The submitting account authenticates via GitHub OAuth
(the submit tool can reuse a ``gh`` login).

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

``manifest.yaml`` holds the given metadata (see the Metadata Full Reference): the
submission's id and title, authors, pointers to abstract and license,
bibliography entries, and the environment it was built against.
This environment must match the archive environment. Example:

    manifestVersion: "1"
    id: Lax261              # absent on the very first submit; assigned by the archive
    draft: true             # submit with false to register
    leanVersion: "v4.30.0"
    mathlibVersion: "c5ea00351c28e24afc9f0f84379aa41082b1188f"
    title: My Submission
    TODO: authors should be a list of tuples!
    authors:
      - orcid: "0000-0002-1825-0097"
      - github: bob
    owners: ["alice"]
    abstractPath: abstract.tex
    licenseFile: LICENSE
    bibEntries: []
    supersedes: Lax042      # optional, see Lifecycle

Implementation note: The registry is ``submissions.jsonl`` in the root of the
archive repository, one line per registered submission.

Further rules (to discuss):

- **File whitelist.** A submission may only contain whitelisted file types
  (``.lean``, ``.tex``, ``.yaml``, ``.json``, ``.bib``, ``.md``, ``.txt``, plus
  ``lean-toolchain``, ``LICENSE``, ``README``) and must stay within the
  archive-wide size limits.

- **License.** The submission must carry one of the accepted open licenses.
  TODO: Do we check that the license verbatim matches (and suggest a copy from
  our download side if they dont?


## Packages

Each submission ``Lax261`` contains two Lake packages: a **concept
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

- **Dependencies.** As stated above (and besides mathlib), concept packages can
  only require concept packages and proof packages may require both. We issue a
  warning when a proof package is required. Mathlib must be pinned to the
  archive-wide revision. Proof and concept packages are added by pinning the
  full commit hash and subfolder of the submission's repository. Every such
  (repository, rev, subfolder) triple must resolve to a registered submission.
  Only exception: The proof package may require its own concept package via a
  relative path to the folder.

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


## Generated Artifacts

TODO: give a clean description of artifacts.json.
it should contain everything extracted during build and required for website display.


# Submission Layer Tooling

TODO: describe the cli used to build and check submission.
Emphasis should be placed on the local build that creates the artifacts.json required for local website building
and the second step that creates the website from the artifacts.json


-----------------------------
TODO
here are some notes from a very early draft of the spec. take it or leave it. i have no emotional attachment to these earlier ideas and its probably good to rethink them.

## building submissions implementation

Probably we want to have a wrapping package with our own package cache location and imports of dependencies filtered from the submission yaml 

This would help us
- to have a flag to reset the package folder with the mathlib
- Build multiple submissions in parallel?


## global substitutioncheck
"lml build fullproofs rootdir" chains all the different axioms and proofs together into a full proof tree for every proven statement. no trust needed. the most paranoid check avaliable. Considers only submissions contained in rootdir (recursively scans for metadata.yaml files to identify submissions). So to do it on the server, one needs to place all submissions into the rootdir.

## building the website
"lml build website target1 target2 ...", where each target is of either of the following types
- submission.jsonl (to append multiple entries)
- submission.json (to append single entries)
This creates a static website containing all targets

-----------------------------




# Website

This is a work in progress. I am just gathering some thoughts here to later turn into a proper website layout.

## People ranking

rank people with respect to multiple criteria (mixes reviewer and author stats)
- verified concepts
- flaged concepts
- created proofs

## Person page

Shows the identity of the person and their statistics (nr of approvals, nr of flags, nr of submissions etc)

