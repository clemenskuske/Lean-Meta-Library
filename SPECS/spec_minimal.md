# Vision

The archive is shall serve as social and archival layer for automated Lean
formalization.

**Social:** Lean's kernel checks proofs for free, but it cannot check whether
a formal statement means what it claims to mean. The archive aims to provide the
missing trust: reviewers can publicly endorse formalizations as faithful,
staking their names on them. 

**Archival:** what arXiv is to preprints, the archive shall be to formalized
mathematics: a decentralized network of independent citable submissions
building on top of each other.

This document describes an absolutely minimal version of this product.
Everything non-essential is postponed to later. At the same time, we try to get
those things right that cannot be easily changed later.


## Concepts and Proofs

The archive's content comes in two kinds.

A **concept** pairs a well-defined mathematical object presented in natural
language (a definition or claim as it would appear in a paper),
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


## Versioning

Unlike most software projects where code freely changes over time, submissions
are frozen in time. This makes it possible to build upon and cite previous
submissions, allowing the organic growth of a dependency network mirroring that
of scientific publications. We understand that this brings along its own
problems, which we believe are worth it. In particular, we pin the version of
lean, lake and mathlib.



# Submission Layout

This section gives the full rule set that all submissions in the archive must
adhere to.

Each submission carries two central files in the root folder:
``manifest.yaml``, written by the authors, and ``build-output.json``, derived by
the build.

## Archive Environment

We fix the following **archive environment**:

- ``specVersion: "1"``
- pinned Lean toolchain (which also fixes the lake version),
    - v4.30.0
- trusted background imports
    - mathlib, pinned to revision ``c5ea00351c28e24afc9f0f84379aa41082b1188f``
- build options 
  - concept packages: 
    - ``autoImplicit`` off
    - ``enableArtifactCache`` on
  - proof packages:
    - ``enableArtifactCache`` on
- allowed background axioms in proofs 
    - ``propext``, 
    - ``Classical.choice``,
    - ``Quot.sound``,


## File Structure

A submission rooted at folder ``mysubmission`` with id ``Lax261`` **must** have the following folder layout with the following files.

    mysubmission/
      manifest.yaml
      abstract.md
      LICENSE
      concepts/                    
        lakefile.toml
        lean-toolchain
        Lax261/...                 -- modules of the concept package
      proofs/                      
        lakefile.toml
        lean-toolchain
        Lax261Proofs/...           -- modules of the proof package

Additional Rules:

- **License.** The file ``LICENSE`` in the submission root folder must contain
  an accepted license, matched against the canonical text after whitespace
  normalization. For the MVP we accept exactly one license: the **Apache
  License 2.0**, the license of Lean and mathlib. 

- **Abstract.** ``abstract.md`` must be valid markdown. This abstract will be
  shown prominently on the website.

- **Files.** Generated data must not be checked in, in particular
  ``build-output.json`` and ``lake-manifest.json``.

## manifest.yaml

The file ``manifest.yaml`` must contain the following keys and adhere to the following rules.

- ``specVersion``: version of the spec this submission adheres to
- ``mathlibVersion``: version the submission was built against
- ``leanVersion``: version the submission was built against

- ``id``: The archive-assigned unique id. must be of form ``LaxN`` for a natural number N written without leading zeros.

- ``title``: A non-unique title, like the title of the paper the submission formalizes.

- ``authors``: An ordered, possibly empty, list of author entries. Each entry is a
  tuple with a required ``name`` (display name) and optional ``orcid`` and
  ``github`` identifiers. Used for credit only, not rights-management.

- ``bibEntries``: a possibly empty list of bibtex entries.

Additional Rules:
- ``specVersion``, ``leanVersion``, ``mathlibVersion``: must match the archive environment for now

Example:

    specVersion: "1"
    id: Lax261             
    leanVersion: "v4.30.0"
    mathlibVersion: "c5ea00351c28e24afc9f0f84379aa41082b1188f"
    title: My Submission
    authors:
      - name: Alice Smith
        orcid: "0000-0002-1825-0097"
        github: alice
      - name: Bob
        github: bob
    bibEntries: []



## Packages

Each submission ``Lax261`` contains two Lake packages: a **concept
package** ``Lax261`` containing its concepts and a **proof
package** ``Lax261Proofs`` containing its proofs.

We only allow ``lakefile.toml``, never ``lakefile.lean``, and enforce the
following rules:

- **Whitelisted keys only.** The file may contain exactly ``name``,
  ``defaultTargets``, ``[[require]]`` entries, and one ``[[lean_lib]]``.
  Additionally build-options must match archive environment.

- **Fixed names.** The package name and the name of the single ``lean_lib``
  are both ``Lax261`` resp. ``Lax261Proofs``. The lib is the only default
  target. With Lake's default layout, module files therefore live under
  ``Lax261/`` resp. ``Lax261Proofs/``.

- **Dependencies.** As stated above (and besides mathlib), concept packages can
  only require concept packages and proof packages may require both. We issue a
  warning when a proof package is required. Mathlib must be pinned to the
  archive-wide revision. Proof and concept packages are added by pinning the
  full commit hash and subfolder of the submission's repository. Every such
  (repository, rev, subfolder) triple must resolve to a registered or.
  Only exception: The proof package may require its own concept package via a
  relative path to the folder.

- **Root modules.** Each package has a root module (``concepts/Lax261.lean``
  resp. ``proofs/Lax261Proofs.lean``) consisting of exactly one ``import``
  line per module of the package and nothing else, so that the default target
  builds everything. (This is the standard Lean layout — mathlib's
  ``Mathlib.lean`` works the same way.)

- **Empty Submission.** It is allowed that the submission contains no concept
  and no proof. Maybe useful to simulate revocation.

- **Pinned toolchain.** ``lean-toolchain`` must contain the archive-wide
  toolchain verbatim.

- **Lock file.** ``lake-manifest.json``, Lake's lock file, must not be checked
  in. It carries no information the lakefile does not already determine: every
  ``[[require]]`` pins a full commit hash, so resolution is deterministic. The
  rule is about version control, not the filesystem: a local build leaves the
  file behind as a byproduct, which is fine and expected. Enforcement therefore
  asks git whether the file is tracked at the submitted commit.

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
    name = "Lax42"
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
    name = "Lax42Proofs"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "proofs"

    [[lean_lib]]
    name = "Lax261Proofs"

## Namespaces

Each submission with id ``Lax261`` owns two top-level namespaces: its concepts 
live in ``Lax261`` and its proofs in ``Lax261Proofs``. 

## Concepts

A **concept** is a Lean module of the concept package; every module except
the root module is one, and must carry the concept annotation (see
Annotations). Helpers therefore have no place outside concepts — worst case,
they go into a "preliminaries" concept. The concept ``Myconcept`` of
submission ``Lax261`` is the module ``Lax261.Myconcept``, stored at Lake's
canonical path ``concepts/Lax261/Myconcept.lean``.

Every declaration of the module must live in the namespace equal to the module
name, e.g. ``Lax261.Myconcept``. Further subnamespaces are allowed. An
``axiom`` declaration in the module is called a **statement** of the concept.
Statements are to be discharged by proofs.

A concept may import mathlib modules and other concept modules (of the same or
of other submissions). The **concept DAG** is the DAG with outgoing edges to
each included module.

Additional Rules:

- **Sorry-free.** The axiom set (``#print axioms``) of every declaration may
  contain only the archive environment's background axioms. In particular
  ``sorryAx`` is forbidden.

### Future work: Lean Dialect for Concepts

These are ideas for later that we want to ignore now. just writing them down
for future reference.

We want to ensure that concepts are written in a lean dialect in which it is
safe to execute untrusted code. Given the small initial community, we postpone
this. 

Later, we may want to decompose concepts into individual declarations with a
dependency DAG on them, such that the semantics of a concept can be derived by
only looking at the declarations reachable in the DAG. We call this "locality".
This seems like quite a challenge as in lean there are a million ways for code
to have non-local side-effects. I dont think we can implement this without
feedback from Lean experts.

## Proofs

A **proof** is a ``theorem`` in the proof package whose docstring frontmatter
carries the ``conclusion`` key. All other declarations are helpers and are
ignored by the archive. Its **conclusion** is the statement named by that
key; its **assumptions** are the statements occurring in the theorem's axiom
set (as reported by ``#print axioms``). The optional ``assumptions`` key,
when present, must list exactly the assumptions the inspector computes (a
redundant sanity check for authors, not an input).

Rules:

- The ``conclusion`` id resolves to an ``axiom`` in the concept package of
   some submission.

- The theorem's type is definitionally equal to the conclusion's type (kernel
   check).

- Every axiom reported by ``#print axioms`` is either a statement or on the
   archive environment's whitelist of background axioms. In particular,
   ``sorryAx`` is forbidden.

- Every declaration of the proof package lives in the namespace
   ``Lax261Proofs``; further subnamespaces are allowed.

Together, the proofs weave the statements of the archive into the **proof
network**: the directed hypergraph over all statements with a hyperedge
(A → c) for every proof with assumption set A and conclusion c. A statement
is **proven** if it is the conclusion of some proof all of whose assumptions
are (recursively) proven, and **unproven** otherwise. More generally, a
statement is **proven relative to** a set C of statements if it becomes
proven once the statements in C are taken as proven.

## Annotations

Each annotation is a docstring that we parse as markdown with optional yaml
frontmatter (a common pattern from static site generators). When later parsing
this docstring into key-value pairs, the markdown after the frontmatter is
placed into the ``description`` key.

    /--
    ---
    key1: value
    key2: value
    ---
    description
    -/

The recognized keys (the list may later be extended):

Atoms
    - ``title`` (optional): natural-language name
    - ``description`` (optional)

Concept
    - ``title`` (required): natural-language name of the mathematical object,
      like "Ramsey's Theorem"
    - ``description`` (required): the natural-language description of that
      object. The whole validity of the archive rests on the assumption that
      the Lean side of the concept faithfully represents this description.

Proof: 
    - ``conclusion`` (required)
    - ``assumptions`` (optional, see Proofs);
    - ``description`` (optional): additional information, like attribution or
      the high-level idea.

A concept is annotated by the module docstring ``/-! … -/`` at the top of its
file.

An example concept module ``concepts/Lax261/Myconcept.lean``:

    import Mathlib.Combinatorics.SimpleGraph.Basic
    import Lax42.Colorings

    /-!
    ---
    title: Title of the concept
    ---
    description of the concept
    -/

    namespace Lax261.Myconcept

    /-- description of atom X -/
    axiom X [...]

    [...]

    end Lax261.Myconcept


An example module within the proof package:

    import Lax261.Myconcept

    namespace Lax261Proofs

    /--
    ---
    conclusion: Lax261.Myconcept.X
    ---
    description of proof Q
    -/
    theorem Q ...

    end Lax261Proofs


# Archive Database

The archive stores one folder per allocated id. ``LaxN/record.json`` holds the
mutable lifecycle data: state, owner set, the current (repository, commit,
folder) triple. ``LaxN/build-output.json`` holds
the build output, frozen on registration. This folder tree is the canonical
state of the archive; everything else (website, indexes) is derived. The
database is a single public git repository with a single writer, and every user
holds a read-only clone of it at ``~/.lax/db``. The path is
deliberately visible, so AI agents can use it to survey existing submissions
and find prior work to build upon. Installing the CLI clones the repository. 
We now describe the content of the two types of files.

Example ``record.json``

    {
      "specVersion": "1",
      "id": "Lax261",
      "state": "registered",
      "owners": ["alice", "bob"],
      "source": {
        "repository": "https://github.com/alice/mysubmission",
        "commit": "0123456789abcdef0123456789abcdef01234567",
        "folder": "."
      }
    }

- ``owners``: GitHub handles, non-empty, immutable after registration.
- ``source``: the (repository, commit, folder) triple; absent in the init
  state, frozen on registration.



Example of ``build-output.json``

    {
      "specVersion": "1",
      "id": "Lax261",
      "manifest": { ... },
      "dependenciesConcepts": ["Lax42"],
      "dependenciesProofs": ["Lax42Proofs"],
      "concepts": [ ... ],
      "proofs": [ ... ]
    }

- ``manifest``: the parsed content of ``manifest.yaml``.
- ``dependenciesConcepts`` resp. ``dependenciesProofs``: the package names
  required by the concept resp. proof package. Mathlib and the proof
  package's path-require of its own concept package are omitted.

Each entry of ``concepts``:

    {
      "name": "Lax261.Myconcept",
      "path": "concepts/Lax261/Myconcept.lean",
      "title": "...",
      "description": "...",
      "imports": ["Lax42.Colorings"],
      "sourceText": "...",
      "atoms": [
        {
          "id": "Lax261.Myconcept.X",
          "kind": "axiom",
          "title": "...",
          "description": "...",
          "signature": "X : ..."
        }
      ]
    }

``title`` and ``description`` come from the annotations; optional keys are
absent when not given. ``imports`` lists imported concept modules only —
mathlib imports are dropped. ``sourceText`` is the verbatim file content, so
the website can display concept code without access to the repository.
``kind`` is the declaring command; ``signature`` is the pretty-printed type.

Each entry of ``proofs``:

    {
      "id": "Lax261Proofs.Q",
      "path": "proofs/Lax261Proofs/Basic.lean",
      "conclusion": "Lax261.Myconcept.X",
      "assumptions": ["Lax42.Colorings.Somestatement"],
      "description": "..."
    }

``assumptions`` is always the inspector-computed set, regardless of whether the
author supplied the redundant ``assumptions`` key. Proof entries carry no
``sourceText``: the website lists proofs, it does not display their code.






# The Archival Layer

An **owner** is a GitHub account listed in a submission's owner set, and is
thereby allowed to act on the submission (e.g., submitting and editing).
Owners take action on the submission layer.

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus stays
in the authors' repositories and attribution is clear. (To guard against link
rot, we may later keep backup copies, e.g. via
https://archive.softwareheritage.org/save/.)

## Lifecycle

Submissions can be in four possible states within our database.

**init:** an id and owner set have been allocated for this submission, but
nothing has been uploaded yet.

**draft:** visible on the website, overwritable by its owners, not citable,
not reviewable, and not allowed to be used in downstream submissions.

**registered:** immutable, citable, reviewable. The normal published state.

The only state transitions are:

- ``-> init``,
- ``init -> draft``
- ``init -> registered``
- ``draft -> draft``
- ``draft -> registered``

## Actions

Opaque ids prevent the squatting of nice names like ``RamseyTheory``.

Every archive action happens via our CLI tool. It has three write actions:
``init`` allocates an id, ``submit`` uploads or registers content, and
``set-owners`` edits the owner set.

**Init.** ``lax init`` takes an empty local folder. The archive reserves the
next free id ``LaxN`` and creates a record in the init state whose
owner set contains exactly the authenticated GitHub account. The CLI then
scaffolds the complete submission layout for that id, including a
``manifest.yaml`` carrying the id.

**Set-owners.** ``lax set-owners`` replaces the owner set of a submission in
the init or draft state. The authenticated GitHub account must be in
the current owner set and may not remove itself; the new set must be non-empty.
The owner set becomes immutable on registration.

**Submit.** ``lax submit`` hands the archive a (repository, commit, folder)
triple. The folder must contain a complete valid manifest with id. The
corresponding submission must be in the init or draft state, and the
authenticated GitHub account must occur in the record's stored owner set.

- Without ``--register``, a successful submit puts the submission in the
  draft state and replaces its previous (repository, commit, folder) triple
  and mutable manifest metadata.
- With ``--register``, a successful submit registers the submission and
  freezes its triple, manifest, concepts, and proofs.


# Implementation

## Build Pipeline

The **build pipeline** checks a submission against this spec and derives
``build-output.json``. The archive runs the identical pipeline on submit and never
trusts local results.

The pipeline operates directly on the submission folder. There are no shadow
workspaces and no third lakefile: the two packages are the only workspaces.

It runs multiple phases. Violations are collected, not failed fast, so the final
report lists every violated rule; a phase with violations aborts the
subsequent phases.

- **Static validation** (milliseconds, no network): folder layout, license,
  ``abstract.md``, manifest schema, ``lean-toolchain``, the lakefile whitelist
  of the Packages section, root-module exactness, annotation frontmatter,
  resolution of dependency triples against database, the import rules of the
  concept DAG, and that no generated file is tracked by git. Imports are read
  with ``parseImports`` on the source text; no build is needed.

- **Resolution** (miliseconds, no network): Check that every dependency triple
  resolves to a registered submission in the local database. (For users, we
  suggest to update the database if misses occur).

- **Compile:** ``lake build`` in ``proofs/``, which may build the concept
  package as a path dependency under its own build options. Then ``lake
  build`` in ``concepts/``, verifying that the concept workspace builds
  standalone — this is the workspace downstream submissions require. Both
  builds use Lake's machine-wide shared artifact cache, so mathlib is built
  once per machine, not once per submission.

- **Inspect:** run the ``Lax.Inspector`` meta-program on the built
  environment, see below.

- **Emit:** write ``build-output.json`` into root of submission.

### Inspection

All meta-programming lives in ``Lax.Inspector``, a Lean library in its own
package: pinned to the archive toolchain, built once per machine, importing
only Lean core, never mathlib. The build process generates a driver file in a
temporary directory — imports of ``Lax.Inspector`` and of every module of both
packages, followed by the ``#lax_inspect`` command — and elaborates it in the
workspace environment (``lake env lean <driver>``, with the inspector's oleans
appended to ``LEAN_PATH``). Running inside the frontend guarantees that the
inspected environment is exactly the one a normal build produces, with no
import boilerplate to maintain across toolchain bumps.

``#lax_inspect`` inspects the jointly imported environment and prints one JSON
report to stdout for the CLI to consume: per-declaration axiom sets (the
``#print axioms`` machinery), conclusion resolution and the kernel defeq check
of each proof, the redundant ``assumptions`` cross-check, the namespace rule
(via each declaration's module of origin), pretty-printed signatures, and
docstrings. We don't actually run ``#print axioms``, but rather take the more
robust meta-programming route that also covers axiom type.

Compile and inspect execute untrusted code (elaboration, import-time
initializers). The archive therefore runs them sandboxed, with network access
only during the resolve phase.


## CLI

The CLI ``lax`` is the only interface to the archive. The acting GitHub account
authenticates via GitHub OAuth (the CLI reuses an existing ``gh`` login).
``lax`` has the following commands:

**lax init [folder]** (default ``.``) starts a submission. The folder must be
empty or not yet exist; otherwise init refuses. The archive reserves the next
free id ``LaxN`` and creates the record in the init state with the
authenticated account as sole owner. The CLI then scaffolds the complete
layout for that id: ``manifest.yaml`` (with ``id: LaxN`` and the environment
pins), package folders, lakefiles, ``lean-toolchain``, root modules,
``abstract.md``, and ``LICENSE``. The result passes ``lax build`` as an empty
submission. Also add a .gitignore that ignores the right stuff:
``build-output.json``, ``lake-manifest.json``, oleans and the rest of
``.lake/``. Also forbidden filetypes probably.

**lax set-owners <handle>...** replaces the owner set of the submission in
the current folder with the given GitHub handles, see Actions.

**lax build [folder]** runs the build pipeline: it checks the submission
against this spec and on success writes ``build-output.json``. Any violation
fails with a nonzero exit and a report listing every violated rule.

**lax serve [folder]** runs the **site generator** — the same component that
builds the archive website — on the submission's ``build-output.json`` and
serves the result locally, running ``build`` first when ``build-output.json``
is missing or stale. What it serves is exactly what the website will display.

**lax submit [folder]** derives the (repository, commit, folder) triple from
the folder's git state — the remote URL, the HEAD commit, the folder's path
within the repository — and hands it to the archive. It refuses if the
worktree is dirty or HEAD is not present on the remote. Without
``--register`` it requests the draft state, with it registration. The archive
re-runs all checks of ``build`` itself and never trusts local results; on
success it updates the record as described in Lifecycle.

**lax pull-db** refreshes the local database checkout at ``~/.lax/db``, see
Local Checkout. Installing or updating the CLI does this too, so the command is
only needed to pick up submissions registered since. It is read-only with
respect to the archive and needs no authentication.

**lax spec** prints this specification. The text is embedded in the binary at
build time, so the printed spec is exactly the one that binary enforces.
Useful for agents authoring submissions.

## Distribution

We distribute via npm or similar, so that updates are one-liners.



# The Social Layer

A **reviewer** is a verified ORCID identity (via OAuth) with a real-world name,
leading to trust by reputation. Reviewers act on the trust layer.

## Endorsements and Flags

Reviewers can **endorse** and **flag** individual concepts. Both are public
verdicts staked on the reviewer's verified ORCID and performed explicitly on
the website — endorsement is opt-in, never implied by authorship.

**Endorsing** means signing the following attestation, displayed at the moment
of endorsement:

    I have read this concept's description and its Lean code, and I attest that
    the code faithfully formalizes the description.

    In particular, I have followed its dependencies — their descriptions, and
    their code — as deeply as necessary.


The endorser vouches for the meaning of the concept as a whole, including the
upstream context that meaning rests on. How deep to read upstream is the
endorser's judgment call — that judgment is exactly what they stake their name
on. Endorsements are revocable.

A **flag** is the opposite verdict and requires a message outlining the
problem. A flag is a staked claim, not a final verdict: it stands until the
flagger retracts it.
