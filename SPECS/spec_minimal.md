# Vision

The archive shall serve as the social and archival layer for automated Lean
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
Lean, Lake and mathlib.



# Submission Layout

This section gives the full rule set that all submissions in the archive must
adhere to.

Each submission carries two central files in the root folder:
``manifest.yaml``, written by the authors, and ``build-output.json``, derived by
the build.

## Archive Environment

We fix the following **archive environment**:

- ``specVersion: "1"``
- pinned Lean toolchain: ``leanprover/lean4:v4.30.0`` (the verbatim content
  of every ``lean-toolchain`` file; it also fixes the Lake version)
- trusted background imports
    - mathlib, pinned to revision ``c5ea00351c28e24afc9f0f84379aa41082b1188f``
- ``enableArtifactCache`` on
- concept build options
    - ``autoImplicit`` off
- proof build options
    - ``autoImplicit`` on
- allowed background axioms
    - ``propext``
    - ``Classical.choice``
    - ``Quot.sound``


## File Structure

A submission rooted at folder ``mysubmission`` with id ``Lax261`` **must**
have the following layout.

    mysubmission/
      manifest.yaml
      abstract.md
      LICENSE
      concepts/                    
        lakefile.toml
        lean-toolchain
        Lax261.lean                -- root module of the concept package
        Lax261/...                 -- modules of the concept package
      proofs/                      
        lakefile.toml
        lean-toolchain
        Lax261Proofs.lean          -- root module of the proof package
        Lax261Proofs/...           -- modules of the proof package

Additional Rules:

- **License.** The file ``LICENSE`` in the submission root folder must contain
  an accepted license, matched against the canonical text after whitespace
  normalization. An optional copyright line at the end of the file is
  ignored. For the MVP we accept exactly one license: the **Apache License
  2.0**, the license of Lean and mathlib.

- **Abstract.** ``abstract.md`` must be non-empty. It is rendered as markdown
  and shown prominently on the website.

- **Files.** ``build-output.json`` and ``lake-manifest.json`` must not be
  checked in. A local build leaving the files behind is fine. Files beyond the
  pictured layout (a README, etc) are allowed and ignored by the archive.

## manifest.yaml

The file ``manifest.yaml`` must contain the following keys and adhere to the following rules.

- ``specVersion``: version of the spec this submission adheres to
- ``mathlibVersion``: version the submission was built against
- ``leanVersion``: version the submission was built against

- ``id``: The archive-assigned unique id. It must be of the form ``LaxN`` for
  a positive natural number N written without leading zeros. Ids are
  deliberately opaque; this prevents the squatting of nice names like
  ``RamseyTheory``.

- ``title``: A non-unique title, like the title of the paper the submission formalizes.

- ``authors``: An ordered, possibly empty, list of author entries. Each entry is a
  tuple with a required ``name`` (display name) and optional ``orcid`` and
  ``github`` identifiers. Used for credit only, not rights-management.

- ``bibEntries``: a possibly empty list of strings, each a single BibTeX
  entry verbatim, as it would appear in a ``.bib`` file.

Additional Rules:
- ``specVersion``, ``leanVersion``, ``mathlibVersion``: must match the
  archive environment for now. ``leanVersion`` holds the version tag
  (``v4.30.0``); the full toolchain name (``leanprover/lean4:v4.30.0``)
  appears only in the ``lean-toolchain`` files.
- No keys beyond the ones listed here are allowed.

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

- **Whitelisted keys only.** The file may contain exactly the keys shown in
  the examples below: ``name``, ``defaultTargets``, the archive environment's
  build options, ``[[require]]`` entries (exactly ``name``, ``git``, ``rev``,
  optionally ``subDir`` — or ``name`` and ``path`` for the proof package's
  own concept package), and one ``[[lean_lib]]`` (exactly ``name``).

- **Fixed names.** The package name and the name of the single ``lean_lib``
  are both ``Lax261`` in the concept package and both ``Lax261Proofs`` in
  the proof package. The lib is the only default target. With Lake's default
  layout, module files therefore live under ``Lax261/`` and
  ``Lax261Proofs/`` respectively.

