# Vision

The archive is the social and archival layer for automated Lean formalization.

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
  The ``init`` action creates this field. It is required by every ``submit``.

- title: A non-unique title, like the title of the paper the submission formalizes.

- authors: An ordered, possibly empty, list of author entries. Each entry is a
  tuple with a required ``name`` (display name) and optional ``orcid`` and
  ``github`` identifiers. Used for credit only, not rights-management.

- owners: A non-empty list of GitHub handles forming the owner set. Used for
  rights-management only, not credits.

- draft: Whether the submission is still an overwritable draft. Submitting a
  draft with ``draft: false`` registers it. Registration is irreversible.

- supersedes: Id of the registered submission this one is intended to
  supersede. Optional. The supersession takes effect only when the successor
  is registered. See Lifecycle.

- leanVersion, mathlibVersion: The environment the submission was built
  against; must match the archive environment.

- abstractPath, licenseFile, bibEntries: Pointers to abstract and license (an
  accepted open license required), plus bibliography entries.

## artifacts.json

Derived by the build, never written by hand: everything extracted from the
source code that the website needs for display, e.g. the individual concepts
of a submission. See the Generated Artifacts section for the full schema.




# The Archival Layer

An **owner** is a GitHub account listed in a submission's owner set, and is
thereby allowed to act on the submission (e.g., submitting and editing).
Owners take action on the submission layer.

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus stays
in the authors' repositories and attribution is clear. (To guard against link
rot, we may keep backup copies, e.g. via
https://archive.softwareheritage.org/save/.)

## Lifecycle

Submissions can be in four possible states.

**local:** the submission starts on the dev machine. Our tooling checks
whether it would be accepted and previews it on a local copy of the website.
It has no archive id and no archive-side state.

**draft:** initialized in the archive and assigned an id. A draft may be only
an empty placeholder created by ``init``, or it may point to the latest
successfully submitted revision. It is visible on the website, overwritable by
its owners, not citable, not reviewable, and not allowed to be used in
downstream submissions.

**registered:** immutable, citable, reviewable. The normal published state.

**superseded:** still immutable, citable, and reviewable, but carrying a
prominently displayed pointer to its successor. Downstream submissions may
still depend on superseded submissions.

The only state transitions are:

- ``local -> draft``, by ``init``;
- ``draft -> draft``, by ``submit`` with ``draft: true``;
- ``draft -> registered``, by ``submit`` with ``draft: false``;
- ``registered -> superseded``, when a successor is registered.

There is no transition out of ``superseded``. These states describe the
submission record; local working copies may of course continue to change after
registration.

## Actions

Opaque ids prevent the squatting of nice names like ``RamseyTheory``.

Every archive action happens via our CLI tool. It has two write actions:
``init`` allocates an id, and ``submit`` uploads or registers content.

**Init.** ``lml init`` takes a local submission folder containing a
``manifest.yaml``. For initialization, the manifest need only contain
``manifestVersion`` and a non-empty ``owners`` list. The authenticated GitHub
account must occur in that list. The archive reserves the next free
id ``LaxN`` and creates a draft record containing the id and owner set. The CLI
then writes ``id: LaxN`` into the local manifest.

**Submit.** ``lml submit`` hands the archive a (repository, commit, folder)
triple. The folder must contain a complete valid manifest with its previously
allocated id. The id must resolve to a draft.

The authenticated GitHub account must occur both in the draft's stored owner
set and in the owner set of the submitted manifest. Consequently, owners can be
added or removed while a submission is a draft. The owner set becomes immutable
on registration.

- With ``draft: true``, a successful submit replaces the draft's previous
  (repository, commit, folder) triple and mutable manifest metadata.
- With ``draft: false``, a successful submit registers the draft and freezes
  its triple, manifest, concepts, and proofs. Registration is atomic and
  irreversible. Any later submit carrying that id is rejected.

**Supersession.** A draft manifest may name a registered submission in its
optional ``supersedes`` field. Every submit carrying this field must also be
performed by an account in the stored owner set of the named predecessor. The
field expresses an intention while the successor is a draft and has no effect
on the predecessor yet.