- **Dependencies.** Besides mathlib, concept packages may require only
  concept packages; proof packages may require both concept and proof
  packages. We issue a warning whenever a proof package is required.
  Requiring mathlib is optional in both packages (it is often already
  present transitively); when required, it must be required under the name
  ``mathlib`` from its canonical URL, pinned to the archive-wide revision.
  Concept and proof packages of other submissions are added by pinning the
  full commit hash and subfolder of the submission's repository. Every such
  ``(git, rev, subDir)`` triple must resolve to a registered submission: a
  record with ``repository = git``, ``commit = rev``, and ``subDir`` equal
  to the record's ``folder`` joined with ``concepts`` or ``proofs``. Only
  exception: the proof package may require its own concept package via the
  relative path ``../concepts``.

- **Imports.** A module may import only modules of its own package, of Lean
  core (``Init``, ``Std``, ``Lean``), of mathlib, and of the packages its
  package requires. Modules of mathlib's own dependencies (``Batteries``,
  ``Aesop``, ``Qq``, …) are not importable; import the corresponding mathlib
  module instead. Enforcement is a prefix check on the ``parseImports``
  output: by the fixed-names rule, every archive module name begins with its
  package name, so an import's first component identifies its package.

- **Root modules.** Each package has a root module (``concepts/Lax261.lean``
  and ``proofs/Lax261Proofs.lean``) consisting of exactly one ``import``
  line per module of the package and nothing else, so that the default target
  builds everything. (This is the standard Lean layout — mathlib's
  ``Mathlib.lean`` works the same way.)

- **Empty submission.** A submission may contain no concepts and no proofs.

- **Pinned toolchain.** ``lean-toolchain`` must contain the archive-wide
  toolchain verbatim.

- **Builds.** Both packages must build: ``lake build`` succeeds in
  ``concepts/`` and in ``proofs/``. Lean warnings do not fail a submission.

Example ``lakefile.toml`` of a concept package:

    # mysubmission/concepts/lakefile.toml
    name = "Lax261"
    defaultTargets = ["Lax261"]
    enableArtifactCache = true

    [leanOptions]
    autoImplicit = false

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
    enableArtifactCache = true

    [leanOptions]
    autoImplicit = true

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

A **concept** is a Lean module of the concept package; every module except the
root module is one, and must carry the concept annotation (see Annotations).
The concept ``Myconcept`` of submission ``Lax261`` is the module
``Lax261.Myconcept``, stored at Lake's canonical path
``concepts/Lax261/Myconcept.lean``. Concepts cannot be nested in subfolders.

The **statements** of a concept are the axioms whose module of origin it is.

TODO: is there a cleaner way to say "everything in the module must be in the namespace" than quantifying every declaration?
Every declaration of the module must live in the namespace equal to the module
name, e.g. ``Lax261.Myconcept``. Further subnamespaces are allowed.

A concept may import mathlib modules and other concept modules (of the same
or of other submissions). These imports form the **concept DAG** (acyclic for
free, since Lean imports are).

Additional Rules:

TODO: we do not even allow statements to appear in the axiom set! Statement axioms can only be defined, never used in the concept package. thus the following needs to reworded.

  - **Axiom-free.** The axiom set (``#print axioms``) of every declaration may
  contain only the archive environment's background axioms and statements (of
  this or any other submission). In particular ``sorryAx`` and
  ``Lean.ofReduceBool`` are forbidden — no ``sorry``, no ``native_decide``.

## Proofs

TODO: this section can be simplified. rewrwrite from first principles.

TODO: a proof is any declaration whose docstring carries a frontmatter at all. this is much cleaner and makes the loud-errors rule actually work without firbidding docstrings for helpers.

A **proof** is a declaration of theorem kind in the proof package whose
docstring frontmatter carries the ``conclusion`` key. The kind is the
kernel's, not the surface syntax, so mathlib's ``lemma`` qualifies as well.
All other declarations are helpers and are ignored by the archive. Its
**conclusion** is the statement named by that key; its **assumptions** are
the statements occurring in the theorem's axiom set (as reported by
``#print axioms``). The optional ``assumptions`` key, when present, must
equal, as a set, the assumptions the inspector computes (a redundant sanity
check for authors, not an input).

Rules:

- The ``conclusion`` id resolves to an ``axiom`` in the concept package of
  some submission, and that axiom is present in the proof package's built
  environment — i.e. the proof's module (transitively) imports the concept
  module declaring it.

- The theorem's type is definitionally equal to the conclusion's type (kernel
  check).

- Every axiom reported by ``#print axioms`` for any declaration of the
  proof package is either a statement or a background
  axiom.

TODO: same todo as for namespaces in concept packages applies here.
- Every declaration of the proof package lives in the namespace
  ``Lax261Proofs``; further subnamespaces are allowed.

Together, the proofs weave the statements of the archive into the **proof
network**: the directed hypergraph over all statements with a hyperedge
(A → c) for every proof with assumption set A and conclusion c. A statement
is **proven** if it is the conclusion of some proof all of whose assumptions
are (recursively) proven, and **unproven** otherwise — a least fixed point,
so statements in a dependency cycle do not prove each other. More generally, a
statement is **proven relative to** a set C of statements if it becomes
proven once the statements in C are taken as proven.

## Annotations

We annotate concepts and proofs. A concept is annotated by its module docstring
``/-! … -/``, of which we allow at most one per module. A proof is annotated by
the usual docstring ``/-- … -/``.

Each annotation is a docstring that we parse as markdown with yaml frontmatter
(a common pattern from static site generators). When later parsing this
docstring into key-value pairs, the markdown after the frontmatter is placed
into the ``description`` key. The recognized keys (the list may later be
extended):

Concept
    - ``title`` (required): natural-language name of the mathematical object,
      like "Ramsey's Theorem"
    - ``description`` (required): the natural-language description of that
      object. The whole validity of the archive rests on the assumption that
      the Lean side of the concept faithfully represents this description.

Proof
    - ``conclusion`` (required)
    - ``assumptions`` (optional): a yaml list of fully qualified statement
      names, see Proofs
    - ``description`` (optional): additional information, like attribution or
      the high-level idea.

Frontmatter with an unrecognized key leads to build errors.

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

    /-- an ordinary Lean docstring; no frontmatter -/
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
mutable lifecycle data: state, owner set, timestamps, the current (repository,
commit, folder) triple. ``LaxN/build-output.json`` holds the build output:
absent in the init state, overwritten on every draft submit (drafts are shown
on the website), frozen on registration. 

TODO: this paragraph should go to the (new) db subsection of the Implementation section
This folder tree is the canonical
state of the archive; everything else (website, indexes) is derived. The
database is a single public git repository with a single writer, and every user
holds a read-only clone of it at ``~/.lax/db``. The path is
deliberately visible, so AI agents can use it to survey existing submissions
and find prior work to build upon. Installing the CLI clones the repository.

Example ``record.json``

    {
      "specVersion": "1",
      "id": "Lax261",
      "state": "registered",
      "createdAt": "2026-07-01T12:00:00Z",
      "registeredAt": "2026-07-19T09:30:00Z",
      "owners": [
        { "githubId": 583231, "handle": "alice" },
        { "githubId": 913874, "handle": "bob" }
      ],
      "source": {
        "repository": "https://github.com/alice/mysubmission",
        "commit": "0123456789abcdef0123456789abcdef01234567",
        "folder": "."
      }
    }

- ``owners``: GitHub accounts, non-empty, immutable after registration.
  Stored as numeric account id (handles are renameable) plus the handle for
  display.
- ``createdAt``, ``registeredAt``: UTC timestamps of init and registration;
  ``registeredAt`` is absent before registration.
- ``source``: the (repository, commit, folder) triple; absent in the init
  state, frozen on registration.



Example of ``build-output.json``

    {
      "specVersion": "1",
      "id": "Lax261",
      "manifest": { ... },
      "requiredByConcepts": ["Lax42"],
      "requiredByProofs": ["Lax42", "Lax42Proofs"],
      "concepts": [ ... ],
      "proofs": [ ... ]
    }

- ``manifest``: the parsed content of ``manifest.yaml``.
- ``requiredByConcepts`` lists all packages required by the concept package,
  and ``requiredByProofs`` lists the packages required by the proofs package.

Each entry of ``concepts``:

    {
      "id": "Lax261.Myconcept",
      "path": "concepts/Lax261/Myconcept.lean",
      "title": "...",
      "description": "...",
      "imports": ["Lax42.Colorings"],
      "sourceText": "...",
      "statements": [
        {
          "id": "Lax261.Myconcept.X",
          "signature": "X : ..."
        }
      ]
    }

``title`` and ``description`` come from the concept annotation, where both are
required. ``imports`` lists imported concept modules only —
mathlib imports are dropped. ``sourceText`` is the verbatim file content, so
the website can display concept code without access to the repository — it is
how the archive shows a concept's declarations, which have no entries of their
own. ``statements`` lists the concept's axioms with their pretty-printed
types; the website marks each proven or unproven.

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

The file is deterministic: every list is sorted lexicographically, concepts,
statements and proofs by ``id`` and the rest by value. Source order is not
preserved anywhere; ``sourceText`` carries the author's ordering for whatever
wants to display it.





# The Archival Layer

An **owner** is a GitHub account listed in a submission's owner set, and is
thereby allowed to act on the submission (e.g., submitting and editing).
Owners act on the archival layer.

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus stays
in the authors' repositories and attribution is clear. (To guard against link
rot, we may later keep backup copies, e.g. via
https://archive.softwareheritage.org/save/.)

## Lifecycle

Submissions can be in three possible states within our database.

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

Every archive action happens via our CLI tool. It has three write actions:
``init`` allocates an id, ``submit`` uploads or registers content, and
``set-owners`` edits the owner set.

**Init.** ``lax init`` takes an empty local folder. The archive reserves the
next free id ``LaxN`` and creates a record in the init state whose
owner set contains exactly the authenticated GitHub account. The CLI then
scaffolds the complete submission layout for that id (see CLI).

**Set-owners.** ``lax set-owners`` replaces the owner set of a submission in
the init or draft state. The authenticated GitHub account must be in
the current owner set and may not remove itself; the new set must be non-empty.
The owner set becomes immutable on registration.

**Submit.** ``lax submit`` hands the archive a (repository, commit, folder)
triple. The folder must contain a complete valid manifest whose ``id`` equals
the id of the record being submitted to. That record must be in the init or
draft state, and the authenticated GitHub account must occur in its stored
owner set.

- Without ``--register``, a successful submit puts the submission in the
  draft state and replaces its previous (repository, commit, folder) triple
  and mutable manifest metadata.
- With ``--register``, a successful submit registers the submission and
  freezes its triple, manifest, concepts, and proofs.





# Implementation

- The **build pipeline** checks a submission against this spec and derives its
  ``build-output.json``. It is the sole authority on what this spec means.

- The **site generator** turns the database into the website.

- The **database repository** holds the archive's state.

- The **CLI** ``lax`` is the only thing authors and agents ever touch.

- The **archive server** is the archive's single piece of infrastructure. It
  serves a small HTTPS API to the CLI, runs build pipeline and site generator
  centrally, and is the sole writer of the database repository.


## Build Pipeline

The pipeline operates directly on the submission folder. There are no shadow
workspaces and no third lakefile: the two packages are the only workspaces.

It runs multiple phases. Violations are collected, not failed fast, so the final
report lists every violated rule. A phase with violations aborts the
subsequent phases.

- **Static validation** (milliseconds, no network): folder layout, license,
  ``abstract.md``, manifest schema, ``lean-toolchain``, the lakefile whitelist
  of the Packages section, root-module exactness, the import rule of the
  Packages section, and that no generated file is tracked by
  git — when the folder is not inside a git repository, this check is skipped
  with a warning. Imports are read with ``parseImports``, which needs no
  environment and hence no build.

- **Resolution** (milliseconds, no network): Check that every dependency triple
  resolves to a registered submission (via ``~/.lax/db`` locally, via local
  checkout on server). A local miss may just mean a stale database, so the
  CLI suggests ``lax pull-db`` and a retry before reporting the violation.

- **Compile:** ``lake build`` in ``concepts/`` first — the standalone
  workspace downstream submissions require — then in ``proofs/``. Fetching
  the pinned git dependencies here is the pipeline's only network access.
  Both builds use Lake's machine-wide shared artifact cache, so mathlib is
  built once per machine, not once per submission. A failing build is a
  violation of the Packages section's build rule; the build transcript is
  reprinted to stdout so the user can act on it.