When the successor is registered, supersession is accepted only if
the predecessor is registered, has no successor, and is not the
successor itself. The predecessor then becomes superseded and gains a pointer
to the successor. Its content and citations remain unchanged, and downstream
submissions may continue to depend on it. A registered successor may later be
superseded in the same way, so successors form a chain.


## License

To display the submission on our website and to make and serve backup copies,
we require submissions to be properly licensed.

For the MVP we accept exactly one license: the **Apache License 2.0**, the
license of Lean and mathlib.

The ``licenseFile`` must contain the Apache 2.0 text. The checker compares it
against the canonical text after whitespace normalization. On mismatch it
rejects and points to a canonical download link.


# The Social Layer

A **reviewer** is a verified ORCID identity (via OAuth) with a real-world name,
leading to trust by reputation. Reviewers act on the trust layer.

## Endorsements and Flags

Reviewers can **endorse** and **flag** individual concepts. Both are public
verdicts staked on the reviewer's verified ORCID and performed explicitly on
the website — endorsement is opt-in, never implied by authorship.

**Endorsing** means signing the following attestation, displayed at the moment
of endorsement:

    I have read this concept's description and its Lean code, and I attest
    that the code faithfully formalizes the description.

    I have followed its dependencies — their descriptions, and their code
    wherever I deemed it necessary — deeply enough to convince myself that
    this concept, read through its dependencies, means what its description
    claims.

Endorsements are fully transitive: the endorser vouches for the meaning of the
concept as a whole, including the upstream context that meaning rests on. How
deep to read upstream is the endorser's judgment call — that judgment is
exactly what they stake their name on. Endorsements are revocable.

A **flag** is the opposite verdict and requires a message outlining the
problem. A flag is a staked claim, not a final verdict: it stands until the
flagger retracts it. The natural fix for a justified flag is superseding the
submission, since content is frozen.



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

The environment may fix additional values as the need arises.

## Submissions

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

``manifest.yaml`` holds the given metadata (see the Metadata Full Reference).

Example:

    manifestVersion: "1"
    id: Lax261              # assigned by lml init; required by lml submit
    draft: true             # submit with false to register
    leanVersion: "v4.30.0"
    mathlibVersion: "c5ea00351c28e24afc9f0f84379aa41082b1188f"
    title: My Submission
    authors:
      - name: Alice Smith
        orcid: "0000-0002-1825-0097"
        github: alice
      - name: Bob
        github: bob
    owners: ["alice"]
    abstractPath: abstract.tex
    licenseFile: LICENSE
    bibEntries: []
    supersedes: Lax042      # optional, see Lifecycle

Rules:

- **License.** ``licenseFile`` must contain the accepted license (see the
  License section), matched against the canonical text after whitespace
  normalization.

- **Environment.** ``leanVersion`` and ``mathlibVersion`` must match the
  archive environment, as must both ``lean-toolchain`` files and the mathlib
  pins in both lakefiles (see Packages).


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

- **Root modules.** Each package has a root module (``concepts/Lax261.lean``
  resp. ``proofs/Lax261Proofs.lean``) consisting of exactly one ``import``
  line per module of the package and nothing else, so that the default target
  builds everything. (This is the standard Lean layout — mathlib's
  ``Mathlib.lean`` works the same way.)

- **Empty Submission.** It is allowed that the submission contains no concept
  and no proof. Maybe useful to simulate revocation.

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

Each submission with id ``Lax261`` owns two top-level namespaces: its concepts 
live in ``Lax261`` and its proofs in ``Lax261Proofs``. 

## Concepts

A concept is a single Lean module of the concept package: concept and file
correspond one to one. The module is the unit of meaning, of annotation, and
of review. (This is the biggest simplification compared to the previous
draft, which partitioned a declaration-level dependency DAG into concepts.)

The declarations of a concept module are its **atoms**. An atom declared by
``axiom`` is called a **statement**. Statements are the claims of the archive,
to be discharged by proofs.

- **Canonical path.** The concept ``Myconcept`` of submission ``Lax261`` is the
  module ``Lax261.Myconcept``, stored at Lake's canonical path
  ``concepts/Lax261/Myconcept.lean``. Hence concepts are precisely the Lean
  files in ``concepts/Lax261/``.