- **Inspect:** run the ``Lax.Inspector`` meta-program on the built
  environment, see below.

- **Emit:** write ``build-output.json`` into the root of the submission.

### Inspection

All meta-programming lives in ``Lax.Inspector``, a Lean library in its own
package: pinned to the archive toolchain, importing only Lean core, never
mathlib. Its source ships with the CLI; the first ``lax build`` on a machine
compiles it into ``~/.lax/inspector/<cli-version>/`` and every later run of
that CLI version reuses those oleans — the version in the path is what makes
an upgraded CLI recompile instead of loading stale oleans. The inspector runs
twice, once per package. For each package, the
pipeline generates a driver file in a temporary directory — imports of
``Lax.Inspector`` and of the package's root module (which by the
root-module rule pulls in every module), followed by the ``#lax_inspect``
command — and elaborates it in that package's workspace environment (``lake
env lean <driver>``, with the inspector's oleans appended to ``LEAN_PATH``).

``#lax_inspect`` inspects the imported environment and writes one JSON report
to the file named by the ``LAX_INSPECT_OUT`` environment variable — not to
stdout, which elaboration of untrusted code can pollute. The report covers:
per-declaration axiom sets, conclusion resolution and the kernel defeq check
of each proof, the redundant ``assumptions`` cross-check, the namespace rule
(via each declaration's module of origin), the pretty-printed signatures of
the statements, and the annotations. That is the whole report; the inspector
has no other job.

The spec phrases several rules in terms of ``#print axioms`` because that is
the familiar name for the notion. The inspector does not run the command but
calls the API behind it (``Lean.collectAxioms``), which traverses a
declaration's value and type transitively and returns the axioms among the
constants it reaches. The same set, returned as data instead of printed: the
inspector has to compare it against the background axioms and the statement
set, not show it to anyone.

**Recognizing statements.** Sorry-freeness, conclusion resolution, and the
computed ``assumptions`` set all rest on splitting the axioms of the built
environment into background axioms and statements. The inspector decides this
by module of origin: an axiom is a **statement** iff its declaring module
belongs to a concept package. The pipeline passes the driver the set of
concept-package names, which it already holds — Resolution has just checked
every ``[[require]]`` against the database — rather than having the inspector
recognize concept packages by their ``LaxN`` shape. Both work today, since the
fixed-names rule makes every module name begin with its package name; passing
the set ties the classification to what Resolution actually verified instead
of to a naming convention, and survives a later change to the id format.

Any axiom that is neither a background axiom nor from a concept package is a
violation. This is what catches a stray ``axiom`` in a proof package, or an
unexpected axiom arriving through mathlib, instead of silently counting it as
an assumption.

**The inspector never parses.** Every unit it reports is environment-legible:
a concept is a module, a statement is an axiom (``ConstantInfo.axiomInfo``)
from a concept module, and theorem-ness is likewise a kernel notion. So are
the annotations — module docstrings via ``getModuleDoc?``, declaration
docstrings via ``findDocString?``, both persisted in the ``.olean``.

Nothing in the pipeline reads concept source as Lean: ``parseImports`` reads
import lines, Emit copies files verbatim into ``sourceText``, and neither is
a parse.


## Site Generator

The site generator is a static site builder: it reads the ``record.json`` and
``build-output.json`` of the database and emits pages. One per submission
(abstract, authors, bib entry, and its concepts with title, description, Lean
source, and statement signatures), one per concept, and index pages listing
submissions and browsing the concept DAG and the proof network, marking each
statement proven or unproven.


## CLI

The acting GitHub account authenticates via GitHub OAuth (the CLI reuses an
existing ``gh`` login). ``lax`` has the following commands:

**lax init [folder]** (default ``.``) starts a submission, see Actions. The
folder must be empty or not yet exist; otherwise init refuses. The scaffold
comprises ``manifest.yaml`` (with ``id: LaxN`` and the environment pins),
package folders, lakefiles, ``lean-toolchain``, root modules, ``abstract.md``,
``LICENSE``, and a ``.gitignore`` covering ``build-output.json``,
``lake-manifest.json``, and ``.lake/``. Init warns when the folder is not
inside a git repository. The result passes ``lax build`` as an empty
submission.

**lax set-owners [folder] --new-list <handle>...** (default ``.``) replaces
the owner set with the given GitHub handles (resolved to numeric account ids,
see Archive Database), see Actions. The submission is identified by the ``id``
in the folder's ``manifest.yaml``.

**lax build [folder]** runs the build pipeline: it checks the submission
against this spec and on success writes ``build-output.json``. Any violation
fails with a nonzero exit and a report listing every violated rule.

**lax serve [folder]** runs the **site generator** and serves the result
locally. It is a long-running process that does not daemonize by default. It
watches both the local database and the submission folder for changes: the
submission's ``build-output.json``, and the ``record.json`` of registered
submissions. Every change triggers a website rebuild. The local folder is
rendered from its own ``build-output.json`` against a synthetic draft record,
so ``lax serve`` works before ``lax init`` has allocated an id. If
``build-output.json`` is missing, the website shows a placeholder stating that
the output has not been generated yet; ``lax serve`` does not build.

**lax submit [folder]** derives the (repository, commit, folder) triple from
the folder's git state — the remote URL, the HEAD commit, the folder's path
within the repository — and hands it to the archive. It refuses if the
worktree is dirty or HEAD is not present on the remote. Without
``--register`` it requests the draft state, with it registration; on success
the archive updates the record as described in Lifecycle.

**lax pull-db** refreshes the local database checkout at ``~/.lax/db``, see
Archive Database. It is read-only with respect to the archive and needs no authentication.

**lax update** upgrades the CLI itself to the latest release and then refreshes
the local database, see Distribution. Likewise needs no authentication.

**lax spec** prints this specification. The text is embedded in the binary at
build time, so the printed spec is exactly the one that binary enforces.
Useful for agents authoring submissions.


## Archive Server

One server does everything the archive does centrally: it answers the CLI's
write requests, owns the database repository, and puts the website online.

- **Authentication.** The CLI sends the user's GitHub OAuth token (reused
  from the ``gh`` login) with every write request. The server verifies the
  token against GitHub and resolves it to the numeric account id that all
  ownership checks run against.

- **Endpoints.** One per write action: ``POST /init``, ``POST /set-owners``,
  ``POST /submit`` (with a ``register`` flag), plus ``GET /jobs/<id>`` for
  polling a submit (see Async submit). These three write commands are the only
  ones that leave the user's machine. Reading *archive content* needs no server
  at all — it goes through the public database repository (``lax pull-db``);
  the server answers no content queries.

- **Build Pipeline.** Compile and inspect execute untrusted code (elaboration,
  import-time initializers) — not only the submission's own, but that of every
  upstream submission it imports. The server runs them sandboxed.

- **Processing.** The server is the single writer, so a global lock over
  database writes suffices. Writes are short: validate the request
  (ownership, state), commit the updated ``record.json`` (and
  ``build-output.json``), push. The expensive part of a submit — cloning the
  triple and running the full sandboxed build pipeline — happens *outside*
  the lock, so one submit does not stall unrelated requests. The ownership
  and state checks are therefore re-run after acquiring the lock: the record
  may have moved while the build ran, and a build against a stale record must
  not be committed.

- **Async submit.** The pipeline takes minutes, so ``POST /submit`` returns
  a job id which the CLI polls until it receives success or the violation
  report.

- **Website.** After each push, the server runs the site generator and serves
  the result. Because the server is the writer, it never has to poll for
  changes: it knows exactly when the database moved.

## Distribution and Deployment

The CLI is the one component users install. We distribute via npm or similar,
making installs and updates one-liners, and expose the upgrade as ``lax
update`` so no user has to know which package manager we chose.

The CLI is not self-contained: it shells out to ``elan``/``lake`` (Compile and
the inspector), to ``git`` (the tracked-files check, ``lax submit``, and the
database clone), and to ``gh`` (the reused OAuth login). It checks for all
three on startup and names the missing one rather than failing inside a
subprocess. Installation clones the database (see Archive Database), which is
also the first ``lax pull-db``.

The CLI and the archive server are built from the same repository, which keeps
the pipeline that authors run locally and the pipeline that gates registration
the same build — and likewise the site generator that ``lax serve`` runs and
the one behind the website.


# The Social Layer (future work)