- **Namespace.** Every declaration of the module must live in the namespace
  equal to the module name, e.g. ``Lax261.Myconcept``. Further nesting into
  subnamespaces is allowed.

- **Dependencies are imports.** A concept may import mathlib modules and
  other concept modules (of the same or of other submissions). The
  **concept DAG** is the DAG with outgoing edges to each included module.

- **Sorry-free.** The axiom set (``#print axioms``) of every atom may contain
  only the archive's background axioms and statements of concept packages. In
  particular ``sorryAx`` is forbidden.

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
when present, must list exactly the assumptions the checker computes (a
redundant sanity check for authors, not an input).

Checks per proof:

1. The ``conclusion`` id resolves to an ``axiom`` in the concept package of
   the submission itself or of a registered dependency.
2. The theorem's type is definitionally equal to the conclusion's type (kernel
   check).
3. Every axiom reported by ``#print axioms`` is either an ``axiom`` in the
   concept package of the submission itself or some other registered
   submission, or on the archive environment's whitelist of background axioms.
   Any other axiom — such as ``sorryAx`` — is forbidden.

Together, the proofs weave the statements of the archive into the **proof
network**: the directed hypergraph over all statements with a hyperedge
(A → c) for every proof with assumption set A and conclusion c. A statement
is **proven** if it is the conclusion of some proof all of whose assumptions
are (recursively) proven, and **unproven** otherwise. More generally, a
statement is **proven relative to** a set C of statements if it becomes
proven once the statements in C are taken as proven.

## Annotations

Each annotation is a docstring that we parse as markdown with optional yaml
frontmatter (a common pattern from static site generators). The frontmatter
holds the key-value pairs; the markdown after it is placed into the
``description`` key. A docstring without frontmatter is pure description.
Consequently, required keys (a concept's ``title``, a proof's ``conclusion``)
must be given explicitly in frontmatter.

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

Atoms and proofs carry ordinary declaration docstrings ``/-- … -/``. A concept
is annotated by the module docstring ``/-! … -/`` at the top of its file:
since concept and module coincide, the annotation of the module is the
annotation of the concept.

An example concept module ``concepts/Lax261/Myconcept.lean``:

    import Mathlib.Combinatorics.SimpleGraph.Basic
    import Lax042.Colorings

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


## Generated Artifacts

TODO

``artifacts.json`` is written by the local build and contains everything the
website needs to display the submission: the website renders artifacts, it
never runs Lean. It is derived data. The checker regenerates it from source
and never trusts a submitted copy.

Top-level structure:

    {
      "artifactsVersion": "1",
      "id": "Lax261",
      "manifest": { ... },
      "source": {
        "repository": "https://github.com/alice/mysubmission",
        "commit": "0123456789abcdef0123456789abcdef01234567",
        "folder": "mysubmission"
      },
      "dependenciesConcept": ["Lax42"],
      "dependenciesProof": ["Lax42", "Lax54Proof"],
      "concepts": [ ... ],
      "proofs": [ ... ]
    }

- ``manifest``: the parsed content of ``manifest.yaml``.
- ``source``: the (repository, commit, folder) triple; filled in by submit,
  absent for purely local builds.
- ``dependenciesConcept`` and ``dependenciesProof``: package names of all dependencies required by either package.

Each entry of ``concepts``:

    {
      "name": "Lax261.Myconcept",
      "path": "concepts/Lax261/Myconcept.lean",
      "title": "...",
      "description": "...",
      "imports": ["Lax042.Colorings"],
      "sourceText": "...",
      "atoms": [
        {
          "id": "Lax261.Myconcept.X",
          "kind": "axiom",
          "isStatement": true,
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
      "assumptions": ["Lax042.Colorings.Somestatement"],
      "description": "..."
    }

``assumptions`` is always the checker-computed set, regardless of whether the
author supplied the redundant ``assumptions`` key. The website computes
everything else — the concept DAG, the proof network, proven/unproven status —
from the artifacts of all submissions together.