This section is reserved for future work and not part of this spec.

A **reviewer** is a verified ORCID identity (via OAuth) with a real-world name,
leading to trust by reputation. Reviewers act on the social layer.

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



# Decisions

**Atoms.** *Resolved: removed. The concept is the only exposed unit.* An
earlier draft gave concepts a second layer: **atoms**, the individual
declarations introduced by the concept's declaration commands, each with its
own id, ``kind``, signature, and annotation. Identifying them required a walk
over the parsed source — the built environment cannot report which command
introduced a declaration, since it no longer distinguishes ``abbrev`` from
``def`` or ``instance`` from ``def`` (both attributes), and ``example``
leaves no trace at all — plus a match of that walk against the environment,
a ``namespace``/``end`` stack, ``mutual`` handling, ``_root_.`` handling, and
a rule forcing every concept instance to be named so the walk had a name to
record.

None of it was load-bearing. What the archive's mechanisms actually need
named individually is *statements*, because a proof's ``conclusion`` points
at one and the proof network is a graph over them — and a statement is an
axiom, which the environment reports honestly and exactly. The spec had in
fact been defining statements twice, once via atoms in the Concepts section
and once via module of origin in Inspection; only the second was ever
consulted. The two could even disagree, since an attribute can generate an
axiom that no declaration command introduces. Deleting atoms collapses them
into one definition and removes the divergence.

Everything else atoms bought was presentation: per-declaration titles,
descriptions, and signatures on the website. That loses real navigability for
a long concept, and we accept it for now on two grounds. The concept is
already the unit of trust everywhere else — the endorsement attestation is
written about a concept read whole, not about an atom — so the exposed
granularity now matches the endorsed granularity. And ``build-output.json``
is derived data, so reintroducing a per-declaration layer later breaks no
citation, no endorsement, and no stored record. This is the direction that is
safe to defer.

The concept-as-unit also puts the spec in line with our conclusion on
locality: the module-inclusion DAG is the semantics we are confident in, and
a dependency DAG over individual declarations is future work pending help
from someone who knows the elaborator deeply. Atoms were a half-step toward a
granularity we had already decided not to commit to.

**Concept dialect enforcement.** *Resolved: dropped for the MVP; the dialect
stays a rule, the parser goes.* Removing atoms left the re-parse with two
jobs: the command whitelist and the module docstring. The second turned out
not to need it — Lean persists module docstrings in the ``.olean`` and
``getModuleDoc?`` reads them back for imported modules, so annotations are
environment data like everything else.

That left the whitelist alone, and it cannot move to the environment. The
tempting check — "a concept module declares no theorem" — is not an
environment property: a ``structure`` eagerly generates ``mk.injEq``,
``mk.inj``, and ``mk.sizeOf_spec``, all of theorem kind, while a plain ``def``
generates none, since equation lemmas are produced lazily. The check would
pass def-only concepts and fail every concept containing a structure.
``example`` and ``set_option`` leave no trace at all. So the whitelist needs
a parser, and it is the only thing that does.

We dropped it rather than keep a parser for one editorial rule. Nothing in
the archive's guarantees touches the dialect: statements are axioms, proofs
are kernel-checked, sorry-freeness is environment-derived. A concept written
in violation is unreadable, not unsound, and unreadable is precisely what the
social layer already exists to catch — an endorser who cannot follow a
concept declines to endorse it. The dialect now sits alongside the
``set_option`` kernel-bypass pitfall in Future work: stated, cooperated with,
enforced later.

The cost is real and worth naming: an unenforced rule in a document that AI
agents read as authoring instructions will be violated more often than one
the build rejects, and ``lax build`` can no longer tell an author they have
put a proof in a concept. We accept that on the grounds that the failure mode
is a bad submission rather than a false one, and that the archive is small
enough for now that bad submissions are visible.

A route we did not take, recorded in case enforcement becomes worth its
weight: have the inspector observe commands *during* ``lake build`` as a Lean
plugin, giving exact syntax and exact environment together. It is
architecturally cleaner than any re-parse and would deliver both the dialect
check and a per-declaration layer. We avoided it because it means injecting
arguments into the submission's own build and we are not certain how that
interacts with Lake's artifact cache — a cache miss on mathlib costs an hour
per build.


